package com.pipeline.wpe.service;

import com.pipeline.wpe.common.enums.JoinPolicy;
import com.pipeline.wpe.common.enums.NodeStatus;
import com.pipeline.wpe.dto.request.graph.CreateDependencyRequest;
import com.pipeline.wpe.dto.request.graph.CreateNodeRequest;
import com.pipeline.wpe.dto.request.graph.CreatePhaseRequest;
import com.pipeline.wpe.dto.request.graph.UpdatePhaseRequest;
import com.pipeline.wpe.dto.response.graph.PublishPipelineResponse;
import com.pipeline.wpe.dto.response.graph.WorkflowGraphResponse;
import com.pipeline.wpe.entity.NodeDependencyEntity;
import com.pipeline.wpe.entity.NodeEntity;
import com.pipeline.wpe.entity.ProjectEntity;
import com.pipeline.wpe.entity.WorkPhaseEntity;
import com.pipeline.wpe.exception.ConflictException;
import com.pipeline.wpe.exception.CycleDetectedException;
import com.pipeline.wpe.exception.ForbiddenException;
import com.pipeline.wpe.repository.NodeDependencyRepository;
import com.pipeline.wpe.repository.NodeRepository;
import com.pipeline.wpe.repository.PhaseDependencyRepository;
import com.pipeline.wpe.entity.PhaseDependencyEntity;
import com.pipeline.wpe.repository.ProjectRepository;
import com.pipeline.wpe.repository.WorkPhaseRepository;
import com.pipeline.wpe.service.engine.KahnDagService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("Unit Tests for WorkflowGraphService")
class WorkflowGraphServiceTest {

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private WorkPhaseRepository workPhaseRepository;

    @Mock
    private NodeRepository nodeRepository;

    @Mock
    private NodeDependencyRepository nodeDependencyRepository;

    @Mock
    private PhaseDependencyRepository phaseDependencyRepository;

    @Mock
    private ProjectAuthorizationService authorizationService;

    @Spy
    private KahnDagService kahnDagService = new KahnDagService();

    @InjectMocks
    private WorkflowGraphService workflowGraphService;

    private ProjectEntity sampleProject;

    @BeforeEach
    void setUp() {
        sampleProject = ProjectEntity.builder()
            .id(1L)
            .ownerId(2L)
            .name("Core Banking Pipeline")
            .status(com.pipeline.wpe.common.enums.ProjectStatus.DRAFT)
            .build();
        // Các hàm ghi Phase đọc trạng thái dự án từ kết quả verifyProjectOwner để chặn ARCHIVED
        lenient().when(authorizationService.verifyProjectOwner(1L, 2L)).thenReturn(sampleProject);
    }

    @Test
    @DisplayName("4.1 getGraph: Lấy đồ thị thành công đầy đủ phases, nodes, dependencies")
    void testGetGraph() {
        WorkPhaseEntity p1 = WorkPhaseEntity.builder().id(10L).projectId(1L).name("P1").orderIndex(0).build();
        NodeEntity n1 = NodeEntity.builder().id(100L).projectId(1L).phaseId(10L).code("WPE-001").title("Task 1").status(NodeStatus.TODO).joinPolicy(JoinPolicy.ALL_COMPLETED).build();
        NodeDependencyEntity dep = NodeDependencyEntity.builder().id(1L).projectId(1L).parentNodeId(100L).childNodeId(101L).build();

        when(workPhaseRepository.findByProjectIdOrderByOrderIndexAsc(1L)).thenReturn(List.of(p1));
        when(nodeRepository.findByProjectId(1L)).thenReturn(List.of(n1));
        when(nodeDependencyRepository.findByProjectId(1L)).thenReturn(List.of(dep));

        WorkflowGraphResponse graph = workflowGraphService.getGraph(1L, 2L);

        assertNotNull(graph);
        assertEquals(1, graph.phases().size());
        assertEquals(1, graph.nodes().size());
        assertEquals(1, graph.dependencies().size());
        verify(authorizationService).verifyProjectMemberOrOwner(1L, 2L);
    }

