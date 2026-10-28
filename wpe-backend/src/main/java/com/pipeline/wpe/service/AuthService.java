package com.pipeline.wpe.service;

import com.pipeline.wpe.common.enums.SystemRole;
import com.pipeline.wpe.dto.request.auth.LoginRequest;
import com.pipeline.wpe.dto.request.auth.RefreshRequest;
import com.pipeline.wpe.dto.request.auth.RegisterRequest;
import com.pipeline.wpe.dto.response.auth.AuthResponse;
import com.pipeline.wpe.entity.RefreshTokenEntity;
import com.pipeline.wpe.entity.UserEntity;
import com.pipeline.wpe.exception.ConflictException;
import com.pipeline.wpe.exception.ForbiddenException;
import com.pipeline.wpe.exception.UnauthorizedException;
import com.pipeline.wpe.mapper.UserMapper;
import com.pipeline.wpe.repository.RefreshTokenRepository;
import com.pipeline.wpe.repository.UserRepository;
import com.pipeline.wpe.security.JwtTokenService;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class AuthService {

    private static final long REFRESH_TOKEN_LIFETIME_DAYS = 7;

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenService jwtTokenService;
    private final UserMapper userMapper;
    private final SecureRandom secureRandom = new SecureRandom();

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String username = normalizeUsername(request.username());
        String email = request.email().trim().toLowerCase(Locale.ROOT);

        if (userRepository.existsByUsername(username)) {
            throw new ConflictException("USERNAME_EXISTS", "Username is already in use.");
        }
        if (userRepository.existsByEmail(email)) {
            throw new ConflictException("EMAIL_EXISTS", "Email is already in use.");
        }

        UserEntity user = UserEntity.builder()
            .username(username)
            .email(email)
            .fullName(request.fullName() == null || request.fullName().isBlank()
                ? null
                : request.fullName().trim())
            .passwordHash(passwordEncoder.encode(request.password()))
            .systemRole(SystemRole.USER)
            .isLocked(false)
            .tokenVersion(0)
            .build();

        try {
            user = userRepository.saveAndFlush(user);
        } catch (DataIntegrityViolationException ex) {
            // A concurrent registration may win the unique-index race after the pre-check.
            throw new ConflictException("ACCOUNT_ALREADY_EXISTS", "Username or email is already in use.");
        }

        return createSession(user);
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        String identifier = request.username().trim();
        UserEntity user = userRepository.findByUsernameIgnoreCaseOrEmailIgnoreCase(identifier, identifier)
            .orElseThrow(() -> badCredentials());

        if (Boolean.TRUE.equals(user.getIsLocked())) {
            throw new ForbiddenException("ACCOUNT_LOCKED", "This account is locked.");
        }
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw badCredentials();
        }

        return createSession(user);
    }

    /**
     * Rotates a refresh token while holding a row lock. A previously revoked token
     * signals possible replay, so every active refresh token for that user is revoked.
     */
    @Transactional(noRollbackFor = {UnauthorizedException.class, ForbiddenException.class})
    public AuthResponse refresh(RefreshRequest request) {
        String submittedToken = request.refreshToken().trim();
        String submittedHash = hashToken(submittedToken);
        RefreshTokenEntity storedToken = refreshTokenRepository.findWithLockByTokenHash(submittedHash)
            .orElseThrow(() -> new UnauthorizedException("INVALID_REFRESH_TOKEN", "Refresh token is invalid."));

        if (Boolean.TRUE.equals(storedToken.getRevoked())) {
            refreshTokenRepository.revokeAllByUserId(storedToken.getUserId());
            throw new UnauthorizedException("REFRESH_TOKEN_REUSE", "Refresh token reuse was detected. Please sign in again.");
        }

        Instant now = Instant.now();
        if (!storedToken.getExpiresAt().isAfter(now)) {
            storedToken.setRevoked(true);
            throw new UnauthorizedException("REFRESH_TOKEN_EXPIRED", "Refresh token has expired. Please sign in again.");
        }

        UserEntity user = userRepository.findById(storedToken.getUserId())
            .orElseThrow(() -> new UnauthorizedException("INVALID_REFRESH_TOKEN", "Refresh token is invalid."));
        if (Boolean.TRUE.equals(user.getIsLocked())) {
            refreshTokenRepository.revokeAllByUserId(user.getId());
            throw new ForbiddenException("ACCOUNT_LOCKED", "This account is locked.");
        }

        storedToken.setRevoked(true);
        refreshTokenRepository.save(storedToken);
        return createSession(user);
    }

    @Transactional
    public void logout(Long authenticatedUserId, String rawRefreshToken) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            return;
        }

        refreshTokenRepository.findWithLockByTokenHash(hashToken(rawRefreshToken.trim()))
            .filter(token -> token.getUserId().equals(authenticatedUserId))
            .ifPresent(token -> {
                token.setRevoked(true);
                refreshTokenRepository.save(token);
            });
    }

    private AuthResponse createSession(UserEntity user) {
        String rawRefreshToken = generateRefreshToken();
        RefreshTokenEntity refreshToken = RefreshTokenEntity.builder()
            .userId(user.getId())
            .tokenHash(hashToken(rawRefreshToken))
            .expiresAt(Instant.now().plus(REFRESH_TOKEN_LIFETIME_DAYS, ChronoUnit.DAYS))
            .revoked(false)
            .build();

        refreshTokenRepository.save(refreshToken);
        return new AuthResponse(jwtTokenService.createAccessToken(user), rawRefreshToken, userMapper.toUserSummary(user));
    }

    private String generateRefreshToken() {
        byte[] entropy = new byte[32];
        secureRandom.nextBytes(entropy);
        return "rt_" + Base64.getUrlEncoder().withoutPadding().encodeToString(entropy);
    }

    private String hashToken(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                .digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (Exception ex) {
            throw new IllegalStateException("SHA-256 is unavailable.", ex);
        }
    }

    private String normalizeUsername(String username) {
        return username.trim().toLowerCase(Locale.ROOT);
    }

    private UnauthorizedException badCredentials() {
        return new UnauthorizedException("BAD_CREDENTIALS", "Username or password is incorrect.");
    }
}
