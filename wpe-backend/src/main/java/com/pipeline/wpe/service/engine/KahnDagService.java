package com.pipeline.wpe.service.engine;

import com.pipeline.wpe.dto.response.template.DagValidationResponse;
import com.pipeline.wpe.dto.response.template.DagValidationResponse.DagViolationItem;
import com.pipeline.wpe.entity.NodeDependencyEntity;
import com.pipeline.wpe.entity.NodeEntity;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;

@Slf4j
@Service
public class KahnDagService {

    public record ProjectKahnResult(
        boolean isValid,
        int visitedCount,
        int totalNodes,
        Set<Long> rootNodeIds,
        /** Mã các node nằm trên chu trình (hoặc nằm giữa 2 chu trình). Không gồm node chỉ đứng sau chu trình. */
        List<String> cycleNodeCodes,
        /** Thứ tự topo theo id node. Rỗng nếu đồ thị có chu trình. */
        List<Long> sortedOrder,
        /** Mã mọi node không duyệt được (còn in-degree > 0): node trên chu trình và node đứng sau chu trình. */
        List<String> blockedNodeCodes
    ) {}

    /**
     * Thuật toán Kahn kiểm tra chu trình, tìm root nodes và thứ tự topo cho dự án (O(V + E)).
     * <p>
     * Thứ tự ổn định: nhiều node cùng in-degree 0 thì lấy node có id nhỏ hơn trước.
     * Cạnh có đầu mút không nằm trong danh sách {@code nodes} thì bị bỏ qua.
     */
    public ProjectKahnResult validateProjectDag(List<NodeEntity> nodes, List<NodeDependencyEntity> dependencies) {
        if (nodes == null || nodes.isEmpty()) {
            return new ProjectKahnResult(true, 0, 0, Collections.emptySet(), Collections.emptyList(),
                Collections.emptyList(), Collections.emptyList());
        }

        Map<Long, Integer> inDegree = new HashMap<>();
        Map<Long, List<Long>> adjacencyList = new HashMap<>();
        Map<Long, String> nodeCodeMap = new HashMap<>();

        for (NodeEntity node : nodes) {
            inDegree.put(node.getId(), 0);
            adjacencyList.put(node.getId(), new ArrayList<>());
            nodeCodeMap.put(node.getId(), node.getCode() != null ? node.getCode() : "NODE-" + node.getId());
        }

        if (dependencies != null) {
            for (NodeDependencyEntity dep : dependencies) {
                Long parent = dep.getParentNodeId();
                Long child = dep.getChildNodeId();

                // Chỉ tính cạnh có cả 2 đầu mút nằm trong đồ thị. Nếu tính cạnh có cha lạ,
                // node con sẽ không bao giờ về in-degree 0 và bị báo chu trình giả.
                if (inDegree.containsKey(parent) && inDegree.containsKey(child)) {
                    inDegree.put(child, inDegree.get(child) + 1);
                    adjacencyList.get(parent).add(child);
                }
            }
        }

        // Hàng đợi ưu tiên theo id tăng dần để kết quả không phụ thuộc thứ tự duyệt của HashMap.
        Set<Long> rootNodeIds = new TreeSet<>();
        PriorityQueue<Long> queue = new PriorityQueue<>();
        for (Map.Entry<Long, Integer> entry : inDegree.entrySet()) {
            if (entry.getValue() == 0) {
                rootNodeIds.add(entry.getKey());
                queue.add(entry.getKey());
            }
        }

        List<Long> sortedOrder = new ArrayList<>(nodes.size());
        while (!queue.isEmpty()) {
            Long current = queue.poll();
            sortedOrder.add(current);

            for (Long neighbor : adjacencyList.get(current)) {
                int newDegree = inDegree.get(neighbor) - 1;
                inDegree.put(neighbor, newDegree);
                if (newDegree == 0) {
                    queue.add(neighbor);
                }
            }
        }

        int visitedCount = sortedOrder.size();
        boolean isValid = (visitedCount == inDegree.size());
        if (isValid) {
            return new ProjectKahnResult(true, visitedCount, nodes.size(), rootNodeIds,
                Collections.emptyList(), sortedOrder, Collections.emptyList());
        }

        // Node bị chặn = node còn in-degree > 0 sau khi chạy Kahn (xếp theo id tăng dần).
        Set<Long> blockedIds = new TreeSet<>();
        for (Map.Entry<Long, Integer> entry : inDegree.entrySet()) {
            if (entry.getValue() > 0) {
                blockedIds.add(entry.getKey());
            }
        }
        Set<Long> cycleIds = peelNodesBehindCycle(blockedIds, adjacencyList);

        List<String> blockedNodeCodes = toCodes(blockedIds, nodeCodeMap);
        List<String> cycleNodeCodes = toCodes(cycleIds, nodeCodeMap);
        log.warn("Kahn Cycle Detection: Phát hiện chu trình lặp tại {} nodes: {} (tổng số node bị chặn: {})",
            cycleNodeCodes.size(), cycleNodeCodes, blockedNodeCodes.size());

        return new ProjectKahnResult(false, visitedCount, nodes.size(), rootNodeIds,
            cycleNodeCodes, Collections.emptyList(), blockedNodeCodes);
    }

