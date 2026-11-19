package com.pipeline.wpe.service;

import com.pipeline.wpe.common.enums.NodeStatus;
import com.pipeline.wpe.common.enums.ProjectStatus;
import com.pipeline.wpe.dto.request.node.UpdateNodeAssignmentRequest;
import com.pipeline.wpe.dto.response.graph.GraphNodeResponse;
import com.pipeline.wpe.entity.NodeEntity;
import com.pipeline.wpe.entity.ProjectEntity;
import com.pipeline.wpe.common.enums.ProjectRole;
import com.pipeline.wpe.exception.BadRequestException;
import com.pipeline.wpe.exception.ConflictException;
import com.pipeline.wpe.exception.ResourceNotFoundException;
import com.pipeline.wpe.repository.NodeRepository;
import com.pipeline.wpe.repository.ProjectMemberRepository;
import com.pipeline.wpe.service.event.ProjectRealtimeNotifier;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Objects;

@Slf4j
@Service
@RequiredArgsConstructor
public class NodeAssignmentService {

    private final NodeRepository nodeRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final ProjectAuthorizationService authorizationService;
    private final ProjectRealtimeNotifier projectRealtimeNotifier;

    @Transactional
    public GraphNodeResponse updateAssignment(Long nodeId, UpdateNodeAssignmentRequest req, Long currentUserId) {
        NodeEntity node = nodeRepository.findById(nodeId)
            .orElseThrow(() -> new ResourceNotFoundException("Task not found with ID: " + nodeId));

        ProjectEntity project = authorizationService.verifyProjectOwnerOrManager(node.getProjectId(), currentUserId);

        if (project.getStatus() == ProjectStatus.ARCHIVED) {
            throw new ConflictException("PROJECT_ARCHIVED", "This project is archived and read-only.");
        }

        if (node.getStatus() == NodeStatus.DONE) {
            throw new IllegalArgumentException("This task is done. The assignee and due date can't be changed.");
        }

        if (!Objects.equals(node.getVersion(), req.version())) {
            throw new OptimisticLockingFailureException(
                "This task was changed by someone else (server version: " + node.getVersion() + ", your version: " + req.version() + "). Please refresh and try again."
            );
        }

        if (req.assignedUserId() == null && req.dueDate() == null) {
            throw new IllegalArgumentException("Provide at least assignedUserId or dueDate.");
        }

        if (req.assignedUserId() != null) {
            boolean isMember = req.assignedUserId().equals(project.getOwnerId())
                || projectMemberRepository.existsByProjectIdAndUserIdAndRemovedAtIsNull(project.getId(), req.assignedUserId());
            if (!isMember) {
                throw new IllegalArgumentException("ASSIGNEE_NOT_MEMBER: The assignee must be a member of the project.");
            }
            boolean isViewer = !req.assignedUserId().equals(project.getOwnerId())
                && projectMemberRepository.findByProjectIdAndUserIdAndRemovedAtIsNull(project.getId(), req.assignedUserId())
                    .map(m -> m.getRole() == ProjectRole.VIEWER)
                    .orElse(false);
            if (isViewer) {
                throw new BadRequestException("ASSIGNEE_IS_VIEWER", "Viewers can't be assigned tasks.");
            }
            node.setAssignedUserId(req.assignedUserId());
        }

        if (req.dueDate() != null) {
            DueDateRules.requireNotBeforeCreation(req.dueDate(), node.getCreatedAt());
            node.setDueDate(req.dueDate());
            if (req.dueDate().isAfter(Instant.now())) {
                node.setIsOverdue(false);
            }
        }

        NodeEntity saved = nodeRepository.saveAndFlush(node);
        projectRealtimeNotifier.notifyTasksChanged(
            saved.getProjectId(),
            saved.getPhaseId(),
            saved.getId(),
            "ASSIGNMENT_CHANGED",
            currentUserId
        );
        return mapToGraphNodeResponse(saved);
    }

    private GraphNodeResponse mapToGraphNodeResponse(NodeEntity n) {
        return GraphNodeResponse.from(n, n.getUiMetadata());
    }
}
