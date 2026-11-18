package com.pipeline.wpe.service.engine;

import java.util.*;

/**
 * Tìm node nằm trên chu trình bằng thành phần liên thông mạnh (SCC, thuật toán Tarjan viết lặp, không đệ quy
 * nên đồ thị rất lớn không tràn stack). Một node "nằm trên chu trình" khi và chỉ khi nó thuộc SCC có từ 2 node
 * trở lên, hoặc có cạnh tự nối chính nó. Độ phức tạp O(V + E).
 */
public final class CycleNodeFinder {

    private CycleNodeFinder() {}

    /**
     * @param vertices  danh sách node
     * @param adjacency danh sách kề (cạnh trỏ tới node ngoài {@code vertices} bị bỏ qua; cạnh trùng không ảnh hưởng)
     * @return tập node nằm trên chu trình
     */
    public static <T> Set<T> findNodesOnCycle(Collection<T> vertices, Map<T, ? extends List<T>> adjacency) {
        Map<T, Integer> index = new HashMap<>();
        Map<T, Integer> low = new HashMap<>();
        Set<T> onStack = new HashSet<>();
        Deque<T> stack = new ArrayDeque<>();
        Set<T> vertexSet = new HashSet<>(vertices);
        Set<T> result = new HashSet<>();
        int counter = 0;

        for (T root : vertices) {
            if (index.containsKey(root)) continue;

            Deque<T> callStack = new ArrayDeque<>();
            Map<T, Iterator<T>> iterators = new HashMap<>();
            index.put(root, counter);
            low.put(root, counter++);
            stack.push(root);
            onStack.add(root);
            callStack.push(root);
            iterators.put(root, neighbors(adjacency, root).iterator());

            while (!callStack.isEmpty()) {
                T v = callStack.peek();
                Iterator<T> it = iterators.get(v);
                if (it.hasNext()) {
                    T w = it.next();
                    if (!vertexSet.contains(w)) continue;
                    if (w.equals(v)) {
                        result.add(v); // cạnh tự nối
                    }
                    if (!index.containsKey(w)) {
                        index.put(w, counter);
                        low.put(w, counter++);
                        stack.push(w);
                        onStack.add(w);
                        callStack.push(w);
                        iterators.put(w, neighbors(adjacency, w).iterator());
                    } else if (onStack.contains(w)) {
                        low.put(v, Math.min(low.get(v), index.get(w)));
                    }
                } else {
                    callStack.pop();
                    iterators.remove(v);
                    if (low.get(v).equals(index.get(v))) {
                        List<T> component = new ArrayList<>();
                        T w;
                        do {
                            w = stack.pop();
                            onStack.remove(w);
                            component.add(w);
                        } while (!w.equals(v));
                        if (component.size() >= 2) {
                            result.addAll(component);
                        }
                    }
                    if (!callStack.isEmpty()) {
                        T parent = callStack.peek();
                        low.put(parent, Math.min(low.get(parent), low.get(v)));
                    }
                }
            }
        }
        return result;
    }

    private static <T> List<T> neighbors(Map<T, ? extends List<T>> adjacency, T v) {
        List<T> list = adjacency.get(v);
        return list == null ? Collections.emptyList() : list;
    }
}
