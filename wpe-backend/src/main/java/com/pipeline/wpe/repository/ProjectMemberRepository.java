package com.pipeline.wpe.repository;

import com.pipeline.wpe.entity.ProjectMemberEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProjectMemberRepository extends JpaRepository<ProjectMemberEntity, Long> {
    List<ProjectMemberEntity> findByProjectIdAndRemovedAtIsNull(Long projectId);
    List<ProjectMemberEntity> findByUserIdAndRemovedAtIsNull(Long userId);
    Optional<ProjectMemberEntity> findByProjectIdAndUserIdAndRemovedAtIsNull(Long projectId, Long userId);
    List<ProjectMemberEntity> findByProjectIdOrderByJoinedAtAsc(Long projectId);
    boolean existsByProjectIdAndUserIdAndRemovedAtIsNull(Long projectId, Long userId);

    @Modifying
    @Query("DELETE FROM ProjectMemberEntity pm WHERE pm.projectId = :projectId")
    void deleteByProjectId(@Param("projectId") Long projectId);
}
