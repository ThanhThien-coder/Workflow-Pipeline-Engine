package com.pipeline.wpe.service;

import com.pipeline.wpe.common.enums.InvitationStatus;
import com.pipeline.wpe.repository.ProjectInvitationRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InvitationExpiryJobTest {

    @Mock
    private ProjectInvitationRepository projectInvitationRepository;

    @InjectMocks
    private InvitationExpiryJob invitationExpiryJob;

    @Test
    @DisplayName("expireOverdueInvitations: Repo trả về 3 thì job trả về 3 và gọi expireOverdue với PENDING, EXPIRED, any(Instant.class)")
    void shouldExpireOverdueInvitations_andReturnCount() {
        when(projectInvitationRepository.expireOverdue(eq(InvitationStatus.PENDING), eq(InvitationStatus.EXPIRED), any(Instant.class)))
                .thenReturn(3);

        int result = invitationExpiryJob.expireOverdueInvitations();

        assertThat(result).isEqualTo(3);
        verify(projectInvitationRepository).expireOverdue(eq(InvitationStatus.PENDING), eq(InvitationStatus.EXPIRED), any(Instant.class));
    }
}
