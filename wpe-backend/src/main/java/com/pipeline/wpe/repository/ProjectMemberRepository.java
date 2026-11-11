package com.pipeline.wpe.repository;

import com.pipeline.wpe.entity.ProjectMemberEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProjectMemberRepository extends JpaRepository<ProjectMemberEntity, Long> {
    List<ProjectMemberEntity> findByProjectIdAndRemovedAtIsNull(Long projectId);
    List<ProjectMemberEntity> findByUserIdAndRemovedAtIsNull(Long userId);
    Optional<ProjectMemberEntity> findByProjectIdAndUserIdAndRemovedAtIsNull(Long projectId, Long userId);
    Optional<ProjectMemberEntity> findByProjectIdAndUserId(Long projectId, Long userId);
    boolean existsByProjectIdAndUserIdAndRemovedAtIsNull(Long projectId, Long userId);
}
