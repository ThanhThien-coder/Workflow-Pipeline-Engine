package com.pipeline.wpe.service.auth;

import com.pipeline.wpe.entity.PasswordResetTokenEntity;
import com.pipeline.wpe.entity.UserEntity;
import com.pipeline.wpe.exception.BadRequestException;
import com.pipeline.wpe.exception.ServiceUnavailableException;
import com.pipeline.wpe.repository.PasswordResetTokenRepository;
import com.pipeline.wpe.repository.RefreshTokenRepository;
import com.pipeline.wpe.repository.UserRepository;
import com.pipeline.wpe.service.mail.AccountEmailService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PasswordResetServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private PasswordResetTokenRepository tokenRepository;
    @Mock private RefreshTokenRepository refreshTokenRepository;
    @Mock private AccountEmailService emailService;

    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder(4);
    private PasswordResetService service;
    private UserEntity user;

    @BeforeEach
    void setUp() {
        service = new PasswordResetService(userRepository, tokenRepository, refreshTokenRepository,
            passwordEncoder, emailService, 30, 60);
        user = UserEntity.builder().id(5L).username("alex").email("alex@example.com").fullName("Alex Kim")
            .passwordHash(passwordEncoder.encode("OldPassword1")).tokenVersion(3).isLocked(false).build();
    }

    private PasswordResetTokenEntity token(String raw, Instant expiresAt, Instant usedAt) {
        return PasswordResetTokenEntity.builder().id(1L).userId(5L).tokenHash(TokenHasher.sha256Hex(raw))
            .expiresAt(expiresAt).usedAt(usedAt).build();
    }

    private static String code(Throwable ex) {
        return ((BadRequestException) ex).getErrorCode();
    }

    // ---------- requestReset ----------

    @Test
    @DisplayName("requestReset: mail tắt -> 503 PASSWORD_RESET_UNAVAILABLE")
    void request_mailDisabled() {
        when(emailService.isEnabled()).thenReturn(false);
        assertThatThrownBy(() -> service.requestReset("alex@example.com"))
            .isInstanceOf(ServiceUnavailableException.class)
            .satisfies(ex -> assertThat(((ServiceUnavailableException) ex).getErrorCode()).isEqualTo("PASSWORD_RESET_UNAVAILABLE"));
        verifyNoInteractions(tokenRepository);
    }

    @Test
    @DisplayName("requestReset: email không tồn tại -> không lưu token, không gửi mail")
    void request_unknownEmail() {
        when(emailService.isEnabled()).thenReturn(true);
        when(userRepository.findByEmailIgnoreCase("nobody@example.com")).thenReturn(Optional.empty());

        service.requestReset("nobody@example.com");

        verify(tokenRepository, never()).save(any());
        verify(emailService, never()).sendPasswordResetAfterCommit(any(), any(), any(), any(), any(), anyLong());
    }

    @Test
    @DisplayName("requestReset: user bị khóa hoặc đã xóa -> không gửi")
    void request_lockedOrDeleted() {
        when(emailService.isEnabled()).thenReturn(true);
        user.setIsLocked(true);
        when(userRepository.findByEmailIgnoreCase("alex@example.com")).thenReturn(Optional.of(user));
        service.requestReset("alex@example.com");

        user.setIsLocked(false);
        user.setDeletedAt(Instant.now());
        service.requestReset("alex@example.com");

        verify(tokenRepository, never()).save(any());
        verify(emailService, never()).sendPasswordResetAfterCommit(any(), any(), any(), any(), any(), anyLong());
    }

    @Test
    @DisplayName("requestReset: user hợp lệ -> lưu hash (64 ký tự, khác token gốc), gửi token gốc, hết hiệu lực token cũ")
    void request_validUser() {
        when(emailService.isEnabled()).thenReturn(true);
        when(userRepository.findByEmailIgnoreCase("alex@example.com")).thenReturn(Optional.of(user));
        when(tokenRepository.existsByUserIdAndCreatedAtAfter(eq(5L), any(Instant.class))).thenReturn(false);

        Instant before = Instant.now();
        service.requestReset("  alex@example.com ");

        ArgumentCaptor<String> raw = ArgumentCaptor.forClass(String.class);
        verify(emailService).sendPasswordResetAfterCommit(eq(5L), eq("alex@example.com"), eq("Alex Kim"), eq("alex"), raw.capture(), eq(30L));
        ArgumentCaptor<PasswordResetTokenEntity> saved = ArgumentCaptor.forClass(PasswordResetTokenEntity.class);
        verify(tokenRepository).save(saved.capture());

        assertThat(raw.getValue()).hasSize(43).matches("[A-Za-z0-9_-]+");
        assertThat(saved.getValue().getTokenHash()).hasSize(64).isNotEqualTo(raw.getValue())
            .isEqualTo(TokenHasher.sha256Hex(raw.getValue()));
        assertThat(saved.getValue().getUserId()).isEqualTo(5L);
        assertThat(saved.getValue().getExpiresAt()).isAfter(before.plusSeconds(29 * 60));
        // token cũ chưa dùng bị đánh dấu dùng trước khi tạo token mới
        var order = inOrder(tokenRepository);
        order.verify(tokenRepository).markAllUnusedAsUsed(eq(5L), any(Instant.class));
        order.verify(tokenRepository).save(any(PasswordResetTokenEntity.class));
    }

    @Test
    @DisplayName("requestReset: lần 2 trong cooldown -> không tạo token mới")
    void request_cooldown() {
        when(emailService.isEnabled()).thenReturn(true);
        when(userRepository.findByEmailIgnoreCase("alex@example.com")).thenReturn(Optional.of(user));
        when(tokenRepository.existsByUserIdAndCreatedAtAfter(eq(5L), any(Instant.class))).thenReturn(true);

        service.requestReset("alex@example.com");

        verify(tokenRepository, never()).save(any());
        verify(tokenRepository, never()).markAllUnusedAsUsed(anyLong(), any());
        verify(emailService, never()).sendPasswordResetAfterCommit(any(), any(), any(), any(), any(), anyLong());
    }

    @Test
    @DisplayName("requestReset: user tự vô hiệu hóa vẫn được gửi")
    void request_deactivatedStillSent() {
        when(emailService.isEnabled()).thenReturn(true);
        user.setDeactivatedAt(Instant.now());
        when(userRepository.findByEmailIgnoreCase("alex@example.com")).thenReturn(Optional.of(user));

        service.requestReset("alex@example.com");

        verify(tokenRepository).save(any(PasswordResetTokenEntity.class));
    }

    // ---------- verify ----------

    @Test
    @DisplayName("verifyToken: hợp lệ -> không ném; sai/hết hạn/đã dùng/rỗng -> INVALID_RESET_TOKEN")
    void verify_cases() {
        when(tokenRepository.findByTokenHash(TokenHasher.sha256Hex("good")))
            .thenReturn(Optional.of(token("good", Instant.now().plusSeconds(600), null)));
        when(tokenRepository.findByTokenHash(TokenHasher.sha256Hex("old")))
            .thenReturn(Optional.of(token("old", Instant.now().minusSeconds(1), null)));
        when(tokenRepository.findByTokenHash(TokenHasher.sha256Hex("used")))
            .thenReturn(Optional.of(token("used", Instant.now().plusSeconds(600), Instant.now())));
        when(tokenRepository.findByTokenHash(TokenHasher.sha256Hex("none"))).thenReturn(Optional.empty());
        when(userRepository.findById(5L)).thenReturn(Optional.of(user));

        service.verifyToken("good");
        for (String bad : new String[]{"old", "used", "none", "", null}) {
            assertThatThrownBy(() -> service.verifyToken(bad))
                .isInstanceOf(BadRequestException.class)
                .satisfies(ex -> assertThat(code(ex)).isEqualTo("INVALID_RESET_TOKEN"));
        }
    }

    // ---------- resetPassword ----------

    @Test
    @DisplayName("resetPassword: hợp lệ -> đổi hash, tokenVersion + 1, revoke refresh token, token đã dùng, gửi mail xác nhận")
    void reset_success() {
        PasswordResetTokenEntity t = token("good", Instant.now().plusSeconds(600), null);
        when(tokenRepository.findByTokenHash(TokenHasher.sha256Hex("good"))).thenReturn(Optional.of(t));
        when(userRepository.findById(5L)).thenReturn(Optional.of(user));
        when(tokenRepository.markUsedIfUnused(any(), any(Instant.class))).thenReturn(1);

        service.resetPassword("good", "BrandNew123");

        assertThat(passwordEncoder.matches("BrandNew123", user.getPasswordHash())).isTrue();
        assertThat(user.getTokenVersion()).isEqualTo(4);
        assertThat(t.getUsedAt()).isNotNull();
        verify(tokenRepository).markUsedIfUnused(any(), any(Instant.class));
        verify(userRepository).save(user);
        verify(refreshTokenRepository).revokeAllByUserId(5L);
        verify(tokenRepository).markAllUnusedAsUsed(eq(5L), any(Instant.class));
        verify(emailService).sendPasswordChangedAfterCommit(eq(5L), eq("alex@example.com"), eq("Alex Kim"), eq("alex"), any(Instant.class));
    }

    @Test
    @DisplayName("resetPassword: token hết hạn / đã dùng / không tồn tại / user bị khóa / user đã xóa -> INVALID_RESET_TOKEN")
    void reset_invalidToken() {
        when(tokenRepository.findByTokenHash(TokenHasher.sha256Hex("old")))
            .thenReturn(Optional.of(token("old", Instant.now().minusSeconds(5), null)));
        when(tokenRepository.findByTokenHash(TokenHasher.sha256Hex("used")))
            .thenReturn(Optional.of(token("used", Instant.now().plusSeconds(600), Instant.now())));
        when(tokenRepository.findByTokenHash(TokenHasher.sha256Hex("locked")))
            .thenReturn(Optional.of(token("locked", Instant.now().plusSeconds(600), null)));
        when(tokenRepository.findByTokenHash(TokenHasher.sha256Hex("none"))).thenReturn(Optional.empty());
        user.setIsLocked(true);
        when(userRepository.findById(5L)).thenReturn(Optional.of(user));

        for (String bad : new String[]{"old", "used", "locked", "none"}) {
            assertThatThrownBy(() -> service.resetPassword(bad, "BrandNew123"))
                .isInstanceOf(BadRequestException.class)
                .satisfies(ex -> assertThat(code(ex)).isEqualTo("INVALID_RESET_TOKEN"));
        }

        user.setIsLocked(false);
        user.setDeletedAt(Instant.now());
        assertThatThrownBy(() -> service.resetPassword("locked", "BrandNew123"))
            .isInstanceOf(BadRequestException.class)
            .satisfies(ex -> assertThat(code(ex)).isEqualTo("INVALID_RESET_TOKEN"));

        verify(userRepository, never()).save(any());
        verifyNoInteractions(emailService);
    }

    @Test
    @DisplayName("resetPassword: mật khẩu yếu -> WEAK_PASSWORD và KHÔNG đánh dấu token đã dùng")
    void reset_weakPassword() {
        PasswordResetTokenEntity t = token("good", Instant.now().plusSeconds(600), null);
        when(tokenRepository.findByTokenHash(TokenHasher.sha256Hex("good"))).thenReturn(Optional.of(t));
        when(userRepository.findById(5L)).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> service.resetPassword("good", "short"))
            .isInstanceOf(BadRequestException.class)
            .satisfies(ex -> assertThat(code(ex)).isEqualTo("WEAK_PASSWORD"));

        assertThat(t.getUsedAt()).isNull();
        verify(tokenRepository, never()).save(any());
        verify(tokenRepository, never()).markUsedIfUnused(any(), any());
        verify(tokenRepository, never()).markAllUnusedAsUsed(anyLong(), any());
        verify(refreshTokenRepository, never()).revokeAllByUserId(anyLong());
        verifyNoInteractions(emailService);
    }

    @Test
    @DisplayName("resetPassword: 2 request cùng link chạy đồng thời -> request thua (UPDATE trả 0) báo INVALID_RESET_TOKEN, không đổi mật khẩu")
    void reset_concurrentSecondRequestLoses() {
        PasswordResetTokenEntity t = token("good", Instant.now().plusSeconds(600), null);
        when(tokenRepository.findByTokenHash(TokenHasher.sha256Hex("good"))).thenReturn(Optional.of(t));
        when(userRepository.findById(5L)).thenReturn(Optional.of(user));
        when(tokenRepository.markUsedIfUnused(any(), any(Instant.class))).thenReturn(0);
        String hashBefore = user.getPasswordHash();

        assertThatThrownBy(() -> service.resetPassword("good", "BrandNew123"))
            .isInstanceOf(BadRequestException.class)
            .satisfies(ex -> assertThat(code(ex)).isEqualTo("INVALID_RESET_TOKEN"));

        assertThat(user.getPasswordHash()).isEqualTo(hashBefore);
        verify(userRepository, never()).save(any());
        verify(refreshTokenRepository, never()).revokeAllByUserId(anyLong());
        verifyNoInteractions(emailService);
    }

    @Test
    @DisplayName("resetPassword: token sai và mật khẩu yếu -> báo token trước")
    void reset_tokenCheckedFirst() {
        when(tokenRepository.findByTokenHash(any())).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.resetPassword("nope", "x"))
            .satisfies(ex -> assertThat(code(ex)).isEqualTo("INVALID_RESET_TOKEN"));
    }
}
