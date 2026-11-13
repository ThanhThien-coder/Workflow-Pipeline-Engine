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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Nghiệp vụ đăng ký, đăng nhập, làm mới token và đăng xuất (Cụm 1 integration map).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    public static final String BAD_CREDENTIALS = "BAD_CREDENTIALS";
    public static final String ACCOUNT_LOCKED = "ACCOUNT_LOCKED";
    public static final String USERNAME_TAKEN = "USERNAME_TAKEN";
    public static final String EMAIL_TAKEN = "EMAIL_TAKEN";


    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final RefreshTokenService refreshTokenService;
    private final UserMapper userMapper;

    /** Hash BCrypt giả để vẫn tốn thời gian so khớp khi user không tồn tại (giảm lộ thông tin qua thời gian phản hồi). */
    private volatile String dummyHash;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String username = request.username().trim();
        String email = request.email().trim();
        if (userRepository.existsByUsername(username)) {
            throw new ConflictException(USERNAME_TAKEN, "Tên đăng nhập đã được sử dụng.");
        }
        if (userRepository.existsByEmail(email)) {
            throw new ConflictException(EMAIL_TAKEN, "Email đã được sử dụng.");
        }

        UserEntity user = UserEntity.builder()
            .username(username)
            .email(email)
            .fullName(request.fullName())
            .passwordHash(passwordEncoder.encode(request.password()))
            .systemRole(SystemRole.USER)
            .isLocked(false)
            .tokenVersion(0)
            .build();
        user = userRepository.save(user);
        log.info("Đăng ký tài khoản mới: user #{} ({})", user.getId(), user.getUsername());
        return buildAuthResponse(user, refreshTokenService.issue(user.getId()));
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        String identifier = request.username().trim();
        UserEntity user = (identifier.contains("@")
            ? userRepository.findByEmailIgnoreCase(identifier)
            : userRepository.findByUsername(identifier))
            .orElse(null);
        if (user == null) {
            passwordEncoder.matches(request.password(), dummyHash());
            throw badCredentials();
        }
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw badCredentials();
        }
        // Kiểm khóa SAU khi đúng mật khẩu để không lộ trạng thái tài khoản cho người không biết mật khẩu
        if (Boolean.TRUE.equals(user.getIsLocked())) {
            throw accountLocked();
        }
        return buildAuthResponse(user, refreshTokenService.issue(user.getId()));
    }

    /**
     * Không đặt @Transactional ở đây: khi phát hiện dùng lại, RefreshTokenService phải commit
     * việc thu hồi hết token rồi mới ném 401 (transaction bên ngoài sẽ rollback mất việc đó).
     */
    public AuthResponse refresh(String rawRefreshToken) {
        RefreshTokenService.RotationResult rotation = refreshTokenService.rotate(rawRefreshToken);
        UserEntity user = userRepository.findById(rotation.userId()).orElse(null);
        if (user == null) {
            throw new UnauthorizedException(RefreshTokenService.INVALID_REFRESH_TOKEN,
                "Refresh token không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.");
        }
        if (Boolean.TRUE.equals(user.getIsLocked())) {
            refreshTokenService.revokeAllForUser(user.getId());
            throw accountLocked();
        }
        return buildAuthResponse(user, rotation.refreshToken());
    }

    public void logout(String rawRefreshToken) {
        refreshTokenService.revoke(rawRefreshToken);
    }

    private String dummyHash() {
        if (dummyHash == null) {
            dummyHash = passwordEncoder.encode("wpe-dummy-password-for-timing");
        }
        return dummyHash;
    }

    private AuthResponse buildAuthResponse(UserEntity user, String refreshToken) {
        return new AuthResponse(
            jwtService.generateAccessToken(user),
            refreshToken,
            userMapper.toUserSummary(user)
        );
    }

    private static UnauthorizedException badCredentials() {
        return new UnauthorizedException(BAD_CREDENTIALS, "Tên đăng nhập hoặc mật khẩu không đúng.");
    }

    private static ForbiddenException accountLocked() {
        return new ForbiddenException(ACCOUNT_LOCKED, "Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.");
    }
}
