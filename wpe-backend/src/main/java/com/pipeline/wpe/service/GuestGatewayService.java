package com.pipeline.wpe.service;

import com.pipeline.wpe.common.enums.FeedbackStatus;
import com.pipeline.wpe.common.enums.NodeStatus;
import com.pipeline.wpe.common.enums.ProjectRole;
import com.pipeline.wpe.common.enums.ProjectStatus;
import com.pipeline.wpe.dto.response.graph.WorkflowGraphResponse;
import com.pipeline.wpe.dto.response.guest.GuestAccessResponse;
import com.pipeline.wpe.dto.response.guest.GuestAiSummaryResponse;
import com.pipeline.wpe.dto.response.guest.GuestOverviewResponse;
import com.pipeline.wpe.dto.response.guest.GuestReportResponse;
import com.pipeline.wpe.entity.NodeDependencyEntity;
import com.pipeline.wpe.entity.PhaseDependencyEntity;
import com.pipeline.wpe.entity.ProjectMemberEntity;
import com.pipeline.wpe.entity.WorkPhaseEntity;
import com.pipeline.wpe.repository.ProjectFeedbackRepository;
import com.pipeline.wpe.repository.ProjectMemberRepository;
import com.pipeline.wpe.entity.ArtifactEntity;
import com.pipeline.wpe.entity.GuestLinkEntity;
import com.pipeline.wpe.entity.NodeEntity;
import com.pipeline.wpe.entity.ProjectEntity;
import com.pipeline.wpe.entity.UserEntity;
import com.pipeline.wpe.exception.ForbiddenException;
import com.pipeline.wpe.exception.ResourceNotFoundException;
import com.pipeline.wpe.repository.ArtifactRepository;
import com.pipeline.wpe.repository.GuestLinkRepository;
import com.pipeline.wpe.repository.NodeDependencyRepository;
import com.pipeline.wpe.repository.NodeRepository;
import com.pipeline.wpe.service.engine.CriticalPathCalculator;
import com.pipeline.wpe.repository.UserRepository;
import com.pipeline.wpe.repository.WorkPhaseRepository;
import com.pipeline.wpe.security.CurrentUserProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class GuestGatewayService {

    private final GuestLinkRepository guestLinkRepository;
    private final NodeRepository nodeRepository;
    private final ArtifactRepository artifactRepository;
    private final WorkPhaseRepository workPhaseRepository;
    private final ProjectAuthorizationService authorizationService;
    private final CurrentUserProvider currentUserProvider;
    private final UserRepository userRepository;
    private final NodeDependencyRepository nodeDependencyRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final ProjectFeedbackRepository projectFeedbackRepository;
    private final WorkflowGraphService workflowGraphService;

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    @Value("${app.frontend.base-url:http://localhost:5173}")
    private String frontendBaseUrl;

    /**
     * Sinh mới hoặc gia hạn Token chia sẻ 64 ký tự cho dự án.
     * Chỉ OWNER mới có quyền thực hiện.
     */
    @Transactional
    public GuestAccessResponse generateOrRenewGuestToken(Long projectId, Integer expiryDays) {
        Long currentUserId = currentUserProvider.requireCurrentUserId();
        authorizationService.verifyProjectOwner(projectId, currentUserId);

        int resolvedDays = (expiryDays != null && expiryDays > 0) ? expiryDays : 30;
        Instant expiresAt = Instant.now().plus(Duration.ofDays(resolvedDays));
        String token = generateSecureHexToken64();

        Optional<GuestLinkEntity> existingOpt = guestLinkRepository.findByProjectIdAndIsRevokedFalse(projectId);
        GuestLinkEntity guestLink;
        if (existingOpt.isPresent()) {
            guestLink = existingOpt.get();
            guestLink.setToken(token);
            guestLink.setIsRevoked(false);
            guestLink.setExpiresAt(expiresAt);
        } else {
            guestLink = GuestLinkEntity.builder()
                .projectId(projectId)
                .token(token)
                .isRevoked(false)
                .expiresAt(expiresAt)
                .build();
        }

        guestLink = guestLinkRepository.save(guestLink);
        log.info("Generated new guest token for project ID: {}, expires at: {}", projectId, expiresAt);

        return toGuestAccessResponse(guestLink);
    }

    /**
     * Thu hồi quyền truy cập công khai của khách đối với dự án.
     * Chỉ OWNER mới có quyền thực hiện.
     */
    @Transactional
    public GuestAccessResponse revokeGuestToken(Long projectId) {
        Long currentUserId = currentUserProvider.requireCurrentUserId();
        authorizationService.verifyProjectOwner(projectId, currentUserId);

        Optional<GuestLinkEntity> existingOpt = guestLinkRepository.findByProjectIdAndIsRevokedFalse(projectId);
        if (existingOpt.isPresent()) {
            GuestLinkEntity link = existingOpt.get();
            link.setIsRevoked(true);
            guestLinkRepository.save(link);
            log.info("Revoked guest token for project ID: {}", projectId);
            return GuestAccessResponse.revoked();
        }

        return GuestAccessResponse.disabled();
    }

    /**
     * Lấy trạng thái Guest Link hiện tại của dự án.
     */
    @Transactional(readOnly = true)
    public GuestAccessResponse getGuestAccessState(Long projectId) {
        Long currentUserId = currentUserProvider.requireCurrentUserId();
        authorizationService.verifyProjectOwner(projectId, currentUserId);

        Optional<GuestLinkEntity> unrevoked = guestLinkRepository.findByProjectIdAndIsRevokedFalse(projectId);
        if (unrevoked.isPresent()) {
            GuestLinkEntity link = unrevoked.get();
            if (link.getExpiresAt().isAfter(Instant.now())) {
                return toGuestAccessResponse(link);
            }
            return GuestAccessResponse.expired(link.getExpiresAt());
        }
        return guestLinkRepository.findFirstByProjectIdOrderByCreatedAtDesc(projectId)
            .filter(link -> Boolean.TRUE.equals(link.getIsRevoked()))
            .map(link -> GuestAccessResponse.revoked())
            .orElseGet(GuestAccessResponse::disabled);
    }

    /**
     * Cổng đọc công khai (Read-only) cho khách ngoài qua Token 64 ký tự.
     * Không yêu cầu JWT Authorization.
     */
    @Transactional(readOnly = true)
    public GuestOverviewResponse getGuestOverview(String token) {
        GuestLinkEntity guestLink = validateAndGetActiveGuestLink(token);
        ProjectEntity project = authorizationService.getProjectOrThrow(guestLink.getProjectId());

        List<NodeEntity> nodes = nodeRepository.findByProjectId(project.getId());
        List<NodeDependencyEntity> dependencies = nodeDependencyRepository.findByProjectId(project.getId());
        List<ArtifactEntity> publicArtifacts = artifactRepository.findByProjectIdAndIsPublicForGuestTrue(project.getId());

        int totalNodes = nodes.size();
        // Cùng định nghĩa đường găng với thẻ dự án và Overview.
        int criticalNodes = CriticalPathCalculator.compute(
            nodes.stream().map(NodeEntity::getId).toList(),
            dependencies);
        int completedNodes = (int) nodes.stream().filter(n -> n.getStatus() == NodeStatus.DONE).count();
        double completionPct = totalNodes > 0 ? Math.round(((double) completedNodes / totalNodes * 100.0) * 10.0) / 10.0 : 0.0;
        int overdueCount = (int) nodes.stream().filter(n -> Boolean.TRUE.equals(n.getIsOverdue())).count();
        int lockedCount = (int) nodes.stream().filter(n -> n.getStatus() == NodeStatus.LOCKED).count();

        // Status breakdown
        Map<NodeStatus, Long> countsByStatus = nodes.stream()
            .collect(Collectors.groupingBy(NodeEntity::getStatus, Collectors.counting()));

        List<GuestOverviewResponse.GuestStatusSliceDto> statusBreakdown = List.of(
            new GuestOverviewResponse.GuestStatusSliceDto("done", "Done", countsByStatus.getOrDefault(NodeStatus.DONE, 0L).intValue()),
            new GuestOverviewResponse.GuestStatusSliceDto("inProgress", "In Progress", countsByStatus.getOrDefault(NodeStatus.IN_PROGRESS, 0L).intValue()),
            new GuestOverviewResponse.GuestStatusSliceDto("review", "In Review", countsByStatus.getOrDefault(NodeStatus.REVIEW, 0L).intValue()),
            new GuestOverviewResponse.GuestStatusSliceDto("todo", "To Do", countsByStatus.getOrDefault(NodeStatus.TODO, 0L).intValue()),
            new GuestOverviewResponse.GuestStatusSliceDto("locked", "Locked", countsByStatus.getOrDefault(NodeStatus.LOCKED, 0L).intValue())
        );

        // Active phase label
        List<WorkPhaseEntity> allPhases = workPhaseRepository.findByProjectIdOrderByOrderIndexAsc(project.getId());
        String phaseLabel = allPhases.stream()
            .findFirst()
            .map(p -> p.getName())
            .orElse("Whole workflow");

        // Public artifacts mapping
        List<GuestOverviewResponse.GuestArtifactDto> artifactDtos = publicArtifacts.stream()
            .map(a -> new GuestOverviewResponse.GuestArtifactDto(
                a.getId(),
                a.getName(),
                a.getType() != null ? a.getType().name() : "OTHER",
                a.getUrl()
            ))
            .toList();

        // Nạp phần còn lại cho report ở ngoài try để không đánh dấu rollback transaction khi có lỗi chuyển đổi DTO.
        List<ProjectMemberEntity> activeMembers = projectMemberRepository.findByProjectIdAndRemovedAtIsNull(project.getId());
        Map<Long, UserEntity> usersById = loadUsersForOverview(project, activeMembers, nodes);
        long feedbackTotal = projectFeedbackRepository.countByProjectId(project.getId());
        long feedbackResolved = projectFeedbackRepository.countByProjectIdAndStatus(project.getId(), FeedbackStatus.RESOLVED);
        List<PhaseDependencyEntity> phaseDependencies = workflowGraphService.loadPhaseDependencies(project.getId());

        // G25: số liệu thật thay cho số giả. DB không lưu thời điểm DONE riêng nên dùng updatedAt của task DONE.
        Instant now = Instant.now();
        List<GuestOverviewResponse.GuestVelocityPointDto> velocity = buildVelocity(nodes, now);
        List<GuestOverviewResponse.GuestActivityDto> recentActivities = buildRecentActivity(nodes, usersById, now);

        GuestReportResponse report = null;
        try {
            report = buildReport(
                guestLink, project, allPhases, phaseDependencies, nodes, dependencies,
                activeMembers, usersById, publicArtifacts,
                feedbackTotal, feedbackResolved, now
            );
        } catch (RuntimeException e) {
            log.warn("Failed to build guest report for project {}: {}", project.getId(), e.getMessage(), e);
        }

        return new GuestOverviewResponse(
            project.getName(),
            phaseLabel,
            project.getUpdatedAt() != null ? project.getUpdatedAt() : project.getCreatedAt(),
            totalNodes,
            criticalNodes,
            completedNodes,
            completionPct,
            overdueCount,
            lockedCount,
            totalNodes,
            velocity,
            statusBreakdown,
            recentActivities,
            artifactDtos,
            buildPhases(allPhases, nodes),
            countMembers(project, activeMembers),
            report
        );
    }

    /** Chuyển dữ liệu đã nạp sẵn thành payload report (không gọi repository trực tiếp). */
    private GuestReportResponse buildReport(
        GuestLinkEntity guestLink,
        ProjectEntity project,
        List<WorkPhaseEntity> allPhases,
        List<PhaseDependencyEntity> phaseDependencies,
        List<NodeEntity> nodes,
        List<NodeDependencyEntity> dependencies,
        List<ProjectMemberEntity> activeMembers,
        Map<Long, UserEntity> usersById,
        List<ArtifactEntity> publicArtifacts,
        long feedbackTotal,
        long feedbackResolved,
        Instant now
    ) {
        WorkflowGraphResponse graph = workflowGraphService.buildGraph(
            project.getId(), allPhases, nodes, dependencies, phaseDependencies
        );
        if (graph == null) {
            throw new IllegalStateException("buildGraph returned null");
        }

        LocalDate todayVn = now.atZone(VIETNAM_ZONE).toLocalDate();
        List<GuestReportResponse.GuestNodeDto> reportNodes = nodes.stream()
            .map(n -> {
                boolean overdue = n.getDueDate() != null
                    && n.getStatus() != NodeStatus.DONE
                    && n.getDueDate().atZone(VIETNAM_ZONE).toLocalDate().isBefore(todayVn);
                return new GuestReportResponse.GuestNodeDto(
                    String.valueOf(n.getId()),
                    n.getPhaseId() != null ? String.valueOf(n.getPhaseId()) : null,
                    n.getCode(),
                    n.getTitle(),
                    n.getDescription(),
                    n.getStatus() != null ? n.getStatus().name() : null,
                    n.getJoinPolicy() != null ? n.getJoinPolicy().name() : null,
                    n.getAssignedUserId() != null ? String.valueOf(n.getAssignedUserId()) : null,
                    n.getDueDate(),
                    n.getEstimatedHours(),
                    n.getCreatedAt(),
                    n.getCompletedAt(),
                    n.getStartedAt(),
                    n.getReopenedAt(),
                    overdue
                );
            })
            .toList();

        Map<Long, String> roleByUserId = new LinkedHashMap<>();
        if (project.getOwnerId() != null) {
            roleByUserId.put(project.getOwnerId(), ProjectRole.OWNER.name());
        }
        for (ProjectMemberEntity m : activeMembers) {
            if (m.getUserId() != null) {
                roleByUserId.putIfAbsent(
                    m.getUserId(),
                    m.getRole() != null ? m.getRole().name() : ProjectRole.COLLABORATOR.name()
                );
            }
        }
        for (NodeEntity n : nodes) {
            if (n.getAssignedUserId() != null) {
                roleByUserId.putIfAbsent(n.getAssignedUserId(), "FORMER");
            }
        }
        List<GuestReportResponse.GuestMemberDto> reportMembers = roleByUserId.entrySet().stream()
            .map(e -> new GuestReportResponse.GuestMemberDto(
                String.valueOf(e.getKey()),
                resolveMemberName(usersById.get(e.getKey()), e.getKey()),
                e.getValue()
            ))
            .toList();

        List<GuestReportResponse.GuestArtifactDto> reportArtifacts = publicArtifacts.stream()
            .filter(a -> !Boolean.FALSE.equals(a.getIsPublicForGuest()))
            .filter(a -> isHttpUrl(a.getUrl()))
            .map(a -> new GuestReportResponse.GuestArtifactDto(
                String.valueOf(a.getId()),
                a.getName(),
                a.getType() != null ? a.getType().name() : "OTHER_LINK",
                a.getUrl().trim(),
                a.getNodeId() != null ? String.valueOf(a.getNodeId()) : null,
                a.getCreatedAt()
            ))
            .toList();

        return new GuestReportResponse(
            now,
            new GuestReportResponse.GuestProjectDto(
                project.getName(),
                project.getDescription(),
                project.getStatus() != null ? project.getStatus().name() : null,
                project.getCreatedAt(),
                guestLink.getExpiresAt()
            ),
            new GuestReportResponse.GuestGraphDto(
                graph.phases(),
                graph.phaseEdges(),
                reportNodes,
                graph.dependencies()
            ),
            reportMembers,
            reportArtifacts,
            new GuestReportResponse.GuestFeedbackDto(feedbackTotal, feedbackResolved)
        );
    }

    private Map<Long, UserEntity> loadUsersForOverview(
        ProjectEntity project,
        List<ProjectMemberEntity> activeMembers,
        List<NodeEntity> nodes
    ) {
        Set<Long> userIds = new LinkedHashSet<>();
        if (project.getOwnerId() != null) {
            userIds.add(project.getOwnerId());
        }
        for (ProjectMemberEntity m : activeMembers) {
            if (m.getUserId() != null) {
                userIds.add(m.getUserId());
            }
        }
        for (NodeEntity n : nodes) {
            if (n.getAssignedUserId() != null) {
                userIds.add(n.getAssignedUserId());
            }
        }
        if (userIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, UserEntity> result = new HashMap<>();
        for (UserEntity u : userRepository.findAllById(new ArrayList<>(userIds))) {
            if (u.getId() != null) {
                result.put(u.getId(), u);
            }
        }
        return result;
    }

    private static String resolveMemberName(UserEntity user, Long userId) {
        if (user == null) {
            return "User #" + userId;
        }
        if (user.getFullName() != null && !user.getFullName().isBlank()) {
            return user.getFullName().trim();
        }
        if (user.getUsername() != null && !user.getUsername().isBlank()) {
            return user.getUsername().trim();
        }
        return "User #" + userId;
    }

    private static boolean isHttpUrl(String url) {
        if (url == null) {
            return false;
        }
        String lower = url.trim().toLowerCase(Locale.ROOT);
        return lower.startsWith("http://") || lower.startsWith("https://");
    }

    /**
     * Cùng kiểm link như overview. Đọc kết quả AI đã lưu trong project.latest_ai_analysis,
     * KHÔNG gọi AI mới. Chưa có phân tích thì trả Optional rỗng (controller trả 404 AI_SUMMARY_NOT_FOUND).
     * Không dùng AiDiagnosticService.getLatestAnalysis vì hàm đó đòi người dùng đăng nhập.
     */
    @Transactional(readOnly = true)
    public Optional<GuestAiSummaryResponse> getGuestAiSummary(String token) {
        GuestLinkEntity guestLink = validateAndGetActiveGuestLink(token);
        ProjectEntity project = authorizationService.getProjectOrThrow(guestLink.getProjectId());
        Map<String, Object> analysis = project.getLatestAiAnalysis();
        if (analysis == null || analysis.isEmpty()) {
            return Optional.empty();
        }

        List<NodeEntity> nodes = nodeRepository.findByProjectId(project.getId());
        Instant weekAgo = Instant.now().minus(Duration.ofDays(7));
        long doneLast7Days = nodes.stream()
            .filter(n -> n.getStatus() == NodeStatus.DONE)
            .filter(n -> {
                Instant at = n.getCompletedAt() != null ? n.getCompletedAt() : n.getUpdatedAt();
                return at != null && at.isAfter(weekAgo);
            })
            .count();
        long remaining = nodes.stream().filter(n -> n.getStatus() != NodeStatus.DONE).count();

        String health = null;
        if (analysis.get("metrics") instanceof Map<?, ?> m && m.get("status") != null) {
            health = String.valueOf(m.get("status")).replace('_', ' ').toLowerCase(Locale.ENGLISH);
        }
        StringBuilder content = new StringBuilder();
        if (health != null) {
            content.append("Project health: ").append(health).append(". ");
        }
        content.append(doneLast7Days).append(doneLast7Days == 1 ? " task was" : " tasks were")
            .append(" completed in the last 7 days; ")
            .append(remaining).append(remaining == 1 ? " task remains." : " tasks remain.");

        List<String> highlights = new ArrayList<>();
        for (Map<String, Object> item : asMapList(analysis.get("actionableAdvice"))) {
            String text = str(item.get("instruction"));
            if (text != null) highlights.add(text);
        }
        List<String> risks = new ArrayList<>();
        // Mỗi mã task chỉ một dòng rủi ro: bottleneck trước, taskTrap của task đã có thì bỏ (tránh WPE-005 hiện 2 lần).
        java.util.Set<String> riskCodes = new java.util.HashSet<>();
        for (Map<String, Object> item : asMapList(analysis.get("bottlenecks"))) {
            if ("LOW".equalsIgnoreCase(str(item.get("severity")))) continue; // LOW = "đang ổn", không phải rủi ro
            String code = str(item.get("nodeCode"));
            if (code != null && !riskCodes.add(code)) continue;
            addRisk(risks, code, str(item.get("reason")));
        }
        for (Map<String, Object> item : asMapList(analysis.get("taskTraps"))) {
            String code = str(item.get("nodeCode"));
            if (code != null && !riskCodes.add(code)) continue;
            addRisk(risks, code, str(item.get("suggestion")));
        }

        return Optional.of(new GuestAiSummaryResponse(
            content.toString(),
            highlights.stream().limit(5).toList(),
            risks.stream().limit(5).toList(),
            str(analysis.get("analyzedAt"))
        ));
    }

    private static void addRisk(List<String> risks, String code, String reason) {
        if (reason == null) return;
        risks.add(code != null ? code + ": " + reason : reason);
    }

    private static String str(Object o) {
        if (o == null) return null;
        String s = String.valueOf(o).trim();
        return s.isEmpty() ? null : s;
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> asMapList(Object o) {
        if (!(o instanceof List<?> list)) return List.of();
        List<Map<String, Object>> out = new ArrayList<>();
        for (Object e : list) {
            if (e instanceof Map<?, ?> m) out.add((Map<String, Object>) m);
        }
        return out;
    }

    /** Chủ dự án + thành viên đang hoạt động, đếm theo userId để không đếm trùng chủ dự án. */
    private int countMembers(ProjectEntity project, List<ProjectMemberEntity> activeMembers) {
        Set<Long> userIds = new HashSet<>();
        if (project.getOwnerId() != null) userIds.add(project.getOwnerId());
        for (ProjectMemberEntity m : activeMembers) {
            if (m.getUserId() != null) userIds.add(m.getUserId());
        }
        return userIds.size();
    }

    /**
     * Mỗi phase một dòng, theo thứ tự orderIndex (danh sách vào đã sắp sẵn), với task của chính phase đó.
     * Không gộp phase con vào phase cha: parent_phase_id chỉ là quan hệ sắp xếp trên canvas, khách cần thấy từng phase.
     * Trạng thái suy ra như FE phaseProgress.
     */
    private List<GuestOverviewResponse.GuestPhaseDto> buildPhases(List<WorkPhaseEntity> allPhases, List<NodeEntity> nodes) {
        Map<Long, List<NodeEntity>> tasksByPhase = new HashMap<>();
        for (NodeEntity n : nodes) {
            if (n.getPhaseId() != null) tasksByPhase.computeIfAbsent(n.getPhaseId(), k -> new ArrayList<>()).add(n);
        }
        List<GuestOverviewResponse.GuestPhaseDto> result = new ArrayList<>();
        for (WorkPhaseEntity p : allPhases) {
            if (p.getId() == null) continue;
            List<NodeEntity> tasks = tasksByPhase.getOrDefault(p.getId(), List.of());
            int total = tasks.size();
            int done = (int) tasks.stream().filter(t -> t.getStatus() == NodeStatus.DONE).count();
            int pct = total > 0 ? (int) Math.round((double) done / total * 100.0) : 0;
            String status;
            if (total == 0) status = "TODO";
            else if (done == total) status = "COMPLETED";
            else if (tasks.stream().allMatch(t -> t.getStatus() == NodeStatus.LOCKED)) status = "LOCKED";
            else if (tasks.stream().anyMatch(t -> t.getStatus() == NodeStatus.IN_PROGRESS
                || t.getStatus() == NodeStatus.REVIEW || t.getStatus() == NodeStatus.DONE)) status = "IN_PROGRESS";
            else status = "TODO";
            result.add(new GuestOverviewResponse.GuestPhaseDto(guestPhaseName(p), status, pct, total, done));
        }
        return result;
    }

    /** Giống phaseDisplayName của FE: tên dạng "PHASE 3" mà có phụ đề thì dùng phụ đề. */
    private static String guestPhaseName(WorkPhaseEntity p) {
        String name = p.getName() != null ? p.getName().trim() : "";
        String sub = p.getSubTitle() != null ? p.getSubTitle().trim() : "";
        if (!sub.isEmpty() && (name.isEmpty() || name.matches("(?i)^phase\\s*\\d+$"))) return sub;
        return !name.isEmpty() ? name : sub;
    }

    private static final java.time.ZoneId VIETNAM_ZONE = java.time.ZoneId.of("Asia/Ho_Chi_Minh");

    /** Số task DONE theo từng ngày trong 7 ngày gần nhất (giờ Việt Nam), nhãn Mon..Sun. */
    private List<GuestOverviewResponse.GuestVelocityPointDto> buildVelocity(List<NodeEntity> nodes, Instant now) {
        java.time.LocalDate today = now.atZone(VIETNAM_ZONE).toLocalDate();
        Map<java.time.LocalDate, Long> doneByDay = nodes.stream()
            .filter(n -> n.getStatus() == NodeStatus.DONE && n.getUpdatedAt() != null)
            .collect(Collectors.groupingBy(n -> n.getUpdatedAt().atZone(VIETNAM_ZONE).toLocalDate(), Collectors.counting()));
        List<GuestOverviewResponse.GuestVelocityPointDto> points = new ArrayList<>();
        for (int i = 6; i >= 0; i--) {
            java.time.LocalDate day = today.minusDays(i);
            String label = day.getDayOfWeek().getDisplayName(java.time.format.TextStyle.SHORT, Locale.ENGLISH);
            points.add(new GuestOverviewResponse.GuestVelocityPointDto(label, doneByDay.getOrDefault(day, 0L).intValue()));
        }
        return points;
    }

    /** 5 task được cập nhật gần nhất (bỏ task chưa từng sửa sau khi tạo). */
    private List<GuestOverviewResponse.GuestActivityDto> buildRecentActivity(
        List<NodeEntity> nodes,
        Map<Long, UserEntity> usersById,
        Instant now
    ) {
        List<NodeEntity> recent = nodes.stream()
            .filter(n -> n.getUpdatedAt() != null && n.getCreatedAt() != null && n.getUpdatedAt().isAfter(n.getCreatedAt()))
            .sorted(Comparator.comparing(NodeEntity::getUpdatedAt).reversed())
            .limit(5)
            .toList();
        return recent.stream()
            .map(n -> {
                UserEntity assignee = n.getAssignedUserId() != null ? usersById.get(n.getAssignedUserId()) : null;
                return new GuestOverviewResponse.GuestActivityDto(
                    "node-" + n.getId(),
                    "WPE",
                    n.getCode(),
                    n.getTitle() + " is now " + n.getStatus().name().replace('_', ' '),
                    agoEn(n.getUpdatedAt(), now),
                    assignee != null ? assignee.getAvatarUrl() : null
                );
            })
            .toList();
    }

    private static String agoEn(Instant at, Instant now) {
        long minutes = Math.max(0, Duration.between(at, now).toMinutes());
        if (minutes < 1) return "just now";
        if (minutes < 60) return minutes + " min ago";
        long hours = minutes / 60;
        if (hours < 24) return hours + (hours == 1 ? " hour ago" : " hours ago");
        long days = hours / 24;
        return days == 1 ? "yesterday" : days + " days ago";
    }

    /**
     * Xác thực tính hợp lệ của Guest Token.
     */
    public GuestLinkEntity validateAndGetActiveGuestLink(String token) {
        if (token == null || token.isBlank()) {
            throw new ForbiddenException("REVOKED_GUEST", "The share link is invalid or missing.");
        }

        GuestLinkEntity guestLink = guestLinkRepository.findByToken(token.trim())
            .orElseThrow(() -> new ForbiddenException("REVOKED_GUEST", "This share link does not exist."));

        if (Boolean.TRUE.equals(guestLink.getIsRevoked())) {
            throw new ForbiddenException("REVOKED_GUEST", "The project owner has revoked this share link.");
        }

        if (guestLink.getExpiresAt().isBefore(Instant.now())) {
            throw new ForbiddenException("REVOKED_GUEST", "This share link has expired.");
        }

        // G25: khách xem được mọi trạng thái (kể cả DRAFT) trừ dự án đã lưu trữ
        ProjectEntity project = authorizationService.getProjectOrThrow(guestLink.getProjectId());
        if (project.getStatus() == ProjectStatus.ARCHIVED) {
            throw new ForbiddenException("REVOKED_GUEST", "This project has been archived and is no longer shared.");
        }

        return guestLink;
    }

    private GuestAccessResponse toGuestAccessResponse(GuestLinkEntity link) {
        String base = frontendBaseUrl != null ? frontendBaseUrl.replaceAll("/+$", "") : "";
        String encodedToken = URLEncoder.encode(link.getToken(), StandardCharsets.UTF_8);
        String shareUrl = String.format("%s/guest?token=%s", base, encodedToken);
        boolean active = !Boolean.TRUE.equals(link.getIsRevoked()) && link.getExpiresAt().isAfter(Instant.now());
        return new GuestAccessResponse(
            active,
            link.getToken(),
            shareUrl,
            link.getExpiresAt(),
            active ? GuestAccessResponse.Status.ACTIVE : GuestAccessResponse.Status.NONE
        );
    }

    private String generateSecureHexToken64() {
        byte[] bytes = new byte[32]; // 32 bytes = 64 hex characters
        SECURE_RANDOM.nextBytes(bytes);
        StringBuilder sb = new StringBuilder(64);
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }
}

