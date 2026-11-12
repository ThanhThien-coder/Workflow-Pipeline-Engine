package com.pipeline.wpe.service;

import com.pipeline.wpe.common.enums.ProjectRole;
import com.pipeline.wpe.entity.ProjectEntity;
import com.pipeline.wpe.entity.ProjectMemberEntity;
import com.pipeline.wpe.exception.ForbiddenException;
import com.pipeline.wpe.repository.ProjectMemberRepository;
import com.pipeline.wpe.repository.ProjectRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjectAuthorizationServiceTest {

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private ProjectMemberRepository projectMemberRepository;

    @InjectMocks
    private ProjectAuthorizationService projectAuthorizationService;

    private ProjectEntity mockProject;
    private final Long projectId = 1L;
    private final Long ownerId = 10L;
    private final Long managerId = 20L;
    private final Long collaboratorId = 30L;
    private final Long strangerId = 99L;

    @BeforeEach
    void setUp() {
        mockProject = ProjectEntity.builder()
            .id(projectId)
            .ownerId(ownerId)
            .name("example-project")
            .build();
    }

    @Test
    @DisplayName("isOwnerOrManager: Owner trả về true")
    void testIsOwnerOrManager_owner_returnsTrue() {
        boolean result = projectAuthorizationService.isOwnerOrManager(mockProject, ownerId);
        assertThat(result).isTrue();
    }

    @Test
    @DisplayName("isOwnerOrManager: MANAGER trả về true")
    void testIsOwnerOrManager_manager_returnsTrue() {
        ProjectMemberEntity member = ProjectMemberEntity.builder()
            .projectId(projectId)
            .userId(managerId)
            .role(ProjectRole.MANAGER)
            .build();
        when(projectMemberRepository.findByProjectIdAndUserIdAndRemovedAtIsNull(projectId, managerId))
            .thenReturn(Optional.of(member));

        boolean result = projectAuthorizationService.isOwnerOrManager(mockProject, managerId);
        assertThat(result).isTrue();
    }

    @Test
    @DisplayName("isOwnerOrManager: COLLABORATOR trả về false")
    void testIsOwnerOrManager_collaborator_returnsFalse() {
        ProjectMemberEntity member = ProjectMemberEntity.builder()
            .projectId(projectId)
            .userId(collaboratorId)
            .role(ProjectRole.COLLABORATOR)
            .build();
        when(projectMemberRepository.findByProjectIdAndUserIdAndRemovedAtIsNull(projectId, collaboratorId))
            .thenReturn(Optional.of(member));

        boolean result = projectAuthorizationService.isOwnerOrManager(mockProject, collaboratorId);
        assertThat(result).isFalse();
    }

    @Test
    @DisplayName("isOwnerOrManager: Không phải thành viên trả về false")
    void testIsOwnerOrManager_notMember_returnsFalse() {
        when(projectMemberRepository.findByProjectIdAndUserIdAndRemovedAtIsNull(projectId, strangerId))
            .thenReturn(Optional.empty());

        boolean result = projectAuthorizationService.isOwnerOrManager(mockProject, strangerId);
        assertThat(result).isFalse();
    }

    @Test
    @DisplayName("verifyProjectOwnerOrManager: Ném ForbiddenException cho COLLABORATOR")
    void testVerifyProjectOwnerOrManager_collaborator_throwsForbiddenException() {
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(mockProject));
        ProjectMemberEntity member = ProjectMemberEntity.builder()
            .projectId(projectId)
            .userId(collaboratorId)
            .role(ProjectRole.COLLABORATOR)
            .build();
        when(projectMemberRepository.findByProjectIdAndUserIdAndRemovedAtIsNull(projectId, collaboratorId))
            .thenReturn(Optional.of(member));

        assertThatThrownBy(() -> projectAuthorizationService.verifyProjectOwnerOrManager(projectId, collaboratorId))
            .isInstanceOf(ForbiddenException.class)
            .hasMessageContaining("Chỉ Chủ dự án hoặc Quản lý");
    }

    @Test
    @DisplayName("verifyProjectOwnerOrManager: Thành công khi là Owner")
    void testVerifyProjectOwnerOrManager_owner_success() {
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(mockProject));

        ProjectEntity result = projectAuthorizationService.verifyProjectOwnerOrManager(projectId, ownerId);
        assertThat(result).isSameAs(mockProject);
    }

    @Test
    @DisplayName("verifyProjectOwnerOrManager: Thành công khi là Manager")
    void testVerifyProjectOwnerOrManager_manager_success() {
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(mockProject));
        ProjectMemberEntity member = ProjectMemberEntity.builder()
            .projectId(projectId)
            .userId(managerId)
            .role(ProjectRole.MANAGER)
            .build();
        when(projectMemberRepository.findByProjectIdAndUserIdAndRemovedAtIsNull(projectId, managerId))
            .thenReturn(Optional.of(member));

        ProjectEntity result = projectAuthorizationService.verifyProjectOwnerOrManager(projectId, managerId);
        assertThat(result).isSameAs(mockProject);
    }
}