    @Test
    @DisplayName("4.1 getGraph: Mỗi Phase trả về progressPct & status suy ra từ task của chính Phase đó")
    void testGetGraphPhaseProgress() {
        WorkPhaseEntity p1 = WorkPhaseEntity.builder().id(10L).projectId(1L).name("P1").orderIndex(0).build();
        WorkPhaseEntity p2 = WorkPhaseEntity.builder().id(20L).projectId(1L).name("P2").parentPhaseId(10L).orderIndex(1).build();
        WorkPhaseEntity p3 = WorkPhaseEntity.builder().id(30L).projectId(1L).name("P3").orderIndex(2).build();
        NodeEntity a = NodeEntity.builder().id(1L).projectId(1L).phaseId(10L).code("A").status(NodeStatus.DONE).joinPolicy(JoinPolicy.ALL_COMPLETED).build();
        NodeEntity b = NodeEntity.builder().id(2L).projectId(1L).phaseId(10L).code("B").status(NodeStatus.REVIEW).joinPolicy(JoinPolicy.ALL_COMPLETED).build();
        NodeEntity c = NodeEntity.builder().id(3L).projectId(1L).phaseId(20L).code("C").status(NodeStatus.LOCKED).joinPolicy(JoinPolicy.ALL_COMPLETED).build();
        NodeEntity standalone = NodeEntity.builder().id(4L).projectId(1L).phaseId(null).code("S").status(NodeStatus.DONE).joinPolicy(JoinPolicy.ALL_COMPLETED).build();

        when(workPhaseRepository.findByProjectIdOrderByOrderIndexAsc(1L)).thenReturn(List.of(p1, p2, p3));
        when(nodeRepository.findByProjectId(1L)).thenReturn(List.of(a, b, c, standalone));
        when(nodeDependencyRepository.findByProjectId(1L)).thenReturn(List.of());

        var phases = workflowGraphService.getGraph(1L, 2L).phases();

        assertEquals(50, phases.get(0).progressPct());
        assertEquals("IN_PROGRESS", phases.get(0).status());
        assertEquals(2, phases.get(0).totalTasks());
        assertEquals(1, phases.get(0).doneTasks());

        assertEquals(0, phases.get(1).progressPct());
        assertEquals("LOCKED", phases.get(1).status());

        assertEquals(0, phases.get(2).progressPct());
        assertEquals("TODO", phases.get(2).status());
        assertEquals(0, phases.get(2).totalTasks());
    }

    @Test
    @DisplayName("4.1 getGraph: Phase có nhiều Phase cha (cột cũ + bảng phase_dependency) trả đủ parentPhaseIds & phaseEdges")
    void testGetGraphMultipleParentPhases() {
        WorkPhaseEntity p1 = WorkPhaseEntity.builder().id(1L).projectId(1L).name("P1").orderIndex(0).build();
        WorkPhaseEntity p5 = WorkPhaseEntity.builder().id(5L).projectId(1L).name("P5").orderIndex(1).build();
        WorkPhaseEntity p4 = WorkPhaseEntity.builder().id(4L).projectId(1L).name("P4").parentPhaseId(1L).orderIndex(2).build();

        when(workPhaseRepository.findByProjectIdOrderByOrderIndexAsc(1L)).thenReturn(List.of(p1, p5, p4));
        when(nodeRepository.findByProjectId(1L)).thenReturn(List.of());
        when(nodeDependencyRepository.findByProjectId(1L)).thenReturn(List.of());
        when(phaseDependencyRepository.findByProjectId(1L)).thenReturn(List.of(
            PhaseDependencyEntity.builder().projectId(1L).parentPhaseId(1L).childPhaseId(4L).build(), // trùng cột cũ
            PhaseDependencyEntity.builder().projectId(1L).parentPhaseId(5L).childPhaseId(4L).build()
        ));

        WorkflowGraphResponse graph = workflowGraphService.getGraph(1L, 2L);

        assertEquals(List.of("1", "5"), graph.phases().get(2).parentPhaseIds());
        assertEquals(List.of(List.of("1", "4"), List.of("5", "4")), graph.phaseEdges());
    }

