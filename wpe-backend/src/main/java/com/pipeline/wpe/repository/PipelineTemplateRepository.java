package com.pipeline.wpe.repository;

import com.pipeline.wpe.entity.PipelineTemplateEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PipelineTemplateRepository extends JpaRepository<PipelineTemplateEntity, Long> {
    Optional<PipelineTemplateEntity> findBySlug(String slug);
    List<PipelineTemplateEntity> findByIsSystemStandardTrue();
    List<PipelineTemplateEntity> findByCategory(String category);
    long countByCreatedBy(Long createdBy);
}
