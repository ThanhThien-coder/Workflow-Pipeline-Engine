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
import com.pipeline.wpe.exception.ConflictException;
import com.pipeline.wpe.exception.ResourceNotFoundException;
import com.pipeline.wpe.repository.*;
import com.pipeline.wpe.service.engine.CriticalPathCalculator;
import com.pipeline.wpe.service.event.ProjectRealtimeNotifier;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
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
    private final TemplateCloneService templateCloneService;
    private final NodeDependencyRepository nodeDependencyRepository;
    private final ProjectRealtimeNotifier projectRealtimeNotifier;

    private static final Map<ProjectStatus, Set<ProjectStatus>> ALLOWED_TRANSITIONS = Map.of(
        ProjectStatus.DRAFT, Set.of(ProjectStatus.ARCHIVED),
        ProjectStatus.PLANNING, Set.of(ProjectStatus.ARCHIVED),
        ProjectStatus.ACTIVE, Set.of(ProjectStatus.PAUSED, ProjectStatus.ARCHIVED, ProjectStatus.COMPLETED),
        ProjectStatus.PAUSED, Set.of(ProjectStatus.ACTIVE, ProjectStatus.ARCHIVED),
        ProjectStatus.COMPLETED, Set.of(ProjectStatus.ACTIVE, ProjectStatus.ARCHIVED), // mở lại dự án đã xong
        ProjectStatus.INACTIVE, Set.of(ProjectStatus.ARCHIVED),
        ProjectStatus.ARCHIVED, Set.of(ProjectStatus.ACTIVE, ProjectStatus.DRAFT)
    );

    public List<ProjectSummaryResponse> getMyProjects(Long currentUserId) {
        return getMyProjects(currentUserId, "all", "ts");
    }

    public List<ProjectSummaryResponse> getMyProjects(Long currentUserId, String tab, String sort) {
        String normalizedTab = (tab == null || tab.isBlank()) ? "all" : tab.trim().toLowerCase();
        if (!Set.of("all", "mine", "shared", "archived").contains(normalizedTab)) {
            throw new IllegalArgumentException("Invalid tab parameter: " + tab);
        }

        String normalizedSort = (sort == null || sort.isBlank()) ? "ts" : sort.trim().toLowerCase();
        if (!Set.of("ts", "done", "nodes").contains(normalizedSort)) {
            throw new IllegalArgumentException("Invalid sort parameter: " + sort);
        }

        List<ProjectEntity> accessibleProjects = projectRepository.findAllAccessibleProjects(currentUserId);
        if (accessibleProjects.isEmpty()) {
            return List.of();
        }

        List<ProjectEntity> filtered = accessibleProjects.stream().filter(p -> {
            boolean isOwner = p.getOwnerId() != null && p.getOwnerId().equals(currentUserId);
            boolean isArchived = p.getStatus() == ProjectStatus.ARCHIVED;
            return switch (normalizedTab) {
                case "all" -> !isArchived;
                case "mine" -> isOwner && !isArchived;
                case "shared" -> !isOwner && !isArchived;
                case "archived" -> isArchived;
                default -> false;
            };
        }).toList();

        if (filtered.isEmpty()) {
            return List.of();
        }

        List<Long> projectIds = filtered.stream().map(ProjectEntity::getId).toList();
        Map<Long, NodeStats> statsMap = countNodesByProjectIds(projectIds);
        Map<Long, Integer> criticalByProject = computeCriticalPathLengths(projectIds);

        // Nạp theo lô: 1 truy vấn thành viên cho mọi dự án + 1 truy vấn user (chủ dự án và thành viên).
        Map<Long, List<ProjectMemberEntity>> activeMembersByProject = projectMemberRepository.findByProjectIdIn(projectIds).stream()
            .filter(m -> m.getRemovedAt() == null && m.getUserId() != null)
            .sorted(Comparator.comparing(ProjectMemberEntity::getJoinedAt, Comparator.nullsLast(Comparator.naturalOrder())))
            .collect(Collectors.groupingBy(ProjectMemberEntity::getProjectId));

        Set<Long> userIds = new LinkedHashSet<>();
        for (ProjectEntity p : filtered) {
            if (p.getOwnerId() != null) userIds.add(p.getOwnerId());
        }
        activeMembersByProject.values().forEach(list -> list.forEach(m -> userIds.add(m.getUserId())));
        Map<Long, UserEntity> usersById = userRepository.findAllById(new ArrayList<>(userIds)).stream()
            .collect(Collectors.toMap(UserEntity::getId, u -> u, (a, b) -> a));
        Map<Long, String> ownerNames = usersById.values().stream()
            .collect(Collectors.toMap(UserEntity::getId, ProjectService::displayNameOf, (a, b) -> a));

        List<ProjectSummaryResponse> result = new ArrayList<>(filtered.stream().map(project -> {
            String ownerName = ownerNames.getOrDefault(project.getOwnerId(), "User #" + project.getOwnerId());
            NodeStats stats = statsMap.getOrDefault(project.getId(), NodeStats.EMPTY);
            return ProjectSummaryResponse.withNodeStats(
                project,
                ownerName,
                stats.nodeCount(),
                stats.activeNodes(),
                stats.doneNodes(),
                stats.inProgressNodes(),
                buildMemberBriefs(project, activeMembersByProject.getOrDefault(project.getId(), List.of()), usersById),
                criticalByProject.getOrDefault(project.getId(), 0)
            );
        }).toList());

        Comparator<ProjectSummaryResponse> comparator = switch (normalizedSort) {
            case "done" -> (p1, p2) -> {
                int c = Integer.compare(p2.doneNodes(), p1.doneNodes());
                return (c != 0) ? c : Long.compare(p2.id(), p1.id());
            };
            case "nodes" -> (p1, p2) -> {
                int c = Integer.compare(p2.nodeCount(), p1.nodeCount());
                return (c != 0) ? c : Long.compare(p2.id(), p1.id());
            };
            case "ts" -> (p1, p2) -> {
                Instant t1 = p1.updatedAt();
                Instant t2 = p2.updatedAt();
                if (t1 == null && t2 == null) {
                    return Long.compare(p2.id(), p1.id());
                }
                if (t1 == null) return 1;
                if (t2 == null) return -1;
                int c = t2.compareTo(t1);
                return (c != 0) ? c : Long.compare(p2.id(), p1.id());
            };
            default -> throw new IllegalArgumentException("Invalid sort parameter: " + sort);
        };

        result.sort(comparator);
        return result;
    }

    public ProjectDetailResponse getProjectDetail(Long projectId, Long currentUserId) {
        ProjectEntity project = projectRepository.findById(projectId)
            .orElseThrow(() -> new ResourceNotFoundException("Project not found with ID: " + projectId));

        boolean isOwner = project.getOwnerId().equals(currentUserId);
        boolean isMember = projectMemberRepository.existsByProjectIdAndUserIdAndRemovedAtIsNull(projectId, currentUserId);
        boolean isAdmin = userRepository.findById(currentUserId)
            .map(u -> u.getSystemRole() == SystemRole.ADMIN)
            .orElse(false);

        if (!isOwner && !isMember && !isAdmin) {
            throw new AccessDeniedException("You don't have access to this project.");
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
        if (req.templateId() != null) {
            CloneTemplateRequest cloneReq = new CloneTemplateRequest(
                req.templateId(),
                req.name(),
                req.description(),
                req.visibility()
            );
            return templateCloneService.cloneTemplate(cloneReq, currentUserId);
        }

        ProjectEntity newProject = ProjectEntity.builder()
            .name(req.name().trim())
            .description(req.description())
            .ownerId(currentUserId)
            .status(ProjectStatus.DRAFT)
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
            .orElseThrow(() -> new ResourceNotFoundException("Project not found with ID: " + projectId));

        boolean isOwner = project.getOwnerId().equals(currentUserId);
        boolean isAdmin = userRepository.findById(currentUserId)
            .map(u -> u.getSystemRole() == SystemRole.ADMIN)
            .orElse(false);

        if (!isOwner && !isAdmin) {
            throw new AccessDeniedException("Only the project owner can change the project status.");
        }

        ProjectStatus newStatus;
        try {
            if (req.status() == null) {
                throw new IllegalArgumentException();
            }
            newStatus = ProjectStatus.valueOf(req.status().trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid project status: " + req.status());
        }

        ProjectStatus currentStatus = project.getStatus();
        if ((currentStatus == ProjectStatus.DRAFT || currentStatus == ProjectStatus.PLANNING)
                && newStatus == ProjectStatus.ACTIVE) {
            throw new ConflictException("USE_PUBLISH", "A draft project can only become active by publishing it.");
        }

        Set<ProjectStatus> allowed = ALLOWED_TRANSITIONS.get(currentStatus);
        if (allowed == null || !allowed.contains(newStatus)) {
            throw new ConflictException("INVALID_PROJECT_STATUS",
                "Can't change the project status from " + currentStatus + " to " + newStatus + ".");
        }

        Map<Long, NodeStats> statsMap = countNodesByProjectIds(List.of(projectId));
        NodeStats stats = statsMap.getOrDefault(projectId, NodeStats.EMPTY);

        // Khi khôi phục dự án từ ARCHIVED (FE gửi ACTIVE):
        // Nếu dự án chưa từng xuất bản (không có node nào hoặc mọi node đều đang ở trạng thái LOCKED),
        // bắt buộc khôi phục về DRAFT thay vì ACTIVE để không cho phép bỏ qua bước xuất bản (publish).
        if (currentStatus == ProjectStatus.ARCHIVED && newStatus == ProjectStatus.ACTIVE) {
            boolean hasUnlockedInStats = (stats.activeNodes() + stats.doneNodes()) > 0;
            boolean hasUnlockedInList = nodeRepository.findByProjectId(projectId).stream()
                .anyMatch(n -> n.getStatus() != null && n.getStatus() != NodeStatus.LOCKED);
            if (!hasUnlockedInStats && !hasUnlockedInList) {
                newStatus = ProjectStatus.DRAFT;
            }
        }

        project.setStatus(newStatus);
        project.setUpdatedAt(Instant.now());
        ProjectEntity saved = projectRepository.save(project);
        projectRealtimeNotifier.notifyProjectChanged(projectId, "PROJECT", "STATUS_CHANGED", currentUserId, null, null);

        String ownerName = getOwnerDisplayName(saved.getOwnerId());

        return ProjectSummaryResponse.withNodeStats(
            saved,
            ownerName,
            stats.nodeCount(),
            stats.activeNodes(),
            stats.doneNodes(),
            stats.inProgressNodes(),
            List.of(),
            computeCriticalPathLengths(List.of(projectId)).getOrDefault(projectId, 0)
        );
    }

    /** Độ dài đường găng của từng dự án, nạp theo lô: 1 truy vấn node + 1 truy vấn phụ thuộc cho mọi dự án. */
    private Map<Long, Integer> computeCriticalPathLengths(Collection<Long> projectIds) {
        if (projectIds == null || projectIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, List<Long>> nodeIdsByProject = new HashMap<>();
        for (NodeEntity n : nodeRepository.findByProjectIdIn(projectIds)) {
            nodeIdsByProject.computeIfAbsent(n.getProjectId(), k -> new ArrayList<>()).add(n.getId());
        }
        Map<Long, List<com.pipeline.wpe.entity.NodeDependencyEntity>> depsByProject = new HashMap<>();
        for (com.pipeline.wpe.entity.NodeDependencyEntity d : nodeDependencyRepository.findByProjectIdIn(projectIds)) {
            depsByProject.computeIfAbsent(d.getProjectId(), k -> new ArrayList<>()).add(d);
        }
        Map<Long, Integer> result = new HashMap<>();
        for (Long projectId : projectIds) {
            result.put(projectId, CriticalPathCalculator.compute(
                nodeIdsByProject.getOrDefault(projectId, List.of()),
                depsByProject.getOrDefault(projectId, List.of())));
        }
        return result;
    }

    @Transactional
    public ProjectDetailResponse updateProject(Long projectId, UpdateProjectRequest req, Long currentUserId) {
        if (req == null || req.name() == null || req.name().trim().isBlank()) {
            throw new IllegalArgumentException("Project name is required.");
        }
        if (req.name().trim().length() > 100) {
            throw new IllegalArgumentException("Project name can't exceed 100 characters.");
        }
        if (req.description() != null && req.description().length() > 1000) {
            throw new IllegalArgumentException("Project description can't exceed 1,000 characters.");
        }

        ProjectEntity project = projectAuthorizationService.verifyProjectOwner(projectId, currentUserId);
        if (project.getStatus() == ProjectStatus.ARCHIVED) {
            throw new ConflictException("PROJECT_ARCHIVED", "This project is archived and read-only.");
        }

        project.setName(req.name().trim());
        String desc = (req.description() != null && !req.description().trim().isEmpty())
            ? req.description().trim()
            : null;
        project.setDescription(desc);
        project.setUpdatedAt(Instant.now());
        projectRepository.save(project);
        projectRealtimeNotifier.notifyProjectChanged(projectId, "PROJECT", "PROJECT_UPDATED", currentUserId, null, null);

        return getProjectDetail(projectId, currentUserId);
    }

    @Transactional
    public void deleteProject(Long projectId, Long currentUserId) {
        ProjectEntity project = projectAuthorizationService.verifyProjectOwner(projectId, currentUserId);
        // Lấy danh sách người nhận TRƯỚC khi xóa (notifier tính người nhận ngay lúc gọi, gửi sau commit)
        projectRealtimeNotifier.notifyProjectChanged(projectId, "PROJECT", "PROJECT_DELETED", currentUserId, null, null);
        nodeRepository.deleteByProjectId(projectId);
        workPhaseRepository.deleteByProjectId(projectId);
        projectMemberRepository.deleteByProjectId(projectId);
        if (project != null) {
            projectRepository.delete(project);
        } else {
            projectRepository.deleteById(projectId);
        }
    }

    private record NodeStats(int nodeCount, int activeNodes, int doneNodes, int inProgressNodes) {
        static final NodeStats EMPTY = new NodeStats(0, 0, 0, 0);
    }

    private Map<Long, NodeStats> countNodesByProjectIds(Collection<Long> projectIds) {
        if (projectIds == null || projectIds.isEmpty()) {
            return Map.of();
        }
        List<Object[]> rows = nodeRepository.countByProjectIdsGroupByStatus(projectIds);
        Map<Long, int[]> countMap = new HashMap<>();
        for (Object[] row : rows) {
            Long pId = (Long) row[0];
            NodeStatus status = (NodeStatus) row[1];
            int count = ((Number) row[2]).intValue();

            int[] counts = countMap.computeIfAbsent(pId, k -> new int[4]);
            counts[0] += count; // nodeCount = tổng
            if (status == NodeStatus.TODO || status == NodeStatus.IN_PROGRESS || status == NodeStatus.REVIEW) {
                counts[1] += count; // activeNodes
            }
            if (status == NodeStatus.DONE) {
                counts[2] += count; // doneNodes
            }
            if (status == NodeStatus.IN_PROGRESS) {
                counts[3] += count; // inProgressNodes
            }
        }

        Map<Long, NodeStats> result = new HashMap<>();
        for (Map.Entry<Long, int[]> entry : countMap.entrySet()) {
            int[] c = entry.getValue();
            result.put(entry.getKey(), new NodeStats(c[0], c[1], c[2], c[3]));
        }
        return result;
    }

    private static String displayNameOf(UserEntity u) {
        return (u.getFullName() != null && !u.getFullName().isBlank()) ? u.getFullName() : u.getUsername();
    }

    /** Chủ dự án trước, rồi thành viên đang hoạt động (đã sắp theo joinedAt), không trùng người. */
    private static List<ProjectMemberBrief> buildMemberBriefs(
        ProjectEntity project, List<ProjectMemberEntity> members, Map<Long, UserEntity> usersById
    ) {
        Set<Long> seen = new LinkedHashSet<>();
        if (project.getOwnerId() != null) {
            seen.add(project.getOwnerId());
        }
        for (ProjectMemberEntity m : members) {
            seen.add(m.getUserId());
        }
        List<ProjectMemberBrief> briefs = new ArrayList<>();
        for (Long uid : seen) {
            UserEntity u = usersById.get(uid);
            String name = u != null ? displayNameOf(u) : "User #" + uid;
            briefs.add(new ProjectMemberBrief(String.valueOf(uid), name, u != null ? u.getAvatarUrl() : null));
        }
        return briefs;
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
