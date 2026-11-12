package com.pipeline.wpe.service;

import com.pipeline.wpe.common.enums.InvitationStatus;
import com.pipeline.wpe.common.enums.ProjectRole;
import com.pipeline.wpe.common.enums.SystemRole;
import com.pipeline.wpe.dto.event.InvitationAcceptedEvent;
import com.pipeline.wpe.dto.event.InvitationCreatedEvent;
import com.pipeline.wpe.dto.request.project.CreateInvitationRequest;
import com.pipeline.wpe.dto.response.project.InvitationDetailResponse;
import com.pipeline.wpe.dto.response.project.InvitationResponse;
import com.pipeline.wpe.entity.NotificationEntity;
import com.pipeline.wpe.entity.ProjectEntity;
import com.pipeline.wpe.entity.ProjectInvitationEntity;
import com.pipeline.wpe.entity.ProjectMemberEntity;
import com.pipeline.wpe.entity.UserEntity;
import com.pipeline.wpe.exception.ConflictException;
import com.pipeline.wpe.exception.ForbiddenException;
import com.pipeline.wpe.exception.ResourceNotFoundException;
import com.pipeline.wpe.repository.NotificationRepository;
import com.pipeline.wpe.repository.ProjectInvitationRepository;
import com.pipeline.wpe.repository.ProjectMemberRepository;
import com.pipeline.wpe.repository.ProjectRepository;
import com.pipeline.wpe.repository.UserRepository;
import com.pipeline.wpe.service.event.WorkflowEventPublisher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProjectInvitationService {

    private final ProjectInvitationRepository projectInvitationRepository;
    private final ProjectRepository projectRepository;
    private final UserRepository userRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final ProjectAuthorizationService projectAuthorizationService;
    private final NotificationRepository notificationRepository;
    private final WorkflowEventPublisher workflowEventPublisher;

    @Value("${app.invitation.expiry-days:7}")
    private long expiryDays = 7;

    /**
     * 1. Gửi Lời mời tham gia dự án (Asynchronous Invitation & Notification Deep-Link).
     */
    @Transactional
    public InvitationResponse sendInvitation(Long projectId, CreateInvitationRequest request, Long currentUserId) {
        ProjectEntity project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy dự án với ID: " + projectId));

        // Kiểm tra quyền: Chỉ chủ dự án (OWNER) mới được gửi lời mời
        if (!project.getOwnerId().equals(currentUserId)) {
            throw new ForbiddenException("ACCESS_DENIED", "Chỉ chủ dự án (OWNER) mới được gửi lời mời.");
        }

        if (request.role() == ProjectRole.OWNER) {
            throw new IllegalArgumentException("Không thể mời với vai trò OWNER. Dùng chức năng chuyển quyền sở hữu.");
        }

        UserEntity inviter = userRepository.findById(currentUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người gửi lời mời"));

        String identifier = request.inviteeEmailOrUsername().trim();
        UserEntity invitee = userRepository.findByEmail(identifier)
                .or(() -> userRepository.findByUsername(identifier))
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng với định danh: " + identifier));

        if (invitee.getId().equals(currentUserId)) {
            throw new IllegalArgumentException("Chủ dự án không thể tự gửi lời mời cho chính mình.");
        }

        // Kiểm tra xem đã là thành viên chính thức chưa
        boolean alreadyMember = projectMemberRepository.existsByProjectIdAndUserIdAndRemovedAtIsNull(projectId, invitee.getId());
        if (alreadyMember) {
            throw new IllegalArgumentException("Người dùng " + invitee.getUsername() + " đã là thành viên chính thức của dự án.");
        }

        // Kiểm tra xem đã có lời mời PENDING chưa
        Optional<ProjectInvitationEntity> pendingInvitationOpt = projectInvitationRepository
                .findByProjectIdAndInviteeIdAndStatus(projectId, invitee.getId(), InvitationStatus.PENDING);
        if (pendingInvitationOpt.isPresent()) {
            ProjectInvitationEntity pendingInvitation = pendingInvitationOpt.get();
            if (pendingInvitation.getExpiresAt().isBefore(Instant.now())) {
                pendingInvitation.setStatus(InvitationStatus.EXPIRED);
                pendingInvitation.setRespondedAt(Instant.now());
                projectInvitationRepository.saveAndFlush(pendingInvitation);
            } else {
                throw new ConflictException("INVITATION_ALREADY_PENDING",
                        "Người dùng " + invitee.getUsername() + " đã có một lời mời đang chờ phản hồi.");
            }
        }

        Instant expiresAt = Instant.now().plus(expiryDays, ChronoUnit.DAYS);
        ProjectRole role = request.role() != null ? request.role() : ProjectRole.COLLABORATOR;

        ProjectInvitationEntity invitation = ProjectInvitationEntity.builder()
                .projectId(projectId)
                .inviterId(currentUserId)
                .inviteeId(invitee.getId())
                .role(role)
                .status(InvitationStatus.PENDING)
                .expiresAt(expiresAt)
                .version(0L)
                .build();

        invitation = projectInvitationRepository.save(invitation);
        log.info("Created ProjectInvitation id={} for project={} invitee={}", invitation.getId(), projectId, invitee.getId());

        String inviterName = inviter.getFullName() != null && !inviter.getFullName().isBlank() 
                ? inviter.getFullName() : inviter.getUsername();

        // Chuẩn Deep-link bắt buộc theo SSOT
        String deepLink = "/workspace?action=open-invite-modal&invitationId=" + invitation.getId();

        // 1. Tạo Notification trực tiếp cho Invitee vào bảng notification
        NotificationEntity notification = NotificationEntity.builder()
                .userId(invitee.getId())
                .title("Lời mời tham gia dự án: " + project.getName())
                .message(inviterName + " đã mời bạn tham gia dự án \"" + project.getName() + "\"")
                .linkUrl(deepLink)
                .isRead(false)
                .build();
        notificationRepository.save(notification);

        // 2. Bắn sự kiện bất đồng bộ qua RabbitMQ -> Real-time SSE Stream
        workflowEventPublisher.publishInvitationCreated(new InvitationCreatedEvent(
                invitation.getId(),
                projectId,
                project.getName(),
                currentUserId,
                inviterName,
                invitee.getId(),
                invitee.getEmail(),
                invitation.getRole().name(),
                deepLink,
                invitation.getCreatedAt()
        ));

        return toResponse(invitation, project.getName(), inviterName, invitee.getEmail());
    }

    /**
     * Alias tương thích ngược: createInvitation.
     */
    @Transactional
    public InvitationResponse createInvitation(Long projectId, Long inviterUserId, CreateInvitationRequest request) {
        return sendInvitation(projectId, request, inviterUserId);
    }

    /**
     * 2. Lấy chi tiết lời mời cho Popup Modal ở Frontend.
     */
    @Transactional(readOnly = true)
    public InvitationDetailResponse getInvitationDetail(Long invitationId, Long currentUserId) {
        ProjectInvitationEntity invitation = projectInvitationRepository.findById(invitationId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lời mời với ID: " + invitationId));

        ProjectEntity project = projectRepository.findById(invitation.getProjectId())
                .orElseThrow(() -> new ResourceNotFoundException("Dự án của lời mời không còn tồn tại"));

        UserEntity inviter = userRepository.findById(invitation.getInviterId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy thông tin người mời"));

        String inviterName = inviter.getFullName() != null && !inviter.getFullName().isBlank()
                ? inviter.getFullName() : inviter.getUsername();

        return new InvitationDetailResponse(
                invitation.getId(),
                project.getId(),
                project.getName(),
                project.getDescription(),
                inviterName,
                invitation.getRole(),
                invitation.getStatus(),
                invitation.getExpiresAt()
        );
    }

    /**
     * 3. Người được mời chấp thuận lời mời (Atomic Transaction -> Kết nạp Thành viên).
     */
    @Transactional(noRollbackFor = ConflictException.class)
    public void acceptInvitation(Long invitationId, Long currentUserId) {
        ProjectInvitationEntity invitation = projectInvitationRepository.findById(invitationId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lời mời với ID: " + invitationId));

        if (!invitation.getInviteeId().equals(currentUserId)) {
            throw new ForbiddenException("ACCESS_DENIED", "Bạn không có quyền phản hồi lời mời này.");
        }

        if (invitation.getStatus() != InvitationStatus.PENDING) {
            throw new ConflictException("INVITATION_NOT_PENDING", "Lời mời không ở trạng thái chờ phản hồi (Hiện tại: " + invitation.getStatus() + ").");
        }

        if (invitation.getExpiresAt().isBefore(Instant.now())) {
            invitation.setStatus(InvitationStatus.EXPIRED);
            invitation.setRespondedAt(Instant.now());
            projectInvitationRepository.save(invitation);
            throw new ConflictException("INVITATION_EXPIRED", "Lời mời đã hết hạn.");
        }

        // Cập nhật trạng thái Lời mời sang ACCEPTED
        invitation.setStatus(InvitationStatus.ACCEPTED);
        invitation.setRespondedAt(Instant.now());
        projectInvitationRepository.save(invitation);

        // THỰC HIỆN KẾT NẠP THÀNH VIÊN (Cách B): nếu đã là thành viên thì giữ nguyên, ngược lại tạo dòng mới
        boolean alreadyActiveMember = projectMemberRepository
                .existsByProjectIdAndUserIdAndRemovedAtIsNull(invitation.getProjectId(), currentUserId);

        if (!alreadyActiveMember) {
            ProjectMemberEntity member = ProjectMemberEntity.builder()
                    .projectId(invitation.getProjectId())
                    .userId(currentUserId)
                    .role(invitation.getRole())
                    .joinedAt(Instant.now())
                    .removedAt(null)
                    .build();
            projectMemberRepository.save(member);
        }
        log.info("User id={} accepted invitation id={} and joined project={}", currentUserId, invitationId, invitation.getProjectId());

        // Đánh dấu đã đọc notification liên quan (nếu có)
        notificationRepository.findByUserIdAndIsReadFalseOrderByCreatedAtDesc(currentUserId).stream()
                .filter(n -> n.getLinkUrl() != null && n.getLinkUrl().contains("invitationId=" + invitationId))
                .forEach(n -> {
                    n.setIsRead(true);
                    notificationRepository.save(n);
                });

        ProjectEntity project = projectRepository.findById(invitation.getProjectId()).orElse(null);
        UserEntity invitee = userRepository.findById(currentUserId).orElse(null);

        // Bắn sự kiện chấp thuận lời mời
        workflowEventPublisher.publishInvitationAccepted(new InvitationAcceptedEvent(
                invitation.getId(),
                invitation.getProjectId(),
                project != null ? project.getName() : "Project",
                currentUserId,
                invitee != null ? invitee.getUsername() : "User",
                invitation.getRole().name(),
                Instant.now()
        ));
    }

    /**
     * 4. Người được mời từ chối lời mời.
     */
    @Transactional(noRollbackFor = ConflictException.class)
    public void rejectInvitation(Long invitationId, Long currentUserId) {
        ProjectInvitationEntity invitation = projectInvitationRepository.findById(invitationId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lời mời với ID: " + invitationId));

        if (!invitation.getInviteeId().equals(currentUserId)) {
            throw new ForbiddenException("ACCESS_DENIED", "Bạn không có quyền từ chối lời mời này.");
        }

        if (invitation.getStatus() != InvitationStatus.PENDING) {
            throw new ConflictException("INVITATION_NOT_PENDING", "Lời mời không ở trạng thái chờ phản hồi.");
        }

        if (invitation.getExpiresAt().isBefore(Instant.now())) {
            invitation.setStatus(InvitationStatus.EXPIRED);
            invitation.setRespondedAt(Instant.now());
            projectInvitationRepository.save(invitation);
            throw new ConflictException("INVITATION_EXPIRED", "Lời mời đã hết hạn.");
        }

        invitation.setStatus(InvitationStatus.REJECTED);
        invitation.setRespondedAt(Instant.now());
        projectInvitationRepository.save(invitation);
        log.info("User id={} rejected invitation id={}", currentUserId, invitationId);

        // Đánh dấu đã đọc notification liên quan
        notificationRepository.findByUserIdAndIsReadFalseOrderByCreatedAtDesc(currentUserId).stream()
                .filter(n -> n.getLinkUrl() != null && n.getLinkUrl().contains("invitationId=" + invitationId))
                .forEach(n -> {
                    n.setIsRead(true);
                    notificationRepository.save(n);
                });
    }

    /**
     * 5. Thu hồi lời mời (chỉ Inviter hoặc OWNER dự án).
     */
    @Transactional
    public void revokeInvitation(Long invitationId, Long currentUserId) {
        ProjectInvitationEntity invitation = projectInvitationRepository.findById(invitationId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lời mời với ID: " + invitationId));

        ProjectEntity project = projectRepository.findById(invitation.getProjectId())
                .orElseThrow(() -> new ResourceNotFoundException("Dự án của lời mời không còn tồn tại"));

        boolean isInviter = invitation.getInviterId().equals(currentUserId);
        boolean isOwner = project.getOwnerId().equals(currentUserId);
        boolean isAdmin = userRepository.findById(currentUserId)
                .map(u -> u.getSystemRole() == SystemRole.ADMIN)
                .orElse(false);

        if (!isInviter && !isOwner && !isAdmin) {
            throw new ForbiddenException("ACCESS_DENIED", "Chỉ người gửi lời mời hoặc chủ dự án mới có quyền thu hồi lời mời này.");
        }

        if (invitation.getStatus() != InvitationStatus.PENDING) {
            throw new ConflictException("INVITATION_NOT_PENDING", "Chỉ có thể thu hồi lời mời đang ở trạng thái PENDING.");
        }

        invitation.setStatus(InvitationStatus.REVOKED);
        invitation.setRespondedAt(Instant.now());
        projectInvitationRepository.save(invitation);
        log.info("User id={} revoked invitation id={} in project={}", currentUserId, invitationId, invitation.getProjectId());
    }

    /**
     * Overload tương thích ngược: revokeInvitation với projectId.
     */
    @Transactional
    public void revokeInvitation(Long projectId, Long invitationId, Long currentUserId) {
        revokeInvitation(invitationId, currentUserId);
    }

    /**
     * 6. Lấy danh sách lời mời đang chờ phản hồi của dự án.
     */
    @Transactional(readOnly = true)
    public List<InvitationResponse> getProjectPendingInvitations(Long projectId, Long currentUserId) {
        projectAuthorizationService.verifyProjectMemberOrOwner(projectId, currentUserId);
        ProjectEntity project = projectAuthorizationService.getProjectOrThrow(projectId);

        return projectInvitationRepository.findByProjectIdAndStatus(projectId, InvitationStatus.PENDING)
                .stream()
                .map(inv -> {
                    UserEntity inviter = userRepository.findById(inv.getInviterId()).orElse(null);
                    UserEntity invitee = userRepository.findById(inv.getInviteeId()).orElse(null);
                    String inviterName = inviter != null ? (inviter.getFullName() != null && !inviter.getFullName().isBlank() ? inviter.getFullName() : inviter.getUsername()) : "Owner";
                    String inviteeEmail = invitee != null ? invitee.getEmail() : "Unknown";
                    return toResponse(inv, project.getName(), inviterName, inviteeEmail);
                })
                .toList();
    }

    private InvitationResponse toResponse(ProjectInvitationEntity inv, String projectName, String inviterName, String inviteeEmail) {
        return new InvitationResponse(
                inv.getId(),
                inv.getProjectId(),
                projectName,
                inv.getInviterId(),
                inviterName,
                inv.getInviteeId(),
                inviteeEmail,
                inv.getRole(),
                inv.getStatus(),
                inv.getCreatedAt(),
                inv.getExpiresAt(),
                inv.getVersion()
        );
    }
}