    /**
     * Kiểm tra: nếu thêm cạnh parentId -> childId vào đồ thị hiện có thì có tạo chu trình không (O(V + E)).
     * <p>
     * Thêm cạnh parent -> child tạo vòng khi và chỉ khi đã có đường đi từ child tới parent.
     * Vì vậy chỉ cần duyệt theo chiều rộng từ child, gặp parent thì trả true.
     *
     * @return true nếu tạo chu trình, kể cả trường hợp parentId bằng childId
     */
    public boolean wouldCreateCycle(List<NodeEntity> nodes, List<NodeDependencyEntity> dependencies,
                                    Long parentId, Long childId) {
        if (parentId == null || childId == null) {
            return false;
        }
        if (parentId.equals(childId)) {
            return true;
        }

        Set<Long> nodeIds = new HashSet<>();
        if (nodes != null) {
            for (NodeEntity node : nodes) {
                nodeIds.add(node.getId());
            }
        }

        Map<Long, List<Long>> adjacencyList = new HashMap<>();
        if (dependencies != null) {
            for (NodeDependencyEntity dep : dependencies) {
                Long from = dep.getParentNodeId();
                Long to = dep.getChildNodeId();
                if (nodeIds.contains(from) && nodeIds.contains(to)) {
                    adjacencyList.computeIfAbsent(from, k -> new ArrayList<>()).add(to);
                }
            }
        }

        Set<Long> visited = new HashSet<>();
        Queue<Long> queue = new ArrayDeque<>();
        queue.add(childId);
        visited.add(childId);
        while (!queue.isEmpty()) {
            Long current = queue.poll();
            for (Long next : adjacencyList.getOrDefault(current, Collections.emptyList())) {
                if (next.equals(parentId)) {
                    return true;
                }
                if (visited.add(next)) {
                    queue.add(next);
                }
            }
        }
        return false;
    }

