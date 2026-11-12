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
import com.pipeline.wpe.repository.ProjectMemberRepository;
import com.pipeline.wpe.repository.ProjectRepository;
import com.pipeline.wpe.dto.request.graph.UpdateNodeMetadataRequest;
import com.pipeline.wpe.dto.request.graph.UpdateNodeRequest;
import org.springframework.dao.OptimisticLockingFailureException;
import com.pipeline.wpe.mapper.NodeMapper;
import com.pipeline.wpe.service.event.SseEmitterService;
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
import static org.mockito.ArgumentMatchers.eq;
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

    @Mock
    private ProjectMemberRepository projectMemberRepository;

    @Mock
    private SseEmitterService sseEmitterService;

    @Mock
    private NodeMapper nodeMapper;

    @Mock
    private com.pipeline.wpe.service.event.WorkflowEventPublisher eventPublisher;

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

    // ===================== B4: vá publishPipeline =====================

    @Test
    @DisplayName("B4 lỗi 1: dự án PAUSED, COMPLETED, INACTIVE không xuất bản được, ném ConflictException INVALID_PROJECT_STATUS (HTTP 409)")
    void testPublishPipelineRejectsNonDraftStatuses() {
        for (var status : List.of(
            com.pipeline.wpe.common.enums.ProjectStatus.PAUSED,
            com.pipeline.wpe.common.enums.ProjectStatus.COMPLETED,
            com.pipeline.wpe.common.enums.ProjectStatus.INACTIVE)) {
            sampleProject.setStatus(status);

            ConflictException ex = assertThrows(ConflictException.class,
                () -> workflowGraphService.publishPipeline(1L, 2L),
                "Dự án " + status + " phải bị chặn xuất bản");

            assertEquals("INVALID_PROJECT_STATUS", ex.getErrorCode());
            assertEquals(status, sampleProject.getStatus(), "Trạng thái dự án không được đổi");
        }
        verify(projectRepository, never()).save(any());
    }

    @Test
    @DisplayName("B4 lỗi 1: dự án ARCHIVED không xuất bản được, ném ConflictException PROJECT_ARCHIVED (HTTP 409)")
    void testPublishPipelineRejectsArchived() {
        sampleProject.setStatus(com.pipeline.wpe.common.enums.ProjectStatus.ARCHIVED);

        ConflictException ex = assertThrows(ConflictException.class, () -> workflowGraphService.publishPipeline(1L, 2L));

        assertEquals("PROJECT_ARCHIVED", ex.getErrorCode());
        assertEquals(com.pipeline.wpe.common.enums.ProjectStatus.ARCHIVED, sampleProject.getStatus());
        verify(projectRepository, never()).save(any());
    }

    @Test
    @DisplayName("B4 lỗi 2: dự án đã ACTIVE xuất bản lần nữa ném ConflictException INVALID_PROJECT_STATUS (HTTP 409), không phải 400")
    void testPublishPipelineAlreadyActiveIsConflict() {
        sampleProject.setStatus(com.pipeline.wpe.common.enums.ProjectStatus.ACTIVE);

        ConflictException ex = assertThrows(ConflictException.class, () -> workflowGraphService.publishPipeline(1L, 2L));

        assertEquals("INVALID_PROJECT_STATUS", ex.getErrorCode());
        verify(projectRepository, never()).save(any());
    }

    @Test
    @DisplayName("B4: dự án PLANNING vẫn xuất bản được")
    void testPublishPipelineFromPlanning() {
        sampleProject.setStatus(com.pipeline.wpe.common.enums.ProjectStatus.PLANNING);
        when(nodeRepository.findByProjectId(1L)).thenReturn(List.of());
        when(nodeDependencyRepository.findByProjectId(1L)).thenReturn(List.of());

        PublishPipelineResponse response = workflowGraphService.publishPipeline(1L, 2L);

        assertEquals("ACTIVE", response.status());
        assertEquals(com.pipeline.wpe.common.enums.ProjectStatus.ACTIVE, sampleProject.getStatus());
    }

    @Test
    @DisplayName("B4 lỗi 3: người phụ trách node gốc vừa mở khóa nhận SSE TASK_UNLOCKED và thông báo; node không có người phụ trách và node con thì không")
    void testPublishPipelineNotifiesAssigneesOfUnlockedRoots() {
        NodeEntity rootOfSarah = NodeEntity.builder().id(1L).projectId(1L).code("WPE-001").title("Thu thập yêu cầu").status(NodeStatus.LOCKED).assignedUserId(3L).build();
        NodeEntity rootNoAssignee = NodeEntity.builder().id(2L).projectId(1L).code("WPE-002").title("Chuẩn bị môi trường").status(NodeStatus.LOCKED).build();
        NodeEntity child = NodeEntity.builder().id(3L).projectId(1L).code("WPE-003").title("Thiết kế").status(NodeStatus.LOCKED).assignedUserId(4L).build();
        NodeDependencyEntity edge = NodeDependencyEntity.builder().id(10L).projectId(1L).parentNodeId(1L).childNodeId(3L).build();
        when(nodeRepository.findByProjectId(1L)).thenReturn(List.of(rootOfSarah, rootNoAssignee, child));
        when(nodeDependencyRepository.findByProjectId(1L)).thenReturn(List.of(edge));

        PublishPipelineResponse response = workflowGraphService.publishPipeline(1L, 2L);

        assertEquals(2, response.unlockedTaskCount());
        verify(sseEmitterService).sendToUser(eq(3L), eq("TASK_UNLOCKED"), any());
        verify(sseEmitterService, times(1)).sendToUser(any(), any(), any());

        var captor = org.mockito.ArgumentCaptor.forClass(com.pipeline.wpe.dto.event.NotificationEvent.class);
        verify(eventPublisher, times(1)).publishNotification(captor.capture());
        assertEquals(3L, captor.getValue().recipientUserId());
        assertEquals(1L, captor.getValue().projectId());
        assertTrue(captor.getValue().message().contains("WPE-001"));
    }

    @Test
    @DisplayName("B4 lỗi 3: SSE và thông báo chỉ gửi SAU KHI transaction commit, trước đó chưa gửi gì")
    void testPublishPipelineSendsEventsOnlyAfterCommit() {
        NodeEntity root = NodeEntity.builder().id(1L).projectId(1L).code("WPE-001").title("Thu thập yêu cầu").status(NodeStatus.LOCKED).assignedUserId(3L).build();
        when(nodeRepository.findByProjectId(1L)).thenReturn(List.of(root));
        when(nodeDependencyRepository.findByProjectId(1L)).thenReturn(List.of());

        // Giả lập đang ở trong một transaction: Spring cho đăng ký việc "làm sau khi commit"
        org.springframework.transaction.support.TransactionSynchronizationManager.initSynchronization();
        try {
            workflowGraphService.publishPipeline(1L, 2L);

            // Hàm đã chạy xong nhưng transaction chưa commit: chưa được gửi gì
            verify(sseEmitterService, never()).sendToUser(any(), any(), any());
            verify(eventPublisher, never()).publishNotification(any());
            // Nội dung gửi đi cũng phải tạo sau commit: lúc đó node mới mang số version đã tăng trong DB.
            // Tạo sớm thì client nhận version cũ, bấm "bắt đầu" sẽ bị 409 lệch version.
            verify(nodeMapper, never()).toKanbanTaskResponse(any());

            // Giả lập commit thành công
            var syncs = org.springframework.transaction.support.TransactionSynchronizationManager.getSynchronizations();
            assertEquals(1, syncs.size());
            syncs.forEach(org.springframework.transaction.support.TransactionSynchronization::afterCommit);

            verify(sseEmitterService).sendToUser(eq(3L), eq("TASK_UNLOCKED"), any());
            verify(eventPublisher).publishNotification(any());
        } finally {
            org.springframework.transaction.support.TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    @DisplayName("B4 lỗi 3: gửi thông báo bị lỗi (RabbitMQ hỏng) không làm hỏng kết quả xuất bản, node sau vẫn được gửi")
    void testPublishPipelineSurvivesNotificationFailure() {
        NodeEntity r1 = NodeEntity.builder().id(1L).projectId(1L).code("WPE-001").title("A").status(NodeStatus.LOCKED).assignedUserId(3L).build();
        NodeEntity r2 = NodeEntity.builder().id(2L).projectId(1L).code("WPE-002").title("B").status(NodeStatus.LOCKED).assignedUserId(4L).build();
        when(nodeRepository.findByProjectId(1L)).thenReturn(List.of(r1, r2));
        when(nodeDependencyRepository.findByProjectId(1L)).thenReturn(List.of());
        doThrow(new RuntimeException("RabbitMQ down")).when(eventPublisher).publishNotification(any());

        PublishPipelineResponse response = assertDoesNotThrow(() -> workflowGraphService.publishPipeline(1L, 2L));

        assertTrue(response.success());
        assertEquals(2, response.unlockedTaskCount());
        verify(sseEmitterService).sendToUser(eq(3L), eq("TASK_UNLOCKED"), any());
        verify(sseEmitterService).sendToUser(eq(4L), eq("TASK_UNLOCKED"), any());
    }

    @Test
    @DisplayName("B4: node gốc đã TODO từ trước (không nằm trong Phase, hoặc được gỡ cạnh lúc DRAFT) không tính vào unlockedTaskCount và không gửi lại SSE")
    void testPublishPipelineSkipsRootsAlreadyTodo() {
        NodeEntity alreadyTodo = NodeEntity.builder().id(1L).projectId(1L).code("WPE-001").title("A").status(NodeStatus.TODO).assignedUserId(3L).build();
        NodeEntity locked = NodeEntity.builder().id(2L).projectId(1L).code("WPE-002").title("B").status(NodeStatus.LOCKED).assignedUserId(4L).build();
        when(nodeRepository.findByProjectId(1L)).thenReturn(List.of(alreadyTodo, locked));
        when(nodeDependencyRepository.findByProjectId(1L)).thenReturn(List.of());

        PublishPipelineResponse response = workflowGraphService.publishPipeline(1L, 2L);

        assertEquals(1, response.unlockedTaskCount());
        verify(sseEmitterService, never()).sendToUser(eq(3L), any(), any());
        verify(sseEmitterService).sendToUser(eq(4L), eq("TASK_UNLOCKED"), any());
    }

    @Test
    @DisplayName("B4 lỗi 4: cycleNodes chỉ gồm node nằm trên chu trình, không gồm node đứng sau chu trình")
    void testPublishPipelineCycleNodesExcludeDownstream() {
        NodeEntity n1 = NodeEntity.builder().id(1L).code("WPE-001").projectId(1L).build();
        NodeEntity n2 = NodeEntity.builder().id(2L).code("WPE-002").projectId(1L).build();
        NodeEntity n3 = NodeEntity.builder().id(3L).code("WPE-003").projectId(1L).build();
        // 1 <-> 2 là chu trình; 3 chỉ đứng sau chu trình (2 -> 3)
        NodeDependencyEntity e1 = NodeDependencyEntity.builder().parentNodeId(1L).childNodeId(2L).projectId(1L).build();
        NodeDependencyEntity e2 = NodeDependencyEntity.builder().parentNodeId(2L).childNodeId(1L).projectId(1L).build();
        NodeDependencyEntity e3 = NodeDependencyEntity.builder().parentNodeId(2L).childNodeId(3L).projectId(1L).build();
        when(nodeRepository.findByProjectId(1L)).thenReturn(List.of(n1, n2, n3));
        when(nodeDependencyRepository.findByProjectId(1L)).thenReturn(List.of(e1, e2, e3));

        CycleDetectedException ex = assertThrows(CycleDetectedException.class, () -> workflowGraphService.publishPipeline(1L, 2L));

        assertEquals(List.of("WPE-001", "WPE-002"), ex.getCycleNodes().stream().sorted().toList());
        assertEquals(com.pipeline.wpe.common.enums.ProjectStatus.DRAFT, sampleProject.getStatus());
        verify(sseEmitterService, never()).sendToUser(any(), any(), any());
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

    // ===================== B3: 4 lỗ hổng của API node và phụ thuộc =====================

    private NodeEntity node(long id, String code, NodeStatus status) {
        return NodeEntity.builder().id(id).projectId(1L).code(code).title(code).status(status)
            .joinPolicy(JoinPolicy.ALL_COMPLETED).version(0L).build();
    }

    private NodeDependencyEntity edge(long parentId, long childId) {
        return NodeDependencyEntity.builder().projectId(1L).parentNodeId(parentId).childNodeId(childId).build();
    }

    @Test
    @DisplayName("B3 lỗ hổng 1: A->B, B->C rồi nối C->A (vòng 3 node) ném CycleDetectedException, không lưu cạnh")
    void testCreateDependencyLongCycle() {
        NodeEntity a = node(1L, "WPE-001", NodeStatus.LOCKED);
        NodeEntity b = node(2L, "WPE-002", NodeStatus.LOCKED);
        NodeEntity c = node(3L, "WPE-003", NodeStatus.LOCKED);
        lenient().when(nodeRepository.findById(1L)).thenReturn(Optional.of(a));
        lenient().when(nodeRepository.findById(3L)).thenReturn(Optional.of(c));
        lenient().when(nodeRepository.findByProjectId(1L)).thenReturn(List.of(a, b, c));
        lenient().when(nodeDependencyRepository.findByProjectId(1L)).thenReturn(List.of(edge(1L, 2L), edge(2L, 3L)));

        CycleDetectedException ex = assertThrows(CycleDetectedException.class,
            () -> workflowGraphService.createDependency(1L, new CreateDependencyRequest(3L, 1L), 2L));

        assertEquals(List.of("WPE-001", "WPE-002", "WPE-003"), ex.getCycleNodes());
        verify(nodeDependencyRepository, never()).save(any());
    }

    @Test
    @DisplayName("B3 lỗ hổng 2: người không phải owner (kể cả Viewer) gọi 4 API ghi node/cạnh/tọa độ đều bị 403")
    void testNodeWriteApisRequireOwner() {
        when(authorizationService.verifyProjectOwner(1L, 3L))
            .thenThrow(new ForbiddenException("ACCESS_DENIED", "Chỉ Chủ dự án mới có quyền."));
        lenient().when(nodeRepository.findById(100L)).thenReturn(Optional.of(node(100L, "WPE-100", NodeStatus.TODO)));
        CreateNodeRequest nodeReq = new CreateNodeRequest(null, null, "Task", null, null, null, null, null, null);

        assertAll(
            () -> assertThrows(ForbiddenException.class, () -> workflowGraphService.createNode(1L, nodeReq, 3L)),
            () -> assertThrows(ForbiddenException.class,
                () -> workflowGraphService.createDependency(1L, new CreateDependencyRequest(100L, 101L), 3L)),
            () -> assertThrows(ForbiddenException.class, () -> workflowGraphService.deleteDependency(1L, 100L, 101L, 3L)),
            () -> assertThrows(ForbiddenException.class,
                () -> workflowGraphService.updateNodeMetadata(100L, new UpdateNodeMetadataRequest(Map.of("x", 1)), 3L))
        );
        verify(nodeRepository, never()).save(any());
        verify(nodeDependencyRepository, never()).save(any());
        verify(nodeDependencyRepository, never()).delete(any());
    }

    @Test
    @DisplayName("B3 lỗ hổng 3: lưu tọa độ không đi qua save() nên không làm tăng version của node")
    void testUpdateNodeMetadataDoesNotBumpVersion() {
        NodeEntity n = node(100L, "WPE-100", NodeStatus.TODO);
        n.setVersion(5L);
        Map<String, Object> meta = Map.of("position", Map.of("x", 300, "y", 200));
        when(nodeRepository.findById(100L)).thenReturn(Optional.of(n));
        lenient().when(nodeRepository.save(any(NodeEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        var response = workflowGraphService.updateNodeMetadata(100L, new UpdateNodeMetadataRequest(meta), 2L);

        verify(nodeRepository, never()).save(any());
        verify(nodeRepository).updateUiMetadata(100L, meta);
        assertEquals(5L, response.version());
        assertEquals(meta, response.uiMetadata());
        assertNull(n.getUiMetadata()); // không sửa entity đang được quản lý, tránh Hibernate tự tăng version
    }

    @Test
    @DisplayName("B3 lỗ hổng 4a: node TODO được thêm một cha chưa DONE (ALL_COMPLETED) thì chuyển về LOCKED")
    void testCreateDependencyLocksTodoChildWhenNewParentNotDone() {
        NodeEntity parent = node(10L, "WPE-010", NodeStatus.TODO);
        NodeEntity child = node(11L, "WPE-011", NodeStatus.TODO);
        when(nodeRepository.findById(10L)).thenReturn(Optional.of(parent));
        when(nodeRepository.findById(11L)).thenReturn(Optional.of(child));
        lenient().when(nodeRepository.findByProjectId(1L)).thenReturn(List.of(parent, child));
        lenient().when(nodeDependencyRepository.findByProjectId(1L)).thenReturn(List.of());

        workflowGraphService.createDependency(1L, new CreateDependencyRequest(10L, 11L), 2L);

        assertEquals(NodeStatus.LOCKED, child.getStatus());
    }

    @Test
    @DisplayName("B3 lỗ hổng 4b: gỡ cạnh làm node LOCKED mất hết cha thì chuyển sang TODO và gửi TASK_UNLOCKED")
    void testDeleteDependencyUnlocksChildWithoutParents() {
        NodeEntity child = node(11L, "WPE-011", NodeStatus.LOCKED);
        child.setAssignedUserId(3L);
        NodeDependencyEntity dep = edge(10L, 11L);
        when(nodeDependencyRepository.findByParentNodeIdAndChildNodeId(10L, 11L)).thenReturn(Optional.of(dep));
        lenient().when(nodeRepository.findById(11L)).thenReturn(Optional.of(child));
        lenient().when(nodeDependencyRepository.findByChildNodeId(11L)).thenReturn(List.of());
        lenient().when(nodeRepository.save(any(NodeEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        workflowGraphService.deleteDependency(1L, 10L, 11L, 2L);

        assertEquals(NodeStatus.TODO, child.getStatus());
        verify(sseEmitterService).sendToUser(eq(3L), eq("TASK_UNLOCKED"), any());
    }

    // ===================== B3: các case bổ sung =====================

    @Test
    @DisplayName("B3 createDependency: ANY_COMPLETED đã có một cha DONE, thêm cha chưa DONE thì node con vẫn TODO")
    void testCreateDependencyAnyCompletedKeepsTodo() {
        NodeEntity doneParent = node(9L, "WPE-009", NodeStatus.DONE);
        NodeEntity newParent = node(10L, "WPE-010", NodeStatus.TODO);
        NodeEntity child = node(11L, "WPE-011", NodeStatus.TODO);
        child.setJoinPolicy(JoinPolicy.ANY_COMPLETED);
        when(nodeRepository.findById(10L)).thenReturn(Optional.of(newParent));
        when(nodeRepository.findById(11L)).thenReturn(Optional.of(child));
        when(nodeRepository.findByProjectId(1L)).thenReturn(List.of(doneParent, newParent, child));
        when(nodeDependencyRepository.findByProjectId(1L)).thenReturn(List.of(edge(9L, 11L)));

        workflowGraphService.createDependency(1L, new CreateDependencyRequest(10L, 11L), 2L);

        assertEquals(NodeStatus.TODO, child.getStatus());
        verify(nodeDependencyRepository).save(any());
    }

    @Test
    @DisplayName("B3 createDependency: node con đang IN_PROGRESS ném NODE_IN_USE (HTTP 409), không lưu cạnh")
    void testCreateDependencyChildInUse() {
        NodeEntity parent = node(10L, "WPE-010", NodeStatus.TODO);
        NodeEntity child = node(11L, "WPE-011", NodeStatus.IN_PROGRESS);
        when(nodeRepository.findById(10L)).thenReturn(Optional.of(parent));
        when(nodeRepository.findById(11L)).thenReturn(Optional.of(child));
        when(nodeRepository.findByProjectId(1L)).thenReturn(List.of(parent, child));
        when(nodeDependencyRepository.findByProjectId(1L)).thenReturn(List.of());

        ConflictException ex = assertThrows(ConflictException.class,
            () -> workflowGraphService.createDependency(1L, new CreateDependencyRequest(10L, 11L), 2L));

        assertEquals("NODE_IN_USE", ex.getErrorCode());
        verify(nodeDependencyRepository, never()).save(any());
    }

    @Test
    @DisplayName("B3 createDependency: cạnh đã có thì trả về luôn (lũy đẳng), không lưu lại, không đổi trạng thái")
    void testCreateDependencyIdempotent() {
        NodeEntity parent = node(10L, "WPE-010", NodeStatus.TODO);
        NodeEntity child = node(11L, "WPE-011", NodeStatus.IN_PROGRESS);
        when(nodeRepository.findById(10L)).thenReturn(Optional.of(parent));
        when(nodeRepository.findById(11L)).thenReturn(Optional.of(child));
        when(nodeDependencyRepository.existsByParentNodeIdAndChildNodeId(10L, 11L)).thenReturn(true);

        var response = workflowGraphService.createDependency(1L, new CreateDependencyRequest(10L, 11L), 2L);

        assertEquals("10", response.parentNodeId());
        verify(nodeDependencyRepository, never()).save(any());
        assertEquals(NodeStatus.IN_PROGRESS, child.getStatus());
    }

    @Test
    @DisplayName("B3 deleteDependency: gỡ cạnh nhưng node LOCKED còn một cha chưa DONE thì vẫn LOCKED, không gửi SSE")
    void testDeleteDependencyKeepsLockedWhenOtherParentNotDone() {
        NodeEntity otherParent = node(9L, "WPE-009", NodeStatus.TODO);
        NodeEntity child = node(11L, "WPE-011", NodeStatus.LOCKED);
        when(nodeDependencyRepository.findByParentNodeIdAndChildNodeId(10L, 11L)).thenReturn(Optional.of(edge(10L, 11L)));
        when(nodeRepository.findById(11L)).thenReturn(Optional.of(child));
        when(nodeDependencyRepository.findByChildNodeId(11L)).thenReturn(List.of(edge(9L, 11L)));
        when(nodeRepository.findAllById(List.of(9L))).thenReturn(List.of(otherParent));

        workflowGraphService.deleteDependency(1L, 10L, 11L, 2L);

        assertEquals(NodeStatus.LOCKED, child.getStatus());
        verifyNoInteractions(sseEmitterService);
    }

    @Test
    @DisplayName("B3 ARCHIVED: 6 thao tác ghi node/cạnh/tọa độ trên dự án ARCHIVED đều ném PROJECT_ARCHIVED")
    void testNodeWriteApisArchivedProject() {
        archiveSampleProject();
        lenient().when(nodeRepository.findById(100L)).thenReturn(Optional.of(node(100L, "WPE-100", NodeStatus.TODO)));
        CreateNodeRequest nodeReq = new CreateNodeRequest(null, null, "Task", null, null, null, null, null, null);
        UpdateNodeRequest updateReq = new UpdateNodeRequest("Task", null, null, null, null, null, null, 0L);

        assertAll(
            () -> assertProjectArchived(() -> workflowGraphService.createNode(1L, nodeReq, 2L)),
            () -> assertProjectArchived(() -> workflowGraphService.createDependency(1L, new CreateDependencyRequest(100L, 101L), 2L)),
            () -> assertProjectArchived(() -> workflowGraphService.deleteDependency(1L, 100L, 101L, 2L)),
            () -> assertProjectArchived(() -> workflowGraphService.updateNodeMetadata(100L, new UpdateNodeMetadataRequest(Map.of("x", 1)), 2L)),
            () -> assertProjectArchived(() -> workflowGraphService.updateNode(100L, updateReq, 2L)),
            () -> assertProjectArchived(() -> workflowGraphService.deleteNode(100L, 2L))
        );
        verify(nodeRepository, never()).save(any());
        verify(nodeRepository, never()).delete(any());
    }

    // ===================== B3: PUT /nodes/{id} =====================

    @Test
    @DisplayName("B3 updateNode: sửa các trường, dời dueDate sang tương lai thì isOverdue = false, không đổi status")
    void testUpdateNodeSuccess() {
        NodeEntity n = node(100L, "WPE-100", NodeStatus.IN_PROGRESS);
        n.setVersion(3L);
        n.setIsOverdue(true);
        Instant future = Instant.now().plusSeconds(86400);
        when(nodeRepository.findById(100L)).thenReturn(Optional.of(n));
        when(projectMemberRepository.existsByProjectIdAndUserIdAndRemovedAtIsNull(1L, 3L)).thenReturn(true);
        when(nodeRepository.saveAndFlush(any(NodeEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        var response = workflowGraphService.updateNode(100L,
            new UpdateNodeRequest("  Ten moi  ", "Mo ta", null, null, 3L, future, 16, 3L), 2L);

        assertEquals("Ten moi", response.title());
        assertEquals("Mo ta", n.getDescription());
        assertEquals(3L, n.getAssignedUserId());
        assertEquals(16, n.getEstimatedHours());
        assertEquals(future, n.getDueDate());
        assertFalse(n.getIsOverdue());
        assertEquals(NodeStatus.IN_PROGRESS, n.getStatus());
    }

    @Test
    @DisplayName("B3 updateNode: sai version ném OptimisticLockingFailureException (HTTP 409), không lưu")
    void testUpdateNodeWrongVersion() {
        NodeEntity n = node(100L, "WPE-100", NodeStatus.TODO);
        n.setVersion(3L);
        when(nodeRepository.findById(100L)).thenReturn(Optional.of(n));

        assertThrows(OptimisticLockingFailureException.class,
            () -> workflowGraphService.updateNode(100L, new UpdateNodeRequest("X", null, null, null, null, null, null, 2L), 2L));
        verify(nodeRepository, never()).saveAndFlush(any());
    }

    @Test
    @DisplayName("B3 updateNode: người phụ trách không phải thành viên ném IllegalArgumentException ASSIGNEE_NOT_MEMBER (HTTP 400)")
    void testUpdateNodeAssigneeNotMember() {
        NodeEntity n = node(100L, "WPE-100", NodeStatus.TODO);
        when(nodeRepository.findById(100L)).thenReturn(Optional.of(n));
        when(projectMemberRepository.existsByProjectIdAndUserIdAndRemovedAtIsNull(1L, 99L)).thenReturn(false);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
            () -> workflowGraphService.updateNode(100L, new UpdateNodeRequest("X", null, null, null, 99L, null, null, 0L), 2L));

        assertTrue(ex.getMessage().startsWith("ASSIGNEE_NOT_MEMBER"));
        verify(nodeRepository, never()).saveAndFlush(any());
    }

    @Test
    @DisplayName("B3 updateNode: đổi ALL_COMPLETED sang ANY_COMPLETED khi đã có một cha DONE thì node LOCKED mở khóa thành TODO")
    void testUpdateNodeJoinPolicyChangeRecomputesStatus() {
        NodeEntity done = node(8L, "WPE-008", NodeStatus.DONE);
        NodeEntity notDone = node(9L, "WPE-009", NodeStatus.TODO);
        NodeEntity n = node(100L, "WPE-100", NodeStatus.LOCKED);
        when(nodeRepository.findById(100L)).thenReturn(Optional.of(n));
        when(nodeDependencyRepository.findByChildNodeId(100L)).thenReturn(List.of(edge(8L, 100L), edge(9L, 100L)));
        when(nodeRepository.findAllById(List.of(8L, 9L))).thenReturn(List.of(done, notDone));
        when(nodeRepository.save(any(NodeEntity.class))).thenAnswer(inv -> inv.getArgument(0));
        when(nodeRepository.saveAndFlush(any(NodeEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        var response = workflowGraphService.updateNode(100L,
            new UpdateNodeRequest("WPE-100", null, null, JoinPolicy.ANY_COMPLETED, null, null, null, 0L), 2L);

        assertEquals("TODO", response.status());
        assertEquals("ANY_COMPLETED", response.joinPolicy());
    }

    // ===================== B3: DELETE /nodes/{id} =====================

    @Test
    @DisplayName("B3 deleteNode: node TODO được xóa cùng các cạnh; node con LOCKED mất cha duy nhất thì thành TODO")
    void testDeleteNodeSuccessAndRecomputeChildren() {
        NodeEntity n = node(100L, "WPE-100", NodeStatus.TODO);
        NodeEntity child = node(101L, "WPE-101", NodeStatus.LOCKED);
        List<NodeDependencyEntity> outgoing = List.of(edge(100L, 101L));
        when(nodeRepository.findById(100L)).thenReturn(Optional.of(n));
        when(nodeRepository.findById(101L)).thenReturn(Optional.of(child));
        when(nodeDependencyRepository.findByParentNodeId(100L)).thenReturn(outgoing);
        when(nodeDependencyRepository.findByChildNodeId(100L)).thenReturn(List.of());
        when(nodeDependencyRepository.findByChildNodeId(101L)).thenReturn(outgoing);
        when(nodeRepository.save(any(NodeEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        workflowGraphService.deleteNode(100L, 2L);

        verify(nodeDependencyRepository).deleteAll(outgoing);
        verify(nodeRepository).delete(n);
        assertEquals(NodeStatus.TODO, child.getStatus());
    }

    @Test
    @DisplayName("B3 deleteNode: node đang IN_PROGRESS ném NODE_IN_USE (HTTP 409), không xóa")
    void testDeleteNodeInUse() {
        when(nodeRepository.findById(100L)).thenReturn(Optional.of(node(100L, "WPE-100", NodeStatus.IN_PROGRESS)));

        ConflictException ex = assertThrows(ConflictException.class, () -> workflowGraphService.deleteNode(100L, 2L));

        assertEquals("NODE_IN_USE", ex.getErrorCode());
        verify(nodeRepository, never()).delete(any());
    }
}
