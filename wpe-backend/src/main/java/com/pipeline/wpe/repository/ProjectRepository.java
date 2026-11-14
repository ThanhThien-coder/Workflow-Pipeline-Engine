package com.pipeline.wpe.repository;

import com.pipeline.wpe.common.enums.ProjectStatus;
import com.pipeline.wpe.entity.ProjectEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

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
}
