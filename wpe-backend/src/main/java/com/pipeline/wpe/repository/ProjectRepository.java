package com.pipeline.wpe.repository;

import com.pipeline.wpe.common.enums.ProjectStatus;
import com.pipeline.wpe.entity.ProjectEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface ProjectRepository extends JpaRepository<ProjectEntity, Long> {
    long countByOwnerId(Long ownerId);
    List<ProjectEntity> findByOwnerId(Long ownerId);
    List<ProjectEntity> findByStatus(ProjectStatus status);

    @Query("""
        SELECT DISTINCT p FROM ProjectEntity p
        LEFT JOIN ProjectMemberEntity pm ON pm.projectId = p.id AND pm.removedAt IS NULL
        WHERE (p.ownerId = :userId OR pm.userId = :userId)
        ORDER BY p.updatedAt DESC
    """)
    List<ProjectEntity> findAllAccessibleProjects(@Param("userId") Long userId);

    default List<ProjectEntity> findAllUserProjects(Long userId) {
        return findAllAccessibleProjects(userId);
    }

    /** B3: giữ chỗ chạy AI nguyên tử. Trả 1 nếu giữ được (chưa có hoặc đã quá ngưỡng), 0 nếu đang trong cooldown. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Transactional
    @Query("UPDATE ProjectEntity p SET p.aiRequestedAt = :now WHERE p.id = :projectId AND (p.aiRequestedAt IS NULL OR p.aiRequestedAt < :threshold)")
    int claimAiDiagnosis(@Param("projectId") Long projectId, @Param("now") Instant now, @Param("threshold") Instant threshold);

    /** Trả lại chỗ khi chạy AI lỗi: chỉ đặt về giá trị cũ nếu chỗ vẫn là của lần gọi này. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Transactional
    @Query("UPDATE ProjectEntity p SET p.aiRequestedAt = :previous WHERE p.id = :projectId AND p.aiRequestedAt = :claimedAt")
    int releaseAiDiagnosisClaim(@Param("projectId") Long projectId, @Param("previous") Instant previous, @Param("claimedAt") Instant claimedAt);

    @Query("SELECT p.aiRequestedAt FROM ProjectEntity p WHERE p.id = :projectId")
    Optional<Instant> findAiRequestedAt(@Param("projectId") Long projectId);

    /** Chỉ ghi cột latest_ai_analysis: không ghi đè cột khác, không đổi updated_at. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Transactional
    @Query(value = "UPDATE project SET latest_ai_analysis = CAST(:analysisJson AS jsonb) WHERE id = :projectId", nativeQuery = true)
    int updateLatestAiAnalysis(@Param("projectId") Long projectId, @Param("analysisJson") String analysisJson);
}
