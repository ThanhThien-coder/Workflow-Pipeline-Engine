package com.pipeline.wpe.service;

import com.pipeline.wpe.common.enums.NodeStatus;
import com.pipeline.wpe.common.enums.ProjectStatus;
import com.pipeline.wpe.dto.response.guest.GuestAccessResponse;
import com.pipeline.wpe.dto.response.guest.GuestOverviewResponse;
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

        return guestLinkRepository.findByProjectIdAndIsRevokedFalse(projectId)
            .filter(link -> link.getExpiresAt().isAfter(Instant.now()))
            .map(this::toGuestAccessResponse)
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
        List<ArtifactEntity> publicArtifacts = artifactRepository.findByProjectIdAndIsPublicForGuestTrue(project.getId());

        int totalNodes = nodes.size();
        // Cùng định nghĩa đường găng với thẻ dự án và Overview.
        int criticalNodes = CriticalPathCalculator.compute(
            nodes.stream().map(NodeEntity::getId).toList(),
            nodeDependencyRepository.findByProjectId(project.getId()));
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
        String phaseLabel = workPhaseRepository.findByProjectIdOrderByOrderIndexAsc(project.getId()).stream()
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

        // G25: số liệu thật thay cho số giả. DB không lưu thời điểm DONE riêng nên dùng updatedAt của task DONE.
        Instant now = Instant.now();
        List<GuestOverviewResponse.GuestVelocityPointDto> velocity = buildVelocity(nodes, now);
        List<GuestOverviewResponse.GuestActivityDto> recentActivities = buildRecentActivity(nodes, now);

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
            artifactDtos
        );
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
    private List<GuestOverviewResponse.GuestActivityDto> buildRecentActivity(List<NodeEntity> nodes, Instant now) {
        List<NodeEntity> recent = nodes.stream()
            .filter(n -> n.getUpdatedAt() != null && n.getCreatedAt() != null && n.getUpdatedAt().isAfter(n.getCreatedAt()))
            .sorted(Comparator.comparing(NodeEntity::getUpdatedAt).reversed())
            .limit(5)
            .toList();
        // Ảnh của người được giao task: nạp 1 lô cho tối đa 5 task.
        Set<Long> assigneeIds = recent.stream().map(NodeEntity::getAssignedUserId)
            .filter(Objects::nonNull).collect(Collectors.toSet());
        Map<Long, String> avatarByUser = new HashMap<>();
        if (!assigneeIds.isEmpty()) {
            for (UserEntity u : userRepository.findAllById(new ArrayList<>(assigneeIds))) {
                if (u.getAvatarUrl() != null) avatarByUser.put(u.getId(), u.getAvatarUrl());
            }
        }
        return recent.stream()
            .map(n -> new GuestOverviewResponse.GuestActivityDto(
                "node-" + n.getId(),
                "WPE",
                n.getCode(),
                n.getTitle() + " is now " + n.getStatus().name().replace('_', ' '),
                agoEn(n.getUpdatedAt(), now),
                n.getAssignedUserId() != null ? avatarByUser.get(n.getAssignedUserId()) : null
            ))
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

        // G25: khách xem được mọi trạng thái (kể cả DRAFT/PLANNING) trừ dự án đã lưu trữ
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
        return new GuestAccessResponse(
            !Boolean.TRUE.equals(link.getIsRevoked()) && link.getExpiresAt().isAfter(Instant.now()),
            link.getToken(),
            shareUrl,
            link.getExpiresAt()
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

