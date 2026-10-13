package com.pipeline.wpe.repository;

import com.pipeline.wpe.common.enums.ProjectStatus;
import com.pipeline.wpe.entity.ProjectEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProjectRepository extends JpaRepository<ProjectEntity, Long> {
    List<ProjectEntity> findByOwnerId(Long ownerId);
    List<ProjectEntity> findByStatus(ProjectStatus status);
}
