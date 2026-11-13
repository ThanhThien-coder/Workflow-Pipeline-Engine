package com.pipeline.wpe.admin;

import com.pipeline.wpe.common.enums.ProjectRole;
import com.pipeline.wpe.common.enums.ProjectStatus;
import com.pipeline.wpe.dto.response.admin.OwnedProjectResponse;
import com.pipeline.wpe.entity.ProjectEntity;
import com.pipeline.wpe.entity.ProjectMemberEntity;
import com.pipeline.wpe.entity.UserEntity;
import com.pipeline.wpe.exception.ConflictException;
import com.pipeline.wpe.exception.ResourceNotFoundException;
import com.pipeline.wpe.repository.ProjectMemberRepository;
import com.pipeline.wpe.repository.ProjectRepository;
import com.pipeline.wpe.repository.UserRepository;
import com.pipeline.wpe.service.admin.AdminAuditAction;
import com.pipeline.wpe.service.admin.AdminAuditService;
import com.pipeline.wpe.service.admin.AdminProjectOwnerService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdminProjectOwnerServiceTest {

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private ProjectMemberRepository projectMemberRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private AdminAuditService adminAuditService;

    @InjectMocks
    private AdminProjectOwnerService adminProjectOwnerService;

    @Test
    @DisplayName("listOwnedProjects: candidates bỏ chủ hiện tại, bỏ member bị khóa, bỏ member đã removedAt")
    void testListOwnedProjects_filtersCandidatesCorrectly() {
        Long ownerId = 1L;
        UserEntity ownerUser = UserEntity.builder().id(ownerId).username("owner").build();
        when(userRepository.findById(ownerId)).thenReturn(Optional.of(ownerUser));

        ProjectEntity project = ProjectEntity.builder()
            .id(10L)
            .name("Dự án Alpha")
            .ownerId(ownerId)
            .status(ProjectStatus.ACTIVE)
            .build();
        when(projectRepository.findByOwnerId(ownerId)).thenReturn(List.of(project));

        // Member 1: Chủ hiện tại
        ProjectMemberEntity member1 = ProjectMemberEntity.builder()
            .id(101L).projectId(10L).userId(1L).role(ProjectRole.OWNER).removedAt(null).build();

        // Member 2: Thành viên hoạt động hợp lệ -> Candidate
        ProjectMemberEntity member2 = ProjectMemberEntity.builder()
            .id(102L).projectId(10L).userId(2L).role(ProjectRole.COLLABORATOR).removedAt(null).build();
        UserEntity user2 = UserEntity.builder()
            .id(2L).username("alex.kim").fullName("Alex Kim").isLocked(false).build();
        when(userRepository.findById(2L)).thenReturn(Optional.of(user2));

        // Member 3: Thành viên bị khóa -> Bị loại
        ProjectMemberEntity member3 = ProjectMemberEntity.builder()
            .id(103L).projectId(10L).userId(3L).role(ProjectRole.COLLABORATOR).removedAt(null).build();
        UserEntity user3 = UserEntity.builder()
            .id(3L).username("locked.user").isLocked(true).build();
        when(userRepository.findById(3L)).thenReturn(Optional.of(user3));

        // Member 4: Đã bị xóa (removedAt != null) -> Bị loại
        ProjectMemberEntity member4 = ProjectMemberEntity.builder()
            .id(104L).projectId(10L).userId(4L).role(ProjectRole.VIEWER).removedAt(Instant.now()).build();

        when(projectMemberRepository.findByProjectIdAndRemovedAtIsNull(10L))
            .thenReturn(List.of(member1, member2, member3, member4));

        List<OwnedProjectResponse> responses = adminProjectOwnerService.listOwnedProjects(ownerId);

        assertThat(responses).hasSize(1);
        OwnedProjectResponse resp = responses.get(0);
        assertThat(resp.projectId()).isEqualTo("10");
        assertThat(resp.name()).isEqualTo("Dự án Alpha");
        assertThat(resp.memberCount()).isEqualTo(3); // 1, 2, 3 (bỏ member4 vì removedAt != null)
        assertThat(resp.candidates()).hasSize(1);
        assertThat(resp.candidates().get(0).userId()).isEqualTo("2");
        assertThat(resp.candidates().get(0).name()).isEqualTo("Alex Kim");
        assertThat(resp.candidates().get(0).username()).isEqualTo("alex.kim");
    }

    @Test
    @DisplayName("transferOwner: chuyển thành công -> ownerId đổi, member mới OWNER, chủ cũ COLLABORATOR, gọi record")
    void testTransferOwner_success() {
        Long projectId = 10L;
        Long oldOwnerId = 1L;
        Long newOwnerId = 2L;
        Long actorUserId = 99L;

        ProjectEntity project = ProjectEntity.builder()
            .id(projectId)
            .name("Dự án Alpha")
            .ownerId(oldOwnerId)
            .status(ProjectStatus.ACTIVE)
            .build();

        ProjectMemberEntity newOwnerMember = ProjectMemberEntity.builder()
            .id(102L).projectId(projectId).userId(newOwnerId).role(ProjectRole.COLLABORATOR).removedAt(null).build();
        UserEntity newOwnerUser = UserEntity.builder()
            .id(newOwnerId).username("alex.kim").isLocked(false).build();

        ProjectMemberEntity oldOwnerMember = ProjectMemberEntity.builder()
            .id(101L).projectId(projectId).userId(oldOwnerId).role(ProjectRole.OWNER).removedAt(null).build();

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(projectMemberRepository.findByProjectIdAndUserIdAndRemovedAtIsNull(projectId, newOwnerId))
            .thenReturn(Optional.of(newOwnerMember));
        when(userRepository.findById(newOwnerId)).thenReturn(Optional.of(newOwnerUser));
        when(projectMemberRepository.findByProjectIdAndUserIdAndRemovedAtIsNull(projectId, oldOwnerId))
            .thenReturn(Optional.of(oldOwnerMember));
        when(projectRepository.save(any(ProjectEntity.class))).thenAnswer(inv -> inv.getArgument(0));
        when(projectMemberRepository.save(any(ProjectMemberEntity.class))).thenAnswer(inv -> inv.getArgument(0));
        when(projectMemberRepository.findByProjectIdAndRemovedAtIsNull(projectId))
            .thenReturn(List.of(newOwnerMember, oldOwnerMember));
        when(userRepository.findById(oldOwnerId)).thenReturn(Optional.of(UserEntity.builder().id(oldOwnerId).username("oldOwner").isLocked(false).build()));

        OwnedProjectResponse response = adminProjectOwnerService.transferOwner(projectId, newOwnerId, actorUserId);

        assertThat(project.getOwnerId()).isEqualTo(newOwnerId);
        assertThat(newOwnerMember.getRole()).isEqualTo(ProjectRole.OWNER);
        assertThat(oldOwnerMember.getRole()).isEqualTo(ProjectRole.COLLABORATOR);

        verify(projectRepository).save(project);
        verify(projectMemberRepository).save(newOwnerMember);
        verify(projectMemberRepository).save(oldOwnerMember);
        verify(adminAuditService).record(
            eq(actorUserId),
            isNull(),
            eq(AdminAuditAction.PROJECT_OWNER_TRANSFERRED),
            eq("PROJECT"),
            eq("10"),
            eq("#1 -> #2")
        );
        assertThat(response).isNotNull();
    }

    @Test
    @DisplayName("transferOwner: người mới không phải member -> ném ConflictException mã NEW_OWNER_NOT_ACTIVE_MEMBER")
    void testTransferOwner_newOwnerNotMember_throwsNewOwnerNotActiveMember() {
        Long projectId = 10L;
        ProjectEntity project = ProjectEntity.builder().id(projectId).ownerId(1L).build();

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(projectMemberRepository.findByProjectIdAndUserIdAndRemovedAtIsNull(projectId, 2L))
            .thenReturn(Optional.empty());

        assertThatThrownBy(() -> adminProjectOwnerService.transferOwner(projectId, 2L, 99L))
            .isInstanceOf(ConflictException.class)
            .satisfies(ex -> assertThat(((ConflictException) ex).getErrorCode()).isEqualTo("NEW_OWNER_NOT_ACTIVE_MEMBER"));

        verify(projectRepository, never()).save(any());
    }

    @Test
    @DisplayName("transferOwner: người mới bị khóa -> ném ConflictException mã NEW_OWNER_NOT_ACTIVE_MEMBER")
    void testTransferOwner_newOwnerLocked_throwsNewOwnerNotActiveMember() {
        Long projectId = 10L;
        ProjectEntity project = ProjectEntity.builder().id(projectId).ownerId(1L).build();
        ProjectMemberEntity member = ProjectMemberEntity.builder().id(102L).projectId(projectId).userId(2L).removedAt(null).build();
        UserEntity lockedUser = UserEntity.builder().id(2L).isLocked(true).build();

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(projectMemberRepository.findByProjectIdAndUserIdAndRemovedAtIsNull(projectId, 2L))
            .thenReturn(Optional.of(member));
        when(userRepository.findById(2L)).thenReturn(Optional.of(lockedUser));

        assertThatThrownBy(() -> adminProjectOwnerService.transferOwner(projectId, 2L, 99L))
            .isInstanceOf(ConflictException.class)
            .satisfies(ex -> assertThat(((ConflictException) ex).getErrorCode()).isEqualTo("NEW_OWNER_NOT_ACTIVE_MEMBER"));

        verify(projectRepository, never()).save(any());
    }

    @Test
    @DisplayName("transferOwner: người mới là chủ hiện tại -> ném ConflictException mã ALREADY_OWNER")
    void testTransferOwner_alreadyOwner_throwsAlreadyOwner() {
        Long projectId = 10L;
        ProjectEntity project = ProjectEntity.builder().id(projectId).ownerId(1L).build();

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));

        assertThatThrownBy(() -> adminProjectOwnerService.transferOwner(projectId, 1L, 99L))
            .isInstanceOf(ConflictException.class)
            .satisfies(ex -> assertThat(((ConflictException) ex).getErrorCode()).isEqualTo("ALREADY_OWNER"));

        verify(projectRepository, never()).save(any());
    }
}
