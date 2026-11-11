package com.pipeline.wpe.service;

import com.pipeline.wpe.common.enums.JoinPolicy;
import com.pipeline.wpe.common.enums.NodeStatus;
import com.pipeline.wpe.common.enums.ProjectRole;
import com.pipeline.wpe.common.enums.ProjectStatus;
import com.pipeline.wpe.dto.project.CloneTemplateRequest;
import com.pipeline.wpe.dto.project.CloneTemplateResponse;
import com.pipeline.wpe.dto.project.ProjectDetailResponse;
import com.pipeline.wpe.entity.*;
import com.pipeline.wpe.exception.ResourceNotFoundException;
import com.pipeline.wpe.repository.*;
import com.pipeline.wpe.security.CurrentUserProvider;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TemplateCloneServiceTest {

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private WorkPhaseRepository workPhaseRepository;

    @Mock
    private NodeRepository nodeRepository;

    @Mock
    private NodeDependencyRepository nodeDependencyRepository;

    @Mock
    private PipelineTemplateRepository pipelineTemplateRepository;

    @Mock
    private ProjectMemberRepository projectMemberRepository;

    @Mock
    private CurrentUserProvider currentUserProvider;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private TemplateCloneService templateCloneService;

    private final Long currentUserId = 2L;
    private final Long templateId = 1L;

    @Test
    @DisplayName("cloneTemplate: Sao chép sâu DAG thành công từ PipelineTemplate (2 phases, 3 nodes A->B->C, 2 deps)")
    void shouldCloneTemplateSuccessfully_withDeepCopyDAGAndFSMReset() {
        // GIVEN: Mẫu với 2 phases, 3 nodes (A -> B -> C), 2 dependencies
        Map<String, Object> graphData = new HashMap<>();
        graphData.put("phases", List.of(
            Map.of("id", "10", "name", "Foundation", "orderIndex", 0),
            Map.of("id", "20", "name", "Execution", "orderIndex", 1)
        ));
        graphData.put("nodes", List.of(
            Map.of("id", "101", "phaseId", "10", "code", "TASK-A", "title", "Design DB"),
            Map.of("id", "102", "phaseId", "20", "code", "TASK-B", "title", "Build API"),
            Map.of("id", "103", "phaseId", "20", "code", "TASK-C", "title", "Deploy")
        ));
        graphData.put("edges", List.of(
            Map.of("source", "101", "target", "102"),
            Map.of("source", "102", "target", "103")
        ));

        PipelineTemplateEntity templateEntity = PipelineTemplateEntity.builder()
            .id(templateId)
            .name("Master Workflow Template")
            .description("Standard banking architecture")
            .graphData(graphData)
            .cloneCount(0)
            .build();

        when(pipelineTemplateRepository.findById(templateId)).thenReturn(Optional.of(templateEntity));

        // Mock lưu dự án mới (ID: 500L, status: DRAFT)
        when(projectRepository.save(any(ProjectEntity.class))).thenAnswer(invocation -> {
            ProjectEntity p = invocation.getArgument(0);
            return ProjectEntity.builder()
                .id(500L)
                .name(p.getName())
                .description(p.getDescription())
                .ownerId(p.getOwnerId())
                .status(p.getStatus())
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
        });

        // Mock sinh ID cho các WorkPhase mới
        long[] newPhaseIdSeq = {501L, 502L};
        int[] phaseIdx = {0};
        when(workPhaseRepository.save(any(WorkPhaseEntity.class))).thenAnswer(invocation -> {
            WorkPhaseEntity p = invocation.getArgument(0);
            if (p.getId() != null) return p;
            return WorkPhaseEntity.builder()
                .id(newPhaseIdSeq[phaseIdx[0]++])
                .projectId(p.getProjectId())
                .name(p.getName())
                .orderIndex(p.getOrderIndex())
                .build();
        });

        // Mock sinh ID cho các Node mới
        long[] newNodeIdSeq = {601L, 602L, 603L};
        int[] nodeIdx = {0};
        when(nodeRepository.save(any(NodeEntity.class))).thenAnswer(invocation -> {
            NodeEntity n = invocation.getArgument(0);
            return NodeEntity.builder()
                .id(newNodeIdSeq[nodeIdx[0]++])
                .projectId(n.getProjectId())
                .phaseId(n.getPhaseId())
                .code(n.getCode())
                .title(n.getTitle())
                .status(n.getStatus())
                .assignedUserId(n.getAssignedUserId())
                .build();
        });

        // Mock khi đọc lại cho bước 7
        when(workPhaseRepository.findByProjectIdOrderByOrderIndexAsc(500L)).thenReturn(List.of(
            WorkPhaseEntity.builder().id(501L).projectId(500L).name("Foundation").orderIndex(0).build(),
            WorkPhaseEntity.builder().id(502L).projectId(500L).name("Execution").orderIndex(1).build()
        ));
        when(nodeRepository.findByProjectId(500L)).thenReturn(List.of(
            NodeEntity.builder().id(601L).projectId(500L).phaseId(501L).code("TASK-A").status(NodeStatus.TODO).build(),
            NodeEntity.builder().id(602L).projectId(500L).phaseId(502L).code("TASK-B").status(NodeStatus.LOCKED).build(),
            NodeEntity.builder().id(603L).projectId(500L).phaseId(502L).code("TASK-C").status(NodeStatus.LOCKED).build()
        ));

        when(userRepository.findById(currentUserId)).thenReturn(Optional.of(
            UserEntity.builder().id(currentUserId).username("alex.kim").fullName("Alex Kim").build()
        ));

        // WHEN: Thực hiện nhân bản
        CloneTemplateRequest req = new CloneTemplateRequest(templateId, "My Cloned Project", "Cloned desc", "PRIVATE");
        ProjectDetailResponse result = templateCloneService.cloneTemplate(req, currentUserId);

        // THEN: Kiểm tra dự án mới
        assertThat(result).isNotNull();
        assertThat(result.id()).isEqualTo(500L);
        assertThat(result.name()).isEqualTo("My Cloned Project");
        assertThat(result.status()).isEqualTo("DRAFT");
        assertThat(result.ownerId()).isEqualTo(currentUserId);
        assertThat(result.ownerName()).isEqualTo("Alex Kim");
        assertThat(result.totalNodes()).isEqualTo(3);
        assertThat(result.completedNodes()).isEqualTo(0);
        assertThat(result.inProgressNodes()).isEqualTo(0);
        assertThat(result.phases()).hasSize(2);

        // Kiểm tra phân quyền OWNER trong bảng project_member
        ArgumentCaptor<ProjectMemberEntity> memberCaptor = ArgumentCaptor.forClass(ProjectMemberEntity.class);
        verify(projectMemberRepository, times(1)).save(memberCaptor.capture());
        ProjectMemberEntity savedMember = memberCaptor.getValue();
        assertThat(savedMember.getProjectId()).isEqualTo(500L);
        assertThat(savedMember.getUserId()).isEqualTo(currentUserId);
        assertThat(savedMember.getRole()).isEqualTo(ProjectRole.OWNER);

        // Kiểm tra trạng thái FSM Reset của các Node:
        // Node A là node gốc (không có incoming deps) -> phải là TODO
        // Node B có incoming từ Node A -> phải là LOCKED
        // Node C có incoming từ Node B -> phải là LOCKED
        // assignedUserId phải là null
        ArgumentCaptor<NodeEntity> nodeCaptor = ArgumentCaptor.forClass(NodeEntity.class);
        verify(nodeRepository, times(3)).save(nodeCaptor.capture());
        List<NodeEntity> savedNodes = nodeCaptor.getAllValues();

        assertThat(savedNodes.get(0).getCode()).isEqualTo("TASK-A");
        assertThat(savedNodes.get(0).getStatus()).isEqualTo(NodeStatus.TODO);
        assertThat(savedNodes.get(0).getAssignedUserId()).isNull();

        assertThat(savedNodes.get(1).getCode()).isEqualTo("TASK-B");
        assertThat(savedNodes.get(1).getStatus()).isEqualTo(NodeStatus.LOCKED);
        assertThat(savedNodes.get(1).getAssignedUserId()).isNull();

        assertThat(savedNodes.get(2).getCode()).isEqualTo("TASK-C");
        assertThat(savedNodes.get(2).getStatus()).isEqualTo(NodeStatus.LOCKED);
        assertThat(savedNodes.get(2).getAssignedUserId()).isNull();

        // Kiểm tra remap 2 cạnh phụ thuộc DAG với ID mới: 601L -> 602L và 602L -> 603L
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<NodeDependencyEntity>> depsCaptor = ArgumentCaptor.forClass(List.class);
        verify(nodeDependencyRepository, times(1)).saveAll(depsCaptor.capture());
        List<NodeDependencyEntity> savedDeps = depsCaptor.getValue();
        assertThat(savedDeps).hasSize(2);
        assertThat(savedDeps.get(0).getParentNodeId()).isEqualTo(601L);
        assertThat(savedDeps.get(0).getChildNodeId()).isEqualTo(602L);
        assertThat(savedDeps.get(1).getParentNodeId()).isEqualTo(602L);
        assertThat(savedDeps.get(1).getChildNodeId()).isEqualTo(603L);
    }

    @Test
    @DisplayName("cloneTemplate: Không clone dự án của người khác khi ID trùng dự án nhưng không có template (vá IDOR)")
    void shouldNotCloneOtherUsersProject_whenIdMatchesProjectButNoTemplate() {
        Long victimProjectId = 7L;
        ProjectEntity otherUsersProject = ProjectEntity.builder()
            .id(victimProjectId)
            .name("Secret Project")
            .ownerId(999L)
            .status(ProjectStatus.ACTIVE)
            .build();

        when(pipelineTemplateRepository.findById(victimProjectId)).thenReturn(Optional.empty());
        when(pipelineTemplateRepository.findBySlug("7")).thenReturn(Optional.empty());
        lenient().when(projectRepository.findById(victimProjectId)).thenReturn(Optional.of(otherUsersProject));

        CloneTemplateRequest req = new CloneTemplateRequest(victimProjectId, "Copy", null);

        assertThatThrownBy(() -> templateCloneService.cloneTemplate(req, currentUserId))
            .isInstanceOf(ResourceNotFoundException.class)
            .hasMessageContaining("Không tìm thấy mẫu quy trình với ID: 7");

        verify(projectRepository, never()).save(any());
        verify(nodeRepository, never()).save(any());
    }

    @Test
    @DisplayName("cloneTemplate: Ném ResourceNotFoundException khi không tìm thấy Template nguồn")
    void shouldThrowResourceNotFoundException_whenTemplateNotFound() {
        when(pipelineTemplateRepository.findById(999L)).thenReturn(Optional.empty());
        when(pipelineTemplateRepository.findBySlug("999")).thenReturn(Optional.empty());

        CloneTemplateRequest req = new CloneTemplateRequest(999L, "Invalid Project", "Desc", "PRIVATE");

        assertThatThrownBy(() -> templateCloneService.cloneTemplate(req, currentUserId))
            .isInstanceOf(ResourceNotFoundException.class)
            .hasMessageContaining("Không tìm thấy mẫu quy trình với ID: 999");

        verify(projectRepository, never()).save(any(ProjectEntity.class));
        verify(projectMemberRepository, never()).save(any(ProjectMemberEntity.class));
    }

    @Test
    @DisplayName("cloneTemplate: Thất bại và kích hoạt rollback khi gặp sự cố lúc lưu phụ thuộc DAG")
    void shouldPropagateExceptionAndRollback_whenDependencySaveFails() {
        Map<String, Object> graphData = new HashMap<>();
        graphData.put("phases", List.of(
            Map.of("id", "10", "name", "P1")
        ));
        graphData.put("nodes", List.of(
            Map.of("id", "101", "phaseId", "10", "code", "A", "title", "A"),
            Map.of("id", "102", "phaseId", "10", "code", "B", "title", "B")
        ));
        graphData.put("edges", List.of(
            Map.of("source", "101", "target", "102")
        ));

        PipelineTemplateEntity templateEntity = PipelineTemplateEntity.builder()
            .id(templateId)
            .name("Template")
            .graphData(graphData)
            .build();

        when(pipelineTemplateRepository.findById(templateId)).thenReturn(Optional.of(templateEntity));

        when(projectRepository.save(any(ProjectEntity.class))).thenReturn(
            ProjectEntity.builder().id(500L).name("P").ownerId(currentUserId).status(ProjectStatus.DRAFT).build()
        );
        when(workPhaseRepository.save(any(WorkPhaseEntity.class))).thenReturn(
            WorkPhaseEntity.builder().id(501L).projectId(500L).build()
        );
        when(nodeRepository.save(any(NodeEntity.class))).thenReturn(
            NodeEntity.builder().id(601L).projectId(500L).build(),
            NodeEntity.builder().id(602L).projectId(500L).build()
        );

        // Giả lập lỗi tại tầng DB khi lưu dependency
        doThrow(new RuntimeException("Database constraint violation"))
            .when(nodeDependencyRepository).saveAll(any());

        CloneTemplateRequest req = new CloneTemplateRequest(templateId, "Rollback Test", "Desc", "PRIVATE");

        assertThatThrownBy(() -> templateCloneService.cloneTemplate(req, currentUserId))
            .isInstanceOf(RuntimeException.class)
            .hasMessage("Database constraint violation");
    }

    @Test
    @DisplayName("cloneTemplateWithStats: Trả về thống kê chính xác số lượng phases, nodes, dependencies đã clone")
    void shouldReturnAccurateStats_whenCloneWithStats() {
        Map<String, Object> graphData = new HashMap<>();
        graphData.put("phases", List.of(
            Map.of("id", "10", "name", "P1")
        ));
        graphData.put("nodes", List.of(
            Map.of("id", "101", "phaseId", "10", "code", "A", "title", "Task A")
        ));

        PipelineTemplateEntity templateEntity = PipelineTemplateEntity.builder()
            .id(templateId)
            .name("Template")
            .graphData(graphData)
            .build();

        when(pipelineTemplateRepository.findById(templateId)).thenReturn(Optional.of(templateEntity));

        when(projectRepository.save(any(ProjectEntity.class))).thenReturn(
            ProjectEntity.builder().id(500L).name("P").ownerId(currentUserId).status(ProjectStatus.DRAFT).build()
        );
        when(workPhaseRepository.save(any(WorkPhaseEntity.class))).thenReturn(
            WorkPhaseEntity.builder().id(501L).projectId(500L).name("P1").build()
        );
        when(nodeRepository.save(any(NodeEntity.class))).thenReturn(
            NodeEntity.builder().id(601L).projectId(500L).phaseId(501L).status(NodeStatus.TODO).build()
        );
        when(workPhaseRepository.findByProjectIdOrderByOrderIndexAsc(500L)).thenReturn(List.of(
            WorkPhaseEntity.builder().id(501L).projectId(500L).name("P1").build()
        ));
        when(nodeRepository.findByProjectId(500L)).thenReturn(List.of(
            NodeEntity.builder().id(601L).projectId(500L).phaseId(501L).status(NodeStatus.TODO).build()
        ));
        when(nodeDependencyRepository.findByProjectId(500L)).thenReturn(List.of(
            NodeDependencyEntity.builder().id(11L).projectId(500L).parentNodeId(601L).childNodeId(601L).build()
        ));
        when(userRepository.findById(currentUserId)).thenReturn(Optional.of(
            UserEntity.builder().id(currentUserId).username("alex.kim").build()
        ));

        CloneTemplateRequest req = new CloneTemplateRequest(templateId, "Stats Test", "Desc", "PRIVATE");
        CloneTemplateResponse stats = templateCloneService.cloneTemplateWithStats(req, currentUserId);

        assertThat(stats).isNotNull();
        assertThat(stats.clonedPhasesCount()).isEqualTo(1);
        assertThat(stats.clonedNodesCount()).isEqualTo(1);
        assertThat(stats.clonedDependenciesCount()).isEqualTo(1);
    }

    @Test
    @DisplayName("cloneTemplate: Sao chép thành công từ PipelineTemplateEntity với slug và ID chuỗi chữ (alphanumeric IDs)")
    void shouldCloneSuccessfullyFromPipelineTemplateEntity_withSlugAndAlphanumericIds() {
        // GIVEN: PipelineTemplateEntity có slug "tpl-sdlc" với 2 phases và 2 nodes có ID chuỗi (alphanumeric)
        Map<String, Object> graphData = new HashMap<>();
        graphData.put("phases", List.of(
            Map.of("id", "ph-sdlc-1", "name", "Phase 1 - Khảo sát", "orderIndex", 0, "accentColor", "blue"),
            Map.of("id", "ph-sdlc-2", "name", "Phase 2 - Thiết kế", "orderIndex", 1, "accentColor", "purple", "runsAfter", List.of("ph-sdlc-1"))
        ));
        graphData.put("nodes", List.of(
            Map.of("id", "nd-req", "phaseId", "ph-sdlc-1", "code", "REQ-01", "title", "Thu thập YCKT",
                   "uiMetadata", Map.of("position", Map.of("x", 120, "y", 80))),
            Map.of("id", "nd-arch", "phaseId", "ph-sdlc-2", "code", "ARCH-01", "title", "Thiết kế Kiến trúc",
                   "uiMetadata", Map.of("position", Map.of("x", 450, "y", 220)))
        ));
        graphData.put("edges", List.of(
            Map.of("source", "nd-req", "target", "nd-arch")
        ));

        PipelineTemplateEntity templateEntity = PipelineTemplateEntity.builder()
            .id(10L)
            .slug("tpl-sdlc")
            .name("Mẫu Phát triển Phần mềm Chuẩn")
            .graphData(graphData)
            .cloneCount(5)
            .build();

        when(pipelineTemplateRepository.findBySlug("tpl-sdlc")).thenReturn(Optional.of(templateEntity));

        // Mock lưu project
        when(projectRepository.save(any(ProjectEntity.class))).thenAnswer(invocation -> {
            ProjectEntity p = invocation.getArgument(0);
            return ProjectEntity.builder()
                .id(888L)
                .name(p.getName())
                .description(p.getDescription())
                .ownerId(p.getOwnerId())
                .status(p.getStatus())
                .build();
        });

        // Mock lưu phases
        long[] phaseSeq = {1001L, 1002L};
        int[] pIdx = {0};
        when(workPhaseRepository.save(any(WorkPhaseEntity.class))).thenAnswer(invocation -> {
            WorkPhaseEntity p = invocation.getArgument(0);
            if (p.getId() != null) {
                return p;
            }
            return WorkPhaseEntity.builder()
                .id(phaseSeq[pIdx[0]++])
                .projectId(p.getProjectId())
                .name(p.getName())
                .parentPhaseId(p.getParentPhaseId())
                .orderIndex(p.getOrderIndex())
                .build();
        });
        when(workPhaseRepository.findById(1002L)).thenReturn(Optional.of(
            WorkPhaseEntity.builder().id(1002L).projectId(888L).name("Phase 2 - Thiết kế").build()
        ));

        // Mock lưu nodes
        long[] nodeSeq = {2001L, 2002L};
        int[] nIdx = {0};
        when(nodeRepository.save(any(NodeEntity.class))).thenAnswer(invocation -> {
            NodeEntity n = invocation.getArgument(0);
            return NodeEntity.builder()
                .id(nodeSeq[nIdx[0]++])
                .projectId(n.getProjectId())
                .phaseId(n.getPhaseId())
                .code(n.getCode())
                .title(n.getTitle())
                .status(n.getStatus())
                .uiMetadata(n.getUiMetadata())
                .build();
        });

        when(workPhaseRepository.findByProjectIdOrderByOrderIndexAsc(888L)).thenReturn(List.of(
            WorkPhaseEntity.builder().id(1001L).projectId(888L).name("Phase 1 - Khảo sát").build(),
            WorkPhaseEntity.builder().id(1002L).projectId(888L).name("Phase 2 - Thiết kế").build()
        ));
        when(nodeRepository.findByProjectId(888L)).thenReturn(List.of(
            NodeEntity.builder().id(2001L).projectId(888L).phaseId(1001L).code("REQ-01").status(NodeStatus.TODO).build(),
            NodeEntity.builder().id(2002L).projectId(888L).phaseId(1002L).code("ARCH-01").status(NodeStatus.LOCKED).build()
        ));
        when(userRepository.findById(currentUserId)).thenReturn(Optional.of(
            UserEntity.builder().id(currentUserId).username("admin").build()
        ));

        // WHEN: Clone qua slug
        CloneTemplateRequest req = new CloneTemplateRequest("tpl-sdlc", "SDLC Cloned", "New SDLC", "PUBLIC");
        ProjectDetailResponse result = templateCloneService.cloneTemplate(req, currentUserId);

        // THEN:
        assertThat(result).isNotNull();
        assertThat(result.id()).isEqualTo(888L);
        assertThat(result.name()).isEqualTo("SDLC Cloned");
        assertThat(result.status()).isEqualTo("DRAFT");
        assertThat(templateEntity.getCloneCount()).isEqualTo(6); // Tăng clone_count

        // Kiểm tra bảo toàn uiMetadata và trạng thái FSM
        ArgumentCaptor<NodeEntity> nodeCaptor = ArgumentCaptor.forClass(NodeEntity.class);
        verify(nodeRepository, times(2)).save(nodeCaptor.capture());
        List<NodeEntity> savedNodes = nodeCaptor.getAllValues();

        assertThat(savedNodes.get(0).getCode()).isEqualTo("REQ-01");
        assertThat(savedNodes.get(0).getStatus()).isEqualTo(NodeStatus.TODO);
        assertThat(savedNodes.get(0).getUiMetadata()).isNotNull();
        assertThat(savedNodes.get(0).getUiMetadata()).containsKey("position");

        assertThat(savedNodes.get(1).getCode()).isEqualTo("ARCH-01");
        assertThat(savedNodes.get(1).getStatus()).isEqualTo(NodeStatus.LOCKED);
        assertThat(savedNodes.get(1).getUiMetadata()).isNotNull();
        assertThat(savedNodes.get(1).getUiMetadata()).containsKey("position");

        // Kiểm tra tái lập dependency giữa 2001L và 2002L
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<NodeDependencyEntity>> depsCaptor = ArgumentCaptor.forClass(List.class);
        verify(nodeDependencyRepository, times(1)).saveAll(depsCaptor.capture());
        List<NodeDependencyEntity> savedDeps = depsCaptor.getValue();
        assertThat(savedDeps).hasSize(1);
        assertThat(savedDeps.get(0).getParentNodeId()).isEqualTo(2001L);
        assertThat(savedDeps.get(0).getChildNodeId()).isEqualTo(2002L);
    }

    @Test
    @DisplayName("cloneTemplate: Kiểm thử khứ hồi đồ thị template (round-trip) khớp chính xác số lượng phase, node, cạnh DAG")
    void shouldRoundTripTemplateGraph_countsMatchGraphData() {
        // GIVEN: GraphData đúng chuẩn schemaVersion: 2 của FE và cấu trúc V5 seed (tpl-sdlc)
        // - 3 phases: ph-1 -> ph-2 -> ph-3
        // - 5 nodes:
        //   * nd-1 (ph-1, parentId: null, level: 0) -> TODO (không cạnh vào)
        //   * nd-2 (ph-1, parentId: "nd-1", level: 1) -> LOCKED (có cạnh vào từ nd-1)
        //   * nd-3 (ph-2, parentId: null, level: 0) -> TODO (không cạnh vào)
        //   * nd-4 (ph-2, parentId: "nd-3", level: 1) -> LOCKED (có cạnh vào từ nd-2 và nd-3)
        //   * nd-5 (ph-3, parentId: null, level: 0) -> LOCKED (có cạnh vào từ nd-4)
        // - 3 edges:
        //   * e1 (nd-1 -> nd-2, TRÙNG với parentId của nd-2)
        //   * e2 (nd-2 -> nd-4)
        //   * e3 (nd-4 -> nd-5)
        Map<String, Object> node1 = new HashMap<>();
        node1.put("id", "nd-1");
        node1.put("phaseId", "ph-1");
        node1.put("parentId", null);
        node1.put("title", "Node 1");
        node1.put("joinPolicy", "ALL_COMPLETED");
        node1.put("level", 0);

        Map<String, Object> node2 = new HashMap<>();
        node2.put("id", "nd-2");
        node2.put("phaseId", "ph-1");
        node2.put("parentId", "nd-1");
        node2.put("title", "Node 2");
        node2.put("joinPolicy", "ALL_COMPLETED");
        node2.put("level", 1);

        Map<String, Object> node3 = new HashMap<>();
        node3.put("id", "nd-3");
        node3.put("phaseId", "ph-2");
        node3.put("parentId", null);
        node3.put("title", "Node 3");
        node3.put("joinPolicy", "ALL_COMPLETED");
        node3.put("level", 0);

        Map<String, Object> node4 = new HashMap<>();
        node4.put("id", "nd-4");
        node4.put("phaseId", "ph-2");
        node4.put("parentId", "nd-3");
        node4.put("title", "Node 4");
        node4.put("joinPolicy", "ALL_COMPLETED");
        node4.put("level", 1);

        Map<String, Object> node5 = new HashMap<>();
        node5.put("id", "nd-5");
        node5.put("phaseId", "ph-3");
        node5.put("parentId", null);
        node5.put("title", "Node 5");
        node5.put("joinPolicy", "ALL_COMPLETED");
        node5.put("level", 0);

        Map<String, Object> graphData = new HashMap<>();
        graphData.put("schemaVersion", 2);
        graphData.put("phases", List.of(
            Map.of("id", "ph-1", "name", "Phase 1", "order", 0, "rootNodeId", "nd-1", "runsAfter", List.of()),
            Map.of("id", "ph-2", "name", "Phase 2", "order", 1, "rootNodeId", "nd-3", "runsAfter", List.of("ph-1")),
            Map.of("id", "ph-3", "name", "Phase 3", "order", 2, "rootNodeId", "nd-5", "runsAfter", List.of("ph-2"))
        ));
        graphData.put("phaseEdges", List.of(
            Map.of("parentPhaseId", "ph-1", "childPhaseId", "ph-2"),
            Map.of("parentPhaseId", "ph-2", "childPhaseId", "ph-3")
        ));
        graphData.put("nodes", List.of(node1, node2, node3, node4, node5));
        graphData.put("edges", List.of(
            Map.of("id", "e1", "parentId", "nd-1", "childId", "nd-2", "kind", "DEPENDENCY"),
            Map.of("id", "e2", "parentId", "nd-2", "childId", "nd-4", "kind", "DEPENDENCY"),
            Map.of("id", "e3", "parentId", "nd-4", "childId", "nd-5", "kind", "DEPENDENCY")
        ));
        graphData.put("metadata", Map.of("version", "1.0.0"));

        Long tplId = 55L;
        PipelineTemplateEntity templateEntity = PipelineTemplateEntity.builder()
            .id(tplId)
            .name("Round Trip Template")
            .graphData(graphData)
            .cloneCount(0)
            .build();

        when(pipelineTemplateRepository.findById(tplId)).thenReturn(Optional.of(templateEntity));

        // Mock lưu project mới
        when(projectRepository.save(any(ProjectEntity.class))).thenAnswer(invocation -> {
            ProjectEntity p = invocation.getArgument(0);
            return ProjectEntity.builder()
                .id(700L)
                .name(p.getName())
                .description(p.getDescription())
                .ownerId(p.getOwnerId())
                .status(p.getStatus())
                .build();
        });

        // Mock lưu phase trả ID tăng dần
        long[] phaseSeq = {701L, 702L, 703L};
        int[] pIdx = {0};
        when(workPhaseRepository.save(any(WorkPhaseEntity.class))).thenAnswer(invocation -> {
            WorkPhaseEntity p = invocation.getArgument(0);
            if (p.getId() != null) return p;
            return WorkPhaseEntity.builder()
                .id(phaseSeq[pIdx[0]++])
                .projectId(p.getProjectId())
                .name(p.getName())
                .orderIndex(p.getOrderIndex())
                .build();
        });

        // Mock lưu node trả ID tăng dần
        long[] nodeSeq = {801L, 802L, 803L, 804L, 805L};
        int[] nIdx = {0};
        when(nodeRepository.save(any(NodeEntity.class))).thenAnswer(invocation -> {
            NodeEntity n = invocation.getArgument(0);
            if (n.getId() != null) return n;
            return NodeEntity.builder()
                .id(nodeSeq[nIdx[0]++])
                .projectId(n.getProjectId())
                .phaseId(n.getPhaseId())
                .code(n.getCode())
                .title(n.getTitle())
                .status(n.getStatus())
                .joinPolicy(n.getJoinPolicy())
                .build();
        });

        // WHEN: Gọi clone template
        CloneTemplateRequest req = new CloneTemplateRequest(tplId, "Cloned Round-Trip Project", "Desc", "PRIVATE");
        ProjectDetailResponse result = templateCloneService.cloneTemplate(req, currentUserId);

        // THEN:
        assertThat(result).isNotNull();

        // 1. Số WorkPhaseEntity mới được tạo = 3
        ArgumentCaptor<WorkPhaseEntity> phaseCaptor = ArgumentCaptor.forClass(WorkPhaseEntity.class);
        verify(workPhaseRepository, times(3)).save(phaseCaptor.capture());
        List<WorkPhaseEntity> savedPhases = phaseCaptor.getAllValues();
        assertThat(savedPhases).hasSize(3);
        assertThat(savedPhases).extracting(WorkPhaseEntity::getName)
            .containsExactly("Phase 1", "Phase 2", "Phase 3");

        // 2. Số NodeEntity được lưu = 5
        ArgumentCaptor<NodeEntity> nodeCaptor = ArgumentCaptor.forClass(NodeEntity.class);
        verify(nodeRepository, times(5)).save(nodeCaptor.capture());
        List<NodeEntity> savedNodes = nodeCaptor.getAllValues();
        assertThat(savedNodes).hasSize(5);

        // 3. Số NodeDependencyEntity trong saveAll = số cặp (cha, con) KHÁC NHAU lấy từ edges ∪ parentId:
        // Giải thích tính bằng tay:
        // - Cạnh tường minh từ mảng edges gồm 3 cạnh:
        //     (nd-1 -> nd-2), (nd-2 -> nd-4), (nd-4 -> nd-5)
        // - Cạnh ngầm định từ quan hệ cây parentId của 2 node con:
        //     (nd-1 -> nd-2) [từ node nd-2 có parentId = "nd-1"]
        //     (nd-3 -> nd-4) [từ node nd-4 có parentId = "nd-3"]
        // - Hợp (union) của 2 tập cạnh trên có đúng 4 cặp (cha, con) KHÁC NHAU:
        //     1. nd-1 -> nd-2 (trùng lặp giữa edges và parentId, được khử trùng lặp qua Set seenEdges)
        //     2. nd-2 -> nd-4 (từ edges)
        //     3. nd-3 -> nd-4 (từ parentId)
        //     4. nd-4 -> nd-5 (từ edges)
        // -> Tổng số NodeDependencyEntity được lưu trong saveAll phải bằng đúng 4.
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<NodeDependencyEntity>> depsCaptor = ArgumentCaptor.forClass(List.class);
        verify(nodeDependencyRepository, times(1)).saveAll(depsCaptor.capture());
        List<NodeDependencyEntity> savedDependencies = depsCaptor.getValue();
        assertThat(savedDependencies).hasSize(4);
        assertThat(savedDependencies).extracting(
            d -> d.getParentNodeId() + "->" + d.getChildNodeId()
        ).containsExactlyInAnyOrder(
            "801->802",
            "802->804",
            "803->804",
            "804->805"
        );

        // 4. Trạng thái FSM: Node không có cạnh vào -> TODO, có cạnh vào -> LOCKED
        // nd-1: không có cạnh vào -> TODO
        // nd-2: có cạnh vào từ nd-1 -> LOCKED
        // nd-3: không có cạnh vào -> TODO
        // nd-4: có cạnh vào từ nd-2 và nd-3 -> LOCKED
        // nd-5: có cạnh vào từ nd-4 -> LOCKED
        Map<String, NodeStatus> statusByTitle = savedNodes.stream()
            .collect(Collectors.toMap(NodeEntity::getTitle, NodeEntity::getStatus));
        assertThat(statusByTitle.get("Node 1")).isEqualTo(NodeStatus.TODO);
        assertThat(statusByTitle.get("Node 2")).isEqualTo(NodeStatus.LOCKED);
        assertThat(statusByTitle.get("Node 3")).isEqualTo(NodeStatus.TODO);
        assertThat(statusByTitle.get("Node 4")).isEqualTo(NodeStatus.LOCKED);
        assertThat(statusByTitle.get("Node 5")).isEqualTo(NodeStatus.LOCKED);
    }
}