    /**
     * "Bóc ngược": từ tập node bị chặn, bỏ dần các node không còn cạnh đi ra tới node khác trong tập.
     * Node như vậy chỉ đứng sau chu trình chứ không nằm trên chu trình. Phần còn lại là node nằm trên
     * chu trình, hoặc nằm trên đường nối giữa 2 chu trình (hạn chế đã biết).
     */
    private Set<Long> peelNodesBehindCycle(Set<Long> blockedIds, Map<Long, List<Long>> adjacencyList) {
        // outDegree: số cạnh đi ra tới node còn trong tập. parents: cạnh ngược, để cập nhật khi bỏ một node.
        Map<Long, Integer> outDegree = new HashMap<>();
        Map<Long, List<Long>> parents = new HashMap<>();
        for (Long id : blockedIds) {
            outDegree.put(id, 0);
            parents.put(id, new ArrayList<>());
        }
        for (Long from : blockedIds) {
            for (Long to : adjacencyList.get(from)) {
                if (blockedIds.contains(to)) {
                    outDegree.put(from, outDegree.get(from) + 1);
                    parents.get(to).add(from);
                }
            }
        }

        Queue<Long> queue = new ArrayDeque<>();
        for (Map.Entry<Long, Integer> entry : outDegree.entrySet()) {
            if (entry.getValue() == 0) {
                queue.add(entry.getKey());
            }
        }

        Set<Long> remaining = new TreeSet<>(blockedIds);
        while (!queue.isEmpty()) {
            Long removed = queue.poll();
            remaining.remove(removed);
            for (Long parent : parents.get(removed)) {
                int newDegree = outDegree.get(parent) - 1;
                outDegree.put(parent, newDegree);
                if (newDegree == 0) {
                    queue.add(parent);
                }
            }
        }
        return remaining;
    }

    private List<String> toCodes(Collection<Long> ids, Map<Long, String> nodeCodeMap) {
        List<String> codes = new ArrayList<>(ids.size());
        for (Long id : ids) {
            codes.add(nodeCodeMap.getOrDefault(id, "NODE-" + id));
        }
        return codes;
    }

    /**
     * Thẩm định đồ thị mẫu 2 tầng (Level 1: Phase DAG, Level 2: Node DAG theo từng Phase)
     * Phục vụ Admin Template Studio khớp với Frontend template.types.ts
     */
    @SuppressWarnings("unchecked")
    public DagValidationResponse validateTemplateGraph(Map<String, Object> graphData) {
        if (graphData == null || graphData.isEmpty()) {
            return new DagValidationResponse(true, 0, 0, Collections.emptyList());
        }

        List<DagViolationItem> violations = new ArrayList<>();
        int totalCount = 0;
        int visitedCount = 0;

        // 1. Level 1: Macro Phase DAG
        List<Map<String, Object>> phases = (List<Map<String, Object>>) graphData.getOrDefault("phases", Collections.emptyList());
        List<Map<String, Object>> phaseEdges = (List<Map<String, Object>>) graphData.getOrDefault("phaseEdges", Collections.emptyList());

        List<String> phaseIds = new ArrayList<>();
        for (Map<String, Object> p : phases) {
            Object idObj = p.get("id");
            if (idObj != null) phaseIds.add(idObj.toString());
        }
        totalCount += phaseIds.size();

        List<Map.Entry<String, String>> macroEdges = new ArrayList<>();
        for (Map<String, Object> pe : phaseEdges) {
            Object parentObj = pe.get("parentPhaseId") != null ? pe.get("parentPhaseId") : pe.get("source");
            Object childObj = pe.get("childPhaseId") != null ? pe.get("childPhaseId") : pe.get("target");
            if (parentObj != null && childObj != null) {
                macroEdges.add(Map.entry(parentObj.toString(), childObj.toString()));
            }
        }

        // Cũng thu thập các cạnh phase từ mảng runsAfter nếu có
        for (Map<String, Object> p : phases) {
            Object childId = p.get("id");
            if (childId != null && p.get("runsAfter") instanceof List<?> runsAfterList) {
                for (Object parentObj : runsAfterList) {
                    if (parentObj != null) {
                        macroEdges.add(Map.entry(parentObj.toString(), childId.toString()));
                    }
                }
            }
        }

        KahnBasicResult phaseResult = validateSimpleDag(phaseIds, macroEdges);
        visitedCount += (phaseIds.size() - phaseResult.cycleNodes.size());
        if (!phaseResult.isValid) {
            violations.add(new DagViolationItem("PHASE", null, phaseResult.cycleNodes));
        }

        // 2. Level 2: Micro Node DAG within each Phase
        List<Map<String, Object>> nodes = (List<Map<String, Object>>) graphData.getOrDefault("nodes", Collections.emptyList());
        List<Map<String, Object>> edges = (List<Map<String, Object>>) graphData.getOrDefault("edges", Collections.emptyList());

        for (String phaseId : phaseIds) {
            List<String> phaseNodeIds = new ArrayList<>();
            List<Map.Entry<String, String>> nodeEdges = new ArrayList<>();

            for (Map<String, Object> n : nodes) {
                Object pIdObj = n.get("phaseId");
                Object nIdObj = n.get("id");
                if (pIdObj != null && phaseId.equals(pIdObj.toString()) && nIdObj != null) {
                    String nId = nIdObj.toString();
                    phaseNodeIds.add(nId);

                    // 2a. Implicit tree edges (parentId -> id)
                    Object parentIdObj = n.get("parentId");
                    if (parentIdObj != null) {
                        String parentId = parentIdObj.toString();
                        if (!parentId.isBlank()) {
                            nodeEdges.add(Map.entry(parentId, nId));
                        }
                    }
                }
            }

            totalCount += phaseNodeIds.size();
            if (phaseNodeIds.isEmpty()) {
                continue;
            }

            // 2b. Explicit edges (hỗ trợ cả parentId/childId và source/target)
            for (Map<String, Object> e : edges) {
                Object pObj = e.get("parentId") != null ? e.get("parentId") : e.get("source");
                Object cObj = e.get("childId") != null ? e.get("childId") : e.get("target");
                if (pObj != null && cObj != null) {
                    String p = pObj.toString();
                    String c = cObj.toString();
                    if (phaseNodeIds.contains(p) && phaseNodeIds.contains(c)) {
                        nodeEdges.add(Map.entry(p, c));
                    }
                }
            }

            KahnBasicResult nodeResult = validateSimpleDag(phaseNodeIds, nodeEdges);
            visitedCount += (phaseNodeIds.size() - nodeResult.cycleNodes.size());
            if (!nodeResult.isValid) {
                violations.add(new DagViolationItem("NODE", phaseId, nodeResult.cycleNodes));
            }
        }

        boolean valid = violations.isEmpty();
        return new DagValidationResponse(valid, visitedCount, totalCount, violations);
    }

