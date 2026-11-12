package com.pipeline.wpe.service.auth;

import com.pipeline.wpe.entity.RefreshTokenEntity;
import com.pipeline.wpe.exception.UnauthorizedException;
import com.pipeline.wpe.repository.RefreshTokenRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RefreshTokenServiceTest {

    private static final long SEVEN_DAYS_MS = Duration.ofDays(7).toMillis();
    private static final Instant NOW = Instant.parse("2026-11-12T00:00:00Z");

    @Mock
    private RefreshTokenRepository repository;

    private RefreshTokenService service;

    @BeforeEach
    void setUp() {
        service = new RefreshTokenService(repository, SEVEN_DAYS_MS, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    private RefreshTokenEntity stored(String raw, boolean revoked, Instant expiresAt) {
        return RefreshTokenEntity.builder()
            .id(10L).userId(2L).tokenHash(TokenHasher.sha256Hex(raw))
            .revoked(revoked).expiresAt(expiresAt).build();
    }

    @Test
    @DisplayName("issue: token dạng rt_ + base64url 32 byte, DB lưu SHA-256 hex, hạn 7 ngày")
    void issue_formatAndStoredHash() {
        String raw = service.issue(2L);

        assertThat(raw).startsWith("rt_");
        byte[] decoded = Base64.getUrlDecoder().decode(raw.substring(3));
        assertThat(decoded).hasSize(32);

        ArgumentCaptor<RefreshTokenEntity> captor = ArgumentCaptor.forClass(RefreshTokenEntity.class);
        verify(repository).save(captor.capture());
        RefreshTokenEntity saved = captor.getValue();
        assertThat(saved.getUserId()).isEqualTo(2L);
        assertThat(saved.getTokenHash()).isEqualTo(TokenHasher.sha256Hex(raw)).isNotEqualTo(raw);
        assertThat(saved.getRevoked()).isFalse();
        assertThat(saved.getExpiresAt()).isEqualTo(NOW.plus(Duration.ofDays(7)));
    }

    @Test
    @DisplayName("issue: hai lần gọi cho hai token khác nhau")
    void issue_randomEachTime() {
        assertThat(service.issue(2L)).isNotEqualTo(service.issue(2L));
    }

    @Test
    @DisplayName("rotate: token hợp lệ -> thu hồi token cũ, cấp token mới cùng user")
    void rotate_valid() {
        String raw = "rt_old";
        when(repository.findByTokenHash(TokenHasher.sha256Hex(raw)))
            .thenReturn(Optional.of(stored(raw, false, NOW.plusSeconds(60))));
        when(repository.revokeIfActive(10L)).thenReturn(1);

        RefreshTokenService.RotationResult result = service.rotate(raw);

        assertThat(result.userId()).isEqualTo(2L);
        assertThat(result.refreshToken()).startsWith("rt_").isNotEqualTo(raw);
        verify(repository).revokeIfActive(10L);
        verify(repository).save(any(RefreshTokenEntity.class));
        verify(repository, never()).revokeAllByUserId(anyLong());
    }

    @Test
    @DisplayName("rotate: token null/rỗng -> 401 INVALID_REFRESH_TOKEN")
    void rotate_blank() {
        assertThatThrownBy(() -> service.rotate(null))
            .isInstanceOf(UnauthorizedException.class).extracting("errorCode").isEqualTo("INVALID_REFRESH_TOKEN");
        assertThatThrownBy(() -> service.rotate("  "))
            .isInstanceOf(UnauthorizedException.class).extracting("errorCode").isEqualTo("INVALID_REFRESH_TOKEN");
        verifyNoInteractions(repository);
    }

    @Test
    @DisplayName("rotate: token không có trong DB -> 401 INVALID_REFRESH_TOKEN")
    void rotate_unknown() {
        when(repository.findByTokenHash(any())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.rotate("rt_unknown"))
            .isInstanceOf(UnauthorizedException.class).extracting("errorCode").isEqualTo("INVALID_REFRESH_TOKEN");
        verify(repository, never()).save(any());
    }

    @Test
    @DisplayName("rotate: token hết hạn -> 401 INVALID_REFRESH_TOKEN, không cấp mới")
    void rotate_expired() {
        String raw = "rt_expired";
        when(repository.findByTokenHash(TokenHasher.sha256Hex(raw)))
            .thenReturn(Optional.of(stored(raw, false, NOW.minusSeconds(1))));

        assertThatThrownBy(() -> service.rotate(raw))
            .isInstanceOf(UnauthorizedException.class).extracting("errorCode").isEqualTo("INVALID_REFRESH_TOKEN");
        verify(repository, never()).save(any());
        verify(repository, never()).revokeAllByUserId(anyLong());
    }

    @Test
    @DisplayName("rotate: token đã bị thu hồi mà gửi lại -> thu hồi MỌI token của user, 401 REFRESH_TOKEN_REUSED")
    void rotate_reused() {
        String raw = "rt_reused";
        when(repository.findByTokenHash(TokenHasher.sha256Hex(raw)))
            .thenReturn(Optional.of(stored(raw, true, NOW.plusSeconds(60))));

        assertThatThrownBy(() -> service.rotate(raw))
            .isInstanceOf(UnauthorizedException.class).extracting("errorCode").isEqualTo("REFRESH_TOKEN_REUSED");
        verify(repository).revokeAllByUserId(2L);
        verify(repository, never()).save(any());
    }

    @Test
    @DisplayName("rotate: hai request song song, request sau cập nhật 0 dòng -> coi là dùng lại")
    void rotate_concurrentSecondRequest_treatedAsReuse() {
        String raw = "rt_race";
        when(repository.findByTokenHash(TokenHasher.sha256Hex(raw)))
            .thenReturn(Optional.of(stored(raw, false, NOW.plusSeconds(60))));
        when(repository.revokeIfActive(10L)).thenReturn(0);

        assertThatThrownBy(() -> service.rotate(raw))
            .isInstanceOf(UnauthorizedException.class).extracting("errorCode").isEqualTo("REFRESH_TOKEN_REUSED");
        verify(repository).revokeAllByUserId(2L);
        verify(repository, never()).save(any());
    }

    @Test
    @DisplayName("revoke (logout): thu hồi đúng token đó")
    void revoke_marksTokenRevoked() {
        String raw = "rt_logout";
        when(repository.findByTokenHash(TokenHasher.sha256Hex(raw)))
            .thenReturn(Optional.of(stored(raw, false, NOW.plusSeconds(60))));

        service.revoke(raw);

        verify(repository).revokeIfActive(10L);
        verify(repository, never()).revokeAllByUserId(anyLong());
    }

    @Test
    @DisplayName("revoke (logout): token không tồn tại hoặc rỗng -> bỏ qua, không lỗi")
    void revoke_unknownOrBlank_noop() {
        when(repository.findByTokenHash(any())).thenReturn(Optional.empty());

        service.revoke("rt_unknown");
        service.revoke(null);

        verify(repository, never()).revokeIfActive(anyLong());
    }

    @Test
    @DisplayName("revokeAllForUser: gọi thu hồi hết theo userId")
    void revokeAllForUser() {
        service.revokeAllForUser(2L);
        verify(repository).revokeAllByUserId(2L);
    }
}
