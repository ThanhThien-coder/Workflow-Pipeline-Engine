package com.pipeline.wpe.repository;

import com.pipeline.wpe.entity.ArtifactEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface ArtifactRepository extends JpaRepository<ArtifactEntity, Long> {
    List<ArtifactEntity> findByProjectId(Long projectId);
    List<ArtifactEntity> findByNodeId(Long nodeId);
    List<ArtifactEntity> findByProjectIdAndIsPublicForGuestTrue(Long projectId);
    List<ArtifactEntity> findByProjectIdAndIsInRepositoryTrue(Long projectId);
    List<ArtifactEntity> findByProjectIdAndIsInRepositoryTrueOrderByCreatedAtDesc(Long projectId);
    List<ArtifactEntity> findByProjectIdAndNodeIdOrderByCreatedAtDesc(Long projectId, Long nodeId);
    List<ArtifactEntity> findByProjectIdOrderByCreatedAtDesc(Long projectId);
    long countByUploadedBy(Long uploadedBy);

    /** G17: tìm bản "trùng hoàn toàn" (cùng dự án, cùng tên, cùng link) để không thêm dòng lặp. */
    List<ArtifactEntity> findByProjectIdAndNameAndUrl(Long projectId, String name, String url);

    List<ArtifactEntity> findByProjectIdIn(Collection<Long> projectIds);
}
