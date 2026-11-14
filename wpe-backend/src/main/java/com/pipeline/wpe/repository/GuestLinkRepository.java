package com.pipeline.wpe.repository;

import com.pipeline.wpe.entity.GuestLinkEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface GuestLinkRepository extends JpaRepository<GuestLinkEntity, Long> {
    Optional<GuestLinkEntity> findByToken(String token);
    Optional<GuestLinkEntity> findByProjectIdAndIsRevokedFalse(Long projectId);
    List<GuestLinkEntity> findByProjectIdOrderByCreatedAtDesc(Long projectId);
    Optional<GuestLinkEntity> findFirstByProjectIdOrderByCreatedAtDesc(Long projectId);
}
