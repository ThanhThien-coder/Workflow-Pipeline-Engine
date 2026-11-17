package com.pipeline.wpe.service.engine;

import com.pipeline.wpe.entity.NodeDependencyEntity;

import java.util.ArrayDeque;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Định nghĩa đường găng DUY NHẤT cho mọi màn hình: số node trên chuỗi phụ thuộc dài nhất.
 * Khớp với computeCriticalPathLength của Overview (wpe-frontend/src/services/impl/http/overview.ts):
 *   - đồ thị rỗng = 0, có ít nhất 1 node = tối thiểu 1;
 *   - bỏ qua cạnh tự trỏ và cạnh trỏ tới node không thuộc tập node;
 *   - chỉ tính phụ thuộc giữa NODE (không tính phụ thuộc giữa phase);
 *   - có vòng thì không treo: node nằm trong vòng không được xếp hàng xử lý (thuật toán Kahn).
 */
public final class CriticalPathCalculator {

    private CriticalPathCalculator() {}

    public static int compute(Collection<Long> nodeIds, Collection<NodeDependencyEntity> dependencies) {
        if (nodeIds == null || nodeIds.isEmpty()) {
            return 0;
        }
        Set<Long> ids = new HashSet<>(nodeIds);
        Map<Long, Integer> inDegree = new HashMap<>();
        Map<Long, List<Long>> adj = new HashMap<>();
        Map<Long, Integer> dist = new HashMap<>();
        for (Long id : ids) {
            inDegree.put(id, 0);
            adj.put(id, new java.util.ArrayList<>());
            dist.put(id, 1);
        }

        if (dependencies != null) {
            for (NodeDependencyEntity dep : dependencies) {
                Long parent = dep.getParentNodeId();
                Long child = dep.getChildNodeId();
                if (parent == null || child == null || parent.equals(child)
                    || !ids.contains(parent) || !ids.contains(child)) {
                    continue;
                }
                adj.get(parent).add(child);
                inDegree.merge(child, 1, Integer::sum);
            }
        }

        ArrayDeque<Long> queue = new ArrayDeque<>();
        for (Map.Entry<Long, Integer> e : inDegree.entrySet()) {
            if (e.getValue() == 0) {
                queue.add(e.getKey());
            }
        }

        int maxLen = 1;
        while (!queue.isEmpty()) {
            Long current = queue.poll();
            int currentDist = dist.get(current);
            if (currentDist > maxLen) {
                maxLen = currentDist;
            }
            for (Long next : adj.get(current)) {
                int candidate = currentDist + 1;
                if (candidate > dist.get(next)) {
                    dist.put(next, candidate);
                    if (candidate > maxLen) {
                        maxLen = candidate;
                    }
                }
                int nextDeg = inDegree.get(next) - 1;
                inDegree.put(next, nextDeg);
                if (nextDeg == 0) {
                    queue.add(next);
                }
            }
        }
        return maxLen;
    }
}