    @Test
    @DisplayName("4.2 connectPhases: Nối thêm Phase cha thứ 2 không ghi đè cha cũ")
    void testConnectPhasesKeepsExistingParent() {
        WorkPhaseEntity p1 = WorkPhaseEntity.builder().id(1L).projectId(1L).name("P1").orderIndex(0).build();
        WorkPhaseEntity p5 = WorkPhaseEntity.builder().id(5L).projectId(1L).name("P5").orderIndex(1).build();
        WorkPhaseEntity p4 = WorkPhaseEntity.builder().id(4L).projectId(1L).name("P4").parentPhaseId(1L).orderIndex(2).build();

        when(workPhaseRepository.findById(4L)).thenReturn(Optional.of(p4));
        when(workPhaseRepository.findById(5L)).thenReturn(Optional.of(p5));
        when(workPhaseRepository.findByProjectIdOrderByOrderIndexAsc(1L)).thenReturn(List.of(p1, p5, p4));
        when(phaseDependencyRepository.findByProjectId(1L)).thenReturn(List.of());

        workflowGraphService.connectPhases(1L, 5L, 4L, 2L);

        assertEquals(1L, p4.getParentPhaseId());
        verify(phaseDependencyRepository).save(argThat(d -> d.getParentPhaseId().equals(5L) && d.getChildPhaseId().equals(4L)));
    }

    @Test
    @DisplayName("4.2 connectPhases: Nối ngược tạo chu trình giữa các Phase ném CycleDetectedException (HTTP 422)")
    void testConnectPhasesCycle() {
        WorkPhaseEntity p1 = WorkPhaseEntity.builder().id(1L).projectId(1L).name("P1").orderIndex(0).build();
        WorkPhaseEntity p2 = WorkPhaseEntity.builder().id(2L).projectId(1L).name("P2").orderIndex(1).build();
        WorkPhaseEntity p3 = WorkPhaseEntity.builder().id(3L).projectId(1L).name("P3").orderIndex(2).build();

        when(workPhaseRepository.findById(1L)).thenReturn(Optional.of(p1));
        when(workPhaseRepository.findById(3L)).thenReturn(Optional.of(p3));
        when(workPhaseRepository.findByProjectIdOrderByOrderIndexAsc(1L)).thenReturn(List.of(p1, p2, p3));
        when(phaseDependencyRepository.findByProjectId(1L)).thenReturn(List.of(
            PhaseDependencyEntity.builder().projectId(1L).parentPhaseId(1L).childPhaseId(2L).build(),
            PhaseDependencyEntity.builder().projectId(1L).parentPhaseId(2L).childPhaseId(3L).build()
        ));

        // P1 -> P2 -> P3 đã có, nối P3 -> P1 sẽ khép vòng
        assertThrows(CycleDetectedException.class, () -> workflowGraphService.connectPhases(1L, 3L, 1L, 2L));
        verify(phaseDependencyRepository, never()).save(any());
    }

