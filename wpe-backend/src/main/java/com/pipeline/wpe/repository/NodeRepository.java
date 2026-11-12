package com.pipeline.wpe.repository;

import com.pipeline.wpe.common.enums.NodeStatus;
import com.pipeline.wpe.entity.NodeEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Repository
public interface NodeRepository extends JpaRepository<NodeEntity, Long> {
    List<NodeEntity> findByProjectId(Long projectId);
    List<NodeEntity> findByPhaseId(Long phaseId);
    Optional<NodeEntity> findByProjectIdAndCode(Long projectId, String code);

    // My Tasks: lọc theo project, người phụ trách và khác LOCKED
    List<NodeEntity> findByProjectIdAndAssignedUserIdAndStatusNotOrderByDueDateAsc(
        Long projectId, Long assignedUserId, NodeStatus status
    );

    List<NodeEntity> findByProjectIdAndAssignedUserIdAndStatusNot(Long projectId, Long assignedUserId, NodeStatus status);

    List<NodeEntity> findByProjectIdAndStatus(Long projectId, NodeStatus status);
    long countByProjectIdAndStatus(Long projectId, NodeStatus status);
    long countByProjectId(Long projectId);

    /**
     * Lưu tọa độ canvas bằng câu UPDATE trực tiếp. Không đi qua save() nên không làm tăng cột version (@Version):
     * kéo thả node không được gây lỗi 409 cho người đang thao tác task trên Kanban.
     */
    @Modifying
    @Query("UPDATE NodeEntity n SET n.uiMetadata = :uiMetadata WHERE n.id = :id")
    int updateUiMetadata(@Param("id") Long id, @Param("uiMetadata") Map<String, Object> uiMetadata);

    List<NodeEntity> findByStatusAndDueDateBeforeAndIsOverdueFalse(NodeStatus status, java.time.Instant now);

    @Query("SELECT n.projectId, n.status, COUNT(n) FROM NodeEntity n WHERE n.projectId IN :projectIds GROUP BY n.projectId, n.status")
    List<Object[]> countByProjectIdsGroupByStatus(@Param("projectIds") Collection<Long> projectIds);
}
