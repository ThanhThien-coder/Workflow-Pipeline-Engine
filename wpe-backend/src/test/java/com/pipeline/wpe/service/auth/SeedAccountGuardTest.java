package com.pipeline.wpe.service.auth;

import com.pipeline.wpe.entity.UserEntity;
import com.pipeline.wpe.repository.RefreshTokenRepository;
import com.pipeline.wpe.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class SeedAccountGuardTest {

    private static final String GOOD = "Str0ngSeedPass99";

    private UserRepository userRepository;
    private RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder encoder = new BCryptPasswordEncoder(4);

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        refreshTokenRepository = mock(RefreshTokenRepository.class);
    }

    private SeedAccountGuard guard(boolean enabled, String password) {
        return new SeedAccountGuard(userRepository, refreshTokenRepository, encoder, enabled, password);
    }

    private UserEntity user(long id, String username, String rawPassword) {
        UserEntity u = new UserEntity();
        u.setId(id);
        u.setUsername(username);
        u.setPasswordHash(encoder.encode(rawPassword));
        u.setTokenVersion(2);
        return u;
    }

    private void stubUsers(UserEntity... users) {
        when(userRepository.findByUsernameInAndDeletedAtIsNull(any())).thenReturn(List.of(users));
    }

    @Test
    void guardDisabledDoesNothing() {
        guard(false, "").run(null);
        verifyNoInteractions(userRepository, refreshTokenRepository);
    }

    @Test
    void noExposedAccountDoesNotSave() {
        stubUsers(user(1, "admin", "SomethingElse123"));
        guard(true, "").run(null);
        verify(userRepository, never()).save(any());
        verifyNoInteractions(refreshTokenRepository);
    }

    @Test
    void invalidNewPasswordBlocksStartup() {
        for (String bad : new String[] {"", "Short1abc", "NoDigitsInThisOne", SeedAccountGuard.PUBLIC_SEED_PASSWORD}) {
            stubUsers(user(1, "admin", SeedAccountGuard.PUBLIC_SEED_PASSWORD));
            assertThatThrownBy(() -> guard(true, bad).run(null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("admin")
                .hasMessageContaining("SEED_ACCOUNT_PASSWORD");
        }
        verify(userRepository, never()).save(any());
        verifyNoInteractions(refreshTokenRepository);
    }

    @Test
    void errorMessageDoesNotLeakConfiguredPassword() {
        stubUsers(user(1, "admin", SeedAccountGuard.PUBLIC_SEED_PASSWORD));
        String weak = "nodigitsbutlongenough";
        assertThatThrownBy(() -> guard(true, weak).run(null))
            .isInstanceOf(IllegalStateException.class)
            .satisfies(e -> assertThat(e.getMessage()).doesNotContain(weak));
    }

    @Test
    void validPasswordRehashesOnlyExposedUsers() {
        UserEntity admin = user(1, "admin", SeedAccountGuard.PUBLIC_SEED_PASSWORD);
        UserEntity alex = user(2, "alex.kim", "AlreadyChanged456");
        UserEntity sarah = user(3, "sarah.chen", SeedAccountGuard.PUBLIC_SEED_PASSWORD);
        String alexHash = alex.getPasswordHash();
        stubUsers(admin, alex, sarah);

        guard(true, GOOD).run(null);

        assertThat(encoder.matches(GOOD, admin.getPasswordHash())).isTrue();
        assertThat(encoder.matches(GOOD, sarah.getPasswordHash())).isTrue();
        assertThat(admin.getTokenVersion()).isEqualTo(3);
        assertThat(sarah.getTokenVersion()).isEqualTo(3);
        assertThat(alex.getPasswordHash()).isEqualTo(alexHash);
        assertThat(alex.getTokenVersion()).isEqualTo(2);
        verify(userRepository).save(admin);
        verify(userRepository).save(sarah);
        verify(userRepository, never()).save(alex);
        verify(refreshTokenRepository).revokeAllByUserId(1L);
        verify(refreshTokenRepository).revokeAllByUserId(3L);
        verify(refreshTokenRepository, never()).revokeAllByUserId(2L);
    }

    @Test
    void softDeletedUserIsIgnored() {
        UserEntity deleted = user(1, "admin", SeedAccountGuard.PUBLIC_SEED_PASSWORD);
        deleted.setDeletedAt(Instant.now());
        stubUsers(deleted);

        guard(true, "").run(null);

        verify(userRepository, never()).save(any());
    }

    @Test
    void secondRunIsIdempotent() {
        UserEntity admin = user(1, "admin", SeedAccountGuard.PUBLIC_SEED_PASSWORD);
        stubUsers(admin);
        guard(true, GOOD).run(null);
        String hash = admin.getPasswordHash();

        guard(true, GOOD).run(null);

        assertThat(admin.getPasswordHash()).isEqualTo(hash);
        assertThat(admin.getTokenVersion()).isEqualTo(3);
    }
}
