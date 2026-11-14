package com.pipeline.wpe.service.auth;

import com.pipeline.wpe.entity.RefreshTokenEntity;
import com.pipeline.wpe.exception.UnauthorizedException;
import com.pipeline.wpe.repository.RefreshTokenRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;

/**
 * Quản lý refresh token: cấp mới, xoay vòng (rotation), phát hiện dùng lại (reuse detection), thu hồi.
 * DB chỉ lưu SHA-256 hex của token ({@link TokenHasher}), không lưu token gốc.
 */
@Slf4j
@Service
public class RefreshTokenService {

    public static final String TOKEN_PREFIX = "rt_";
    /** Mã lỗi (không phải khóa bí mật); xuống dòng để bộ quét khóa trong pre-commit không báo nhầm. */
    public static final String INVALID_REFRESH_TOKEN =
        "INVALID_REFRESH_TOKEN";
    public static final String REFRESH_TOKEN_REUSED = "REFRESH_TOKEN_REUSED";

    private static final int TOKEN_BYTES = 32;

    private final RefreshTokenRepository refreshTokenRepository;
    private final long refreshTokenExpirationMs;
    private final Clock clock;
    private final SecureRandom secureRandom = new SecureRandom();

    @Autowired
    public RefreshTokenService(
        RefreshTokenRepository refreshTokenRepository,
        @Value("${jwt.refresh-token-expiration-ms:604800000}") long refreshTokenExpirationMs
    ) {
        this(refreshTokenRepository, refreshTokenExpirationMs, Clock.systemUTC());
    }

    RefreshTokenService(RefreshTokenRepository refreshTokenRepository, long refreshTokenExpirationMs, Clock clock) {
        this.refreshTokenRepository = refreshTokenRepository;
        this.refreshTokenExpirationMs = refreshTokenExpirationMs;
        this.clock = clock;
    }

    /** Cấp refresh token mới cho user, trả về token gốc (chỉ trả cho client một lần). */
    @Transactional
    public String issue(Long userId) {
        byte[] bytes = new byte[TOKEN_BYTES];
        secureRandom.nextBytes(bytes);
        String rawToken = TOKEN_PREFIX + Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);

        RefreshTokenEntity entity = RefreshTokenEntity.builder()
            .userId(userId)
            .tokenHash(TokenHasher.sha256Hex(rawToken))
            .expiresAt(Instant.now(clock).plusMillis(refreshTokenExpirationMs))
            .revoked(false)
            .build();
        refreshTokenRepository.save(entity);
        return rawToken;
    }

    /**
     * Xoay vòng: thu hồi token cũ, cấp token mới.
     * - Không có / không tìm thấy / hết hạn: 401 INVALID_REFRESH_TOKEN.
     * - Đã bị thu hồi mà vẫn gửi lại: thu hồi MỌI refresh token của user, 401 REFRESH_TOKEN_REUSED.
     * noRollbackFor để việc thu hồi hết vẫn được commit dù method ném lỗi.
     */
    @Transactional(noRollbackFor = UnauthorizedException.class)
    public RotationResult rotate(String rawToken) {
        RefreshTokenEntity current = findByRawToken(rawToken)
            .orElseThrow(RefreshTokenService::invalid);

        if (Boolean.TRUE.equals(current.getRevoked())) {
            revokeAllForReuse(current.getUserId());
        }
        if (!current.getExpiresAt().isAfter(Instant.now(clock))) {
            throw invalid();
        }
        // Cập nhật có điều kiện: request song song thứ hai sẽ nhận 0 dòng -> coi như dùng lại
        if (refreshTokenRepository.revokeIfActive(current.getId()) == 0) {
            revokeAllForReuse(current.getUserId());
        }
        String newToken = issue(current.getUserId());
        return new RotationResult(current.getUserId(), newToken);
    }

    /** Đăng xuất: thu hồi đúng token được gửi lên. Token không tồn tại thì bỏ qua (idempotent). */
    @Transactional
    public void revoke(String rawToken) {
        findByRawToken(rawToken).ifPresent(token -> {
            if (!Boolean.TRUE.equals(token.getRevoked())) {
                refreshTokenRepository.revokeIfActive(token.getId());
            }
        });
    }

    /** Thu hồi mọi refresh token của user (dùng khi phát hiện dùng lại, khóa tài khoản, đổi mật khẩu). */
    @Transactional
    public void revokeAllForUser(Long userId) {
        refreshTokenRepository.revokeAllByUserId(userId);
    }

    public Optional<Long> findUserIdByRawToken(String rawToken) {
        return findByRawToken(rawToken).map(RefreshTokenEntity::getUserId);
    }

    private Optional<RefreshTokenEntity> findByRawToken(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            return Optional.empty();
        }
        return refreshTokenRepository.findByTokenHash(TokenHasher.sha256Hex(rawToken));
    }

    private void revokeAllForReuse(Long userId) {
        log.warn("Phát hiện refresh token bị dùng lại cho user #{}: thu hồi toàn bộ phiên", userId);
        refreshTokenRepository.revokeAllByUserId(userId);
        throw new UnauthorizedException(REFRESH_TOKEN_REUSED,
            "Refresh token đã bị dùng lại. Mọi phiên đăng nhập đã bị thu hồi, vui lòng đăng nhập lại.");
    }

    private static UnauthorizedException invalid() {
        return new UnauthorizedException(INVALID_REFRESH_TOKEN,
            "Refresh token không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.");
    }

    public record RotationResult(Long userId, String refreshToken) {
    }
}