    @Test
    @DisplayName("4.2 createPhase: orderIndex mặc định = MAX(order_index) + 1")
    void testCreatePhaseOrderIndexMaxPlusOne() {
        WorkPhaseEntity a = WorkPhaseEntity.builder().id(1L).projectId(1L).name("A").orderIndex(0).build();
        WorkPhaseEntity b = WorkPhaseEntity.builder().id(2L).projectId(1L).name("B").orderIndex(5).build();
        when(workPhaseRepository.findByProjectIdOrderByOrderIndexAsc(1L)).thenReturn(List.of(a, b));
        when(workPhaseRepository.save(any(WorkPhaseEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        var response = workflowGraphService.createPhase(1L, new CreatePhaseRequest("C", null, null, null, null, null), 2L);

        assertEquals(6, response.orderIndex());
    }

    @Test
    @DisplayName("4.3 deleteDependency: Cạnh thuộc dự án khác ném IllegalArgumentException, không xóa")
    void testDeleteDependencyOtherProject() {
        NodeDependencyEntity foreign = NodeDependencyEntity.builder().id(9L).projectId(99L).parentNodeId(100L).childNodeId(101L).build();
        when(nodeDependencyRepository.findByParentNodeIdAndChildNodeId(100L, 101L)).thenReturn(Optional.of(foreign));

        assertThrows(IllegalArgumentException.class, () -> workflowGraphService.deleteDependency(1L, 100L, 101L, 2L));
        verify(nodeDependencyRepository, never()).delete(any());
    }

    @Test
    @DisplayName("4.3 deleteDependency: Cạnh cùng dự án được xóa")
    void testDeleteDependencySameProject() {
        NodeDependencyEntity dep = NodeDependencyEntity.builder().id(9L).projectId(1L).parentNodeId(100L).childNodeId(101L).build();
        when(nodeDependencyRepository.findByParentNodeIdAndChildNodeId(100L, 101L)).thenReturn(Optional.of(dep));

        workflowGraphService.deleteDependency(1L, 100L, 101L, 2L);

        verify(nodeDependencyRepository).delete(dep);
    }

    @Test
    @DisplayName("4.2 createPhase: Tạo Phase mới thành công")
    void testCreatePhase() {
        CreatePhaseRequest req = new CreatePhaseRequest("Phase 4", "Sub 4", "emerald", null, 1, null);
        WorkPhaseEntity savedPhase = WorkPhaseEntity.builder().id(4L).projectId(1L).name("Phase 4").subTitle("Sub 4").accentColor("emerald").orderIndex(1).build();

        when(workPhaseRepository.save(any(WorkPhaseEntity.class))).thenReturn(savedPhase);

        var response = workflowGraphService.createPhase(1L, req, 2L);

        assertNotNull(response);
        assertEquals("4", response.id());
        assertEquals("Phase 4", response.name());
        verify(authorizationService).verifyProjectOwner(1L, 2L);
    }

    @Test
    @DisplayName("4.2 deletePhase: Xóa Phase an toàn, chuyển các node con sang standalone (phase_id = null)")
    void testDeletePhaseSafe() {
        WorkPhaseEntity phase = WorkPhaseEntity.builder().id(10L).projectId(1L).name("Phase 10").build();
        NodeEntity childNode = NodeEntity.builder().id(50L).projectId(1L).phaseId(10L).build();

        when(workPhaseRepository.findById(10L)).thenReturn(Optional.of(phase));
        when(nodeRepository.findByPhaseId(10L)).thenReturn(List.of(childNode));
        when(workPhaseRepository.findByParentPhaseIdOrderByOrderIndexAsc(10L)).thenReturn(List.of());

        workflowGraphService.deletePhase(1L, 10L, 2L);

        assertNull(childNode.getPhaseId());
        verify(nodeRepository).saveAll(List.of(childNode));
        verify(workPhaseRepository).delete(phase);
    }

    @Test
    @DisplayName("4.3 createNode: Trùng mã code ném ConflictException (HTTP 409)")
    void testCreateNodeDuplicateCode() {
        CreateNodeRequest req = new CreateNodeRequest(null, "WPE-001", "Task Title", "Desc", JoinPolicy.ALL_COMPLETED, null, null, 8, null);
        when(nodeRepository.findByProjectIdAndCode(1L, "WPE-001"))
            .thenReturn(Optional.of(NodeEntity.builder().id(99L).code("WPE-001").build()));

        assertThrows(ConflictException.class, () -> workflowGraphService.createNode(1L, req, 2L));
    }

    @Test
    @DisplayName("4.3 createDependency: Tự nối vào chính mình ném IllegalArgumentException (HTTP 400)")
    void testCreateDependencySelfLoop() {
        CreateDependencyRequest req = new CreateDependencyRequest(10L, 10L);
        assertThrows(IllegalArgumentException.class, () -> workflowGraphService.createDependency(1L, req, 2L));
    }

    @Test
    @DisplayName("4.5 publishPipeline: Đồ thị hợp lệ, dự án chuyển sang ACTIVE và mở khóa task gốc từ LOCKED sang TODO")
    void testPublishPipelineSuccess() {
        sampleProject.setStatus(com.pipeline.wpe.common.enums.ProjectStatus.DRAFT);
        when(authorizationService.verifyProjectOwner(1L, 2L)).thenReturn(sampleProject);

        NodeEntity rootNode = NodeEntity.builder().id(1L).projectId(1L).code("WPE-001").status(NodeStatus.LOCKED).build();
        NodeEntity childNode = NodeEntity.builder().id(2L).projectId(1L).code("WPE-002").status(NodeStatus.LOCKED).build();
        NodeDependencyEntity edge = NodeDependencyEntity.builder().id(10L).projectId(1L).parentNodeId(1L).childNodeId(2L).build();

        when(nodeRepository.findByProjectId(1L)).thenReturn(List.of(rootNode, childNode));
        when(nodeDependencyRepository.findByProjectId(1L)).thenReturn(List.of(edge));

        PublishPipelineResponse response = workflowGraphService.publishPipeline(1L, 2L);

        assertTrue(response.success());
        assertEquals("ACTIVE", response.status());
        assertEquals(1, response.unlockedTaskCount()); // Chỉ rootNode (ID=1) được mở khóa
        assertEquals(NodeStatus.TODO, rootNode.getStatus());
        assertEquals(NodeStatus.LOCKED, childNode.getStatus()); // childNode vẫn LOCKED
        verify(projectRepository).save(sampleProject);
    }

    @Test
    @DisplayName("4.5 publishPipeline: Đồ thị có chu trình lặp ném CycleDetectedException (HTTP 422)")
    void testPublishPipelineCycleDetected() {
        sampleProject.setStatus(com.pipeline.wpe.common.enums.ProjectStatus.DRAFT);
        when(authorizationService.verifyProjectOwner(1L, 2L)).thenReturn(sampleProject);

        NodeEntity n1 = NodeEntity.builder().id(1L).code("WPE-001").projectId(1L).build();
        NodeEntity n2 = NodeEntity.builder().id(2L).code("WPE-002").projectId(1L).build();

        // 1 -> 2 và 2 -> 1 (chu trình lặp 2 chiều)
        NodeDependencyEntity e1 = NodeDependencyEntity.builder().parentNodeId(1L).childNodeId(2L).projectId(1L).build();
        NodeDependencyEntity e2 = NodeDependencyEntity.builder().parentNodeId(2L).childNodeId(1L).projectId(1L).build();

        when(nodeRepository.findByProjectId(1L)).thenReturn(List.of(n1, n2));
        when(nodeDependencyRepository.findByProjectId(1L)).thenReturn(List.of(e1, e2));

        assertThrows(CycleDetectedException.class, () -> workflowGraphService.publishPipeline(1L, 2L));
        verify(projectRepository, never()).save(sampleProject);
    }

    // ===================== B2: chặn ghi trên dự án ARCHIVED =====================

    private void archiveSampleProject() {
        sampleProject.setStatus(com.pipeline.wpe.common.enums.ProjectStatus.ARCHIVED);
        when(authorizationService.verifyProjectOwner(1L, 2L)).thenReturn(sampleProject);
    }

    private void assertProjectArchived(org.junit.jupiter.api.function.Executable call) {
        ConflictException ex = assertThrows(ConflictException.class, call);
        assertEquals("PROJECT_ARCHIVED", ex.getErrorCode());
    }

    @Test
    @DisplayName("B2 createPhase: dự án ARCHIVED ném ConflictException PROJECT_ARCHIVED (HTTP 409), không lưu")
    void testCreatePhaseArchivedProject() {
        archiveSampleProject();

        assertProjectArchived(() -> workflowGraphService.createPhase(1L, new CreatePhaseRequest("C", null, null, null, null, null), 2L));
        verify(workPhaseRepository, never()).save(any());
    }

    @Test
    @DisplayName("B2 updatePhase: dự án ARCHIVED ném PROJECT_ARCHIVED, không lưu")
    void testUpdatePhaseArchivedProject() {
        archiveSampleProject();

        assertProjectArchived(() -> workflowGraphService.updatePhase(1L, 10L, new UpdatePhaseRequest("Doi ten", null, null, null, null, null), 2L));
        verify(workPhaseRepository, never()).save(any());
    }

    @Test
    @DisplayName("B2 deletePhase: dự án ARCHIVED ném PROJECT_ARCHIVED, không xóa")
    void testDeletePhaseArchivedProject() {
        archiveSampleProject();

        assertProjectArchived(() -> workflowGraphService.deletePhase(1L, 10L, 2L));
        verify(workPhaseRepository, never()).delete(any());
    }

    @Test
    @DisplayName("B2 connectPhases: dự án ARCHIVED ném PROJECT_ARCHIVED, không thêm cạnh")
    void testConnectPhasesArchivedProject() {
        archiveSampleProject();

        assertProjectArchived(() -> workflowGraphService.connectPhases(1L, 5L, 4L, 2L));
        verify(phaseDependencyRepository, never()).save(any());
    }

    @Test
    @DisplayName("B2 disconnectPhases: dự án ARCHIVED ném PROJECT_ARCHIVED, không gỡ cạnh")
    void testDisconnectPhasesArchivedProject() {
        archiveSampleProject();

        assertProjectArchived(() -> workflowGraphService.disconnectPhases(1L, 5L, 4L, 2L));
        verify(phaseDependencyRepository, never()).deleteByParentPhaseIdAndChildPhaseId(any(), any());
    }

    // ===================== B2: lưu vị trí Phase (ui_metadata, V9) =====================

    @Test
    @DisplayName("B2 createPhase: uiMetadata gửi lên được lưu vào entity và trả lại trong response")
    void testCreatePhaseSavesUiMetadata() {
        Map<String, Object> pos = Map.of("x", 280, "y", 140, "w", 250, "h", 220);
        when(workPhaseRepository.save(any(WorkPhaseEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        var response = workflowGraphService.createPhase(1L, new CreatePhaseRequest("C", null, null, null, 0, pos), 2L);

        verify(workPhaseRepository).save(argThat(p -> pos.equals(p.getUiMetadata())));
        assertEquals(pos, response.uiMetadata());
    }

    @Test
    @DisplayName("B2 createPhase: không gửi uiMetadata thì lưu map rỗng (cột NOT NULL), không lưu null")
    void testCreatePhaseWithoutUiMetadataDefaultsToEmptyMap() {
        when(workPhaseRepository.save(any(WorkPhaseEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        var response = workflowGraphService.createPhase(1L, new CreatePhaseRequest("C", null, null, null, 0, null), 2L);

        assertEquals(Map.of(), response.uiMetadata());
    }

    @Test
    @DisplayName("B2 updatePhase: uiMetadata mới ghi đè vị trí cũ và trả lại trong response")
    void testUpdatePhaseSavesUiMetadata() {
        WorkPhaseEntity phase = WorkPhaseEntity.builder().id(10L).projectId(1L).name("P").orderIndex(0)
            .uiMetadata(Map.of("x", 1, "y", 2)).build();
        Map<String, Object> pos = Map.of("x", 280, "y", 140, "w", 250, "h", 220);
        when(workPhaseRepository.findById(10L)).thenReturn(Optional.of(phase));
        when(workPhaseRepository.save(any(WorkPhaseEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        var response = workflowGraphService.updatePhase(1L, 10L, new UpdatePhaseRequest("P", null, null, null, null, pos), 2L);

        assertEquals(pos, phase.getUiMetadata());
        assertEquals(pos, response.uiMetadata());
    }

    @Test
    @DisplayName("B2 updatePhase: không gửi uiMetadata (chỉ đổi tên) thì giữ nguyên vị trí cũ")
    void testUpdatePhaseWithoutUiMetadataKeepsOldPosition() {
        Map<String, Object> old = Map.of("x", 1, "y", 2);
        WorkPhaseEntity phase = WorkPhaseEntity.builder().id(10L).projectId(1L).name("P").orderIndex(0).uiMetadata(old).build();
        when(workPhaseRepository.findById(10L)).thenReturn(Optional.of(phase));
        when(workPhaseRepository.save(any(WorkPhaseEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        var response = workflowGraphService.updatePhase(1L, 10L, new UpdatePhaseRequest("Ten moi", null, null, null, null, null), 2L);

        assertEquals("Ten moi", response.name());
        assertEquals(old, response.uiMetadata());
    }

    @Test
    @DisplayName("B2 getGraph: mỗi Phase trả lại uiMetadata đã lưu")
    void testGetGraphReturnsPhaseUiMetadata() {
        Map<String, Object> pos = Map.of("x", 280, "y", 140, "w", 250, "h", 220);
        WorkPhaseEntity p1 = WorkPhaseEntity.builder().id(10L).projectId(1L).name("P1").orderIndex(0).uiMetadata(pos).build();
        when(workPhaseRepository.findByProjectIdOrderByOrderIndexAsc(1L)).thenReturn(List.of(p1));
        when(nodeRepository.findByProjectId(1L)).thenReturn(List.of());
        when(nodeDependencyRepository.findByProjectId(1L)).thenReturn(List.of());

        assertEquals(pos, workflowGraphService.getGraph(1L, 2L).phases().get(0).uiMetadata());
    }

    // ===================== B2: các case còn thiếu =====================

    @Test
    @DisplayName("B2 getGraph: dự án ARCHIVED vẫn đọc được (chỉ chặn ghi)")
    void testGetGraphArchivedProjectStillReadable() {
        sampleProject.setStatus(com.pipeline.wpe.common.enums.ProjectStatus.ARCHIVED);
        when(workPhaseRepository.findByProjectIdOrderByOrderIndexAsc(1L)).thenReturn(List.of());
        when(nodeRepository.findByProjectId(1L)).thenReturn(List.of());
        when(nodeDependencyRepository.findByProjectId(1L)).thenReturn(List.of());

        assertNotNull(workflowGraphService.getGraph(1L, 2L));
    }

    @Test
    @DisplayName("B2 createPhase: không phải owner ném ForbiddenException (HTTP 403), không lưu")
    void testCreatePhaseNotOwner() {
        when(authorizationService.verifyProjectOwner(1L, 3L))
            .thenThrow(new ForbiddenException("ACCESS_DENIED", "Chỉ Chủ dự án mới có quyền."));

        assertThrows(ForbiddenException.class,
            () -> workflowGraphService.createPhase(1L, new CreatePhaseRequest("C", null, null, null, null, null), 3L));
        verify(workPhaseRepository, never()).save(any());
    }

    @Test
    @DisplayName("B2 updatePhase: đặt parentPhaseId tạo vòng (P1 -> P2, rồi P2 làm cha của P1) ném CycleDetectedException")
    void testUpdatePhaseParentCreatesCycle() {
        WorkPhaseEntity p1 = WorkPhaseEntity.builder().id(1L).projectId(1L).name("P1").orderIndex(0).build();
        WorkPhaseEntity p2 = WorkPhaseEntity.builder().id(2L).projectId(1L).name("P2").orderIndex(1).build();
        when(workPhaseRepository.findById(1L)).thenReturn(Optional.of(p1));
        when(workPhaseRepository.findById(2L)).thenReturn(Optional.of(p2));
        when(workPhaseRepository.findByProjectIdOrderByOrderIndexAsc(1L)).thenReturn(List.of(p1, p2));
        when(phaseDependencyRepository.findByProjectId(1L)).thenReturn(List.of(
            PhaseDependencyEntity.builder().projectId(1L).parentPhaseId(1L).childPhaseId(2L).build()
        ));

        assertThrows(CycleDetectedException.class,
            () -> workflowGraphService.updatePhase(1L, 1L, new UpdatePhaseRequest("P1", null, null, 2L, null, null), 2L));
        verify(phaseDependencyRepository, never()).save(any());
    }

    @Test
    @DisplayName("B2 disconnectPhases: gỡ cả cạnh trong bảng nối lẫn cột cũ parent_phase_id")
    void testDisconnectPhasesClearsLegacyColumn() {
        WorkPhaseEntity p4 = WorkPhaseEntity.builder().id(4L).projectId(1L).name("P4").parentPhaseId(1L).orderIndex(2).build();
        when(workPhaseRepository.findById(4L)).thenReturn(Optional.of(p4));

        workflowGraphService.disconnectPhases(1L, 1L, 4L, 2L);

        verify(phaseDependencyRepository).deleteByParentPhaseIdAndChildPhaseId(1L, 4L);
        assertNull(p4.getParentPhaseId());
        verify(workPhaseRepository).save(p4);
    }
}
