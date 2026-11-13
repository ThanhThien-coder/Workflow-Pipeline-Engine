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

    /** A6 — Mọi dự án cho Admin, mới cập nhật lên đầu. Service chỉ đọc metadata, không đọc task. */
    List<ProjectEntity> findAllByOrderByUpdatedAtDesc();

    /** A6 — Số dự án mỗi user làm chủ. Mỗi dòng: [ownerId (Long), count (Long)]. */
    @Query("SELECT p.ownerId, COUNT(p) FROM ProjectEntity p GROUP BY p.ownerId")
    List<Object[]> countProjectsGroupByOwner();

    /**
     * A6 — Số dự án mỗi user đang là thành viên (chưa bị gỡ) nhưng KHÔNG làm chủ, để cộng với
     * {@link #countProjectsGroupByOwner()} mà không đếm trùng. Mỗi dòng: [userId (Long), count (Long)].
     */
    @Query("""
        SELECT pm.userId, COUNT(DISTINCT pm.projectId) FROM ProjectMemberEntity pm, ProjectEntity p
        WHERE p.id = pm.projectId AND pm.removedAt IS NULL AND p.ownerId <> pm.userId
        GROUP BY pm.userId
    """)
    List<Object[]> countJoinedProjectsGroupByMember();

    /** A6 — Số thành viên đang hoạt động của từng dự án. Mỗi dòng: [projectId (Long), count (Long)]. */
    @Query("SELECT pm.projectId, COUNT(pm) FROM ProjectMemberEntity pm WHERE pm.removedAt IS NULL GROUP BY pm.projectId")
    List<Object[]> countActiveMembersGroupByProject();

    /** A6 — Chỉ ĐẾM node của từng dự án (không đọc tiêu đề, nội dung). Mỗi dòng: [projectId (Long), count (Long)]. */
    @Query("SELECT n.projectId, COUNT(n) FROM NodeEntity n GROUP BY n.projectId")
    List<Object[]> countNodesGroupByProject();
}
