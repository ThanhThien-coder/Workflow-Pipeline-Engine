package com.pipeline.wpe.service;

import com.pipeline.wpe.common.enums.NodeStatus;
import com.pipeline.wpe.common.enums.ProjectRole;
import com.pipeline.wpe.dto.response.project.ProjectMemberHistoryResponse;
import com.pipeline.wpe.dto.response.project.ProjectMemberResponse;
import com.pipeline.wpe.dto.response.project.RemoveMemberResponse;
import com.pipeline.wpe.entity.NodeEntity;
import com.pipeline.wpe.entity.ProjectEntity;
import com.pipeline.wpe.entity.ProjectMemberEntity;
import com.pipeline.wpe.entity.UserEntity;
import com.pipeline.wpe.exception.ResourceNotFoundException;
import com.pipeline.wpe.repository.NodeRepository;
import com.pipeline.wpe.repository.ProjectMemberRepository;
import com.pipeline.wpe.repository.ProjectRepository;
import com.pipeline.wpe.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProjectMemberService {

    private final ProjectAuthorizationService projectAuthorizationService;
    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final UserRepository userRepository;
    private final NodeRepository nodeRepository;

    /**
     * Lấy danh sách thành viên dự án, OWNER đứng đầu, rồi theo joinedAt.
     */
    @Transactional(readOnly = true)
    public List<ProjectMemberResponse> getMembers(Long projectId, Long currentUserId) {
        projectAuthorizationService.verifyProjectMemberOrOwner(projectId, currentUserId);

        List<ProjectMemberEntity> members = projectMemberRepository.findByProjectIdAndRemovedAtIsNull(projectId);
        if (members.isEmpty()) {
            return List.of();
        }

        List<Long> userIds = members.stream().map(ProjectMemberEntity::getUserId).toList();
        Map<Long, UserEntity> userMap = userRepository.findAllById(userIds).stream()
                .collect(Collectors.toMap(UserEntity::getId, Function.identity(), (a, b) -> a));

        List<NodeEntity> projectNodes = nodeRepository.findByProjectId(projectId);
        Map<Long, Long> activeCountMap = projectNodes.stream()
                .filter(n -> n.getAssignedUserId() != null && n.getStatus() != NodeStatus.DONE)
                .collect(Collectors.groupingBy(NodeEntity::getAssignedUserId, Collectors.counting()));

        List<ProjectMemberEntity> sortedMembers = new ArrayList<>(members);
        sortedMembers.sort((m1, m2) -> {
            boolean m1IsOwner = m1.getRole() == ProjectRole.OWNER;
            boolean m2IsOwner = m2.getRole() == ProjectRole.OWNER;
            if (m1IsOwner && !m2IsOwner) return -1;
            if (!m1IsOwner && m2IsOwner) return 1;
            if (m1.getJoinedAt() == null && m2.getJoinedAt() == null) return 0;
            if (m1.getJoinedAt() == null) return 1;
            if (m2.getJoinedAt() == null) return -1;
            return m1.getJoinedAt().compareTo(m2.getJoinedAt());
        });

        return sortedMembers.stream().map(m -> {
            UserEntity user = userMap.get(m.getUserId());
            String username = user != null ? user.getUsername() : "unknown";
            String fullName = user != null ? user.getFullName() : null;
            String email = user != null ? user.getEmail() : "";
            int activeNodeCount = activeCountMap.getOrDefault(m.getUserId(), 0L).intValue();
            String initials = calculateInitials(fullName, username);
            return new ProjectMemberResponse(
                    String.valueOf(m.getUserId()),
                    username,
                    fullName,
                    email,
                    m.getRole().name(),
                    m.getJoinedAt(),
                    activeNodeCount,
                    initials,
                    null
            );
        }).toList();
    }

    /**
     * Lấy toàn bộ lịch sử thành viên dự án (Cách B: mỗi lần tham gia là một dòng).
     */
    @Transactional(readOnly = true)
    public List<ProjectMemberHistoryResponse> getMemberHistory(Long projectId, Long currentUserId) {
        projectAuthorizationService.verifyProjectMemberOrOwner(projectId, currentUserId);

        List<ProjectMemberEntity> members = projectMemberRepository.findByProjectIdOrderByJoinedAtAsc(projectId);
        if (members.isEmpty()) {
            return List.of();
        }

        List<Long> userIds = members.stream().map(ProjectMemberEntity::getUserId).distinct().toList();
        Map<Long, UserEntity> userMap = userRepository.findAllById(userIds).stream()
                .collect(Collectors.toMap(UserEntity::getId, Function.identity(), (a, b) -> a));

        return members.stream().map(m -> {
            UserEntity user = userMap.get(m.getUserId());
            String username = user != null ? user.getUsername() : "unknown";
            String fullName = user != null ? user.getFullName() : null;
            boolean active = m.getRemovedAt() == null;
            return new ProjectMemberHistoryResponse(
                    String.valueOf(m.getUserId()),
                    username,
                    fullName,
                    m.getRole().name(),
                    m.getJoinedAt(),
                    m.getRemovedAt(),
                    active
            );
        }).toList();
    }

    /**
     * Cập nhật vai trò thành viên hoặc chuyển quyền sở hữu (Atomic Transaction).
     */
    @Transactional
    public ProjectMemberResponse updateRole(Long projectId, Long targetUserId, ProjectRole newRole, Long currentUserId) {
        ProjectEntity project = projectAuthorizationService.verifyProjectOwner(projectId, currentUserId);

        ProjectMemberEntity targetMember = projectMemberRepository
                .findByProjectIdAndUserIdAndRemovedAtIsNull(projectId, targetUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy thành viên trong dự án: " + targetUserId));

        if (newRole == ProjectRole.OWNER) {
            if (targetUserId.equals(project.getOwnerId())) {
                return toMemberResponse(targetMember, projectId);
            }

            Long oldOwnerId = project.getOwnerId();
            project.setOwnerId(targetUserId);
            project.setUpdatedAt(Instant.now());
            projectRepository.save(project);

            targetMember.setRole(ProjectRole.OWNER);

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

            projectMemberRepository.save(targetMember);
            projectMemberRepository.save(oldOwnerMember);
        } else {
            // newRole là COLLABORATOR hoặc VIEWER
            if (targetUserId.equals(project.getOwnerId())) {
                throw new IllegalArgumentException("OWNER_ROLE_LOCKED: Không thể hạ vai trò của chủ dự án. Hãy chuyển quyền sở hữu trước.");
            }
            targetMember.setRole(newRole);
            targetMember = projectMemberRepository.save(targetMember);
        }

        return toMemberResponse(targetMember, projectId);
    }

    /**
     * Xóa mềm thành viên khỏi dự án và gỡ phân công các task chưa DONE.
     */
    @Transactional
    public RemoveMemberResponse removeMember(Long projectId, Long targetUserId, Long currentUserId) {
        ProjectEntity project = projectAuthorizationService.verifyProjectOwner(projectId, currentUserId);

        if (targetUserId.equals(project.getOwnerId())) {
            throw new IllegalArgumentException("CANNOT_REMOVE_OWNER: Không thể xóa chủ dự án.");
        }

        ProjectMemberEntity targetMember = projectMemberRepository
                .findByProjectIdAndUserIdAndRemovedAtIsNull(projectId, targetUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy thành viên trong dự án: " + targetUserId));

        targetMember.setRemovedAt(Instant.now());
        projectMemberRepository.save(targetMember);

        List<NodeEntity> nodesToUnassign = nodeRepository
                .findByProjectIdAndAssignedUserIdAndStatusNot(projectId, targetUserId, NodeStatus.DONE);

        for (NodeEntity node : nodesToUnassign) {
            node.setAssignedUserId(null);
        }
        nodeRepository.saveAll(nodesToUnassign);

        log.info("Removed member userId={} from project={}, unassigned {} tasks", targetUserId, projectId, nodesToUnassign.size());
        return new RemoveMemberResponse(targetUserId, nodesToUnassign.size());
    }

    private ProjectMemberResponse toMemberResponse(ProjectMemberEntity member, Long projectId) {
        UserEntity user = userRepository.findById(member.getUserId()).orElse(null);
        String username = user != null ? user.getUsername() : "unknown";
        String fullName = user != null ? user.getFullName() : null;
        String email = user != null ? user.getEmail() : "";
        int activeNodeCount = nodeRepository
                .findByProjectIdAndAssignedUserIdAndStatusNot(projectId, member.getUserId(), NodeStatus.DONE)
                .size();
        String initials = calculateInitials(fullName, username);
        return new ProjectMemberResponse(
                String.valueOf(member.getUserId()),
                username,
                fullName,
                email,
                member.getRole().name(),
                member.getJoinedAt(),
                activeNodeCount,
                initials,
                null
        );
    }

    private String calculateInitials(String fullName, String username) {
        String source = (fullName != null && !fullName.isBlank()) ? fullName.trim() : (username != null ? username.trim() : "");
        if (source.isEmpty()) {
            return "";
        }
        String[] words = source.split("\\s+");
        if (words.length >= 2) {
            String first = words[0].substring(0, 1);
            String second = words[1].substring(0, 1);
            return (first + second).toUpperCase();
        } else {
            return source.substring(0, Math.min(2, source.length())).toUpperCase();
        }
    }
}
