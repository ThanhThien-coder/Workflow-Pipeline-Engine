package com.pipeline.wpe.service;

import com.pipeline.wpe.common.enums.ProjectRole;
import com.pipeline.wpe.entity.ProjectEntity;
import com.pipeline.wpe.exception.ForbiddenException;
import com.pipeline.wpe.exception.ResourceNotFoundException;
import com.pipeline.wpe.repository.ProjectMemberRepository;
import com.pipeline.wpe.repository.ProjectRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ProjectAuthorizationService {

    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository projectMemberRepository;

    /**
     * Lấy dự án theo ID hoặc ném ResourceNotFoundException nếu không tồn tại.
     */
    public ProjectEntity getProjectOrThrow(Long projectId) {
        return projectRepository.findById(projectId)
            .orElseThrow(() -> new ResourceNotFoundException("Project not found with ID: " + projectId));
    }

    /**
     * Thẩm định quyền Chủ dự án (Project Owner).
     * Chỉ OWNER mới có quyền sinh/thu hồi Guest Link hoặc cấu hình dự án.
     */
    public ProjectEntity verifyProjectOwner(Long projectId, Long userId) {
        ProjectEntity project = getProjectOrThrow(projectId);
        if (!project.getOwnerId().equals(userId)) {
            throw new ForbiddenException("ACCESS_DENIED", "Only the project owner can do this.");
        }
        return project;
    }

    /**
     * Thẩm định quyền Thành viên (Owner, Collaborator, hoặc Viewer).
     */
    public ProjectEntity verifyProjectMemberOrOwner(Long projectId, Long userId) {
        ProjectEntity project = getProjectOrThrow(projectId);
        if (project.getOwnerId().equals(userId)) {
            return project;
        }

        boolean isMember = projectMemberRepository.existsByProjectIdAndUserIdAndRemovedAtIsNull(projectId, userId);
        if (!isMember) {
            throw new ForbiddenException("ACCESS_DENIED", "You are not a member of this project.");
        }
        return project;
    }

    /**
     * Kiểm tra người dùng có phải Chủ dự án hoặc Quản lý (Manager).
     */
    public boolean isOwnerOrManager(ProjectEntity project, Long userId) {
        if (project.getOwnerId().equals(userId)) {
            return true;
        }
        return projectMemberRepository.findByProjectIdAndUserIdAndRemovedAtIsNull(project.getId(), userId)
            .map(m -> m.getRole() == ProjectRole.MANAGER)
            .orElse(false);
    }

    /**
     * Thẩm định quyền Chủ dự án hoặc Quản lý (Owner hoặc Manager).
     */
    public ProjectEntity verifyProjectOwnerOrManager(Long projectId, Long userId) {
        ProjectEntity project = getProjectOrThrow(projectId);
        if (!isOwnerOrManager(project, userId)) {
            throw new ForbiddenException("ACCESS_DENIED", "Only the project owner or a manager can do this.");
        }
        return project;
    }
}

