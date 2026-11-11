package com.pipeline.wpe.repository;

import com.pipeline.wpe.entity.PhaseDependencyEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PhaseDependencyRepository extends JpaRepository<PhaseDependencyEntity, Long> {
    List<PhaseDependencyEntity> findByProjectId(Long projectId);
    boolean existsByParentPhaseIdAndChildPhaseId(Long parentPhaseId, Long childPhaseId);
    void deleteByParentPhaseIdAndChildPhaseId(Long parentPhaseId, Long childPhaseId);
}
