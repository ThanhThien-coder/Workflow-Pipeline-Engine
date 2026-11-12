package com.pipeline.wpe.service.ai;

import com.pipeline.wpe.common.enums.NodeStatus;
import com.pipeline.wpe.entity.NodeEntity;
import com.pipeline.wpe.entity.ProjectEntity;
import com.pipeline.wpe.entity.ProjectFeedbackEntity;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;

/**
 * Cài đặt giả, dùng khi app.ai.mode=mock (mặc định) hoặc làm dự phòng khi microservice lỗi.
 */
@Slf4j
@Service
@ConditionalOnProperty(prefix = "app.ai", name = "mode", havingValue = "mock", matchIfMissing = true)
public class AiServiceClientImpl implements AiServiceClient {

    public AiServiceClientImpl() {
    }

    @Override
    public Map<String, Object> requestDiagnosis(ProjectEntity project, List<NodeEntity> nodes, List<ProjectFeedbackEntity> openFeedbacks) {
        log.info("Requesting AI Diagnosis for project ID: {}, name: {}",
            project != null ? project.getId() : null,
            project != null ? project.getName() : null);

        // Phát hiện các điểm nghẽn (Bottlenecks) dựa trên phân tích dữ liệu thực tế:
        List<Map<String, Object>> bottlenecks = new ArrayList<>();
        List<Map<String, Object>> taskTraps = new ArrayList<>();
        List<Map<String, Object>> actionableAdvice = new ArrayList<>();
        List<String> criticalPath = new ArrayList<>();

        if (nodes != null) {
            // Tìm các node đang bị quá hạn hoặc bị ngâm
            for (NodeEntity node : nodes) {
                criticalPath.add(node.getCode());

                if (Boolean.TRUE.equals(node.getIsOverdue()) || node.getStatus() == NodeStatus.IN_PROGRESS) {
                    bottlenecks.add(Map.of(
                        "nodeCode", node.getCode(),
                        "title", node.getTitle(),
                        "reason", Boolean.TRUE.equals(node.getIsOverdue())
                            ? "Tác vụ đã vượt quá hạn chót (due_date) và đang giữ chân downstream nodes."
                            : "Tác vụ đang ngâm ở trạng thái IN_PROGRESS cần đẩy nhanh tiến độ.",
                        "severity", "HIGH"
                    ));

                    taskTraps.add(Map.of(
                        "nodeCode", node.getCode(),
                        "title", node.getTitle(),
                        "trapType", "POTENTIAL_STALL",
                        "suggestion", "Nên phân rã nhỏ phạm vi công việc hoặc bổ sung người phối hợp pair-programming."
                    ));

                    actionableAdvice.add(Map.of(
                        "action", "SPLIT_NODE",
                        "targetNodeCode", node.getCode(),
                        "instruction", "Tách tác vụ " + node.getCode() + " thành 2 phần để giải phóng nhánh phụ thuộc.",
                        "priority", "HIGH"
                    ));
                }
            }
        }

        // Bổ sung khuyến nghị từ các phản hồi OPEN của giáo viên/khách
        if (openFeedbacks != null && !openFeedbacks.isEmpty()) {
            actionableAdvice.add(Map.of(
                "action", "RESOLVE_FEEDBACK",
                "targetNodeCode", "GENERAL",
                "instruction", "Dự án hiện có " + openFeedbacks.size() + " ý kiến đóng góp chưa giải quyết tại Feedback Queue.",
                "priority", "MEDIUM"
            ));
        }

        if (bottlenecks.isEmpty()) {
            bottlenecks.add(Map.of(
                "nodeCode", (nodes != null && !nodes.isEmpty()) ? nodes.get(0).getCode() : "N/A",
                "title", (nodes != null && !nodes.isEmpty()) ? nodes.get(0).getTitle() : "Tác vụ khởi đầu",
                "reason", "Tiến độ đang trong tầm kiểm soát ổn định (DriftScore < 20%).",
                "severity", "LOW"
            ));
            actionableAdvice.add(Map.of(
                "action", "CONTINUE_PIPELINE",
                "targetNodeCode", "GENERAL",
                "instruction", "Duy trì nhịp độ thực hiện tác vụ theo đúng đường găng CPM.",
                "priority", "LOW"
            ));
        }

        Map<String, Object> metrics = Map.of(
            "targetVelocity", 2.0,
            "actualVelocity", 1.8,
            "driftScore", bottlenecks.size() > 1 ? 45.0 : 15.0,
            "status", bottlenecks.size() > 1 ? "RED_ALERT" : "STABLE_GREEN"
        );

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("analyzedAt", Instant.now().toString());
        result.put("bottlenecks", bottlenecks);
        result.put("taskTraps", taskTraps);
        result.put("criticalPath", criticalPath);
        result.put("actionableAdvice", actionableAdvice);
        result.put("metrics", metrics);
        result.put("source", "MOCK");

        return result;
    }
}
