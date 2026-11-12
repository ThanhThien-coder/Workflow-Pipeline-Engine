package com.pipeline.wpe.service;

import com.pipeline.wpe.common.enums.ArtifactType;
import com.pipeline.wpe.common.enums.ProjectRole;
import com.pipeline.wpe.dto.artifact.ArtifactResponse;
import com.pipeline.wpe.dto.artifact.CreateArtifactRequest;
import com.pipeline.wpe.entity.ArtifactEntity;
import com.pipeline.wpe.entity.ProjectEntity;
import com.pipeline.wpe.entity.ProjectMemberEntity;
import com.pipeline.wpe.exception.ForbiddenException;
import com.pipeline.wpe.repository.ArtifactRepository;
import com.pipeline.wpe.repository.ProjectMemberRepository;
import com.pipeline.wpe.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * C4: phân quyền kho tài nguyên. Owner, Manager, Collaborator được thêm/bật tắt kho; Viewer chỉ xem (403).
 * Xóa: người đăng hoặc Owner. type lạ → OTHER_LINK, không gửi type thì tự nhận diện theo URL.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ArtifactServiceTest {

    @Mock private ArtifactRepository artifactRepository;
    @Mock private ProjectAuthorizationService projectAuthorizationService;
    @Mock private ProjectMemberRepository projectMemberRepository;
    @Mock private UserRepository userRepository;

    @InjectMocks
    private ArtifactService artifactService;

    private static final Long PROJECT_ID = 1L;
    private static final Long OWNER = 2L;
    private static final Long COLLABORATOR = 3L;
    private static final Long VIEWER = 4L;
    private static final Long MANAGER = 5L;
    private static final Long OTHER_COLLABORATOR = 6L;

    @BeforeEach
    void setUp() {
        ProjectEntity project = ProjectEntity.builder().id(PROJECT_ID).ownerId(OWNER).name("Core Banking Pipeline").build();
        when(projectAuthorizationService.verifyProjectMemberOrOwner(any(), any())).thenReturn(project);
        when(projectAuthorizationService.getProjectOrThrow(PROJECT_ID)).thenReturn(project);
        member(OWNER, ProjectRole.OWNER);
        member(COLLABORATOR, ProjectRole.COLLABORATOR);
        member(VIEWER, ProjectRole.VIEWER);
        member(MANAGER, ProjectRole.MANAGER);
        member(OTHER_COLLABORATOR, ProjectRole.COLLABORATOR);
        when(artifactRepository.save(any(ArtifactEntity.class))).thenAnswer(i -> i.getArgument(0));
    }

    private void member(Long userId, ProjectRole role) {
        when(projectMemberRepository.findByProjectIdAndUserIdAndRemovedAtIsNull(PROJECT_ID, userId))
            .thenReturn(Optional.of(ProjectMemberEntity.builder().projectId(PROJECT_ID).userId(userId).role(role).build()));
    }

    private static CreateArtifactRequest link(String type) {
        return new CreateArtifactRequest("Figma màn hình đăng nhập", "https://www.figma.com/file/abc", type, null, null);
    }

    @Nested
    @DisplayName("Thêm link")
    class Create {

        @ParameterizedTest(name = "[{index}] user {0} được thêm")
        @CsvSource({"2", "3", "5"})
        @DisplayName("Owner, Collaborator, Manager thêm được; uploadedBy là người gọi")
        void writerRoles_canCreate(Long userId) {
            ArtifactResponse response = artifactService.createArtifact(PROJECT_ID, link(null), userId);

            assertThat(response.uploadedBy()).isEqualTo(userId);
            verify(artifactRepository).save(any(ArtifactEntity.class));
        }

        @Test
        @DisplayName("Viewer thêm link → 403, không lưu")
        void viewer_forbidden() {
            assertThatThrownBy(() -> artifactService.createArtifact(PROJECT_ID, link(null), VIEWER))
                .isInstanceOf(ForbiddenException.class);
            verify(artifactRepository, never()).save(any());
        }

        @Test
        @DisplayName("Không phải thành viên → 403 (từ verifyProjectMemberOrOwner), không lưu")
        void nonMember_forbidden() {
            when(projectAuthorizationService.verifyProjectMemberOrOwner(PROJECT_ID, 99L))
                .thenThrow(new ForbiddenException("ACCESS_DENIED", "Bạn không phải là thành viên của dự án này."));

            assertThatThrownBy(() -> artifactService.createArtifact(PROJECT_ID, link(null), 99L))
                .isInstanceOf(ForbiddenException.class);
            verify(artifactRepository, never()).save(any());
        }

        @ParameterizedTest(name = "[{index}] type={0} → {1}")
        @CsvSource({"PR, PR", "figma, FIGMA", "khong-ton-tai, OTHER_LINK", "'', FIGMA"})
        @DisplayName("type hợp lệ giữ nguyên (không phân biệt hoa thường), type lạ → OTHER_LINK, rỗng → nhận diện theo URL")
        void typeResolution(String type, ArtifactType expected) {
            ArtifactResponse response = artifactService.createArtifact(PROJECT_ID, link(type), COLLABORATOR);

            assertThat(response.type()).isEqualTo(expected);
        }

        @Test
        @DisplayName("Không gửi type: nhận diện theo URL (figma.com → FIGMA)")
        void nullType_detectedFromUrl() {
            ArtifactResponse response = artifactService.createArtifact(PROJECT_ID, link(null), COLLABORATOR);

            assertThat(response.type()).isEqualTo(ArtifactType.FIGMA);
        }
    }

    @Nested
    @DisplayName("Xóa link")
    class Delete {

        private ArtifactEntity uploadedBy(Long userId) {
            ArtifactEntity artifact = ArtifactEntity.builder().id(7L).projectId(PROJECT_ID).uploadedBy(userId)
                .name("PR").type(ArtifactType.PR).url("https://github.com/org/repo/pull/42").build();
            when(artifactRepository.findById(7L)).thenReturn(Optional.of(artifact));
            return artifact;
        }

        @Test
        @DisplayName("Người đăng xóa được")
        void uploader_canDelete() {
            ArtifactEntity artifact = uploadedBy(COLLABORATOR);

            artifactService.deleteArtifact(PROJECT_ID, 7L, COLLABORATOR);

            verify(artifactRepository).delete(artifact);
        }

        @Test
        @DisplayName("Owner xóa được link của người khác")
        void owner_canDelete() {
            ArtifactEntity artifact = uploadedBy(COLLABORATOR);

            artifactService.deleteArtifact(PROJECT_ID, 7L, OWNER);

            verify(artifactRepository).delete(artifact);
        }

        @Test
        @DisplayName("Collaborator khác xóa link không phải của mình → 403")
        void otherCollaborator_forbidden() {
            uploadedBy(COLLABORATOR);

            assertThatThrownBy(() -> artifactService.deleteArtifact(PROJECT_ID, 7L, OTHER_COLLABORATOR))
                .isInstanceOf(ForbiddenException.class);
            verify(artifactRepository, never()).delete(any());
        }

        @Test
        @DisplayName("Không có người gọi (null) → không được xóa, không còn bỏ qua kiểm quyền")
        void nullUser_forbidden() {
            uploadedBy(COLLABORATOR);

            assertThatThrownBy(() -> artifactService.deleteArtifact(PROJECT_ID, 7L, null))
                .isInstanceOf(ForbiddenException.class);
            verify(artifactRepository, never()).delete(any());
        }
    }

    @Nested
    @DisplayName("Bật/tắt hiển thị trong kho chung")
    class ToggleRepository {

        @Test
        @DisplayName("Viewer → 403, không lưu")
        void viewer_forbidden() {
            ArtifactEntity artifact = ArtifactEntity.builder().id(7L).projectId(PROJECT_ID).uploadedBy(COLLABORATOR)
                .name("PR").type(ArtifactType.PR).url("https://github.com/org/repo/pull/42").isInRepository(false).build();
            when(artifactRepository.findById(7L)).thenReturn(Optional.of(artifact));

            assertThatThrownBy(() -> artifactService.toggleRepositoryVisibility(PROJECT_ID, 7L, true, VIEWER))
                .isInstanceOf(ForbiddenException.class);
            verify(artifactRepository, never()).save(any());
        }

        @Test
        @DisplayName("Collaborator bật được")
        void collaborator_canToggle() {
            ArtifactEntity artifact = ArtifactEntity.builder().id(7L).projectId(PROJECT_ID).uploadedBy(COLLABORATOR)
                .name("PR").type(ArtifactType.PR).url("https://github.com/org/repo/pull/42").isInRepository(false).build();
            when(artifactRepository.findById(7L)).thenReturn(Optional.of(artifact));

            assertThatCode(() -> artifactService.toggleRepositoryVisibility(PROJECT_ID, 7L, true, COLLABORATOR))
                .doesNotThrowAnyException();
            assertThat(artifact.getIsInRepository()).isTrue();
        }
    }

    @Nested
    @DisplayName("Xem danh sách (giữ hành vi hiện có)")
    class ListArtifacts {

        @Test
        @DisplayName("Có nodeId: lấy theo task")
        void byNode() {
            artifactService.getProjectArtifacts(PROJECT_ID, 10L, null, VIEWER);
            verify(artifactRepository).findByProjectIdAndNodeIdOrderByCreatedAtDesc(PROJECT_ID, 10L);
        }

        @Test
        @DisplayName("inRepo=true: chỉ lấy kho chung")
        void repositoryOnly() {
            artifactService.getProjectArtifacts(PROJECT_ID, null, true, VIEWER);
            verify(artifactRepository).findByProjectIdAndIsInRepositoryTrueOrderByCreatedAtDesc(PROJECT_ID);
        }

        @Test
        @DisplayName("Không lọc: lấy tất cả; Viewer vẫn xem được")
        void all() {
            when(artifactRepository.findByProjectIdOrderByCreatedAtDesc(PROJECT_ID)).thenReturn(List.of());
            assertThat(artifactService.getProjectArtifacts(PROJECT_ID, null, null, VIEWER)).isEmpty();
        }

        @Test
        @DisplayName("Không có người gọi (null, ví dụ token rác) → 403, không đọc kho (lỗ hổng D báo ở #49)")
        void nullUser_forbidden() {
            assertThatThrownBy(() -> artifactService.getProjectArtifacts(PROJECT_ID, null, null, null))
                .isInstanceOf(ForbiddenException.class);
            verify(artifactRepository, never()).findByProjectIdOrderByCreatedAtDesc(any());
        }

        @Test
        @DisplayName("Không phải thành viên → 403, không đọc kho")
        void nonMember_forbidden() {
            when(projectAuthorizationService.verifyProjectMemberOrOwner(PROJECT_ID, 99L))
                .thenThrow(new ForbiddenException("ACCESS_DENIED", "Bạn không phải là thành viên của dự án này."));

            assertThatThrownBy(() -> artifactService.getProjectArtifacts(PROJECT_ID, null, null, 99L))
                .isInstanceOf(ForbiddenException.class);
            verify(artifactRepository, never()).findByProjectIdOrderByCreatedAtDesc(any());
        }
    }
}
