package com.pipeline.wpe.repository;

import com.pipeline.wpe.common.enums.InvitationStatus;
import com.pipeline.wpe.entity.ProjectInvitationEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProjectInvitationRepository extends JpaRepository<ProjectInvitationEntity, Long> {
    List<ProjectInvitationEntity> findByProjectIdAndStatus(Long projectId, InvitationStatus status);
    List<ProjectInvitationEntity> findByInviteeIdAndStatus(Long inviteeId, InvitationStatus status);
    Optional<ProjectInvitationEntity> findByProjectIdAndInviteeIdAndStatus(Long projectId, Long inviteeId, InvitationStatus status);
    boolean existsByProjectIdAndInviteeIdAndStatus(Long projectId, Long inviteeId, InvitationStatus status);
}
