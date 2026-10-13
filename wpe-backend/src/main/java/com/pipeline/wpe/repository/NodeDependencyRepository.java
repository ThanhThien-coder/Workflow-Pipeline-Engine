package com.pipeline.wpe.repository;

import com.pipeline.wpe.entity.NodeDependencyEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NodeDependencyRepository extends JpaRepository<NodeDependencyEntity, Long> {
    List<NodeDependencyEntity> findByProjectId(Long projectId);
    List<NodeDependencyEntity> findByParentNodeId(Long parentNodeId);
    List<NodeDependencyEntity> findByChildNodeId(Long childNodeId);
    boolean existsByParentNodeIdAndChildNodeId(Long parentNodeId, Long childNodeId);
    void deleteByParentNodeIdAndChildNodeId(Long parentNodeId, Long childNodeId);
}
