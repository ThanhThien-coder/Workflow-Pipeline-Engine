package com.pipeline.wpe.service;

import com.pipeline.wpe.common.enums.NodeStatus;
import com.pipeline.wpe.common.enums.ProjectRole;
import com.pipeline.wpe.common.enums.ProjectStatus;
import com.pipeline.wpe.common.enums.SystemRole;
import com.pipeline.wpe.dto.project.*;
import com.pipeline.wpe.entity.NodeEntity;
import com.pipeline.wpe.entity.ProjectEntity;
import com.pipeline.wpe.entity.ProjectMemberEntity;
import com.pipeline.wpe.entity.UserEntity;
import com.pipeline.wpe.entity.WorkPhaseEntity;
import com.pipeline.wpe.exception.AccessDeniedException;
import com.pipeline.wpe.exception.ResourceNotFoundException;
import com.pipeline.wpe.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final NodeRepository nodeRepository;
    private final WorkPhaseRepository workPhaseRepository;
    private final ProjectAuthorizationService projectAuthorizationService;
    private final UserRepository userRepository;

    public List<ProjectSummaryResponse> getMyProjects(Long currentUserId) {
        List<ProjectEntity> projects = projectRepository.findAllAccessibleProjects(currentUserId);
        if (projects.isEmpty()) {
            return List.of();
        }

        List<Long> ownerIds = projects.stream().map(ProjectEntity::getOwnerId).distinct().toList();
        Map<Long, String> ownerNames = userRepository.findAllById(ownerIds).stream()
            .collect(Collectors.toMap(
                UserEntity::getId,
                u -> (u.getFullName() != null && !u.getFullName().isBlank()) ? u.getFullName() : u.getUsername(),
                (a, b) -> a
            ));

        return projects.stream().map(project -> {
            String ownerName = ownerNames.getOrDefault(project.getOwnerId(), "User #" + project.getOwnerId());
            int totalNodes = (int) nodeRepository.countByProjectId(project.getId());
            int completedNodes = (int) nodeRepository.countByProjectIdAndStatus(project.getId(), NodeStatus.DONE);
            int inProgressNodes = (int) nodeRepository.countByProjectIdAndStatus(project.getId(), NodeStatus.IN_PROGRESS);

            return ProjectSummaryResponse.fromEntity(project, ownerName, totalNodes, completedNodes, inProgressNodes);
        }).toList();
    }

    public ProjectDetailResponse getProjectDetail(Long projectId, Long currentUserId) {
        ProjectEntity project = projectRepository.findById(projectId)
            .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy dự án với ID: " + projectId));

        boolean isOwner = project.getOwnerId().equals(currentUserId);
        boolean isMember = projectMemberRepository.existsByProjectIdAndUserIdAndRemovedAtIsNull(projectId, currentUserId);
        boolean isAdmin = userRepository.findById(currentUserId)
            .map(u -> u.getSystemRole() == SystemRole.ADMIN)
            .orElse(false);

        if (!isOwner && !isMember && !isAdmin) {
            throw new AccessDeniedException("Bạn không có quyền truy cập vào dự án này.");
        }

        String ownerName = getOwnerDisplayName(project.getOwnerId());

        List<WorkPhaseEntity> phases = workPhaseRepository.findByProjectIdOrderByOrderIndexAsc(projectId);
        List<NodeEntity> projectNodes = nodeRepository.findByProjectId(projectId);

        Map<Long, Long> nodesPerPhase = projectNodes.stream()
            .filter(n -> n.getPhaseId() != null)
            .collect(Collectors.groupingBy(NodeEntity::getPhaseId, Collectors.counting()));

        List<WorkPhaseSummaryResponse> phaseResponses = phases.stream()
            .map(phase -> WorkPhaseSummaryResponse.fromEntity(
                phase,
                nodesPerPhase.getOrDefault(phase.getId(), 0L).intValue()
            ))
            .toList();

        int totalNodes = projectNodes.size();
        int completedNodes = (int) projectNodes.stream()
            .filter(n -> n.getStatus() == NodeStatus.DONE)
            .count();
        int inProgressNodes = (int) projectNodes.stream()
            .filter(n -> n.getStatus() == NodeStatus.IN_PROGRESS)
            .count();

        return ProjectDetailResponse.fromEntity(
            project,
            ownerName,
            totalNodes,
            completedNodes,
            inProgressNodes,
            phaseResponses
        );
    }

    @Transactional
    public ProjectDetailResponse createProject(CreateProjectRequest req, Long currentUserId) {
        ProjectEntity newProject = ProjectEntity.builder()
            .name(req.name().trim())
            .description(req.description())
            .ownerId(currentUserId)
            .status(ProjectStatus.PLANNING)
            .build();

        ProjectEntity savedProject = projectRepository.save(newProject);

        ProjectMemberEntity ownerMember = ProjectMemberEntity.builder()
            .projectId(savedProject.getId())
            .userId(currentUserId)
            .role(ProjectRole.OWNER)
            .joinedAt(Instant.now())
            .removedAt(null)
            .build();
        projectMemberRepository.save(ownerMember);

        String ownerName = getOwnerDisplayName(currentUserId);

        return ProjectDetailResponse.fromEntity(
            savedProject,
            ownerName,
            0,
            0,
            0,
            List.of()
        );
    }

    @Transactional
    public ProjectSummaryResponse updateProjectStatus(Long projectId, UpdateProjectStatusRequest req, Long currentUserId) {
        ProjectEntity project = projectRepository.findById(projectId)
            .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy dự án với ID: " + projectId));

        boolean isOwner = project.getOwnerId().equals(currentUserId);
        boolean isAdmin = userRepository.findById(currentUserId)
            .map(u -> u.getSystemRole() == SystemRole.ADMIN)
            .orElse(false);

        if (!isOwner && !isAdmin) {
            throw new AccessDeniedException("Chỉ chủ sở hữu dự án mới có quyền đổi trạng thái");
        }

        ProjectStatus newStatus;
        try {
            newStatus = ProjectStatus.valueOf(req.status().trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Trạng thái dự án không hợp lệ: " + req.status());
        }

        project.setStatus(newStatus);
        project.setUpdatedAt(Instant.now());
        ProjectEntity saved = projectRepository.save(project);

        String ownerName = getOwnerDisplayName(saved.getOwnerId());
        int totalNodes = (int) nodeRepository.countByProjectId(projectId);
        int completedNodes = (int) nodeRepository.countByProjectIdAndStatus(projectId, NodeStatus.DONE);
        int inProgressNodes = (int) nodeRepository.countByProjectIdAndStatus(projectId, NodeStatus.IN_PROGRESS);

        return ProjectSummaryResponse.fromEntity(saved, ownerName, totalNodes, completedNodes, inProgressNodes);
    }

    private String getOwnerDisplayName(Long ownerId) {
        if (ownerId == null) {
            return "Unknown";
        }
        return userRepository.findById(ownerId)
            .map(u -> (u.getFullName() != null && !u.getFullName().isBlank()) ? u.getFullName() : u.getUsername())
            .orElse("User #" + ownerId);
    }
}
