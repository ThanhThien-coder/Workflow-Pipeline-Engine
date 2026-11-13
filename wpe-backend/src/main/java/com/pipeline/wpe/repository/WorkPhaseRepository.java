package com.pipeline.wpe.repository;

import com.pipeline.wpe.entity.WorkPhaseEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WorkPhaseRepository extends JpaRepository<WorkPhaseEntity, Long> {
    List<WorkPhaseEntity> findByProjectIdOrderByOrderIndexAsc(Long projectId);
    long countByProjectId(Long projectId);
    List<WorkPhaseEntity> findByProjectIdAndParentPhaseIdIsNullOrderByOrderIndexAsc(Long projectId);
    List<WorkPhaseEntity> findByParentPhaseIdOrderByOrderIndexAsc(Long parentPhaseId);
}
