package com.pipeline.wpe.repository;

import com.pipeline.wpe.entity.PipelineTemplateEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PipelineTemplateRepository extends JpaRepository<PipelineTemplateEntity, Long> {
    List<PipelineTemplateEntity> findByIsSystemStandardTrue();
    List<PipelineTemplateEntity> findByCategory(String category);
}
