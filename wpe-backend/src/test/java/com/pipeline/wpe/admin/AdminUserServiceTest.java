package com.pipeline.wpe.admin;

import com.pipeline.wpe.common.enums.ProjectRole;
import com.pipeline.wpe.common.enums.SystemRole;
import com.pipeline.wpe.dto.request.admin.SuspendUserRequest;
import com.pipeline.wpe.dto.response.admin.AdminUserResponse;
import com.pipeline.wpe.entity.UserEntity;
import com.pipeline.wpe.exception.ForbiddenException;
import com.pipeline.wpe.exception.ResourceNotFoundException;
import com.pipeline.wpe.repository.ProjectMemberRepository;
import com.pipeline.wpe.repository.ProjectRepository;
import com.pipeline.wpe.repository.UserRepository;
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
    private RefreshTokenService refreshTokenService;

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

        assertThatThrownBy(() -> adminUserService.suspendUser(1L, new SuspendUserRequest("Reason", 7, "Note"), 99L))
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

        AdminUserResponse response = adminUserService.suspendUser(2L, new SuspendUserRequest("Violation", 3, "Note"), 1L);

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

        assertThatThrownBy(() -> adminUserService.suspendUser(999L, new SuspendUserRequest("Violation", 3, null), 1L))
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
}
