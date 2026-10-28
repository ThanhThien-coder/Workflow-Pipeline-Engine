package com.pipeline.wpe.service.engine;

import com.pipeline.wpe.common.enums.NodeStatus;
import com.pipeline.wpe.entity.NodeEntity;
import com.pipeline.wpe.service.engine.PhaseProgressCalculator.PhaseProgress;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Unit Tests for PhaseProgressCalculator")
class PhaseProgressCalculatorTest {

    private static List<NodeEntity> tasks(NodeStatus... statuses) {
        return Arrays.stream(statuses)
            .map(s -> NodeEntity.builder().status(s).build())
            .toList();
    }

    @Test
    @DisplayName("Phase rỗng -> TODO 0%")
    void emptyPhase() {
        assertEquals(new PhaseProgress("TODO", 0, 0, 0), PhaseProgressCalculator.compute(List.of()));
    }

    @Test
    @DisplayName("Chỉ đếm DONE: IN_PROGRESS / REVIEW vẫn là 0%")
    void onlyDoneCounts() {
        assertEquals(0, PhaseProgressCalculator.compute(tasks(NodeStatus.IN_PROGRESS)).progressPct());
        assertEquals(0, PhaseProgressCalculator.compute(tasks(NodeStatus.REVIEW)).progressPct());
        assertEquals(100, PhaseProgressCalculator.compute(tasks(NodeStatus.DONE)).progressPct());
    }

    @Test
    @DisplayName("Làm tròn phần trăm")
    void rounding() {
        assertEquals(33, PhaseProgressCalculator.compute(tasks(NodeStatus.DONE, NodeStatus.TODO, NodeStatus.TODO)).progressPct());
        assertEquals(67, PhaseProgressCalculator.compute(tasks(NodeStatus.DONE, NodeStatus.DONE, NodeStatus.TODO)).progressPct());
    }

    @Test
    @DisplayName("Suy ra trạng thái Phase từ task")
    void derivedStatus() {
        assertEquals("LOCKED", PhaseProgressCalculator.compute(tasks(NodeStatus.LOCKED, NodeStatus.LOCKED)).status());
        assertEquals("TODO", PhaseProgressCalculator.compute(tasks(NodeStatus.TODO, NodeStatus.LOCKED)).status());
        assertEquals("IN_PROGRESS", PhaseProgressCalculator.compute(tasks(NodeStatus.REVIEW, NodeStatus.LOCKED)).status());
        assertEquals("IN_PROGRESS", PhaseProgressCalculator.compute(tasks(NodeStatus.DONE, NodeStatus.LOCKED)).status());
        assertEquals("COMPLETED", PhaseProgressCalculator.compute(tasks(NodeStatus.DONE, NodeStatus.DONE)).status());
    }
}
