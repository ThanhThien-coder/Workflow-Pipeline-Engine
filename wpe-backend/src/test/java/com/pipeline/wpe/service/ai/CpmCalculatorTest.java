package com.pipeline.wpe.service.ai;

import com.pipeline.wpe.entity.NodeDependencyEntity;
import com.pipeline.wpe.entity.NodeEntity;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Collections;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class CpmCalculatorTest {

    @Test
    @DisplayName("CPM: Đồ thị A(8h)->B(4h), A->C(10h), B->D(3h), C->D(3h) tính đúng forward/backward pass và đường găng")
    void testCalculate_StandardFourNodeGraph() {
        // A(8h) -> B(4h), A -> C(10h), B -> D(3h), C -> D(3h)
        NodeEntity a = NodeEntity.builder().id(1L).code("A").estimatedHours(8).build();
        NodeEntity b = NodeEntity.builder().id(2L).code("B").estimatedHours(4).build();
        NodeEntity c = NodeEntity.builder().id(3L).code("C").estimatedHours(10).build();
        NodeEntity d = NodeEntity.builder().id(4L).code("D").estimatedHours(3).build();

        List<NodeEntity> nodes = List.of(a, b, c, d);

        List<NodeDependencyEntity> deps = List.of(
            NodeDependencyEntity.builder().id(101L).parentNodeId(1L).childNodeId(2L).build(), // A -> B
            NodeDependencyEntity.builder().id(102L).parentNodeId(1L).childNodeId(3L).build(), // A -> C
            NodeDependencyEntity.builder().id(103L).parentNodeId(2L).childNodeId(4L).build(), // B -> D
            NodeDependencyEntity.builder().id(104L).parentNodeId(3L).childNodeId(4L).build()  // C -> D
        );

        List<Long> sortedOrder = List.of(1L, 2L, 3L, 4L);

        CpmCalculator.CpmResult result = CpmCalculator.calculate(nodes, deps, sortedOrder);

        // A(ES0, EF8, LS0, LF8, slack0)
        CpmCalculator.NodeTiming timingA = result.timings().get(1L);
        assertThat(timingA).isNotNull();
        assertThat(timingA.es()).isEqualTo(0);
        assertThat(timingA.ef()).isEqualTo(8);
        assertThat(timingA.ls()).isEqualTo(0);
        assertThat(timingA.lf()).isEqualTo(8);
        assertThat(timingA.slack()).isEqualTo(0);

        // B(ES8, EF12, LS14, LF18, slack6)
        CpmCalculator.NodeTiming timingB = result.timings().get(2L);
        assertThat(timingB).isNotNull();
        assertThat(timingB.es()).isEqualTo(8);
        assertThat(timingB.ef()).isEqualTo(12);
        assertThat(timingB.ls()).isEqualTo(14);
        assertThat(timingB.lf()).isEqualTo(18);
        assertThat(timingB.slack()).isEqualTo(6);

        // C(ES8, EF18, LS8, LF18, slack0)
        CpmCalculator.NodeTiming timingC = result.timings().get(3L);
        assertThat(timingC).isNotNull();
        assertThat(timingC.es()).isEqualTo(8);
        assertThat(timingC.ef()).isEqualTo(18);
        assertThat(timingC.ls()).isEqualTo(8);
        assertThat(timingC.lf()).isEqualTo(18);
        assertThat(timingC.slack()).isEqualTo(0);

        // D(ES18, EF21, LS18, LF21, slack0)
        CpmCalculator.NodeTiming timingD = result.timings().get(4L);
        assertThat(timingD).isNotNull();
        assertThat(timingD.es()).isEqualTo(18);
        assertThat(timingD.ef()).isEqualTo(21);
        assertThat(timingD.ls()).isEqualTo(18);
        assertThat(timingD.lf()).isEqualTo(21);
        assertThat(timingD.slack()).isEqualTo(0);

        // Đường găng: [1, 3, 4]
        assertThat(result.criticalPathIds()).containsExactly(1L, 3L, 4L);
        assertThat(result.projectDurationHours()).isEqualTo(21);
    }

    @Test
    @DisplayName("CPM: Đồ thị 1 node đơn")
    void testCalculate_SingleNode() {
        NodeEntity a = NodeEntity.builder().id(1L).code("A").estimatedHours(12).build();
        List<NodeEntity> nodes = List.of(a);
        List<Long> sortedOrder = List.of(1L);

        CpmCalculator.CpmResult result = CpmCalculator.calculate(nodes, Collections.emptyList(), sortedOrder);

        assertThat(result.projectDurationHours()).isEqualTo(12);
        assertThat(result.criticalPathIds()).containsExactly(1L);
        CpmCalculator.NodeTiming timing = result.timings().get(1L);
        assertThat(timing).isNotNull();
        assertThat(timing.es()).isEqualTo(0);
        assertThat(timing.ef()).isEqualTo(12);
        assertThat(timing.ls()).isEqualTo(0);
        assertThat(timing.lf()).isEqualTo(12);
        assertThat(timing.slack()).isEqualTo(0);
    }

    @Test
    @DisplayName("CPM: sortedOrder rỗng mà nodes không rỗng (chu trình) -> kết quả rỗng")
    void testCalculate_EmptySortedOrder_Cycle() {
        NodeEntity a = NodeEntity.builder().id(1L).code("A").estimatedHours(8).build();
        NodeEntity b = NodeEntity.builder().id(2L).code("B").estimatedHours(4).build();
        List<NodeEntity> nodes = List.of(a, b);

        CpmCalculator.CpmResult result = CpmCalculator.calculate(nodes, Collections.emptyList(), Collections.emptyList());

        assertThat(result.timings()).isEmpty();
        assertThat(result.criticalPathIds()).isEmpty();
        assertThat(result.projectDurationHours()).isEqualTo(0);
    }

    @Test
    @DisplayName("CPM: estimatedHours null hoặc <= 0 -> mặc định 8h")
    void testCalculate_EstimatedHoursNullOrZeroOrNegative_DefaultsTo8() {
        NodeEntity a = NodeEntity.builder().id(1L).code("A").estimatedHours(null).build();
        NodeEntity b = NodeEntity.builder().id(2L).code("B").estimatedHours(0).build();
        NodeEntity c = NodeEntity.builder().id(3L).code("C").estimatedHours(-4).build();

        List<NodeEntity> nodes = List.of(a, b, c);
        List<NodeDependencyEntity> deps = List.of(
            NodeDependencyEntity.builder().parentNodeId(1L).childNodeId(2L).build(),
            NodeDependencyEntity.builder().parentNodeId(2L).childNodeId(3L).build()
        );
        List<Long> sortedOrder = List.of(1L, 2L, 3L);

        CpmCalculator.CpmResult result = CpmCalculator.calculate(nodes, deps, sortedOrder);

        assertThat(result.projectDurationHours()).isEqualTo(24);
        assertThat(result.criticalPathIds()).containsExactly(1L, 2L, 3L);

        assertThat(result.timings().get(1L).ef()).isEqualTo(8);
        assertThat(result.timings().get(2L).ef()).isEqualTo(16);
        assertThat(result.timings().get(3L).ef()).isEqualTo(24);
    }

    @Test
    @DisplayName("CPM: Bỏ qua cạnh có đầu mút không thuộc nodes")
    void testCalculate_IgnoresExternalEdges() {
        NodeEntity a = NodeEntity.builder().id(1L).code("A").estimatedHours(8).build();
        NodeEntity b = NodeEntity.builder().id(2L).code("B").estimatedHours(4).build();
        List<NodeEntity> nodes = List.of(a, b);

        List<NodeDependencyEntity> deps = List.of(
            NodeDependencyEntity.builder().parentNodeId(1L).childNodeId(2L).build(),
            NodeDependencyEntity.builder().parentNodeId(99L).childNodeId(1L).build(), // 99 không có trong nodes
            NodeDependencyEntity.builder().parentNodeId(2L).childNodeId(100L).build() // 100 không có trong nodes
        );
        List<Long> sortedOrder = List.of(1L, 2L);

        CpmCalculator.CpmResult result = CpmCalculator.calculate(nodes, deps, sortedOrder);

        assertThat(result.projectDurationHours()).isEqualTo(12);
        assertThat(result.criticalPathIds()).containsExactly(1L, 2L);
    }
}
