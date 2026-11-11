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

    // ===== B1: test tái hiện thiếu sót (viết trước khi sửa) =====

    private static NodeEntity node(long id, String code) {
        return NodeEntity.builder().id(id).code(code).build();
    }

    private static NodeDependencyEntity edge(long parent, long child) {
        return NodeDependencyEntity.builder().parentNodeId(parent).childNodeId(child).build();
    }

    @Test
    @DisplayName("B1 - Chu trình kèm đuôi (A->B->C->A, C->D, D->E): cycleNodeCodes chỉ gồm A, B, C; không chứa node đuôi D, E")
    void testCycleWithTailExcludesTailNodes() {
        var nodes = List.of(node(1, "A"), node(2, "B"), node(3, "C"), node(4, "D"), node(5, "E"));
        var edges = List.of(edge(1, 2), edge(2, 3), edge(3, 1), edge(3, 4), edge(4, 5));

        var result = kahnDagService.validateProjectDag(nodes, edges);

        assertFalse(result.isValid());
        assertEquals(List.of("A", "B", "C"), result.cycleNodeCodes());
    }

    @Test
    @DisplayName("B1 - Cạnh trỏ tới node cha không có trong danh sách: bỏ qua cạnh đó, không báo chu trình giả")
    void testEdgeWithUnknownParentIsIgnored() {
        var nodes = List.of(node(1, "A"), node(2, "B"));
        var edges = List.of(edge(1, 2), edge(99, 2));

        var result = kahnDagService.validateProjectDag(nodes, edges);

        assertTrue(result.isValid());
        assertEquals(2, result.visitedCount());
        assertEquals(List.of(1L, 2L), result.sortedOrder());
    }

    // ===== B1: sortedOrder, blockedNodeCodes và các case còn thiếu =====

    @Test
    @DisplayName("B1 - Một node, không có cạnh: hợp lệ, node đó là root và là toàn bộ sortedOrder")
    void testSingleNode() {
        var result = kahnDagService.validateProjectDag(List.of(node(7, "ONLY")), List.of());

        assertTrue(result.isValid());
        assertEquals(java.util.Set.of(7L), result.rootNodeIds());
        assertEquals(List.of(7L), result.sortedOrder());
        assertTrue(result.blockedNodeCodes().isEmpty());
    }

    @Test
    @DisplayName("B1 - Đồ thị rỗng: sortedOrder và blockedNodeCodes đều rỗng, không null")
    void testEmptyDagHasEmptyLists() {
        var result = kahnDagService.validateProjectDag(List.of(), List.of());

        assertTrue(result.sortedOrder().isEmpty());
        assertTrue(result.blockedNodeCodes().isEmpty());
        assertTrue(result.cycleNodeCodes().isEmpty());
    }

    @Test
    @DisplayName("B1 - Dữ liệu seed WPE-001 -> 002 -> 003 -> 004: sortedOrder đúng thứ tự 1, 2, 3, 4; root là WPE-001")
    void testSeedChainSortedOrder() {
        var nodes = List.of(node(1, "WPE-001"), node(2, "WPE-002"), node(3, "WPE-003"), node(4, "WPE-004"));
        var edges = List.of(edge(1, 2), edge(2, 3), edge(3, 4));

        var result = kahnDagService.validateProjectDag(nodes, edges);

        assertTrue(result.isValid());
        assertEquals(List.of(1L, 2L, 3L, 4L), result.sortedOrder());
        assertEquals(java.util.Set.of(1L), result.rootNodeIds());
        assertTrue(result.cycleNodeCodes().isEmpty());
        assertTrue(result.blockedNodeCodes().isEmpty());
    }

    @Test
    @DisplayName("B1 - Kim cương, danh sách node đưa vào theo thứ tự ngược: sortedOrder vẫn ổn định theo id tăng dần")
    void testDiamondStableOrderRegardlessOfInputOrder() {
        var nodes = List.of(node(4, "D"), node(3, "C"), node(2, "B"), node(1, "A"));
        var edges = List.of(edge(3, 4), edge(2, 4), edge(1, 3), edge(1, 2));

        var result = kahnDagService.validateProjectDag(nodes, edges);

        assertTrue(result.isValid());
        assertEquals(List.of(1L, 2L, 3L, 4L), result.sortedOrder());
    }

    @Test
    @DisplayName("B1 - Thứ tự ổn định: node id nhỏ vừa được mở vẫn đi trước node id lớn đang chờ (1->2, 5 đứng riêng)")
    void testStableOrderPrefersSmallerIdAmongReadyNodes() {
        var nodes = List.of(node(5, "E"), node(1, "A"), node(2, "B"));
        var edges = List.of(edge(1, 2));

        var result = kahnDagService.validateProjectDag(nodes, edges);

        assertEquals(List.of(1L, 2L, 5L), result.sortedOrder());
    }

    @Test
    @DisplayName("B1 - Hai thành phần rời (1->2 và 3->4): hợp lệ, có 2 root, sortedOrder đủ 4 node")
    void testTwoDisconnectedComponents() {
        var nodes = List.of(node(1, "A"), node(2, "B"), node(3, "C"), node(4, "D"));
        var edges = List.of(edge(1, 2), edge(3, 4));

        var result = kahnDagService.validateProjectDag(nodes, edges);

        assertTrue(result.isValid());
        assertEquals(java.util.Set.of(1L, 3L), result.rootNodeIds());
        assertEquals(List.of(1L, 2L, 3L, 4L), result.sortedOrder());
    }

    @Test
    @DisplayName("B1 - Chu trình 3 node: sortedOrder rỗng, blockedNodeCodes trùng cycleNodeCodes")
    void testThreeNodeCycleHasEmptySortedOrder() {
        var nodes = List.of(node(1, "A"), node(2, "B"), node(3, "C"));
        var edges = List.of(edge(1, 2), edge(2, 3), edge(3, 1));

        var result = kahnDagService.validateProjectDag(nodes, edges);

        assertFalse(result.isValid());
        assertTrue(result.sortedOrder().isEmpty());
        assertEquals(List.of("A", "B", "C"), result.cycleNodeCodes());
        assertEquals(List.of("A", "B", "C"), result.blockedNodeCodes());
    }

    @Test
    @DisplayName("B1 - Chu trình kèm đuôi và có node đứng trước: blockedNodeCodes gồm cả đuôi, node đứng trước vẫn duyệt được")
    void testCycleWithTailBlockedNodeCodes() {
        // 0 -> A, A->B->C->A, C->D, D->E
        var nodes = List.of(node(10, "ROOT"), node(1, "A"), node(2, "B"), node(3, "C"), node(4, "D"), node(5, "E"));
        var edges = List.of(edge(10, 1), edge(1, 2), edge(2, 3), edge(3, 1), edge(3, 4), edge(4, 5));

        var result = kahnDagService.validateProjectDag(nodes, edges);

        assertFalse(result.isValid());
        assertEquals(1, result.visitedCount());
        assertEquals(List.of("A", "B", "C"), result.cycleNodeCodes());
        assertEquals(List.of("A", "B", "C", "D", "E"), result.blockedNodeCodes());
        assertTrue(result.sortedOrder().isEmpty());
    }

    @Test
    @DisplayName("B1 - Hai chu trình rời (1<->2 và 3->4->5->3): cycleNodeCodes gồm node của cả 2 chu trình")
    void testTwoSeparateCycles() {
        var nodes = List.of(node(1, "A"), node(2, "B"), node(3, "C"), node(4, "D"), node(5, "E"), node(6, "F"));
        var edges = List.of(edge(1, 2), edge(2, 1), edge(3, 4), edge(4, 5), edge(5, 3), edge(5, 6));

        var result = kahnDagService.validateProjectDag(nodes, edges);

        assertFalse(result.isValid());
        assertEquals(List.of("A", "B", "C", "D", "E"), result.cycleNodeCodes());
        assertEquals(List.of("A", "B", "C", "D", "E", "F"), result.blockedNodeCodes());
    }

    @Test
    @DisplayName("B1 - Hạn chế đã biết: node nằm giữa 2 chu trình (1<->2, 2->3, 3->4, 4<->5) vẫn bị đưa vào cycleNodeCodes")
    void testNodeBetweenTwoCyclesIsStillReported() {
        var nodes = List.of(node(1, "A"), node(2, "B"), node(3, "MID"), node(4, "D"), node(5, "E"));
        var edges = List.of(edge(1, 2), edge(2, 1), edge(2, 3), edge(3, 4), edge(4, 5), edge(5, 4));

        var result = kahnDagService.validateProjectDag(nodes, edges);

        assertFalse(result.isValid());
        assertEquals(List.of("A", "B", "MID", "D", "E"), result.cycleNodeCodes());
    }

    @Test
    @DisplayName("B1 - Cạnh trùng (1->2 xuất hiện 2 lần): vẫn hợp lệ, không báo chu trình")
    void testDuplicateEdges() {
        var nodes = List.of(node(1, "A"), node(2, "B"), node(3, "C"));
        var edges = List.of(edge(1, 2), edge(1, 2), edge(2, 3));

        var result = kahnDagService.validateProjectDag(nodes, edges);

        assertTrue(result.isValid());
        assertEquals(List.of(1L, 2L, 3L), result.sortedOrder());
    }

    @Test
    @DisplayName("B1 - Node không có code: dùng mã thay thế NODE-<id> trong cycleNodeCodes")
    void testNodeWithoutCodeUsesFallbackCode() {
        var nodes = List.of(NodeEntity.builder().id(1L).build(), NodeEntity.builder().id(2L).build());
        var edges = List.of(edge(1, 2), edge(2, 1));

        var result = kahnDagService.validateProjectDag(nodes, edges);

        assertEquals(List.of("NODE-1", "NODE-2"), result.cycleNodeCodes());
    }

    // ===== B1: wouldCreateCycle =====

    /** Đồ thị seed: 1 -> 2 -> 3 -> 4, thêm node 5 đứng riêng. */
    private static final List<NodeEntity> CHAIN_NODES =
        List.of(node(1, "WPE-001"), node(2, "WPE-002"), node(3, "WPE-003"), node(4, "WPE-004"), node(5, "WPE-005"));
    private static final List<NodeDependencyEntity> CHAIN_EDGES = List.of(edge(1, 2), edge(2, 3), edge(3, 4));

    @org.junit.jupiter.params.ParameterizedTest(name = "thêm cạnh {0} -> {1}: tạo vòng = {2} ({3})")
    @org.junit.jupiter.params.provider.CsvSource({
        "3, 1, true,  vòng 3 node 1->2->3->1",
        "4, 1, true,  vòng 4 node 1->2->3->4->1",
        "2, 1, true,  vòng 2 node",
        "2, 2, true,  node nối vào chính nó",
        "1, 3, false, cạnh tắt cùng chiều",
        "1, 4, false, cạnh tắt cùng chiều qua 3 node",
        "4, 5, false, nối sang node đứng riêng",
        "5, 1, false, node đứng riêng làm cha của root",
        "1, 2, false, cạnh đã tồn tại"
    })
    void testWouldCreateCycle(long parentId, long childId, boolean expected, String moTa) {
        assertEquals(expected, kahnDagService.wouldCreateCycle(CHAIN_NODES, CHAIN_EDGES, parentId, childId));
    }

    @Test
    @DisplayName("B1 - wouldCreateCycle với đồ thị rỗng hoặc id null: trả false, không ném lỗi")
    void testWouldCreateCycleEdgeInputs() {
        assertFalse(kahnDagService.wouldCreateCycle(List.of(), List.of(), 1L, 2L));
        assertFalse(kahnDagService.wouldCreateCycle(null, null, 1L, 2L));
        assertFalse(kahnDagService.wouldCreateCycle(CHAIN_NODES, CHAIN_EDGES, null, 2L));
        assertFalse(kahnDagService.wouldCreateCycle(CHAIN_NODES, CHAIN_EDGES, 1L, null));
        assertTrue(kahnDagService.wouldCreateCycle(List.of(), List.of(), 1L, 1L));
    }

    @Test
    @DisplayName("B1 - wouldCreateCycle khớp với validateProjectDag: cạnh bị báo tạo vòng thì thêm vào sẽ làm đồ thị không hợp lệ")
    void testWouldCreateCycleAgreesWithValidateProjectDag() {
        for (long parent = 1; parent <= 5; parent++) {
            for (long child = 1; child <= 5; child++) {
                if (parent == child) {
                    continue;
                }
                var withNewEdge = new java.util.ArrayList<>(CHAIN_EDGES);
                withNewEdge.add(edge(parent, child));

                boolean predicted = kahnDagService.wouldCreateCycle(CHAIN_NODES, CHAIN_EDGES, parent, child);
                boolean actualCycle = !kahnDagService.validateProjectDag(CHAIN_NODES, withNewEdge).isValid();

                assertEquals(actualCycle, predicted, "Lệch tại cạnh " + parent + " -> " + child);
            }
        }
    }
}
