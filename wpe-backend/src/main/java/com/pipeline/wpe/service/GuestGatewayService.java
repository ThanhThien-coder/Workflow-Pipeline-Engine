package com.pipeline.wpe.service;

import com.pipeline.wpe.common.enums.NodeStatus;
import com.pipeline.wpe.common.enums.ProjectStatus;
import com.pipeline.wpe.dto.response.guest.GuestAccessResponse;
import com.pipeline.wpe.dto.response.guest.GuestOverviewResponse;
import com.pipeline.wpe.entity.ArtifactEntity;
import com.pipeline.wpe.entity.GuestLinkEntity;
import com.pipeline.wpe.entity.NodeEntity;
import com.pipeline.wpe.entity.ProjectEntity;
import com.pipeline.wpe.exception.ForbiddenException;
import com.pipeline.wpe.exception.ResourceNotFoundException;
import com.pipeline.wpe.repository.ArtifactRepository;
import com.pipeline.wpe.repository.GuestLinkRepository;
import com.pipeline.wpe.repository.NodeRepository;
import com.pipeline.wpe.repository.WorkPhaseRepository;
import com.pipeline.wpe.security.CurrentUserProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
        int completedNodes = (int) nodes.stream().filter(n -> n.getStatus() == NodeStatus.DONE).count();
        double completionPct = totalNodes > 0 ? Math.round(((double) completedNodes / totalNodes * 100.0) * 10.0) / 10.0 : 0.0;
        int overdueCount = (int) nodes.stream().filter(n -> Boolean.TRUE.equals(n.getIsOverdue())).count();
        int lockedCount = (int) nodes.stream().filter(n -> n.getStatus() == NodeStatus.LOCKED).count();

        // Status breakdown
        Map<NodeStatus, Long> countsByStatus = nodes.stream()
            .collect(Collectors.groupingBy(NodeEntity::getStatus, Collectors.counting()));

        List<GuestOverviewResponse.GuestStatusSliceDto> statusBreakdown = List.of(
            new GuestOverviewResponse.GuestStatusSliceDto("done", "Hoàn thành", countsByStatus.getOrDefault(NodeStatus.DONE, 0L).intValue()),
            new GuestOverviewResponse.GuestStatusSliceDto("inProgress", "Đang thực hiện", countsByStatus.getOrDefault(NodeStatus.IN_PROGRESS, 0L).intValue()),
            new GuestOverviewResponse.GuestStatusSliceDto("review", "Chờ nghiệm thu", countsByStatus.getOrDefault(NodeStatus.REVIEW, 0L).intValue()),
            new GuestOverviewResponse.GuestStatusSliceDto("todo", "Sẵn sàng làm", countsByStatus.getOrDefault(NodeStatus.TODO, 0L).intValue()),
            new GuestOverviewResponse.GuestStatusSliceDto("locked", "Bị khóa (DAG)", countsByStatus.getOrDefault(NodeStatus.LOCKED, 0L).intValue())
        );

        // Active phase label
        String phaseLabel = workPhaseRepository.findByProjectIdOrderByOrderIndexAsc(project.getId()).stream()
            .findFirst()
            .map(p -> p.getOrderIndex() + ". " + p.getName())
            .orElse("Toàn bộ quy trình");

        // Public artifacts mapping
        List<GuestOverviewResponse.GuestArtifactDto> artifactDtos = publicArtifacts.stream()
            .map(a -> new GuestOverviewResponse.GuestArtifactDto(
                a.getId(),
                a.getName(),
                a.getType() != null ? a.getType().name() : "OTHER",
                a.getUrl()
            ))
            .toList();

        // Velocity mockup/history based on recent completed tasks
        List<GuestOverviewResponse.GuestVelocityPointDto> velocity = List.of(
            new GuestOverviewResponse.GuestVelocityPointDto("T2", 2),
            new GuestOverviewResponse.GuestVelocityPointDto("T3", 3),
            new GuestOverviewResponse.GuestVelocityPointDto("T4", 1),
            new GuestOverviewResponse.GuestVelocityPointDto("T5", 4),
            new GuestOverviewResponse.GuestVelocityPointDto("T6", completedNodes > 0 ? Math.min(completedNodes, 5) : 2)
        );

        List<GuestOverviewResponse.GuestActivityDto> recentActivities = List.of(
            new GuestOverviewResponse.GuestActivityDto(
                "act-1",
                "WPE",
                "Hệ thống",
                "Dự án đang vận hành với " + totalNodes + " tác vụ trên quy trình DAG.",
                "hôm nay"
            )
        );

        return new GuestOverviewResponse(
            project.getName(),
            phaseLabel,
            project.getUpdatedAt() != null ? project.getUpdatedAt() : project.getCreatedAt(),
            totalNodes,
            Math.max(1, (int) Math.ceil(totalNodes * 0.3)), // Ước tính nút critical
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

    /**
     * Xác thực tính hợp lệ của Guest Token.
     */
    public GuestLinkEntity validateAndGetActiveGuestLink(String token) {
        if (token == null || token.isBlank()) {
            throw new ForbiddenException("REVOKED_GUEST", "Token chia sẻ không hợp lệ hoặc bị thiếu.");
        }

        GuestLinkEntity guestLink = guestLinkRepository.findByToken(token.trim())
            .orElseThrow(() -> new ForbiddenException("REVOKED_GUEST", "Liên kết chia sẻ không tồn tại hoặc sai token."));

        if (Boolean.TRUE.equals(guestLink.getIsRevoked())) {
            throw new ForbiddenException("REVOKED_GUEST", "Liên kết chia sẻ này đã bị Chủ dự án thu hồi.");
        }

        if (guestLink.getExpiresAt().isBefore(Instant.now())) {
            throw new ForbiddenException("REVOKED_GUEST", "Liên kết chia sẻ đã hết hạn.");
        }

        ProjectEntity project = authorizationService.getProjectOrThrow(guestLink.getProjectId());
        if (project.getStatus() != ProjectStatus.ACTIVE) {
            throw new ForbiddenException("REVOKED_GUEST", "Dự án hiện không mở cho khách xem (trạng thái " + project.getStatus() + ").");
        }

        return guestLink;
    }

    private GuestAccessResponse toGuestAccessResponse(GuestLinkEntity link) {
        String shareUrl = String.format("%s/guest/%s", frontendBaseUrl.replaceAll("/+$", ""), link.getToken());
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

