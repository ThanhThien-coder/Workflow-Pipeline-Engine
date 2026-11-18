package com.pipeline.wpe.service.engine;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("TASK_66 - CycleNodeFinder (SCC Tarjan lặp)")
class CycleNodeFinderTest {

    @Test
    void emptyGraph() {
        assertTrue(CycleNodeFinder.findNodesOnCycle(List.<Integer>of(), Map.<Integer, List<Integer>>of()).isEmpty());
    }

    @Test
    void singleNodeNoEdge() {
        assertTrue(CycleNodeFinder.findNodesOnCycle(List.of(1), Map.of(1, List.of())).isEmpty());
    }

    @Test
    void selfLoop() {
        assertEquals(Set.of(1), CycleNodeFinder.findNodesOnCycle(List.of(1, 2), Map.of(1, List.of(1, 2), 2, List.of())));
    }

    @Test
    void chainWithoutCycle() {
        Map<Integer, List<Integer>> adj = Map.of(1, List.of(2), 2, List.of(3), 3, List.of());
        assertTrue(CycleNodeFinder.findNodesOnCycle(List.of(1, 2, 3), adj).isEmpty());
    }

    @Test
    void ignoresEdgesToUnknownNodesAndDuplicates() {
        Map<Integer, List<Integer>> adj = Map.of(1, List.of(2, 2, 99), 2, List.of(3), 3, List.of());
        assertTrue(CycleNodeFinder.findNodesOnCycle(List.of(1, 2, 3), adj).isEmpty());
    }

    @Test
    void longChainOf10000NodesDoesNotOverflowStack() {
        int n = 10_000;
        List<Integer> vertices = new ArrayList<>();
        Map<Integer, List<Integer>> adj = new HashMap<>();
        for (int i = 0; i < n; i++) {
            vertices.add(i);
            adj.put(i, i + 1 < n ? List.of(i + 1) : List.of());
        }
        assertTrue(CycleNodeFinder.findNodesOnCycle(vertices, adj).isEmpty());
        // Đóng vòng: cả chuỗi dài thành một SCC.
        adj.put(n - 1, List.of(0));
        assertEquals(n, CycleNodeFinder.findNodesOnCycle(vertices, adj).size());
    }
}
