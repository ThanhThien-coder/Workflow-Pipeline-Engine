package com.pipeline.wpe.service.engine;

import com.pipeline.wpe.common.enums.JoinPolicy;
import com.pipeline.wpe.common.enums.NodeStatus;
import com.pipeline.wpe.common.enums.ProjectStatus;
import com.pipeline.wpe.dto.request.node.SubmitTaskArtifactRequest;
import com.pipeline.wpe.dto.request.node.SubmitTaskArtifactRequest.ArtifactPayload;
import com.pipeline.wpe.dto.response.node.KanbanTaskResponse;
import com.pipeline.wpe.entity.ArtifactEntity;
import com.pipeline.wpe.entity.NodeEntity;
import com.pipeline.wpe.entity.ProjectEntity;
import com.pipeline.wpe.mapper.NodeMapper;
import com.pipeline.wpe.repository.ArtifactRepository;
import com.pipeline.wpe.repository.NodeDependencyRepository;
import com.pipeline.wpe.repository.NodeRepository;
import com.pipeline.wpe.repository.ProjectMemberRepository;
import com.pipeline.wpe.repository.ProjectRepository;
import com.pipeline.wpe.service.event.SseEmitterService;
import com.pipeline.wpe.service.event.WorkflowEventPublisher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * C4: nộp bài kèm minh chứng. isPublicForGuest lấy từ request (mặc định true), URL minh chứng phải là http(s) hợp lệ,
 * nộp bài không kèm link vẫn hợp lệ.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SubmitTaskArtifactTest {

    @Mock private NodeRepository nodeRepository;
    @Mock private NodeDependencyRepository dependencyRepository;
    @Mock private ProjectRepository projectRepository;
    @Mock private ProjectMemberRepository projectMemberRepository;
    @Mock private ArtifactRepository artifactRepository;
    @Mock private WorkflowEventPublisher eventPublisher;
    @Mock private SseEmitterService sseEmitterService;
    @Mock private NodeMapper nodeMapper;

    @InjectMocks
    private StateMachineService stateMachineService;

    private static final Long TASK_ID = 10L;
    private static final Long ASSIGNEE = 3L;
    private NodeEntity node;

    @BeforeEach
    void setUp() {
        ProjectEntity project = ProjectEntity.builder().id(1L).ownerId(2L).name("Core Banking Pipeline")
            .status(ProjectStatus.ACTIVE).build();
        node = NodeEntity.builder().id(TASK_ID).projectId(1L).code("WPE-010").title("Test Task")
            .status(NodeStatus.IN_PROGRESS).assignedUserId(ASSIGNEE).joinPolicy(JoinPolicy.ALL_COMPLETED)
            .version(0L).uiMetadata(Map.of()).build();
        when(nodeRepository.findById(TASK_ID)).thenReturn(Optional.of(node));
        when(projectRepository.findById(1L)).thenReturn(Optional.of(project));
        when(nodeRepository.save(any(NodeEntity.class))).thenAnswer(i -> i.getArgument(0));
        when(artifactRepository.save(any(ArtifactEntity.class))).thenAnswer(i -> i.getArgument(0));
        when(nodeMapper.toKanbanTaskResponse(any())).thenReturn(new KanbanTaskResponse(
            "10", "1", "WPE-010", "Test Task", "Desc", "REVIEW", "3", "ALL_COMPLETED", null, Instant.now(), false, 1L, Map.of()));
    }

    private static SubmitTaskArtifactRequest withArtifact(String url, Boolean isPublicForGuest) {
        return new SubmitTaskArtifactRequest(null, null, null, null, null,
            new ArtifactPayload("PR #42", null, "PR", url, null, isPublicForGuest), 0L);
    }

    private ArtifactEntity savedArtifact() {
        ArgumentCaptor<ArtifactEntity> captor = ArgumentCaptor.forClass(ArtifactEntity.class);
        verify(artifactRepository).save(captor.capture());
        return captor.getValue();
    }

    @Test
    @DisplayName("Gửi isPublicForGuest = false: minh chứng không công khai cho khách")
    void respectsPrivateChoice() {
        stateMachineService.submitTaskArtifact(TASK_ID, withArtifact("https://github.com/org/repo/pull/42", false), ASSIGNEE);

        assertThat(savedArtifact().getIsPublicForGuest()).isFalse();
    }

    @Test
    @DisplayName("Không gửi isPublicForGuest: mặc định true")
    void defaultsToPublic() {
        stateMachineService.submitTaskArtifact(TASK_ID, withArtifact("https://github.com/org/repo/pull/42", null), ASSIGNEE);

        assertThat(savedArtifact().getIsPublicForGuest()).isTrue();
    }

    @Test
    @DisplayName("URL minh chứng javascript: → 400, không lưu artifact, task không chuyển REVIEW")
    void javascriptUrl_rejected() {
        assertThatThrownBy(() -> stateMachineService.submitTaskArtifact(
                TASK_ID, withArtifact("javascript:alert(1)", true), ASSIGNEE))
            .isInstanceOf(IllegalArgumentException.class);

        verify(artifactRepository, never()).save(any());
        verify(nodeRepository, never()).save(any());
        assertThat(node.getStatus()).isEqualTo(NodeStatus.IN_PROGRESS);
    }

    @Test
    @DisplayName("Nộp bài không kèm link: hợp lệ, chuyển REVIEW, không tạo artifact")
    void withoutLink_ok() {
        stateMachineService.submitTaskArtifact(TASK_ID,
            new SubmitTaskArtifactRequest(null, null, null, null, null, null, 0L), ASSIGNEE);

        assertThat(node.getStatus()).isEqualTo(NodeStatus.REVIEW);
        verify(artifactRepository, never()).save(any());
    }
}
