package com.pipeline.wpe.service.admin;

import com.pipeline.wpe.common.enums.InvitationStatus;
import com.pipeline.wpe.common.enums.NodeStatus;
import com.pipeline.wpe.common.enums.ProjectRole;
import com.pipeline.wpe.common.enums.ProjectStatus;
import com.pipeline.wpe.dto.response.admin.AdminWorkspaceDetailResponse;
import com.pipeline.wpe.dto.response.admin.AdminWorkspaceOwnerResponse;
import com.pipeline.wpe.dto.response.admin.AdminWorkspaceResponse;
import com.pipeline.wpe.dto.response.admin.OwnerCandidateResponse;
import com.pipeline.wpe.entity.GuestLinkEntity;
import com.pipeline.wpe.entity.NodeEntity;
import com.pipeline.wpe.entity.ProjectEntity;
import com.pipeline.wpe.entity.ProjectMemberEntity;
import com.pipeline.wpe.entity.UserEntity;
import com.pipeline.wpe.entity.WorkPhaseEntity;
import com.pipeline.wpe.exception.ConflictException;
import com.pipeline.wpe.exception.ResourceNotFoundException;
import com.pipeline.wpe.repository.GuestLinkRepository;
import com.pipeline.wpe.repository.NodeRepository;
import com.pipeline.wpe.repository.ProjectInvitationRepository;
import com.pipeline.wpe.repository.ProjectMemberRepository;
import com.pipeline.wpe.repository.ProjectRepository;
import com.pipeline.wpe.repository.UserRepository;
import com.pipeline.wpe.repository.WorkPhaseRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AdminWorkspaceService {

    private final ProjectRepository projectRepository;
    private final UserRepository userRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final WorkPhaseRepository workPhaseRepository;
    private final NodeRepository nodeRepository;
    private final ProjectInvitationRepository projectInvitationRepository;
    private final GuestLinkRepository guestLinkRepository;
    private final AdminProjectOwnerService adminProjectOwnerService;
    private final AdminAuditService adminAuditService;

    @Transactional(readOnly = true)
    public List<AdminWorkspaceResponse> listWorkspaces(String query, String status) {
        List<ProjectEntity> allProjects = projectRepository.findAll();
        List<UserEntity> allUsers = userRepository.findAll();
        Map<Long, UserEntity> userMap = allUsers.stream()
            .collect(Collectors.toMap(UserEntity::getId, u -> u, (a, b) -> a));

        List<ProjectMemberEntity> allMembers = projectMemberRepository.findAll();
        Map<Long, List<ProjectMemberEntity>> membersByProject = allMembers.stream()
            .filter(m -> m.getRemovedAt() == null)
            .collect(Collectors.groupingBy(ProjectMemberEntity::getProjectId));

        List<WorkPhaseEntity> allPhases = workPhaseRepository.findAll();
        Map<Long, List<WorkPhaseEntity>> phasesByProject = allPhases.stream()
            .collect(Collectors.groupingBy(WorkPhaseEntity::getProjectId));

        List<NodeEntity> allNodes = nodeRepository.findAll();
        Map<Long, List<NodeEntity>> nodesByProject = allNodes.stream()
            .collect(Collectors.groupingBy(NodeEntity::getProjectId));

        ProjectStatus filterStatus = null;
        if (status != null && !status.isBlank()) {
            try {
                filterStatus = ProjectStatus.valueOf(status.trim().toUpperCase());
            } catch (IllegalArgumentException ignored) {
                // Giá trị khác thì bỏ qua lọc
            }
        }

        final ProjectStatus targetStatus = filterStatus;
        final String q = (query != null && !query.isBlank()) ? query.trim().toLowerCase() : null;

        return allProjects.stream()
            .filter(p -> {
                if (targetStatus != null && p.getStatus() != targetStatus) {
                    return false;
                }
                if (q != null) {
                    UserEntity owner = userMap.get(p.getOwnerId());
                    boolean matchProjectName = p.getName() != null && p.getName().toLowerCase().contains(q);
                    boolean matchOwnerName = owner != null && owner.getFullName() != null && owner.getFullName().toLowerCase().contains(q);
                    boolean matchOwnerUsername = owner != null && owner.getUsername() != null && owner.getUsername().toLowerCase().contains(q);
                    // KHÔNG khớp email
                    if (!matchProjectName && !matchOwnerName && !matchOwnerUsername) {
                        return false;
                    }
                }
                return true;
            })
            .map(p -> {
                UserEntity owner = userMap.get(p.getOwnerId());
                String ownerName = owner != null
                    ? ((owner.getFullName() != null && !owner.getFullName().isBlank()) ? owner.getFullName() : owner.getUsername())
                    : "Unknown";
                String ownerMaskedEmail = owner != null ? EmailMasker.mask(owner.getEmail()) : "—";

                int memberCount = membersByProject.getOrDefault(p.getId(), List.of()).size();
                int phaseCount = phasesByProject.getOrDefault(p.getId(), List.of()).size();
                List<NodeEntity> projectNodes = nodesByProject.getOrDefault(p.getId(), List.of());
                int nodeCount = projectNodes.size();
                int doneCount = (int) projectNodes.stream().filter(n -> n.getStatus() == NodeStatus.DONE).count();
                int progressPercentage = nodeCount == 0 ? 0 : (int) Math.round((double) doneCount * 100.0 / nodeCount);

                return new AdminWorkspaceResponse(
                    String.valueOf(p.getId()),
                    p.getName(),
                    String.valueOf(p.getOwnerId()),
                    ownerName,
                    ownerMaskedEmail,
                    p.getStatus() != null ? p.getStatus().name() : null,
                    memberCount,
                    phaseCount,
                    nodeCount,
                    doneCount,
                    progressPercentage,
                    p.getCreatedAt(),
                    p.getUpdatedAt()
                );
            })
            .sorted(Comparator.comparing(
                AdminWorkspaceResponse::updatedAt,
                Comparator.nullsLast(Comparator.reverseOrder())
            ).thenComparing(AdminWorkspaceResponse::id))
            .toList();
    }

    @Transactional
    public AdminWorkspaceResponse archiveWorkspace(Long projectId, Long actorUserId) {
        if (projectId == null) {
            throw new ResourceNotFoundException("Dự án không tồn tại: null");
        }
        ProjectEntity project = projectRepository.findById(projectId)
            .orElseThrow(() -> new ResourceNotFoundException("Dự án không tồn tại: " + projectId));

        if (project.getStatus() == ProjectStatus.ARCHIVED) {
            throw new ConflictException("ALREADY_ARCHIVED", "Dự án đã được lưu trữ.");
        }

        ProjectStatus oldStatus = project.getStatus();
        project.setStatus(ProjectStatus.ARCHIVED);
        project.setUpdatedAt(Instant.now());
        ProjectEntity saved = projectRepository.save(project);

        adminAuditService.record(
            actorUserId,
            null,
            AdminAuditAction.WORKSPACE_ARCHIVED,
            "PROJECT",
            String.valueOf(projectId),
            saved.getName() + " (" + oldStatus + ")"
        );

        UserEntity owner = userRepository.findById(saved.getOwnerId()).orElse(null);
        String ownerName = owner != null
            ? ((owner.getFullName() != null && !owner.getFullName().isBlank()) ? owner.getFullName() : owner.getUsername())
            : "Unknown";
        String ownerMaskedEmail = owner != null ? EmailMasker.mask(owner.getEmail()) : "—";

        int memberCount = (int) projectMemberRepository.findByProjectIdAndRemovedAtIsNull(saved.getId()).stream()
            .filter(m -> m.getRemovedAt() == null)
            .count();
        int phaseCount = workPhaseRepository.findByProjectIdOrderByOrderIndexAsc(saved.getId()).size();
        List<NodeEntity> nodes = nodeRepository.findByProjectId(saved.getId());
        int nodeCount = nodes.size();
        int doneCount = (int) nodes.stream().filter(n -> n.getStatus() == NodeStatus.DONE).count();
        int progressPercentage = nodeCount == 0 ? 0 : (int) Math.round((double) doneCount * 100.0 / nodeCount);

        return new AdminWorkspaceResponse(
            String.valueOf(saved.getId()),
            saved.getName(),
            String.valueOf(saved.getOwnerId()),
            ownerName,
            ownerMaskedEmail,
            saved.getStatus() != null ? saved.getStatus().name() : null,
            memberCount,
            phaseCount,
            nodeCount,
            doneCount,
            progressPercentage,
            saved.getCreatedAt(),
            saved.getUpdatedAt()
        );
    }

    @Transactional(readOnly = true)
    public AdminWorkspaceDetailResponse getWorkspaceDetail(Long projectId) {
        if (projectId == null) {
            throw new ResourceNotFoundException("Dự án không tồn tại: null");
        }
        ProjectEntity project = projectRepository.findById(projectId)
            .orElseThrow(() -> new ResourceNotFoundException("Dự án không tồn tại: " + projectId));

        UserEntity owner = userRepository.findById(project.getOwnerId()).orElse(null);
        String ownerName = owner != null
            ? ((owner.getFullName() != null && !owner.getFullName().isBlank()) ? owner.getFullName() : owner.getUsername())
            : "Unknown";
        String ownerMaskedEmail = owner != null ? EmailMasker.mask(owner.getEmail()) : "—";
        AdminWorkspaceOwnerResponse ownerResponse = new AdminWorkspaceOwnerResponse(
            String.valueOf(project.getOwnerId()),
            ownerName,
            ownerMaskedEmail
        );

        // Members by role (đủ 4 khóa OWNER, MANAGER, COLLABORATOR, VIEWER)
        Map<String, Integer> membersByRole = new LinkedHashMap<>();
        for (ProjectRole role : ProjectRole.values()) {
            membersByRole.put(role.name(), 0);
        }
        List<ProjectMemberEntity> activeMembers = projectMemberRepository.findByProjectIdAndRemovedAtIsNull(projectId)
            .stream()
            .filter(m -> m.getRemovedAt() == null)
            .toList();
        for (ProjectMemberEntity m : activeMembers) {
            if (m.getRole() != null) {
                membersByRole.merge(m.getRole().name(), 1, Integer::sum);
            }
        }

        int pendingInvitationCount = (int) projectInvitationRepository.countByProjectIdAndStatus(projectId, InvitationStatus.PENDING);
        int phaseCount = workPhaseRepository.findByProjectIdOrderByOrderIndexAsc(projectId).size();

        // Nodes by status (đủ 5 khóa)
        List<NodeEntity> nodes = nodeRepository.findByProjectId(projectId);
        int nodeCount = nodes.size();
        Map<String, Integer> nodesByStatus = new LinkedHashMap<>();
        for (NodeStatus status : NodeStatus.values()) {
            nodesByStatus.put(status.name(), 0);
        }
        for (NodeEntity n : nodes) {
            if (n.getStatus() != null) {
                nodesByStatus.merge(n.getStatus().name(), 1, Integer::sum);
            }
        }

        int doneCount = nodesByStatus.get(NodeStatus.DONE.name());
        int progressPercentage = nodeCount == 0 ? 0 : (int) Math.round((double) doneCount * 100.0 / nodeCount);

        Instant now = Instant.now();
        int overdueCount = (int) nodes.stream()
            .filter(n -> n.getDueDate() != null && n.getDueDate().isBefore(now) && n.getStatus() != NodeStatus.DONE)
            .count();

        // Guest link: link mới nhất chưa thu hồi và chưa hết hạn; không có thì false/null
        List<GuestLinkEntity> guestLinks = guestLinkRepository.findByProjectIdOrderByCreatedAtDesc(projectId);
        GuestLinkEntity activeLink = guestLinks.stream()
            .filter(l -> !Boolean.TRUE.equals(l.getIsRevoked()) && l.getExpiresAt() != null && l.getExpiresAt().isAfter(now))
            .findFirst()
            .orElse(null);
        boolean guestLinkActive = activeLink != null;
        Instant guestLinkExpiresAt = activeLink != null ? activeLink.getExpiresAt() : null;

        // lastActivityAt: max updatedAt của node, không có thì project.updatedAt
        Instant lastActivityAt = nodes.stream()
            .map(NodeEntity::getUpdatedAt)
            .filter(Objects::nonNull)
            .max(Instant::compareTo)
            .orElse(project.getUpdatedAt() != null ? project.getUpdatedAt() : project.getCreatedAt());

        // ownerCandidates: dùng lại logic từ AdminProjectOwnerService
        List<OwnerCandidateResponse> ownerCandidates = adminProjectOwnerService.findOwnerCandidates(projectId, project.getOwnerId());

        return new AdminWorkspaceDetailResponse(
            String.valueOf(project.getId()),
            project.getName(),
            project.getDescription(),
            project.getStatus() != null ? project.getStatus().name() : null,
            project.getCreatedAt(),
            project.getUpdatedAt(),
            ownerResponse,
            membersByRole,
            pendingInvitationCount,
            phaseCount,
            nodeCount,
            nodesByStatus,
            progressPercentage,
            overdueCount,
            guestLinkActive,
            guestLinkExpiresAt,
            lastActivityAt,
            ownerCandidates
        );
    }
}
