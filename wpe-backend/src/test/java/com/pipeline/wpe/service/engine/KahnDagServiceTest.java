package com.pipeline.wpe.service.engine;

import com.pipeline.wpe.dto.response.template.DagValidationResponse;
import com.pipeline.wpe.entity.NodeDependencyEntity;
import com.pipeline.wpe.entity.NodeEntity;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Unit Tests for KahnDagService (Topological Sort & Cycle Detection)")
class KahnDagServiceTest {

    private KahnDagService kahnDagService;

    @BeforeEach
    void setUp() {
        kahnDagService = new KahnDagService();
    }

    @Test
    @DisplayName("Đồ thị tuyến tính hợp lệ (A -> B -> C): isValid == true, không có chu trình, root là A")
    void testValidLinearDag() {
        NodeEntity nodeA = NodeEntity.builder().id(1L).code("WPE-001").build();
        NodeEntity nodeB = NodeEntity.builder().id(2L).code("WPE-002").build();
        NodeEntity nodeC = NodeEntity.builder().id(3L).code("WPE-003").build();

        NodeDependencyEntity edge1 = NodeDependencyEntity.builder().parentNodeId(1L).childNodeId(2L).build();
        NodeDependencyEntity edge2 = NodeDependencyEntity.builder().parentNodeId(2L).childNodeId(3L).build();

        var result = kahnDagService.validateProjectDag(List.of(nodeA, nodeB, nodeC), List.of(edge1, edge2));

        assertTrue(result.isValid());
        assertEquals(3, result.visitedCount());
        assertEquals(3, result.totalNodes());
        assertTrue(result.cycleNodeCodes().isEmpty());
        assertEquals(1, result.rootNodeIds().size());
        assertTrue(result.rootNodeIds().contains(1L));
    }

    @Test
    @DisplayName("Đồ thị phân nhánh và hội tụ hợp lệ (A -> B, A -> C, B -> D, C -> D): isValid == true, root là A")
    void testValidDiamondDag() {
        NodeEntity a = NodeEntity.builder().id(1L).code("A").build();
        NodeEntity b = NodeEntity.builder().id(2L).code("B").build();
        NodeEntity c = NodeEntity.builder().id(3L).code("C").build();
        NodeEntity d = NodeEntity.builder().id(4L).code("D").build();

        var edges = List.of(
            NodeDependencyEntity.builder().parentNodeId(1L).childNodeId(2L).build(),
            NodeDependencyEntity.builder().parentNodeId(1L).childNodeId(3L).build(),
            NodeDependencyEntity.builder().parentNodeId(2L).childNodeId(4L).build(),
            NodeDependencyEntity.builder().parentNodeId(3L).childNodeId(4L).build()
        );

        var result = kahnDagService.validateProjectDag(List.of(a, b, c, d), edges);

        assertTrue(result.isValid());
        assertEquals(4, result.visitedCount());
        assertTrue(result.rootNodeIds().contains(1L));
        assertFalse(result.rootNodeIds().contains(4L));
    }

    @Test
    @DisplayName("Phát hiện chu trình kín 3 đỉnh (A -> B -> C -> A): isValid == false, trả về danh sách cycleNodes")
    void testCycleDetectedThreeNodes() {
        NodeEntity a = NodeEntity.builder().id(1L).code("WPE-001").build();
        NodeEntity b = NodeEntity.builder().id(2L).code("WPE-002").build();
        NodeEntity c = NodeEntity.builder().id(3L).code("WPE-003").build();

        var edges = List.of(
            NodeDependencyEntity.builder().parentNodeId(1L).childNodeId(2L).build(),
            NodeDependencyEntity.builder().parentNodeId(2L).childNodeId(3L).build(),
            NodeDependencyEntity.builder().parentNodeId(3L).childNodeId(1L).build() // Nối ngược tạo vòng
        );

        var result = kahnDagService.validateProjectDag(List.of(a, b, c), edges);

        assertFalse(result.isValid());
        assertEquals(0, result.visitedCount());
        assertEquals(3, result.cycleNodeCodes().size());
        assertTrue(result.cycleNodeCodes().containsAll(List.of("WPE-001", "WPE-002", "WPE-003")));
    }

    @Test
    @DisplayName("Đồ thị rỗng hoặc null: isValid == true an toàn")
    void testEmptyDag() {
        var result = kahnDagService.validateProjectDag(List.of(), List.of());
        assertTrue(result.isValid());
        assertEquals(0, result.totalNodes());
    }

    @Test
    @DisplayName("Thẩm định Template 2 tầng hợp lệ: valid == true, không có violations")
    void testValidateTemplateGraphValid() {
        Map<String, Object> graphData = Map.of(
            "phases", List.of(
                Map.of("id", "p1", "name", "Foundation"),
                Map.of("id", "p2", "name", "Core Engine")
            ),
            "phaseEdges", List.of(
                Map.of("parentPhaseId", "p1", "childPhaseId", "p2")
            ),
            "nodes", List.of(
                Map.of("id", "n1", "phaseId", "p1", "title", "DB Schema"),
                Map.of("id", "n2", "phaseId", "p2", "title", "FSM Engine")
            ),
            "edges", List.of()
        );

        DagValidationResponse response = kahnDagService.validateTemplateGraph(graphData);
        assertTrue(response.valid());
        assertTrue(response.violations().isEmpty());
    }

    @Test
    @DisplayName("Thẩm định Template có chu trình ở tầng Phase (p1 -> p2 -> p1): valid == false, scope == PHASE")
    void testValidateTemplateGraphPhaseCycle() {
        Map<String, Object> graphData = Map.of(
            "phases", List.of(
                Map.of("id", "p1", "name", "P1"),
                Map.of("id", "p2", "name", "P2")
            ),
            "phaseEdges", List.of(
                Map.of("parentPhaseId", "p1", "childPhaseId", "p2"),
                Map.of("parentPhaseId", "p2", "childPhaseId", "p1")
            ),
            "nodes", List.of()
        );

        DagValidationResponse response = kahnDagService.validateTemplateGraph(graphData);
        assertFalse(response.valid());
        assertEquals(1, response.violations().size());
        assertEquals("PHASE", response.violations().get(0).scope());
    }
}
