package com.pipeline.wpe.repository;

import com.pipeline.wpe.common.enums.InvitationStatus;
import com.pipeline.wpe.entity.ProjectInvitationEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface ProjectInvitationRepository extends JpaRepository<ProjectInvitationEntity, Long> {
    List<ProjectInvitationEntity> findByProjectIdAndStatus(Long projectId, InvitationStatus status);
    List<ProjectInvitationEntity> findByProjectIdOrderByCreatedAtDesc(Long projectId);
    List<ProjectInvitationEntity> findByInviteeIdAndStatus(Long inviteeId, InvitationStatus status);
    Optional<ProjectInvitationEntity> findByProjectIdAndInviteeIdAndStatus(Long projectId, Long inviteeId, InvitationStatus status);
    boolean existsByProjectIdAndInviteeIdAndStatus(Long projectId, Long inviteeId, InvitationStatus status);

    @Modifying
    @Query("UPDATE ProjectInvitationEntity i SET i.status = :expired, i.respondedAt = :now, i.version = i.version + 1 WHERE i.status = :pending AND i.expiresAt < :now")
    int expireOverdue(@Param("pending") InvitationStatus pending, @Param("expired") InvitationStatus expired, @Param("now") Instant now);
}