    private KahnBasicResult validateSimpleDag(Collection<String> vertices, Collection<Map.Entry<String, String>> edges) {
        Map<String, Integer> inDegree = new HashMap<>();
        Map<String, List<String>> adj = new HashMap<>();
        Set<String> vertexSet = new HashSet<>(vertices);

        for (String v : vertices) {
            inDegree.put(v, 0);
            adj.put(v, new ArrayList<>());
        }

        for (Map.Entry<String, String> edge : edges) {
            String from = edge.getKey();
            String to = edge.getValue();
            if (vertexSet.contains(from) && vertexSet.contains(to)) {
                inDegree.put(to, inDegree.get(to) + 1);
                adj.get(from).add(to);
            }
        }

        Queue<String> queue = new ArrayDeque<>();
        for (Map.Entry<String, Integer> entry : inDegree.entrySet()) {
            if (entry.getValue() == 0) {
                queue.add(entry.getKey());
            }
        }

        int visited = 0;
        while (!queue.isEmpty()) {
            String u = queue.poll();
            visited++;
            for (String neighbor : adj.getOrDefault(u, Collections.emptyList())) {
                int next = inDegree.get(neighbor) - 1;
                inDegree.put(neighbor, next);
                if (next == 0) {
                    queue.add(neighbor);
                }
            }
        }

        List<String> cycleNodes = new ArrayList<>();
        if (visited != vertices.size()) {
            for (Map.Entry<String, Integer> entry : inDegree.entrySet()) {
                if (entry.getValue() > 0) {
                    cycleNodes.add(entry.getKey());
                }
            }
        }

        return new KahnBasicResult(visited == vertices.size(), visited, vertices.size(), cycleNodes);
    }

    public record KahnBasicResult(boolean isValid, int visitedCount, int totalCount, List<String> cycleNodes) {}
}
