package com.pipeline.wpe.service.auth;

import com.pipeline.wpe.repository.PasswordResetTokenRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PasswordResetCleanupJobTest {

    @Test
    @DisplayName("cleanup: xóa token cũ hơn 7 ngày")
    void cleanup_usesSevenDayCutoff() {
        PasswordResetTokenRepository repo = mock(PasswordResetTokenRepository.class);
        when(repo.deleteOlderThan(org.mockito.ArgumentMatchers.any())).thenReturn(4);

        int n = new PasswordResetCleanupJob(repo).cleanup();

        ArgumentCaptor<Instant> cutoff = ArgumentCaptor.forClass(Instant.class);
        verify(repo).deleteOlderThan(cutoff.capture());
        assertThat(n).isEqualTo(4);
        assertThat(Duration.between(cutoff.getValue(), Instant.now()).toDays()).isEqualTo(7);
    }
}
