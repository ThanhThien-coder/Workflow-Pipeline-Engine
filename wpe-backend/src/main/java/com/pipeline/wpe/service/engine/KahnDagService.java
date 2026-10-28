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
        List<String> cycleNodeCodes
    ) {}

    /**
     * Thuật toán Kahn kiểm tra chu trình và tìm root nodes cho dự án (O(V + E))
     */
    public ProjectKahnResult validateProjectDag(List<NodeEntity> nodes, List<NodeDependencyEntity> dependencies) {
        if (nodes == null || nodes.isEmpty()) {
            return new ProjectKahnResult(true, 0, 0, Collections.emptySet(), Collections.emptyList());
        }

        Map<Long, Integer> inDegree = new HashMap<>();
        Map<Long, List<Long>> adjacencyList = new HashMap<>();
        Map<Long, String> nodeCodeMap = new HashMap<>();

        for (NodeEntity node : nodes) {
            inDegree.put(node.getId(), 0);
            adjacencyList.put(node.getId(), new ArrayList<>());
            nodeCodeMap.put(node.getId(), node.getCode() != null ? node.getCode() : "NODE-" + node.getId());
        }

        for (NodeDependencyEntity dep : dependencies) {
            Long parent = dep.getParentNodeId();
            Long child = dep.getChildNodeId();

            if (inDegree.containsKey(child)) {
                inDegree.put(child, inDegree.get(child) + 1);
            }
            if (adjacencyList.containsKey(parent)) {
                adjacencyList.get(parent).add(child);
            }
        }

        Set<Long> rootNodeIds = new HashSet<>();
        Queue<Long> queue = new ArrayDeque<>();
        for (Map.Entry<Long, Integer> entry : inDegree.entrySet()) {
            if (entry.getValue() == 0) {
                rootNodeIds.add(entry.getKey());
                queue.add(entry.getKey());
            }
        }

        int visitedCount = 0;
        while (!queue.isEmpty()) {
            Long current = queue.poll();
            visitedCount++;

            List<Long> neighbors = adjacencyList.getOrDefault(current, Collections.emptyList());
            for (Long neighbor : neighbors) {
                int newDegree = inDegree.get(neighbor) - 1;
                inDegree.put(neighbor, newDegree);
                if (newDegree == 0) {
                    queue.add(neighbor);
                }
            }
        }

        boolean isValid = (visitedCount == nodes.size());
        List<String> cycleNodeCodes = new ArrayList<>();

        if (!isValid) {
            for (Map.Entry<Long, Integer> entry : inDegree.entrySet()) {
                if (entry.getValue() > 0) {
                    cycleNodeCodes.add(nodeCodeMap.getOrDefault(entry.getKey(), "NODE-" + entry.getKey()));
                }
            }
            log.warn("Kahn Cycle Detection: Phát hiện chu trình lặp tại {} nodes: {}", cycleNodeCodes.size(), cycleNodeCodes);
        }

        return new ProjectKahnResult(isValid, visitedCount, nodes.size(), rootNodeIds, cycleNodeCodes);
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
