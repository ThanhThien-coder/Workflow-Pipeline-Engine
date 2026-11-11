package com.pipeline.wpe.service.ai;

import com.pipeline.wpe.entity.NodeDependencyEntity;
import com.pipeline.wpe.entity.NodeEntity;

import java.util.*;

public final class CpmCalculator {

    public record NodeTiming(int es, int ef, int ls, int lf, int slack) {}

    public record CpmResult(Map<Long, NodeTiming> timings, List<Long> criticalPathIds, int projectDurationHours) {}

    private CpmCalculator() {
        // Lớp chỉ chứa các hàm static thuần, không khởi tạo đối tượng
    }

    /**
     * Tính toán đường găng (Critical Path Method - CPM) cho đồ thị công việc dự án.
     *
     * @param nodes Danh sách các nút công việc
     * @param dependencies Danh sách quan hệ phụ thuộc giữa các nút (cha -> con)
     * @param sortedOrder Thứ tự sắp xếp topo (Kahn topological sort)
     * @return CpmResult chứa timings của từng node, danh sách node trên đường găng và tổng thời lượng dự án
     */
    public static CpmResult calculate(List<NodeEntity> nodes, List<NodeDependencyEntity> dependencies, List<Long> sortedOrder) {
        if (nodes == null || nodes.isEmpty() || sortedOrder == null || sortedOrder.isEmpty()) {
            return new CpmResult(Collections.emptyMap(), Collections.emptyList(), 0);
        }

        Map<Long, NodeEntity> nodeMap = new HashMap<>();
        for (NodeEntity node : nodes) {
            if (node != null && node.getId() != null) {
                nodeMap.put(node.getId(), node);
            }
        }

        // Khởi tạo danh sách cha (parents) và con (children) cho từng node
        Map<Long, List<Long>> parentsMap = new HashMap<>();
        Map<Long, List<Long>> childrenMap = new HashMap<>();
        for (Long id : nodeMap.keySet()) {
            parentsMap.put(id, new ArrayList<>());
            childrenMap.put(id, new ArrayList<>());
        }

        if (dependencies != null) {
            for (NodeDependencyEntity dep : dependencies) {
                if (dep == null) continue;
                Long parentId = dep.getParentNodeId();
                Long childId = dep.getChildNodeId();
                // Bỏ qua cạnh có đầu mút không thuộc nodes
                if (parentId != null && childId != null && nodeMap.containsKey(parentId) && nodeMap.containsKey(childId)) {
                    parentsMap.get(childId).add(parentId);
                    childrenMap.get(parentId).add(childId);
                }
            }
        }

        // Forward pass theo sortedOrder: ES = max(EF của các cha), EF = ES + duration
        Map<Long, Integer> esMap = new HashMap<>();
        Map<Long, Integer> efMap = new HashMap<>();
        int projectDurationHours = 0;

        for (Long id : sortedOrder) {
            if (!nodeMap.containsKey(id)) continue;
            NodeEntity node = nodeMap.get(id);
            int duration = getDuration(node);

            List<Long> parents = parentsMap.getOrDefault(id, Collections.emptyList());
            int es = 0;
            if (!parents.isEmpty()) {
                for (Long pId : parents) {
                    Integer parentEf = efMap.get(pId);
                    if (parentEf != null && parentEf > es) {
                        es = parentEf;
                    }
                }
            }
            int ef = es + duration;
            esMap.put(id, es);
            efMap.put(id, ef);
            if (ef > projectDurationHours) {
                projectDurationHours = ef;
            }
        }

        // Backward pass theo thứ tự NGƯỢC: LF = min(LS của các con), LS = LF - duration, slack = LS - ES
        Map<Long, Integer> lsMap = new HashMap<>();
        Map<Long, Integer> lfMap = new HashMap<>();
        Map<Long, Integer> slackMap = new HashMap<>();

        for (int i = sortedOrder.size() - 1; i >= 0; i--) {
            Long id = sortedOrder.get(i);
            if (!nodeMap.containsKey(id)) continue;
            NodeEntity node = nodeMap.get(id);
            int duration = getDuration(node);

            List<Long> children = childrenMap.getOrDefault(id, Collections.emptyList());
            int lf;
            if (children.isEmpty()) {
                lf = projectDurationHours;
            } else {
                int minLs = Integer.MAX_VALUE;
                for (Long cId : children) {
                    Integer childLs = lsMap.get(cId);
                    if (childLs != null && childLs < minLs) {
                        minLs = childLs;
                    }
                }
                lf = (minLs == Integer.MAX_VALUE) ? projectDurationHours : minLs;
            }
            int ls = lf - duration;
            int es = esMap.getOrDefault(id, 0);
            int slack = ls - es;

            lsMap.put(id, ls);
            lfMap.put(id, lf);
            slackMap.put(id, slack);
        }

        // Tập hợp timings và criticalPathIds giữ đúng thứ tự sortedOrder
        Map<Long, NodeTiming> timings = new LinkedHashMap<>();
        List<Long> criticalPathIds = new ArrayList<>();

        for (Long id : sortedOrder) {
            if (!nodeMap.containsKey(id)) continue;
            int es = esMap.getOrDefault(id, 0);
            int ef = efMap.getOrDefault(id, 0);
            int ls = lsMap.getOrDefault(id, 0);
            int lf = lfMap.getOrDefault(id, 0);
            int slack = slackMap.getOrDefault(id, 0);

            timings.put(id, new NodeTiming(es, ef, ls, lf, slack));
            if (slack == 0) {
                criticalPathIds.add(id);
            }
        }

        return new CpmResult(timings, criticalPathIds, projectDurationHours);
    }

    private static int getDuration(NodeEntity node) {
        if (node == null) return 8;
        Integer hours = node.getEstimatedHours();
        return (hours == null || hours <= 0) ? 8 : hours;
    }
}
