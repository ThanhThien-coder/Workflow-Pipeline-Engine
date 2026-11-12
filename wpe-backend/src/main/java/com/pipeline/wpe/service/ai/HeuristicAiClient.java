package com.pipeline.wpe.service.ai;

import com.pipeline.wpe.common.enums.NodeStatus;
import com.pipeline.wpe.entity.NodeDependencyEntity;
import com.pipeline.wpe.entity.NodeEntity;
import com.pipeline.wpe.entity.ProjectEntity;
import com.pipeline.wpe.entity.ProjectFeedbackEntity;
import com.pipeline.wpe.repository.NodeDependencyRepository;
import com.pipeline.wpe.service.engine.KahnDagService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class HeuristicAiClient implements AiServiceClient {

    private final NodeDependencyRepository nodeDependencyRepository;
    private final KahnDagService kahnDagService;

    @Override
    public Map<String, Object> requestDiagnosis(ProjectEntity project, List<NodeEntity> nodes, List<ProjectFeedbackEntity> openFeedbacks) {
        log.info("Executing Heuristic AI Diagnosis for project ID: {}, name: {}",
            project != null ? project.getId() : null,
            project != null ? project.getName() : null);

        List<NodeEntity> safeNodes = nodes != null ? nodes : Collections.emptyList();
        List<ProjectFeedbackEntity> safeFeedbacks = openFeedbacks != null ? openFeedbacks : Collections.emptyList();

        // 1. deps = nodeDependencyRepository.findByProjectId(project.getId())
        List<NodeDependencyEntity> deps = (project != null && project.getId() != null)
            ? nodeDependencyRepository.findByProjectId(project.getId())
            : Collections.emptyList();

        // 2. kahn = kahnDagService.validateProjectDag(nodes, deps)
        KahnDagService.ProjectKahnResult kahn = kahnDagService.validateProjectDag(safeNodes, deps);

        Map<Long, NodeEntity> nodeById = new LinkedHashMap<>();
        for (NodeEntity n : safeNodes) {
            if (n != null && n.getId() != null) {
                nodeById.put(n.getId(), n);
            }
        }

        String warning = null;
        CpmCalculator.CpmResult cpm;
        List<String> criticalPath = new ArrayList<>();
        Set<Long> criticalPathIdSet = new HashSet<>();

        if (!kahn.isValid()) {
            // Đồ thị có chu trình: không tính CPM, criticalPath rỗng, thêm warning
            warning = "Đồ thị có chu trình (" + kahn.cycleNodeCodes() + "), không tính được đường găng.";
            cpm = new CpmCalculator.CpmResult(Collections.emptyMap(), Collections.emptyList(), 0);
        } else {
            // 3. Ngược lại: cpm = CpmCalculator.calculate(nodes, deps, kahn.sortedOrder())
            cpm = CpmCalculator.calculate(safeNodes, deps, kahn.sortedOrder());
            criticalPathIdSet.addAll(cpm.criticalPathIds());
            for (Long id : cpm.criticalPathIds()) {
                NodeEntity n = nodeById.get(id);
                if (n != null && n.getCode() != null) {
                    criticalPath.add(n.getCode());
                }
            }
        }

        // 4. Instant now = Instant.now(); stalled = StalledNodeDetector.findStalled(nodes, now)
        Instant now = Instant.now();
        List<NodeEntity> stalled = StalledNodeDetector.findStalled(safeNodes, now);
        Set<Long> stalledNodeIds = new HashSet<>();
        for (NodeEntity sn : stalled) {
            if (sn.getId() != null) {
                stalledNodeIds.add(sn.getId());
            }
        }

        // Xây dựng danh sách bottlenecks và actionableAdvice
        List<Map<String, Object>> bottlenecks = new ArrayList<>();
        List<Map<String, Object>> actionableAdvice = new ArrayList<>();

        for (NodeEntity node : safeNodes) {
            if (node == null) continue;
            boolean isStalled = stalledNodeIds.contains(node.getId());
            boolean isOverdue = Boolean.TRUE.equals(node.getIsOverdue());

            if (isStalled) {
                boolean onCriticalPath = criticalPathIdSet.contains(node.getId());
                String severity = onCriticalPath ? "HIGH" : "MEDIUM";

                long hoursStalled = (node.getStartedAt() != null)
                    ? Duration.between(node.getStartedAt(), now).toHours()
                    : 0;
                int duration = (node.getEstimatedHours() == null || node.getEstimatedHours() <= 0) ? 8 : node.getEstimatedHours();
                double threshold = 2.5 * duration;
                String thresholdStr = (threshold == (long) threshold) ? String.valueOf((long) threshold) : String.valueOf(threshold);

                String reason = "Tác vụ đã ngâm " + hoursStalled + " giờ ở trạng thái IN_PROGRESS (vượt ngưỡng 2.5 × " + duration + "h = " + thresholdStr + "h).";
                if (isOverdue) {
                    reason += " Đồng thời tác vụ đã vượt quá hạn chót (due_date).";
                    severity = "HIGH";
                }

                Map<String, Object> b = new LinkedHashMap<>();
                b.put("nodeCode", node.getCode());
                b.put("title", node.getTitle());
                b.put("reason", reason);
                b.put("severity", severity);
                bottlenecks.add(b);

                Map<String, Object> advice = new LinkedHashMap<>();
                advice.put("action", "SPLIT_NODE");
                advice.put("targetNodeCode", node.getCode());
                advice.put("instruction", "Tách tác vụ " + node.getCode() + " thành 2 phần để giải phóng nhánh phụ thuộc.");
                advice.put("priority", "HIGH");
                actionableAdvice.add(advice);

            } else if (isOverdue) {
                Map<String, Object> b = new LinkedHashMap<>();
                b.put("nodeCode", node.getCode());
                b.put("title", node.getTitle());
                b.put("reason", "Tác vụ đã vượt quá hạn chót (due_date) và đang giữ chân downstream nodes.");
                b.put("severity", "HIGH");
                bottlenecks.add(b);

                Map<String, Object> advice = new LinkedHashMap<>();
                advice.put("action", "SPLIT_NODE");
                advice.put("targetNodeCode", node.getCode());
                advice.put("instruction", "Tách tác vụ " + node.getCode() + " thành 2 phần để giải phóng nhánh phụ thuộc.");
                advice.put("priority", "HIGH");
                actionableAdvice.add(advice);
            }
        }

        // Bổ sung khuyến nghị từ các phản hồi OPEN
        if (!safeFeedbacks.isEmpty()) {
            Map<String, Object> feedbackAdvice = new LinkedHashMap<>();
            feedbackAdvice.put("action", "RESOLVE_FEEDBACK");
            feedbackAdvice.put("targetNodeCode", "GENERAL");
            feedbackAdvice.put("instruction", "Dự án hiện có " + safeFeedbacks.size() + " ý kiến đóng góp chưa giải quyết tại Feedback Queue.");
            feedbackAdvice.put("priority", "MEDIUM");
            actionableAdvice.add(feedbackAdvice);
        }

        // Khối fallback khi không có điểm nghẽn
        if (bottlenecks.isEmpty()) {
            Map<String, Object> fallback = new LinkedHashMap<>();
            fallback.put("nodeCode", !safeNodes.isEmpty() ? safeNodes.get(0).getCode() : "N/A");
            fallback.put("title", !safeNodes.isEmpty() ? safeNodes.get(0).getTitle() : "Tác vụ khởi đầu");
            fallback.put("reason", "Tiến độ đang trong tầm kiểm soát ổn định (DriftScore < 20%).");
            fallback.put("severity", "LOW");
            bottlenecks.add(fallback);

            Map<String, Object> fallbackAdvice = new LinkedHashMap<>();
            fallbackAdvice.put("action", "CONTINUE_PIPELINE");
            fallbackAdvice.put("targetNodeCode", "GENERAL");
            fallbackAdvice.put("instruction", "Duy trì nhịp độ thực hiện tác vụ theo đúng đường găng CPM.");
            fallbackAdvice.put("priority", "LOW");
            actionableAdvice.add(fallbackAdvice);
        }

        // taskTraps: mỗi node ngâm 1 phần tử trapType = "STALLED_NODE"
        List<Map<String, Object>> taskTraps = new ArrayList<>();
        for (NodeEntity sn : stalled) {
            Map<String, Object> trap = new LinkedHashMap<>();
            trap.put("nodeCode", sn.getCode());
            trap.put("title", sn.getTitle());
            trap.put("trapType", "STALLED_NODE");
            trap.put("suggestion", "Nên phân rã nhỏ phạm vi công việc hoặc bổ sung người phối hợp pair-programming.");
            taskTraps.add(trap);
        }

        // metrics: giữ 4 key cũ, thêm projectDurationHours và stalledCount
        boolean hasRealBottlenecks = !stalled.isEmpty() || safeNodes.stream().anyMatch(n -> Boolean.TRUE.equals(n.getIsOverdue()));
        int realBottleneckCount = hasRealBottlenecks ? bottlenecks.size() : 0;

        Map<String, Object> metrics = new LinkedHashMap<>();
        metrics.put("targetVelocity", 2.0);
        metrics.put("actualVelocity", 1.8);
        metrics.put("driftScore", realBottleneckCount > 1 ? 45.0 : 15.0);
        metrics.put("status", realBottleneckCount > 1 ? "RED_ALERT" : "STABLE_GREEN");
        metrics.put("projectDurationHours", cpm.projectDurationHours());
        metrics.put("stalledCount", stalled.size());

        // cpm: list các map {nodeCode, es, ef, ls, lf, slack, onCriticalPath} theo thứ tự topo
        List<Map<String, Object>> cpmList = new ArrayList<>();
        if (kahn.isValid() && kahn.sortedOrder() != null) {
            for (Long nodeId : kahn.sortedOrder()) {
                CpmCalculator.NodeTiming timing = cpm.timings().get(nodeId);
                NodeEntity node = nodeById.get(nodeId);
                if (timing != null && node != null) {
                    Map<String, Object> nodeCpm = new LinkedHashMap<>();
                    nodeCpm.put("nodeCode", node.getCode() != null ? node.getCode() : "NODE-" + nodeId);
                    nodeCpm.put("es", timing.es());
                    nodeCpm.put("ef", timing.ef());
                    nodeCpm.put("ls", timing.ls());
                    nodeCpm.put("lf", timing.lf());
                    nodeCpm.put("slack", timing.slack());
                    nodeCpm.put("onCriticalPath", timing.slack() == 0);
                    cpmList.add(nodeCpm);
                }
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("analyzedAt", now.toString());
        result.put("source", "HEURISTIC");
        if (warning != null) {
            result.put("warning", warning);
        }
        result.put("bottlenecks", bottlenecks);
        result.put("taskTraps", taskTraps);
        result.put("criticalPath", criticalPath);
        result.put("actionableAdvice", actionableAdvice);
        result.put("metrics", metrics);
        result.put("cpm", cpmList);

        return result;
    }
}
