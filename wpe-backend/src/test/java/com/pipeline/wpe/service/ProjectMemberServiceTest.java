package com.pipeline.wpe.service;

import com.pipeline.wpe.common.enums.NodeStatus;
import com.pipeline.wpe.common.enums.ProjectRole;
import com.pipeline.wpe.dto.response.project.ProjectMemberHistoryResponse;
import com.pipeline.wpe.dto.response.project.ProjectMemberResponse;
import com.pipeline.wpe.dto.response.project.RemoveMemberResponse;
import com.pipeline.wpe.entity.NodeEntity;
import com.pipeline.wpe.entity.ProjectEntity;
import com.pipeline.wpe.entity.ProjectMemberEntity;
import com.pipeline.wpe.entity.UserEntity;
import com.pipeline.wpe.exception.ForbiddenException;
import com.pipeline.wpe.repository.NodeRepository;
import com.pipeline.wpe.repository.ProjectMemberRepository;
import com.pipeline.wpe.repository.ProjectRepository;
import com.pipeline.wpe.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProjectMemberServiceTest {

    @Mock
    private ProjectAuthorizationService projectAuthorizationService;

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private ProjectMemberRepository projectMemberRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private NodeRepository nodeRepository;

    @InjectMocks
    private ProjectMemberService projectMemberService;

    @Test
    @DisplayName("getMembers: Người ngoài dự án gọi lấy danh sách thành viên thì ném ForbiddenException")
    void getMembers_whenNonMember_throwsForbiddenException() {
        Long projectId = 1L;
        Long outsiderId = 99L;

        when(projectAuthorizationService.verifyProjectMemberOrOwner(projectId, outsiderId))
                .thenThrow(new ForbiddenException("ACCESS_DENIED", "Bạn không phải là thành viên của dự án này."));

        assertThatThrownBy(() -> projectMemberService.getMembers(projectId, outsiderId))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("Bạn không phải là thành viên của dự án này.");

        verify(projectMemberRepository, never()).findByProjectIdAndRemovedAtIsNull(any());
    }

    @Test
    @DisplayName("getMembers: Trả về đủ danh sách thành viên, OWNER đứng đầu, activeNodeCount đúng (loại bỏ DONE)")
    void getMembers_whenMember_returnsMemberListWithOwnerFirstAndActiveCountCorrect() {
        Long projectId = 1L;
        Long currentUserId = 2L;

        Instant t0 = Instant.now().minus(10, ChronoUnit.DAYS);
        Instant t1 = Instant.now().minus(5, ChronoUnit.DAYS);
        Instant t2 = Instant.now().minus(2, ChronoUnit.DAYS);

        ProjectMemberEntity memberCollab = ProjectMemberEntity.builder()
                .id(102L)
                .projectId(projectId)
                .userId(2L)
                .role(ProjectRole.COLLABORATOR)
                .joinedAt(t0)
                .build();

        ProjectMemberEntity memberOwner = ProjectMemberEntity.builder()
                .id(101L)
                .projectId(projectId)
                .userId(1L)
                .role(ProjectRole.OWNER)
                .joinedAt(t1)
                .build();

        ProjectMemberEntity memberViewer = ProjectMemberEntity.builder()
                .id(103L)
                .projectId(projectId)
                .userId(3L)
                .role(ProjectRole.VIEWER)
                .joinedAt(t2)
                .build();

        UserEntity user1 = UserEntity.builder().id(1L).username("owner.alex").fullName("Alex Kim").email("alex@wpe.io").build();
        UserEntity user2 = UserEntity.builder().id(2L).username("sarah.c").fullName("Sarah Chen").email("sarah@wpe.io").build();
        UserEntity user3 = UserEntity.builder().id(3L).username("john.v").fullName("John Viewer").email("john@wpe.io").build();

        NodeEntity node1 = NodeEntity.builder().id(201L).assignedUserId(2L).status(NodeStatus.IN_PROGRESS).build();
        NodeEntity node2 = NodeEntity.builder().id(202L).assignedUserId(2L).status(NodeStatus.TODO).build();
        NodeEntity node3 = NodeEntity.builder().id(203L).assignedUserId(2L).status(NodeStatus.DONE).build();
        NodeEntity node4 = NodeEntity.builder().id(204L).assignedUserId(1L).status(NodeStatus.LOCKED).build();
        NodeEntity node5 = NodeEntity.builder().id(205L).assignedUserId(3L).status(NodeStatus.DONE).build();

        when(projectAuthorizationService.verifyProjectMemberOrOwner(projectId, currentUserId))
                .thenReturn(ProjectEntity.builder().id(projectId).ownerId(1L).build());
        when(projectMemberRepository.findByProjectIdAndRemovedAtIsNull(projectId))
                .thenReturn(List.of(memberCollab, memberOwner, memberViewer));
        when(userRepository.findAllById(List.of(2L, 1L, 3L)))
                .thenReturn(List.of(user1, user2, user3));
        when(nodeRepository.findByProjectId(projectId))
                .thenReturn(List.of(node1, node2, node3, node4, node5));

        List<ProjectMemberResponse> result = projectMemberService.getMembers(projectId, currentUserId);

        assertThat(result).hasSize(3);

        // OWNER luôn đứng đầu
        assertThat(result.get(0).userId()).isEqualTo("1");
        assertThat(result.get(0).role()).isEqualTo("OWNER");
        assertThat(result.get(0).username()).isEqualTo("owner.alex");
        assertThat(result.get(0).initials()).isEqualTo("AK");
        assertThat(result.get(0).activeNodeCount()).isEqualTo(1);

        // Sau đó theo joinedAt: memberCollab (t0) trước memberViewer (t2)
        assertThat(result.get(1).userId()).isEqualTo("2");
        assertThat(result.get(1).role()).isEqualTo("COLLABORATOR");
        assertThat(result.get(1).activeNodeCount()).isEqualTo(2);
        assertThat(result.get(1).initials()).isEqualTo("SC");

        assertThat(result.get(2).userId()).isEqualTo("3");
        assertThat(result.get(2).role()).isEqualTo("VIEWER");
        assertThat(result.get(2).activeNodeCount()).isEqualTo(0);
        assertThat(result.get(2).initials()).isEqualTo("JV");
    }

    @Test
    @DisplayName("updateRole OWNER: Chuyển quyền sở hữu, đổi project.ownerId, người mới thành OWNER, owner cũ thành COLLABORATOR")
    void updateRole_toOwner_transfersOwnershipAndRoles() {
        Long projectId = 1L;
        Long currentOwnerId = 1L;
        Long newOwnerId = 2L;

        ProjectEntity project = ProjectEntity.builder()
                .id(projectId)
                .ownerId(currentOwnerId)
                .build();

        ProjectMemberEntity targetMember = ProjectMemberEntity.builder()
                .id(102L)
                .projectId(projectId)
                .userId(newOwnerId)
                .role(ProjectRole.COLLABORATOR)
                .joinedAt(Instant.now().minus(10, ChronoUnit.DAYS))
                .build();

        ProjectMemberEntity oldOwnerMember = ProjectMemberEntity.builder()
                .id(101L)
                .projectId(projectId)
                .userId(currentOwnerId)
                .role(ProjectRole.OWNER)
                .joinedAt(Instant.now().minus(20, ChronoUnit.DAYS))
                .build();

        UserEntity user2 = UserEntity.builder().id(newOwnerId).username("sarah.c").fullName("Sarah Chen").email("sarah@wpe.io").build();

        when(projectAuthorizationService.verifyProjectOwner(projectId, currentOwnerId)).thenReturn(project);
        when(projectMemberRepository.findByProjectIdAndUserIdAndRemovedAtIsNull(projectId, newOwnerId))
                .thenReturn(Optional.of(targetMember));
        when(projectMemberRepository.findByProjectIdAndUserIdAndRemovedAtIsNull(projectId, currentOwnerId))
                .thenReturn(Optional.of(oldOwnerMember));
        when(userRepository.findById(newOwnerId)).thenReturn(Optional.of(user2));
        when(nodeRepository.findByProjectIdAndAssignedUserIdAndStatusNot(projectId, newOwnerId, NodeStatus.DONE))
                .thenReturn(List.of());

        ProjectMemberResponse res = projectMemberService.updateRole(projectId, newOwnerId, ProjectRole.OWNER, currentOwnerId);

        assertThat(project.getOwnerId()).isEqualTo(newOwnerId);
        verify(projectRepository).save(project);

        assertThat(targetMember.getRole()).isEqualTo(ProjectRole.OWNER);
        verify(projectMemberRepository).save(targetMember);

        assertThat(oldOwnerMember.getRole()).isEqualTo(ProjectRole.COLLABORATOR);
        verify(projectMemberRepository).save(oldOwnerMember);

        assertThat(res.userId()).isEqualTo(String.valueOf(newOwnerId));
        assertThat(res.role()).isEqualTo("OWNER");
    }

    @Test
    @DisplayName("updateRole VIEWER cho owner: Ném IllegalArgumentException chứa OWNER_ROLE_LOCKED")
    void updateRole_whenViewerForOwner_throwsIllegalArgumentExceptionWithOwnerRoleLocked() {
        Long projectId = 1L;
        Long ownerId = 1L;

        ProjectEntity project = ProjectEntity.builder()
                .id(projectId)
                .ownerId(ownerId)
                .build();

        ProjectMemberEntity ownerMember = ProjectMemberEntity.builder()
                .id(101L)
                .projectId(projectId)
                .userId(ownerId)
                .role(ProjectRole.OWNER)
                .build();

        when(projectAuthorizationService.verifyProjectOwner(projectId, ownerId)).thenReturn(project);
        when(projectMemberRepository.findByProjectIdAndUserIdAndRemovedAtIsNull(projectId, ownerId))
                .thenReturn(Optional.of(ownerMember));

        assertThatThrownBy(() -> projectMemberService.updateRole(projectId, ownerId, ProjectRole.VIEWER, ownerId))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("OWNER_ROLE_LOCKED");

        verify(projectMemberRepository, never()).save(any());
        verify(projectRepository, never()).save(any());
    }

    @Test
    @DisplayName("updateRole bởi người không phải owner: Ném ForbiddenException")
    void updateRole_whenNotOwner_throwsForbiddenException() {
        Long projectId = 1L;
        Long nonOwnerId = 2L;

        when(projectAuthorizationService.verifyProjectOwner(projectId, nonOwnerId))
                .thenThrow(new ForbiddenException("ACCESS_DENIED", "Chỉ Chủ dự án (Project Owner) mới có quyền thực hiện hành động này."));

        assertThatThrownBy(() -> projectMemberService.updateRole(projectId, 3L, ProjectRole.COLLABORATOR, nonOwnerId))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("Chỉ Chủ dự án (Project Owner) mới có quyền thực hiện hành động này.");

        verify(projectMemberRepository, never()).findByProjectIdAndUserIdAndRemovedAtIsNull(any(), any());
    }

    @Test
    @DisplayName("removeMember: 2 node chưa DONE + 1 node DONE của người đó -> unassignedTaskCount = 2, 2 node set null, node DONE giữ nguyên, removedAt khác null")
    void removeMember_unassignsNonDoneNodesAndSoftDeletes() {
        Long projectId = 1L;
        Long ownerId = 1L;
        Long targetUserId = 2L;

        ProjectEntity project = ProjectEntity.builder()
                .id(projectId)
                .ownerId(ownerId)
                .build();

        ProjectMemberEntity targetMember = ProjectMemberEntity.builder()
                .id(102L)
                .projectId(projectId)
                .userId(targetUserId)
                .role(ProjectRole.COLLABORATOR)
                .removedAt(null)
                .build();

        NodeEntity node1 = NodeEntity.builder().id(201L).projectId(projectId).assignedUserId(targetUserId).status(NodeStatus.TODO).build();
        NodeEntity node2 = NodeEntity.builder().id(202L).projectId(projectId).assignedUserId(targetUserId).status(NodeStatus.IN_PROGRESS).build();
        NodeEntity nodeDone = NodeEntity.builder().id(203L).projectId(projectId).assignedUserId(targetUserId).status(NodeStatus.DONE).build();

        when(projectAuthorizationService.verifyProjectOwner(projectId, ownerId)).thenReturn(project);
        when(projectMemberRepository.findByProjectIdAndUserIdAndRemovedAtIsNull(projectId, targetUserId))
                .thenReturn(Optional.of(targetMember));
        when(nodeRepository.findByProjectIdAndAssignedUserIdAndStatusNot(projectId, targetUserId, NodeStatus.DONE))
                .thenReturn(new ArrayList<>(List.of(node1, node2)));

        RemoveMemberResponse res = projectMemberService.removeMember(projectId, targetUserId, ownerId);

        assertThat(res.userId()).isEqualTo(targetUserId);
        assertThat(res.unassignedTaskCount()).isEqualTo(2);

        assertThat(targetMember.getRemovedAt()).isNotNull();
        verify(projectMemberRepository).save(targetMember);

        assertThat(node1.getAssignedUserId()).isNull();
        assertThat(node2.getAssignedUserId()).isNull();
        verify(nodeRepository).saveAll(List.of(node1, node2));

        assertThat(nodeDone.getAssignedUserId()).isEqualTo(targetUserId);
    }

    @Test
    @DisplayName("removeMember owner: Ném IllegalArgumentException chứa CANNOT_REMOVE_OWNER")
    void removeMember_whenOwner_throwsIllegalArgumentExceptionWithCannotRemoveOwner() {
        Long projectId = 1L;
        Long ownerId = 1L;

        ProjectEntity project = ProjectEntity.builder()
                .id(projectId)
                .ownerId(ownerId)
                .build();

        when(projectAuthorizationService.verifyProjectOwner(projectId, ownerId)).thenReturn(project);

        assertThatThrownBy(() -> projectMemberService.removeMember(projectId, ownerId, ownerId))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("CANNOT_REMOVE_OWNER");

        verify(projectMemberRepository, never()).findByProjectIdAndUserIdAndRemovedAtIsNull(any(), any());
        verify(nodeRepository, never()).findByProjectIdAndAssignedUserIdAndStatusNot(any(), any(), any());
    }

    @Test
    @DisplayName("getMemberHistory: 1 người có 2 dòng (dòng cũ có removedAt, dòng mới active) -> 2 phần tử đúng thứ tự, active đúng")
    void getMemberHistory_returnsOrderedHistory_withCorrectActiveStatus() {
        Long projectId = 1L;
        Long currentUserId = 10L;
        Long targetUserId = 20L;

        Instant t0 = Instant.now().minus(30, ChronoUnit.DAYS);
        Instant tRemoved = Instant.now().minus(10, ChronoUnit.DAYS);
        Instant t1 = Instant.now().minus(5, ChronoUnit.DAYS);

        ProjectMemberEntity oldRecord = ProjectMemberEntity.builder()
                .id(100L)
                .projectId(projectId)
                .userId(targetUserId)
                .role(ProjectRole.VIEWER)
                .joinedAt(t0)
                .removedAt(tRemoved)
                .build();

        ProjectMemberEntity newRecord = ProjectMemberEntity.builder()
                .id(101L)
                .projectId(projectId)
                .userId(targetUserId)
                .role(ProjectRole.COLLABORATOR)
                .joinedAt(t1)
                .removedAt(null)
                .build();

        UserEntity user = UserEntity.builder()
                .id(targetUserId)
                .username("example-sarah")
                .fullName("Sarah Chen")
                .email("example-sarah@example-pipeline.org")
                .build();

        when(projectAuthorizationService.verifyProjectMemberOrOwner(projectId, currentUserId))
                .thenReturn(ProjectEntity.builder().id(projectId).ownerId(1L).build());
        when(projectMemberRepository.findByProjectIdOrderByJoinedAtAsc(projectId))
                .thenReturn(List.of(oldRecord, newRecord));
        when(userRepository.findAllById(List.of(targetUserId)))
                .thenReturn(List.of(user));

        List<ProjectMemberHistoryResponse> history = projectMemberService.getMemberHistory(projectId, currentUserId);

        assertThat(history).hasSize(2);

        // Phần tử 1: Dòng cũ (đã xóa)
        assertThat(history.get(0).userId()).isEqualTo(String.valueOf(targetUserId));
        assertThat(history.get(0).username()).isEqualTo("example-sarah");
        assertThat(history.get(0).fullName()).isEqualTo("Sarah Chen");
        assertThat(history.get(0).role()).isEqualTo("VIEWER");
        assertThat(history.get(0).joinedAt()).isEqualTo(t0);
        assertThat(history.get(0).removedAt()).isEqualTo(tRemoved);
        assertThat(history.get(0).active()).isFalse();

        // Phần tử 2: Dòng mới (đang hoạt động)
        assertThat(history.get(1).userId()).isEqualTo(String.valueOf(targetUserId));
        assertThat(history.get(1).username()).isEqualTo("example-sarah");
        assertThat(history.get(1).fullName()).isEqualTo("Sarah Chen");
        assertThat(history.get(1).role()).isEqualTo("COLLABORATOR");
        assertThat(history.get(1).joinedAt()).isEqualTo(t1);
        assertThat(history.get(1).removedAt()).isNull();
        assertThat(history.get(1).active()).isTrue();
    }
}
