package com.pipeline.wpe.service;

import com.pipeline.wpe.common.enums.InvitationStatus;
import com.pipeline.wpe.repository.ProjectInvitationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Slf4j
@Component
@RequiredArgsConstructor
public class InvitationExpiryJob {

    private final ProjectInvitationRepository projectInvitationRepository;

    @Scheduled(fixedDelayString = "${app.invitation.expiry-scan-ms:3600000}", initialDelayString = "${app.invitation.expiry-scan-ms:3600000}")
    @Transactional
    public int expireOverdueInvitations() {
        int n = projectInvitationRepository.expireOverdue(InvitationStatus.PENDING, InvitationStatus.EXPIRED, Instant.now());
        if (n > 0) {
            log.info("Expired {} overdue project invitations", n);
        }
        return n;
    }
}
