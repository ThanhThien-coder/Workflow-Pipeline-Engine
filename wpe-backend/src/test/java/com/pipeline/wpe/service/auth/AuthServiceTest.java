package com.pipeline.wpe.service.auth;

import com.pipeline.wpe.common.enums.SystemRole;
import com.pipeline.wpe.dto.request.auth.LoginRequest;
import com.pipeline.wpe.dto.request.auth.RegisterRequest;
import com.pipeline.wpe.dto.response.auth.AuthResponse;
import com.pipeline.wpe.entity.UserEntity;
import com.pipeline.wpe.exception.ConflictException;
import com.pipeline.wpe.exception.ForbiddenException;
import com.pipeline.wpe.exception.UnauthorizedException;
import com.pipeline.wpe.mapper.UserMapper;
import com.pipeline.wpe.repository.UserRepository;
import com.pipeline.wpe.service.admin.AdminAuditService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    // cost 4 cho test chạy nhanh; cost 12 thật được kiểm ở SeedPasswordHashTest
    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder(4);

    @Mock
    private UserRepository userRepository;
    @Mock
    private JwtService jwtService;
    @Mock
    private RefreshTokenService refreshTokenService;
    @Mock
    private UserMapper userMapper;
    @Mock
    private AdminAuditService adminAuditService;

    private AuthService authService;

    private final AuthResponse.UserSummary summary =
        new AuthResponse.UserSummary("2", "alex.kim", "alex.kim@pipeline.engine", "Alex Kim", "USER", null);

    @BeforeEach
    void setUp() {
        authService = new AuthService(userRepository, passwordEncoder, jwtService, refreshTokenService, userMapper, adminAuditService);
    }

    private UserEntity alex(boolean locked) {
        return UserEntity.builder()
            .id(2L).username("alex.kim").email("alex.kim@pipeline.engine").fullName("Alex Kim")
            .passwordHash(passwordEncoder.encode("Password123!"))
            .systemRole(SystemRole.USER).isLocked(locked).tokenVersion(0).build();
    }

    // ---------- register ----------

    @Test
    @DisplayName("register: hợp lệ -> lưu user USER/không khóa/tv=0, mật khẩu đã băm, trả cặp token")
    void register_ok() {
        when(userRepository.existsByUsername("minhdang2026")).thenReturn(false);
        when(userRepository.existsByEmail("dang.dev@wpe.io")).thenReturn(false);
        when(userRepository.save(any(UserEntity.class))).thenAnswer(inv -> {
            UserEntity u = inv.getArgument(0);
            u.setId(5L);
            return u;
        });
        when(jwtService.generateAccessToken(any())).thenReturn("jwt");
        when(refreshTokenService.issue(5L)).thenReturn("rt_new");
        when(userMapper.toUserSummary(any())).thenReturn(summary);

        AuthResponse res = authService.register(
            new RegisterRequest("minhdang2026", "dang.dev@wpe.io", "SecurePassword123!", "Dang Minh"));

        assertThat(res.token()).isEqualTo("jwt");
        assertThat(res.refreshToken()).isEqualTo("rt_new");
        ArgumentCaptor<UserEntity> captor = ArgumentCaptor.forClass(UserEntity.class);
        verify(userRepository).save(captor.capture());
        UserEntity saved = captor.getValue();
        assertThat(saved.getSystemRole()).isEqualTo(SystemRole.USER);
        assertThat(saved.getIsLocked()).isFalse();
        assertThat(saved.getTokenVersion()).isZero();
        assertThat(saved.getPasswordHash()).isNotEqualTo("SecurePassword123!");
        assertThat(passwordEncoder.matches("SecurePassword123!", saved.getPasswordHash())).isTrue();
    }

    @Test
    @DisplayName("register: trùng username -> 409 USERNAME_TAKEN")
    void register_usernameTaken() {
        when(userRepository.existsByUsername("alex.kim")).thenReturn(true);

        assertThatThrownBy(() -> authService.register(
            new RegisterRequest("alex.kim", "new@wpe.io", "Password123!", null)))
            .isInstanceOf(ConflictException.class).extracting("errorCode").isEqualTo("USERNAME_TAKEN");
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("register: trùng email -> 409 EMAIL_TAKEN")
    void register_emailTaken() {
        when(userRepository.existsByUsername("newbie")).thenReturn(false);
        when(userRepository.existsByEmail("alex.kim@pipeline.engine")).thenReturn(true);

        assertThatThrownBy(() -> authService.register(
            new RegisterRequest("newbie", "alex.kim@pipeline.engine", "Password123!", null)))
            .isInstanceOf(ConflictException.class).extracting("errorCode").isEqualTo("EMAIL_TAKEN");
        verify(userRepository, never()).save(any());
    }

    // ---------- login ----------

    @Test
    @DisplayName("login: đúng mật khẩu -> trả token, refreshToken, user")
    void login_ok() {
        UserEntity user = alex(false);
        when(userRepository.findByUsername("alex.kim")).thenReturn(Optional.of(user));
        when(jwtService.generateAccessToken(user)).thenReturn("jwt");
        when(refreshTokenService.issue(2L)).thenReturn("rt_x");
        when(userMapper.toUserSummary(user)).thenReturn(summary);

        AuthResponse res = authService.login(new LoginRequest("alex.kim", "Password123!", true));

        assertThat(res.token()).isEqualTo("jwt");
        assertThat(res.refreshToken()).isEqualTo("rt_x");
        assertThat(res.user().id()).isEqualTo("2");
        verify(adminAuditService).record(eq(2L), any(), eq("LOGIN_SUCCESS"), eq("USER"), eq("2"), any());
    }

    @Test
    @DisplayName("login: bằng email alex.kim@pipeline.engine -> gọi findByEmailIgnoreCase, thành công, không gọi findByUsername")
    void login_byEmail_ok() {
        UserEntity user = alex(false);
        when(userRepository.findByEmailIgnoreCase("alex.kim@pipeline.engine")).thenReturn(Optional.of(user));
        when(jwtService.generateAccessToken(user)).thenReturn("jwt");
        when(refreshTokenService.issue(2L)).thenReturn("rt_x");
        when(userMapper.toUserSummary(user)).thenReturn(summary);

        AuthResponse res = authService.login(new LoginRequest("alex.kim@pipeline.engine", "Password123!", true));

        assertThat(res.token()).isEqualTo("jwt");
        assertThat(res.refreshToken()).isEqualTo("rt_x");
        assertThat(res.user().id()).isEqualTo("2");
        verify(userRepository).findByEmailIgnoreCase("alex.kim@pipeline.engine");
        verify(userRepository, never()).findByUsername(anyString());
    }

    @Test
    @DisplayName("login: email viết hoa ALEX.KIM@PIPELINE.ENGINE -> gọi findByEmailIgnoreCase với chuỗi đó (đã trim) và thành công")
    void login_byEmail_uppercase_ok() {
        UserEntity user = alex(false);
        when(userRepository.findByEmailIgnoreCase("ALEX.KIM@PIPELINE.ENGINE")).thenReturn(Optional.of(user));
        when(jwtService.generateAccessToken(user)).thenReturn("jwt");
        when(refreshTokenService.issue(2L)).thenReturn("rt_x");
        when(userMapper.toUserSummary(user)).thenReturn(summary);

        AuthResponse res = authService.login(new LoginRequest("  ALEX.KIM@PIPELINE.ENGINE  ", "Password123!", true));

        assertThat(res.token()).isEqualTo("jwt");
        assertThat(res.refreshToken()).isEqualTo("rt_x");
        assertThat(res.user().id()).isEqualTo("2");
        verify(userRepository).findByEmailIgnoreCase("ALEX.KIM@PIPELINE.ENGINE");
        verify(userRepository, never()).findByUsername(anyString());
    }

    @Test
    @DisplayName("login: email không tồn tại -> 401 BAD_CREDENTIALS")
    void login_byEmail_notFound_badCredentials() {
        when(userRepository.findByEmailIgnoreCase("ghost@pipeline.engine")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(new LoginRequest("ghost@pipeline.engine", "Password123!", false)))
            .isInstanceOf(UnauthorizedException.class)
            .extracting("errorCode")
            .isEqualTo("BAD_CREDENTIALS");
        verify(userRepository).findByEmailIgnoreCase("ghost@pipeline.engine");
        verify(userRepository, never()).findByUsername(anyString());
        verify(refreshTokenService, never()).issue(anyLong());
    }

    @Test
    @DisplayName("login: sai mật khẩu và không có user -> cùng 401 BAD_CREDENTIALS, cùng thông báo")
    void login_badCredentials_sameMessage() {
        when(userRepository.findByUsername("alex.kim")).thenReturn(Optional.of(alex(false)));
        when(userRepository.findByUsername("ghost")).thenReturn(Optional.empty());

        Throwable wrongPassword = catchUnauthorized(() -> authService.login(new LoginRequest("alex.kim", "sai", false)));
        Throwable noUser = catchUnauthorized(() -> authService.login(new LoginRequest("ghost", "Password123!", false)));

        assertThat(((UnauthorizedException) wrongPassword).getErrorCode()).isEqualTo("BAD_CREDENTIALS");
        assertThat(((UnauthorizedException) noUser).getErrorCode()).isEqualTo("BAD_CREDENTIALS");
        assertThat(wrongPassword.getMessage()).isEqualTo(noUser.getMessage());
        verify(refreshTokenService, never()).issue(anyLong());
    }

    @Test
    @DisplayName("login: tài khoản khóa, đúng mật khẩu -> 403 ACCOUNT_LOCKED")
    void login_locked() {
        when(userRepository.findByUsername("alex.kim")).thenReturn(Optional.of(alex(true)));

        assertThatThrownBy(() -> authService.login(new LoginRequest("alex.kim", "Password123!", false)))
            .isInstanceOf(ForbiddenException.class).extracting("errorCode").isEqualTo("ACCOUNT_LOCKED");
        verify(refreshTokenService, never()).issue(anyLong());
    }

    @Test
    @DisplayName("login: tài khoản khóa nhưng sai mật khẩu -> 401 BAD_CREDENTIALS (không lộ trạng thái khóa)")
    void login_lockedWrongPassword_badCredentials() {
        when(userRepository.findByUsername("alex.kim")).thenReturn(Optional.of(alex(true)));

        assertThatThrownBy(() -> authService.login(new LoginRequest("alex.kim", "sai", false)))
            .isInstanceOf(UnauthorizedException.class).extracting("errorCode").isEqualTo("BAD_CREDENTIALS");
    }

    // ---------- refresh / logout ----------

    @Test
    @DisplayName("refresh: xoay vòng thành công -> access token mới + refresh token mới")
    void refresh_ok() {
        UserEntity user = alex(false);
        when(refreshTokenService.rotate("rt_old")).thenReturn(new RefreshTokenService.RotationResult(2L, "rt_new"));
        when(userRepository.findById(2L)).thenReturn(Optional.of(user));
        when(jwtService.generateAccessToken(user)).thenReturn("jwt2");
        when(userMapper.toUserSummary(user)).thenReturn(summary);

        AuthResponse res = authService.refresh("rt_old");

        assertThat(res.token()).isEqualTo("jwt2");
        assertThat(res.refreshToken()).isEqualTo("rt_new");
    }

    @Test
    @DisplayName("refresh: lỗi từ RefreshTokenService (REUSED) được ném nguyên vẹn")
    void refresh_reusedPropagates() {
        when(refreshTokenService.rotate("rt_old"))
            .thenThrow(new UnauthorizedException("REFRESH_TOKEN_REUSED", "reused"));

        assertThatThrownBy(() -> authService.refresh("rt_old"))
            .isInstanceOf(UnauthorizedException.class).extracting("errorCode").isEqualTo("REFRESH_TOKEN_REUSED");
    }

    @Test
    @DisplayName("refresh: user bị khóa -> thu hồi hết phiên, 403 ACCOUNT_LOCKED")
    void refresh_lockedUser() {
        when(refreshTokenService.rotate("rt_old")).thenReturn(new RefreshTokenService.RotationResult(2L, "rt_new"));
        when(userRepository.findById(2L)).thenReturn(Optional.of(alex(true)));

        assertThatThrownBy(() -> authService.refresh("rt_old"))
            .isInstanceOf(ForbiddenException.class).extracting("errorCode").isEqualTo("ACCOUNT_LOCKED");
        verify(refreshTokenService).revokeAllForUser(2L);
    }

    @Test
    @DisplayName("logout: chuyển cho RefreshTokenService thu hồi đúng token")
    void logout_revokes() {
        authService.logout("rt_x");
        verify(refreshTokenService).revoke("rt_x");
    }

    @Test
    @DisplayName("login audit: sai mật khẩu -> ghi audit log LOGIN_FAILED với actor là user")
    void login_audit_wrongPassword_loginFailed() {
        UserEntity user = alex(false);
        when(userRepository.findByUsername("alex.kim")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> authService.login(new LoginRequest("alex.kim", "wrong_pass", false)))
            .isInstanceOf(UnauthorizedException.class);

        verify(adminAuditService).record(eq(2L), eq("alex.kim"), eq("LOGIN_FAILED"), eq("USER"), eq("2"), eq("Sai mật khẩu"));
    }

    @Test
    @DisplayName("login audit: user không tồn tại -> ghi audit log LOGIN_FAILED với actorUserId null")
    void login_audit_userNotFound_loginFailed() {
        when(userRepository.findByUsername("ghost")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(new LoginRequest("ghost", "Password123!", false)))
            .isInstanceOf(UnauthorizedException.class);

        verify(adminAuditService).record(isNull(), eq("ghost"), eq("LOGIN_FAILED"), eq("USER"), isNull(), eq("Không tồn tại tài khoản"));
    }

    private static Throwable catchUnauthorized(Runnable r) {
        try {
            r.run();
        } catch (UnauthorizedException e) {
            return e;
        }
        throw new AssertionError("Expected UnauthorizedException");
    }
}
