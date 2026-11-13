package com.pipeline.wpe.service.admin;

import com.pipeline.wpe.common.enums.ProjectRole;
import com.pipeline.wpe.dto.response.admin.OwnedProjectResponse;
import com.pipeline.wpe.dto.response.admin.OwnerCandidateResponse;
import com.pipeline.wpe.entity.ProjectEntity;
import com.pipeline.wpe.entity.ProjectMemberEntity;
import com.pipeline.wpe.entity.UserEntity;
import com.pipeline.wpe.exception.ConflictException;
import com.pipeline.wpe.exception.ResourceNotFoundException;
import com.pipeline.wpe.repository.ProjectMemberRepository;
import com.pipeline.wpe.repository.ProjectRepository;
import com.pipeline.wpe.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;

/**
 * Service quản lý chuyển chủ sở hữu dự án dành cho quản trị viên.
 * Ghi chú: Dự án chỉ có một người thì candidates rỗng, FE không cho chuyển (đề xuất: chỉ lưu trữ).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminProjectOwnerService {

    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final UserRepository userRepository;
    private final AdminAuditService adminAuditService;

    @Transactional(readOnly = true)
    public List<OwnedProjectResponse> listOwnedProjects(Long userId) {
        if (userId == null) {
            throw new ResourceNotFoundException("Người dùng không tồn tại: null");
        }
        userRepository.findById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("Người dùng không tồn tại: " + userId));

        List<ProjectEntity> projects = projectRepository.findByOwnerId(userId).stream()
            .sorted(Comparator.comparing(ProjectEntity::getId))
            .toList();

        return projects.stream()
            .map(this::toOwnedProjectResponse)
            .toList();
    }

    @Transactional
    public OwnedProjectResponse transferOwner(Long projectId, Long newOwnerId, Long actorUserId) {
        if (projectId == null) {
            throw new ResourceNotFoundException("Dự án không tồn tại: null");
        }
        ProjectEntity project = projectRepository.findById(projectId)
            .orElseThrow(() -> new ResourceNotFoundException("Dự án không tồn tại: " + projectId));

        if (newOwnerId == null) {
            throw new IllegalArgumentException("Chủ mới không hợp lệ");
        }

        if (newOwnerId.equals(project.getOwnerId())) {
            throw new ConflictException("ALREADY_OWNER", "Người dùng này đã là chủ dự án.");
        }

        ProjectMemberEntity newOwnerMember = projectMemberRepository
            .findByProjectIdAndUserIdAndRemovedAtIsNull(projectId, newOwnerId)
            .filter(m -> m.getRemovedAt() == null)
            .orElseThrow(() -> new ConflictException("NEW_OWNER_NOT_ACTIVE_MEMBER", "Chủ mới phải là thành viên đang hoạt động của dự án."));

        UserEntity newOwnerUser = userRepository.findById(newOwnerId)
            .orElseThrow(() -> new ConflictException("NEW_OWNER_NOT_ACTIVE_MEMBER", "Chủ mới phải là thành viên đang hoạt động của dự án."));

        if (Boolean.TRUE.equals(newOwnerUser.getIsLocked())) {
            throw new ConflictException("NEW_OWNER_NOT_ACTIVE_MEMBER", "Chủ mới phải là thành viên đang hoạt động của dự án.");
        }

        Long oldOwnerId = project.getOwnerId();
        project.setOwnerId(newOwnerId);
        project.setUpdatedAt(Instant.now());
        projectRepository.save(project);

        newOwnerMember.setRole(ProjectRole.OWNER);

        ProjectMemberEntity oldOwnerMember = projectMemberRepository
            .findByProjectIdAndUserIdAndRemovedAtIsNull(projectId, oldOwnerId)
            .orElseGet(() -> ProjectMemberEntity.builder()
                .projectId(projectId)
                .userId(oldOwnerId)
                .role(ProjectRole.COLLABORATOR)
                .joinedAt(Instant.now())
                .removedAt(null)
                .build());
        oldOwnerMember.setRole(ProjectRole.COLLABORATOR);

        projectMemberRepository.save(newOwnerMember);
        projectMemberRepository.save(oldOwnerMember);

        adminAuditService.record(
            actorUserId,
            null,
            AdminAuditAction.PROJECT_OWNER_TRANSFERRED,
            "PROJECT",
            String.valueOf(projectId),
            "#" + oldOwnerId + " -> #" + newOwnerId
        );

        return toOwnedProjectResponse(project);
    }

    public List<OwnerCandidateResponse> findOwnerCandidates(Long projectId, Long ownerId) {
        if (projectId == null) {
            return List.of();
        }
        List<ProjectMemberEntity> activeMembers = projectMemberRepository.findByProjectIdAndRemovedAtIsNull(projectId)
            .stream()
            .filter(m -> m.getRemovedAt() == null)
            .toList();

        return activeMembers.stream()
            .filter(m -> ownerId == null || !m.getUserId().equals(ownerId))
            .map(m -> userRepository.findById(m.getUserId()).orElse(null))
            .filter(u -> u != null && !Boolean.TRUE.equals(u.getIsLocked()))
            .map(u -> {
                String name = (u.getFullName() != null && !u.getFullName().isBlank()) ? u.getFullName() : u.getUsername();
                return new OwnerCandidateResponse(String.valueOf(u.getId()), name, u.getUsername());
            })
            .toList();
    }

    private OwnedProjectResponse toOwnedProjectResponse(ProjectEntity project) {
        List<ProjectMemberEntity> activeMembers = projectMemberRepository.findByProjectIdAndRemovedAtIsNull(project.getId())
            .stream()
            .filter(m -> m.getRemovedAt() == null)
            .toList();
        int memberCount = activeMembers.size();

        List<OwnerCandidateResponse> candidates = findOwnerCandidates(project.getId(), project.getOwnerId());

        return new OwnedProjectResponse(
            String.valueOf(project.getId()),
            project.getName(),
            project.getStatus() != null ? project.getStatus().name() : null,
            memberCount,
            candidates
        );
    }
}
