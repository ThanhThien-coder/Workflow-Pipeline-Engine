package com.pipeline.wpe.service.engine;

import com.pipeline.wpe.entity.NodeDependencyEntity;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertTimeoutPreemptively;

class CriticalPathCalculatorTest {

    private static NodeDependencyEntity dep(long parent, long child) {
        return NodeDependencyEntity.builder().projectId(1L).parentNodeId(parent).childNodeId(child).build();
    }

    @Test
    @DisplayName("do thi rong = 0")
    void empty() {
        assertThat(CriticalPathCalculator.compute(List.of(), List.of())).isZero();
        assertThat(CriticalPathCalculator.compute(null, null)).isZero();
    }

    @Test
    @DisplayName("1 node = 1; nhieu node khong phu thuoc = 1")
    void singleAndIsolated() {
        assertThat(CriticalPathCalculator.compute(List.of(1L), List.of())).isEqualTo(1);
        assertThat(CriticalPathCalculator.compute(List.of(1L, 2L, 3L), List.of())).isEqualTo(1);
    }

    @Test
    @DisplayName("chuoi 1->2->3->4 = 4")
    void chain() {
        assertThat(CriticalPathCalculator.compute(List.of(1L, 2L, 3L, 4L), List.of(dep(1, 2), dep(2, 3), dep(3, 4))))
            .isEqualTo(4);
    }

    @Test
    @DisplayName("nhanh: lay nhanh dai nhat")
    void branches() {
        // 1->2->3->5 va 1->4->5 => 4 node
        assertThat(CriticalPathCalculator.compute(List.of(1L, 2L, 3L, 4L, 5L),
            List.of(dep(1, 2), dep(2, 3), dep(3, 5), dep(1, 4), dep(4, 5)))).isEqualTo(4);
    }

    @Test
    @DisplayName("canh tro node la hoac tu tro bi bo qua")
    void unknownAndSelfEdges() {
        assertThat(CriticalPathCalculator.compute(List.of(1L, 2L),
            List.of(dep(1, 99), dep(99, 2), dep(2, 2), dep(1, 2)))).isEqualTo(2);
    }

    @Test
    @DisplayName("co vong thi khong treo va tra so huu han")
    void cycleDoesNotHang() {
        int result = assertTimeoutPreemptively(Duration.ofSeconds(5), () ->
            CriticalPathCalculator.compute(List.of(1L, 2L, 3L), List.of(dep(1, 2), dep(2, 3), dep(3, 2))));
        assertThat(result).isBetween(1, 3);
    }
}
