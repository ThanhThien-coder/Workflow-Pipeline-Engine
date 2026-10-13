package com.pipeline.wpe.repository;

import com.pipeline.wpe.common.enums.FeedbackStatus;
import com.pipeline.wpe.entity.ProjectFeedbackEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProjectFeedbackRepository extends JpaRepository<ProjectFeedbackEntity, Long> {
    List<ProjectFeedbackEntity> findByProjectIdOrderByCreatedAtDesc(Long projectId);
    List<ProjectFeedbackEntity> findByProjectIdAndStatus(Long projectId, FeedbackStatus status);
    List<ProjectFeedbackEntity> findByNodeId(Long nodeId);
}
