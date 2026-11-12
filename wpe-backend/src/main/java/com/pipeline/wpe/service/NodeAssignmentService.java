package com.pipeline.wpe.service;

import com.pipeline.wpe.common.enums.NodeStatus;
import com.pipeline.wpe.common.enums.ProjectStatus;
import com.pipeline.wpe.dto.request.node.UpdateNodeAssignmentRequest;
import com.pipeline.wpe.dto.response.graph.GraphNodeResponse;
import com.pipeline.wpe.entity.NodeEntity;
import com.pipeline.wpe.entity.ProjectEntity;
import com.pipeline.wpe.exception.ConflictException;
import com.pipeline.wpe.exception.ResourceNotFoundException;
import com.pipeline.wpe.repository.NodeRepository;
import com.pipeline.wpe.repository.ProjectMemberRepository;
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

    @Transactional
    public GraphNodeResponse updateAssignment(Long nodeId, UpdateNodeAssignmentRequest req, Long currentUserId) {
        NodeEntity node = nodeRepository.findById(nodeId)
            .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy công việc với ID: " + nodeId));

        ProjectEntity project = authorizationService.verifyProjectOwnerOrManager(node.getProjectId(), currentUserId);

        if (project.getStatus() == ProjectStatus.ARCHIVED) {
            throw new ConflictException("PROJECT_ARCHIVED", "Dự án đã được lưu trữ, chỉ có thể xem.");
        }

        if (node.getStatus() == NodeStatus.DONE) {
            throw new IllegalArgumentException("Tác vụ đã hoàn tất, không thể đổi người làm hoặc hạn chót.");
        }

        if (!Objects.equals(node.getVersion(), req.version())) {
            throw new OptimisticLockingFailureException(
                "Công việc đã bị thay đổi (phiên bản máy chủ: " + node.getVersion() + ", phiên bản yêu cầu: " + req.version() + ")."
            );
        }

        if (req.assignedUserId() == null && req.dueDate() == null) {
            throw new IllegalArgumentException("Cần ít nhất assignedUserId hoặc dueDate.");
        }

        if (req.assignedUserId() != null) {
            boolean isMember = req.assignedUserId().equals(project.getOwnerId())
                || projectMemberRepository.existsByProjectIdAndUserIdAndRemovedAtIsNull(project.getId(), req.assignedUserId());
            if (!isMember) {
                throw new IllegalArgumentException("ASSIGNEE_NOT_MEMBER: Người phụ trách phải là thành viên của dự án.");
            }
            node.setAssignedUserId(req.assignedUserId());
        }

        if (req.dueDate() != null) {
            node.setDueDate(req.dueDate());
            if (req.dueDate().isAfter(Instant.now())) {
                node.setIsOverdue(false);
            }
        }

        NodeEntity saved = nodeRepository.save(node);
        return mapToGraphNodeResponse(saved);
    }

    private GraphNodeResponse mapToGraphNodeResponse(NodeEntity n) {
        return new GraphNodeResponse(
            String.valueOf(n.getId()),
            n.getPhaseId() != null ? String.valueOf(n.getPhaseId()) : null,
            n.getCode(),
            n.getTitle(),
            n.getDescription(),
            n.getStatus().name(),
            n.getJoinPolicy().name(),
            n.getAssignedUserId() != null ? String.valueOf(n.getAssignedUserId()) : null,
            n.getDueDate(),
            n.getEstimatedHours(),
            n.getVersion(),
            n.getUiMetadata()
        );
    }
}
