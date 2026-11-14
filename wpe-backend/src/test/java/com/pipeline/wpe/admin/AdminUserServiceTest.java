package com.pipeline.wpe.admin;

import com.pipeline.wpe.common.enums.ProjectRole;
import com.pipeline.wpe.common.enums.SystemRole;
import com.pipeline.wpe.dto.request.admin.SuspendUserRequest;
import com.pipeline.wpe.dto.response.admin.AdminUserResponse;
import com.pipeline.wpe.entity.UserEntity;
import com.pipeline.wpe.exception.ConflictException;
import com.pipeline.wpe.exception.ForbiddenException;
import com.pipeline.wpe.exception.ResourceNotFoundException;
import com.pipeline.wpe.repository.ArtifactRepository;
import com.pipeline.wpe.repository.NodeRepository;
import com.pipeline.wpe.repository.PipelineTemplateRepository;
import com.pipeline.wpe.repository.ProjectInvitationRepository;
import com.pipeline.wpe.repository.ProjectMemberRepository;
import com.pipeline.wpe.repository.ProjectRepository;
import com.pipeline.wpe.repository.UserRepository;
import com.pipeline.wpe.service.admin.AdminAuditService;
import com.pipeline.wpe.service.admin.AdminUserService;
import com.pipeline.wpe.service.auth.RefreshTokenService;
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
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdminUserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private ProjectMemberRepository projectMemberRepository;

    @Mock
    private PipelineTemplateRepository pipelineTemplateRepository;

    @Mock
    private ArtifactRepository artifactRepository;

    @Mock
    private ProjectInvitationRepository projectInvitationRepository;

    @Mock
    private NodeRepository nodeRepository;

    @Mock
    private RefreshTokenService refreshTokenService;

    @Mock
    private AdminAuditService adminAuditService;

    @InjectMocks
    private AdminUserService adminUserService;

    @Test
    @DisplayName("Khóa user ADMIN -> ném ForbiddenException mã CANNOT_SUSPEND_ADMIN và không thu hồi token")
    void testSuspendUser_whenAdmin_throwsForbiddenException() {
        UserEntity admin = UserEntity.builder()
            .id(1L)
            .username("admin")
            .email("admin@pipeline.engine")
            .systemRole(SystemRole.ADMIN)
            .isLocked(false)
            .tokenVersion(0)
            .build();

        when(userRepository.findById(1L)).thenReturn(Optional.of(admin));

        assertThatThrownBy(() -> adminUserService.suspendUser(1L, new SuspendUserRequest("Reason", "Note"), 99L))
            .isInstanceOf(ForbiddenException.class)
            .satisfies(ex -> assertThat(((ForbiddenException) ex).getErrorCode()).isEqualTo("CANNOT_SUSPEND_ADMIN"));

        verify(refreshTokenService, never()).revokeAllForUser(any());
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("Khóa user thường -> isLocked=true, tokenVersion tăng 1, gọi revokeAllForUser(id)")
    void testSuspendUser_whenRegularUser_locksAndIncrementsTokenVersionAndRevokes() {
        UserEntity user = UserEntity.builder()
            .id(2L)
            .username("alex.kim")
            .fullName("Alex Kim")
            .email("alex.kim@pipeline.engine")
            .systemRole(SystemRole.USER)
            .isLocked(false)
            .tokenVersion(2)
            .createdAt(Instant.now())
            .build();

        when(userRepository.findById(2L)).thenReturn(Optional.of(user));
        when(userRepository.save(any(UserEntity.class))).thenAnswer(inv -> inv.getArgument(0));
        when(projectRepository.countByOwnerId(2L)).thenReturn(3L);
        when(projectMemberRepository.countByUserIdAndRemovedAtIsNullAndRoleNot(2L, ProjectRole.OWNER)).thenReturn(5L);

        AdminUserResponse response = adminUserService.suspendUser(2L, new SuspendUserRequest("Violation", "Note"), 1L);

        assertThat(response).isNotNull();
        assertThat(response.status()).isEqualTo("SUSPENDED");
        assertThat(response.maskedEmail()).isEqualTo("a***@pipeline.engine");
        assertThat(user.getIsLocked()).isTrue();
        assertThat(user.getTokenVersion()).isEqualTo(3);

        verify(refreshTokenService, times(1)).revokeAllForUser(2L);
        verify(userRepository, times(1)).save(user);
    }

    @Test
    @DisplayName("Khóa user không tồn tại -> ném ResourceNotFoundException")
    void testSuspendUser_whenNotFound_throwsResourceNotFound() {
        when(userRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> adminUserService.suspendUser(999L, new SuspendUserRequest("Violation", null), 1L))
            .isInstanceOf(ResourceNotFoundException.class);

        verify(refreshTokenService, never()).revokeAllForUser(any());
    }

    @Test
    @DisplayName("Mở khóa user -> isLocked=false")
    void testUnbanUser_success() {
        UserEntity user = UserEntity.builder()
            .id(2L)
            .username("alex.kim")
            .fullName("Alex Kim")
            .email("alex.kim@pipeline.engine")
            .systemRole(SystemRole.USER)
            .isLocked(true)
            .tokenVersion(3)
            .createdAt(Instant.now())
            .build();

        when(userRepository.findById(2L)).thenReturn(Optional.of(user));
        when(userRepository.save(any(UserEntity.class))).thenAnswer(inv -> inv.getArgument(0));
        when(projectRepository.countByOwnerId(2L)).thenReturn(3L);
        when(projectMemberRepository.countByUserIdAndRemovedAtIsNullAndRoleNot(2L, ProjectRole.OWNER)).thenReturn(5L);

        AdminUserResponse response = adminUserService.unbanUser(2L, 1L);

        assertThat(response).isNotNull();
        assertThat(response.status()).isEqualTo("ACTIVE");
        assertThat(user.getIsLocked()).isFalse();

        verify(userRepository, times(1)).save(user);
    }

    @Test
    @DisplayName("Mở khóa user không tồn tại -> ném ResourceNotFoundException")
    void testUnbanUser_whenNotFound_throwsResourceNotFound() {
        when(userRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> adminUserService.unbanUser(999L, 1L))
            .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("listUsers lọc đúng theo query và status, email trả về đã che")
    void testListUsers_filtersByQueryAndStatus() {
        Instant now = Instant.now();
        UserEntity u1 = UserEntity.builder()
            .id(1L)
            .username("admin")
            .fullName("System Administrator")
            .email("admin@pipeline.engine")
            .systemRole(SystemRole.ADMIN)
            .isLocked(false)
            .createdAt(now)
            .build();

        UserEntity u2 = UserEntity.builder()
            .id(2L)
            .username("alex.kim")
            .fullName("Alex Kim")
            .email("alex.kim@pipeline.engine")
            .systemRole(SystemRole.USER)
            .isLocked(false)
            .createdAt(now)
            .build();

        UserEntity u3 = UserEntity.builder()
            .id(3L)
            .username("sarah.chen")
            .fullName("Sarah Chen")
            .email("sarah.chen@acme.io")
            .systemRole(SystemRole.USER)
            .isLocked(true)
            .createdAt(now)
            .build();

        when(userRepository.findAll()).thenReturn(List.of(u3, u1, u2)); // un-ordered to test sort
        when(projectRepository.countByOwnerId(anyLong())).thenReturn(2L);
        when(projectMemberRepository.countByUserIdAndRemovedAtIsNullAndRoleNot(anyLong(), eq(ProjectRole.OWNER))).thenReturn(1L);

        // Test 1: Query "alex" + status "ACTIVE"
        List<AdminUserResponse> resultAlex = adminUserService.listUsers("alex", "ACTIVE");
        assertThat(resultAlex).hasSize(1);
        assertThat(resultAlex.get(0).username()).isEqualTo("alex.kim");
        assertThat(resultAlex.get(0).maskedEmail()).isEqualTo("a***@pipeline.engine");
        assertThat(resultAlex.get(0).status()).isEqualTo("ACTIVE");

        // Test 2: Status "SUSPENDED"
        List<AdminUserResponse> resultSuspended = adminUserService.listUsers(null, "SUSPENDED");
        assertThat(resultSuspended).hasSize(1);
        assertThat(resultSuspended.get(0).username()).isEqualTo("sarah.chen");
        assertThat(resultSuspended.get(0).status()).isEqualTo("SUSPENDED");
        assertThat(resultSuspended.get(0).maskedEmail()).isEqualTo("s***@acme.io");

        // Test 3: Query "admin"
        List<AdminUserResponse> resultAdmin = adminUserService.listUsers("admin", null);
        assertThat(resultAdmin).hasSize(1);
        assertThat(resultAdmin.get(0).role()).isEqualTo("ADMIN");

        // Test 4: Sắp xếp theo id tăng dần
        List<AdminUserResponse> allSorted = adminUserService.listUsers(null, null);
        assertThat(allSorted).hasSize(3);
        assertThat(allSorted.get(0).id()).isEqualTo("1");
        assertThat(allSorted.get(1).id()).isEqualTo("2");
        assertThat(allSorted.get(2).id()).isEqualTo("3");
    }

    @Test
    @DisplayName("Khóa/mở khóa user -> gọi adminAuditService.record với USER_SUSPENDED/USER_UNBANNED và targetId đúng")
    void testSuspendAndUnban_recordsAuditLogs() {
        UserEntity user = UserEntity.builder()
            .id(5L)
            .username("sarah.chen")
            .fullName("Sarah Chen")
            .email("sarah.chen@pipeline.engine")
            .systemRole(SystemRole.USER)
            .isLocked(false)
            .tokenVersion(1)
            .createdAt(Instant.now())
            .build();

        when(userRepository.findById(5L)).thenReturn(Optional.of(user));
        when(userRepository.save(any(UserEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        adminUserService.suspendUser(5L, new SuspendUserRequest("TERMS_VIOLATION", "Spamming"), 10L);
        verify(adminAuditService).record(eq(10L), isNull(), eq("USER_SUSPENDED"), eq("USER"), eq("5"), contains("TERMS_VIOLATION"));

        adminUserService.unbanUser(5L, 10L);
        verify(adminAuditService).record(eq(10L), isNull(), eq("USER_UNBANNED"), eq("USER"), eq("5"), isNull());
    }

    @Test
    @DisplayName("listUsers không tìm theo email: tìm theo email hoặc domain trả về danh sách rỗng, tìm theo họ tên vẫn ra 1 user")
    void testListUsers_doesNotSearchByEmail() {
        UserEntity user = UserEntity.builder()
            .id(2L)
            .username("alex.kim")
            .fullName("Alex Kim")
            .email("alex.kim@pipeline.engine")
            .systemRole(SystemRole.USER)
            .isLocked(false)
            .createdAt(Instant.now())
            .build();

        when(userRepository.findAll()).thenReturn(List.of(user));
        when(projectRepository.countByOwnerId(anyLong())).thenReturn(0L);
        when(projectMemberRepository.countByUserIdAndRemovedAtIsNullAndRoleNot(anyLong(), eq(ProjectRole.OWNER))).thenReturn(0L);

        List<AdminUserResponse> byFullEmail = adminUserService.listUsers("alex.kim@pipeline.engine", null);
        assertThat(byFullEmail).isEmpty();

        List<AdminUserResponse> byDomain = adminUserService.listUsers("pipeline.engine", null);
        assertThat(byDomain).isEmpty();

        List<AdminUserResponse> byFullName = adminUserService.listUsers("Alex Kim", null);
        assertThat(byFullName).hasSize(1);
        assertThat(byFullName.get(0).username()).isEqualTo("alex.kim");
    }

    @Test
    @DisplayName("Nâng USER -> ADMIN thành công, ghi log USER -> ADMIN")
    void testChangeRole_userToAdmin_success() {
        UserEntity user = UserEntity.builder()
            .id(2L)
            .username("alex.kim")
            .fullName("Alex Kim")
            .email("alex.kim@pipeline.engine")
            .systemRole(SystemRole.USER)
            .isLocked(false)
            .tokenVersion(0)
            .build();

        when(userRepository.findById(2L)).thenReturn(Optional.of(user));
        when(userRepository.save(any(UserEntity.class))).thenAnswer(inv -> inv.getArgument(0));
        when(projectRepository.countByOwnerId(2L)).thenReturn(0L);
        when(projectMemberRepository.countByUserIdAndRemovedAtIsNullAndRoleNot(2L, ProjectRole.OWNER)).thenReturn(0L);

        AdminUserResponse response = adminUserService.changeRole(2L, "ADMIN", 1L);

        assertThat(response.role()).isEqualTo("ADMIN");
        assertThat(user.getSystemRole()).isEqualTo(SystemRole.ADMIN);
        verify(userRepository).save(user);
        verify(adminAuditService).record(eq(1L), isNull(), eq("USER_ROLE_CHANGED"), eq("USER"), eq("2"), eq("USER -> ADMIN"));
    }

    @Test
    @DisplayName("Nâng user đang bị khóa -> ném ConflictException mã USER_LOCKED")
    void testChangeRole_userToAdmin_whenLocked_throwsUserLocked() {
        UserEntity user = UserEntity.builder()
            .id(2L)
            .username("alex.kim")
            .systemRole(SystemRole.USER)
            .isLocked(true)
            .build();

        when(userRepository.findById(2L)).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> adminUserService.changeRole(2L, "ADMIN", 1L))
            .isInstanceOf(ConflictException.class)
            .satisfies(ex -> assertThat(((ConflictException) ex).getErrorCode()).isEqualTo("USER_LOCKED"));

        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("Tự hạ quyền chính mình -> ném ForbiddenException mã CANNOT_DEMOTE_SELF")
    void testChangeRole_adminToUser_selfDemotion_throwsCannotDemoteSelf() {
        UserEntity admin = UserEntity.builder()
            .id(1L)
            .username("admin")
            .systemRole(SystemRole.ADMIN)
            .isLocked(false)
            .build();

        when(userRepository.findById(1L)).thenReturn(Optional.of(admin));

        assertThatThrownBy(() -> adminUserService.changeRole(1L, "USER", 1L))
            .isInstanceOf(ForbiddenException.class)
            .satisfies(ex -> assertThat(((ForbiddenException) ex).getErrorCode()).isEqualTo("CANNOT_DEMOTE_SELF"));

        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("Hạ admin cuối cùng -> ném ConflictException mã LAST_ADMIN")
    void testChangeRole_adminToUser_lastAdmin_throwsLastAdmin() {
        UserEntity admin = UserEntity.builder()
            .id(2L)
            .username("admin2")
            .systemRole(SystemRole.ADMIN)
            .isLocked(false)
            .build();

        when(userRepository.findById(2L)).thenReturn(Optional.of(admin));
        when(userRepository.lockActiveAdmins()).thenReturn(List.of(admin));

        assertThatThrownBy(() -> adminUserService.changeRole(2L, "USER", 99L))
            .isInstanceOf(ConflictException.class)
            .satisfies(ex -> assertThat(((ConflictException) ex).getErrorCode()).isEqualTo("LAST_ADMIN"));

        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("Hạ admin khi có >= 2 admin -> role USER, tokenVersion + 1, thu hồi refresh token và ghi log")
    void testChangeRole_adminToUser_withMultipleAdmins_success() {
        UserEntity admin1 = UserEntity.builder()
            .id(1L)
            .username("admin1")
            .systemRole(SystemRole.ADMIN)
            .isLocked(false)
            .build();

        UserEntity admin2 = UserEntity.builder()
            .id(2L)
            .username("admin2")
            .fullName("Admin Two")
            .email("admin2@pipeline.engine")
            .systemRole(SystemRole.ADMIN)
            .isLocked(false)
            .tokenVersion(2)
            .build();

        when(userRepository.findById(2L)).thenReturn(Optional.of(admin2));
        when(userRepository.lockActiveAdmins()).thenReturn(List.of(admin1, admin2));
        when(userRepository.save(any(UserEntity.class))).thenAnswer(inv -> inv.getArgument(0));
        when(projectRepository.countByOwnerId(2L)).thenReturn(0L);
        when(projectMemberRepository.countByUserIdAndRemovedAtIsNullAndRoleNot(2L, ProjectRole.OWNER)).thenReturn(0L);

        AdminUserResponse response = adminUserService.changeRole(2L, "USER", 1L);

        assertThat(response.role()).isEqualTo("USER");
        assertThat(admin2.getSystemRole()).isEqualTo(SystemRole.USER);
        assertThat(admin2.getTokenVersion()).isEqualTo(3);
        verify(refreshTokenService).revokeAllForUser(2L);
        verify(userRepository).save(admin2);
        verify(adminAuditService).record(eq(1L), isNull(), eq("USER_ROLE_CHANGED"), eq("USER"), eq("2"), eq("ADMIN -> USER"));
    }

    @Test
    @DisplayName("Role không hợp lệ ('abc') -> ném IllegalArgumentException")
    void testChangeRole_invalidRole_throwsIllegalArgumentException() {
        assertThatThrownBy(() -> adminUserService.changeRole(2L, "abc", 1L))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("Role mới bằng role hiện tại -> không làm gì, trả response, không ghi log")
    void testChangeRole_sameRole_returnsResponseWithoutAction() {
        UserEntity user = UserEntity.builder()
            .id(2L)
            .username("alex.kim")
            .systemRole(SystemRole.USER)
            .isLocked(false)
            .build();

        when(userRepository.findById(2L)).thenReturn(Optional.of(user));
        when(projectRepository.countByOwnerId(2L)).thenReturn(0L);
        when(projectMemberRepository.countByUserIdAndRemovedAtIsNullAndRoleNot(2L, ProjectRole.OWNER)).thenReturn(0L);

        AdminUserResponse response = adminUserService.changeRole(2L, "USER", 1L);

        assertThat(response.role()).isEqualTo("USER");
        verify(userRepository, never()).save(any());
        verify(adminAuditService, never()).record(any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("Xóa user trắng dữ liệu -> gọi userRepository.delete và ghi log USER_DELETED trước")
    void testDeleteUser_emptyUser_success() {
        UserEntity user = UserEntity.builder()
            .id(2L)
            .username("alex.kim")
            .systemRole(SystemRole.USER)
            .build();

        when(userRepository.findById(2L)).thenReturn(Optional.of(user));
        when(projectRepository.countByOwnerId(2L)).thenReturn(0L);
        when(pipelineTemplateRepository.countByCreatedBy(2L)).thenReturn(0L);
        when(artifactRepository.countByUploadedBy(2L)).thenReturn(0L);
        when(projectInvitationRepository.countByInviterIdOrInviteeId(2L, 2L)).thenReturn(0L);
        when(projectMemberRepository.countByUserId(2L)).thenReturn(0L);
        when(nodeRepository.countByAssignedUserId(2L)).thenReturn(0L);

        adminUserService.deleteUser(2L, 1L);

        verify(adminAuditService).record(eq(1L), isNull(), eq("USER_DELETED"), eq("USER"), eq("2"), eq("alex.kim"));
        verify(userRepository).delete(user);
    }

    @Test
    @DisplayName("Xóa user có 1 dự án sở hữu -> ném ConflictException mã USER_HAS_DATA và KHÔNG xóa")
    void testDeleteUser_hasOwnedProject_throwsUserHasData() {
        UserEntity user = UserEntity.builder()
            .id(2L)
            .username("alex.kim")
            .systemRole(SystemRole.USER)
            .build();

        when(userRepository.findById(2L)).thenReturn(Optional.of(user));
        when(projectRepository.countByOwnerId(2L)).thenReturn(1L);
        when(pipelineTemplateRepository.countByCreatedBy(2L)).thenReturn(0L);
        when(artifactRepository.countByUploadedBy(2L)).thenReturn(0L);
        when(projectInvitationRepository.countByInviterIdOrInviteeId(2L, 2L)).thenReturn(0L);
        when(projectMemberRepository.countByUserId(2L)).thenReturn(0L);
        when(nodeRepository.countByAssignedUserId(2L)).thenReturn(0L);

        assertThatThrownBy(() -> adminUserService.deleteUser(2L, 1L))
            .isInstanceOf(ConflictException.class)
            .satisfies(ex -> {
                ConflictException ce = (ConflictException) ex;
                assertThat(ce.getErrorCode()).isEqualTo("USER_HAS_DATA");
                assertThat(ce.getMessage()).contains("1 dự án sở hữu");
            });

        verify(userRepository, never()).delete(any());
    }

    @Test
    @DisplayName("Xóa user có 1 dòng member -> ném ConflictException mã USER_HAS_DATA và KHÔNG xóa")
    void testDeleteUser_hasMembership_throwsUserHasData() {
        UserEntity user = UserEntity.builder()
            .id(2L)
            .username("alex.kim")
            .systemRole(SystemRole.USER)
            .build();

        when(userRepository.findById(2L)).thenReturn(Optional.of(user));
        when(projectRepository.countByOwnerId(2L)).thenReturn(0L);
        when(pipelineTemplateRepository.countByCreatedBy(2L)).thenReturn(0L);
        when(artifactRepository.countByUploadedBy(2L)).thenReturn(0L);
        when(projectInvitationRepository.countByInviterIdOrInviteeId(2L, 2L)).thenReturn(0L);
        when(projectMemberRepository.countByUserId(2L)).thenReturn(1L);
        when(nodeRepository.countByAssignedUserId(2L)).thenReturn(0L);

        assertThatThrownBy(() -> adminUserService.deleteUser(2L, 1L))
            .isInstanceOf(ConflictException.class)
            .satisfies(ex -> {
                ConflictException ce = (ConflictException) ex;
                assertThat(ce.getErrorCode()).isEqualTo("USER_HAS_DATA");
                assertThat(ce.getMessage()).contains("1 lần tham gia dự án");
            });

        verify(userRepository, never()).delete(any());
    }

    @Test
    @DisplayName("Xóa user chỉ được giao 1 task -> ném ConflictException mã USER_HAS_DATA và KHÔNG xóa")
    void testDeleteUser_hasAssignedTask_throwsUserHasData() {
        UserEntity user = UserEntity.builder()
            .id(2L)
            .username("alex.kim")
            .systemRole(SystemRole.USER)
            .build();

        when(userRepository.findById(2L)).thenReturn(Optional.of(user));
        when(projectRepository.countByOwnerId(2L)).thenReturn(0L);
        when(pipelineTemplateRepository.countByCreatedBy(2L)).thenReturn(0L);
        when(artifactRepository.countByUploadedBy(2L)).thenReturn(0L);
        when(projectInvitationRepository.countByInviterIdOrInviteeId(2L, 2L)).thenReturn(0L);
        when(projectMemberRepository.countByUserId(2L)).thenReturn(0L);
        when(nodeRepository.countByAssignedUserId(2L)).thenReturn(1L);

        assertThatThrownBy(() -> adminUserService.deleteUser(2L, 1L))
            .isInstanceOf(ConflictException.class)
            .satisfies(ex -> {
                ConflictException ce = (ConflictException) ex;
                assertThat(ce.getErrorCode()).isEqualTo("USER_HAS_DATA");
                assertThat(ce.getMessage()).contains("1 task được giao");
            });

        verify(userRepository, never()).delete(any());
    }

    @Test
    @DisplayName("Xóa chính mình -> ném ForbiddenException mã CANNOT_DELETE_SELF")
    void testDeleteUser_selfDeletion_throwsCannotDeleteSelf() {
        UserEntity user = UserEntity.builder()
            .id(1L)
            .username("admin")
            .systemRole(SystemRole.USER)
            .build();

        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> adminUserService.deleteUser(1L, 1L))
            .isInstanceOf(ForbiddenException.class)
            .satisfies(ex -> assertThat(((ForbiddenException) ex).getErrorCode()).isEqualTo("CANNOT_DELETE_SELF"));

        verify(userRepository, never()).delete(any());
    }

    @Test
    @DisplayName("Xóa user là ADMIN -> ném ForbiddenException mã CANNOT_DELETE_ADMIN")
    void testDeleteUser_adminUser_throwsCannotDeleteAdmin() {
        UserEntity admin = UserEntity.builder()
            .id(2L)
            .username("admin2")
            .systemRole(SystemRole.ADMIN)
            .build();

        when(userRepository.findById(2L)).thenReturn(Optional.of(admin));

        assertThatThrownBy(() -> adminUserService.deleteUser(2L, 1L))
            .isInstanceOf(ForbiddenException.class)
            .satisfies(ex -> assertThat(((ForbiddenException) ex).getErrorCode()).isEqualTo("CANNOT_DELETE_ADMIN"));

        verify(userRepository, never()).delete(any());
    }
}
