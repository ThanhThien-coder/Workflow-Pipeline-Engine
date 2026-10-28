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
    @DisplayName("cloneTemplate: Sao chép sâu DAG thành công từ Project nguồn (2 phases, 3 nodes A->B->C, 2 deps)")
    void shouldCloneTemplateSuccessfully_withDeepCopyDAGAndFSMReset() {
        // GIVEN: Dự án nguồn với 2 phases, 3 nodes (A -> B -> C), 2 dependencies
        ProjectEntity sourceProject = ProjectEntity.builder()
            .id(templateId)
            .name("Master Workflow Template")
            .description("Standard banking architecture")
            .ownerId(1L)
            .status(ProjectStatus.ACTIVE)
            .build();

        WorkPhaseEntity p1 = WorkPhaseEntity.builder().id(10L).projectId(templateId).name("Foundation").orderIndex(0).build();
        WorkPhaseEntity p2 = WorkPhaseEntity.builder().id(20L).projectId(templateId).name("Execution").orderIndex(1).build();

        NodeEntity nodeA = NodeEntity.builder()
            .id(101L).projectId(templateId).phaseId(10L).code("TASK-A").title("Design DB").status(NodeStatus.DONE).build();
        NodeEntity nodeB = NodeEntity.builder()
            .id(102L).projectId(templateId).phaseId(20L).code("TASK-B").title("Build API").status(NodeStatus.IN_PROGRESS).build();
        NodeEntity nodeC = NodeEntity.builder()
            .id(103L).projectId(templateId).phaseId(20L).code("TASK-C").title("Deploy").status(NodeStatus.LOCKED).build();

        // Dependencies: A -> B, B -> C
        NodeDependencyEntity dep1 = NodeDependencyEntity.builder().id(1L).projectId(templateId).parentNodeId(101L).childNodeId(102L).build();
        NodeDependencyEntity dep2 = NodeDependencyEntity.builder().id(2L).projectId(templateId).parentNodeId(102L).childNodeId(103L).build();

        when(projectRepository.findById(templateId)).thenReturn(Optional.of(sourceProject));
        when(pipelineTemplateRepository.findById(templateId)).thenReturn(Optional.empty());

        // Mock lưu dự án mới (ID: 500L)
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

        // Mock đọc phases và nodes nguồn
        when(workPhaseRepository.findByProjectIdOrderByOrderIndexAsc(templateId)).thenReturn(List.of(p1, p2));
        when(nodeRepository.findByProjectId(templateId)).thenReturn(List.of(nodeA, nodeB, nodeC));
        when(nodeDependencyRepository.findByProjectId(templateId)).thenReturn(List.of(dep1, dep2));

        // Mock sinh ID cho các WorkPhase mới
        long[] newPhaseIdSeq = {501L, 502L};
        int[] phaseIdx = {0};
        when(workPhaseRepository.save(any(WorkPhaseEntity.class))).thenAnswer(invocation -> {
            WorkPhaseEntity p = invocation.getArgument(0);
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
        assertThat(result.status()).isEqualTo("PLANNING");
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
        ArgumentCaptor<NodeEntity> nodeCaptor = ArgumentCaptor.forClass(NodeEntity.class);
        verify(nodeRepository, times(3)).save(nodeCaptor.capture());
        List<NodeEntity> savedNodes = nodeCaptor.getAllValues();

        assertThat(savedNodes.get(0).getCode()).isEqualTo("TASK-A");
        assertThat(savedNodes.get(0).getStatus()).isEqualTo(NodeStatus.TODO);

        assertThat(savedNodes.get(1).getCode()).isEqualTo("TASK-B");
        assertThat(savedNodes.get(1).getStatus()).isEqualTo(NodeStatus.LOCKED);

        assertThat(savedNodes.get(2).getCode()).isEqualTo("TASK-C");
        assertThat(savedNodes.get(2).getStatus()).isEqualTo(NodeStatus.LOCKED);

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
    @DisplayName("cloneTemplate: Ném ResourceNotFoundException khi không tìm thấy Template/Project nguồn")
    void shouldThrowResourceNotFoundException_whenTemplateNotFound() {
        when(projectRepository.findById(999L)).thenReturn(Optional.empty());
        when(pipelineTemplateRepository.findById(999L)).thenReturn(Optional.empty());

        CloneTemplateRequest req = new CloneTemplateRequest(999L, "Invalid Project", "Desc", "PRIVATE");

        assertThatThrownBy(() -> templateCloneService.cloneTemplate(req, currentUserId))
            .isInstanceOf(ResourceNotFoundException.class)
            .hasMessageContaining("Không tìm thấy mẫu quy trình");

        verify(projectRepository, never()).save(any(ProjectEntity.class));
        verify(projectMemberRepository, never()).save(any(ProjectMemberEntity.class));
    }

    @Test
    @DisplayName("cloneTemplate: Thất bại và kích hoạt rollback khi gặp sự cố lúc lưu phụ thuộc DAG")
    void shouldPropagateExceptionAndRollback_whenDependencySaveFails() {
        ProjectEntity sourceProject = ProjectEntity.builder().id(templateId).name("Template").ownerId(1L).build();
        WorkPhaseEntity p1 = WorkPhaseEntity.builder().id(10L).projectId(templateId).name("P1").build();
        NodeEntity n1 = NodeEntity.builder().id(101L).projectId(templateId).phaseId(10L).code("A").build();
        NodeDependencyEntity dep1 = NodeDependencyEntity.builder().id(1L).projectId(templateId).parentNodeId(101L).childNodeId(101L).build();

        when(projectRepository.findById(templateId)).thenReturn(Optional.of(sourceProject));
        when(pipelineTemplateRepository.findById(templateId)).thenReturn(Optional.empty());

        when(projectRepository.save(any(ProjectEntity.class))).thenReturn(
            ProjectEntity.builder().id(500L).name("P").ownerId(currentUserId).build()
        );
        when(workPhaseRepository.findByProjectIdOrderByOrderIndexAsc(templateId)).thenReturn(List.of(p1));
        when(workPhaseRepository.save(any(WorkPhaseEntity.class))).thenReturn(
            WorkPhaseEntity.builder().id(501L).projectId(500L).build()
        );
        when(nodeRepository.findByProjectId(templateId)).thenReturn(List.of(n1));
        when(nodeRepository.save(any(NodeEntity.class))).thenReturn(
            NodeEntity.builder().id(601L).projectId(500L).build()
        );
        when(nodeDependencyRepository.findByProjectId(templateId)).thenReturn(List.of(dep1));

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
        ProjectEntity sourceProject = ProjectEntity.builder().id(templateId).name("Template").ownerId(1L).build();
        WorkPhaseEntity p1 = WorkPhaseEntity.builder().id(10L).projectId(templateId).name("P1").build();
        NodeEntity n1 = NodeEntity.builder().id(101L).projectId(templateId).phaseId(10L).code("A").build();
        NodeDependencyEntity dep1 = NodeDependencyEntity.builder().id(1L).projectId(templateId).parentNodeId(101L).childNodeId(101L).build();

        when(projectRepository.findById(templateId)).thenReturn(Optional.of(sourceProject));
        when(pipelineTemplateRepository.findById(templateId)).thenReturn(Optional.empty());

        when(projectRepository.save(any(ProjectEntity.class))).thenReturn(
            ProjectEntity.builder().id(500L).name("P").ownerId(currentUserId).build()
        );
        when(workPhaseRepository.findByProjectIdOrderByOrderIndexAsc(templateId)).thenReturn(List.of(p1));
        when(workPhaseRepository.save(any(WorkPhaseEntity.class))).thenReturn(
            WorkPhaseEntity.builder().id(501L).projectId(500L).build()
        );
        when(nodeRepository.findByProjectId(templateId)).thenReturn(List.of(n1));
        when(nodeRepository.save(any(NodeEntity.class))).thenReturn(
            NodeEntity.builder().id(601L).projectId(500L).build()
        );
        when(nodeDependencyRepository.findByProjectId(templateId)).thenReturn(List.of(dep1));
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
}
