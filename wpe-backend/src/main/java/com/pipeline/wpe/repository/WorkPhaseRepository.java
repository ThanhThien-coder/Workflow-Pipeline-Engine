package com.pipeline.wpe.repository;

import com.pipeline.wpe.entity.WorkPhaseEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WorkPhaseRepository extends JpaRepository<WorkPhaseEntity, Long> {
    List<WorkPhaseEntity> findByProjectIdOrderByOrderIndexAsc(Long projectId);
    List<WorkPhaseEntity> findByProjectIdAndParentPhaseIdIsNullOrderByOrderIndexAsc(Long projectId);
    List<WorkPhaseEntity> findByParentPhaseIdOrderByOrderIndexAsc(Long parentPhaseId);

    @Modifying
    @Query("DELETE FROM WorkPhaseEntity w WHERE w.projectId = :projectId")
    void deleteByProjectId(@Param("projectId") Long projectId);
}
