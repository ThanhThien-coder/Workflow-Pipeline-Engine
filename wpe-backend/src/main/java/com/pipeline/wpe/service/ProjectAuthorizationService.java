package com.pipeline.wpe.service;

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
            .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy dự án với ID: " + projectId));
    }

    /**
     * Thẩm định quyền Chủ dự án (Project Owner).
     * Chỉ OWNER mới có quyền sinh/thu hồi Guest Link hoặc cấu hình dự án.
     */
    public ProjectEntity verifyProjectOwner(Long projectId, Long userId) {
        ProjectEntity project = getProjectOrThrow(projectId);
        if (!project.getOwnerId().equals(userId)) {
            throw new ForbiddenException("ACCESS_DENIED", "Chỉ Chủ dự án (Project Owner) mới có quyền thực hiện hành động này.");
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
            throw new ForbiddenException("ACCESS_DENIED", "Bạn không phải là thành viên của dự án này.");
        }
        return project;
    }
}
