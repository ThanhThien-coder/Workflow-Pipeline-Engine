package com.pipeline.wpe.service;

import com.pipeline.wpe.common.enums.InvitationStatus;
import com.pipeline.wpe.common.enums.ProjectRole;
import com.pipeline.wpe.dto.event.InvitationAcceptedEvent;
import com.pipeline.wpe.dto.event.InvitationCreatedEvent;
import com.pipeline.wpe.dto.request.project.CreateInvitationRequest;
import com.pipeline.wpe.dto.response.project.InvitationDetailResponse;
import com.pipeline.wpe.dto.response.project.InvitationResponse;
import com.pipeline.wpe.entity.ProjectEntity;
import com.pipeline.wpe.entity.ProjectInvitationEntity;
import com.pipeline.wpe.entity.ProjectMemberEntity;
import com.pipeline.wpe.entity.UserEntity;
import com.pipeline.wpe.exception.ConflictException;
import com.pipeline.wpe.exception.ForbiddenException;
import com.pipeline.wpe.exception.ResourceNotFoundException;
import com.pipeline.wpe.repository.ProjectInvitationRepository;
import com.pipeline.wpe.repository.ProjectMemberRepository;
import com.pipeline.wpe.repository.ProjectRepository;
import com.pipeline.wpe.repository.UserRepository;
import com.pipeline.wpe.service.event.WorkflowEventPublisher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProjectInvitationService {

    private final ProjectInvitationRepository projectInvitationRepository;
    private final ProjectRepository projectRepository;
    private final UserRepository userRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final ProjectAuthorizationService projectAuthorizationService;
    private final WorkflowEventPublisher workflowEventPublisher;

    /**
     * 1. Chủ dự án tạo Lời mời tham gia dự án (Asynchronous Invitation).
     */
    @Transactional
    public InvitationResponse createInvitation(Long projectId, Long inviterUserId, CreateInvitationRequest request) {
        ProjectEntity project = projectAuthorizationService.verifyProjectOwner(projectId, inviterUserId);
        UserEntity inviter = userRepository.findById(inviterUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người gửi lời mời"));

        String identifier = request.inviteeEmailOrUsername().trim();
        UserEntity invitee = userRepository.findByEmail(identifier)
                .or(() -> userRepository.findByUsername(identifier))
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng với định danh: " + identifier));

        if (invitee.getId().equals(inviterUserId)) {
            throw new IllegalArgumentException("Chủ dự án không thể tự gửi lời mời cho chính mình.");
        }

        // Kiểm tra xem đã là thành viên chính thức chưa
        boolean alreadyMember = projectMemberRepository.existsByProjectIdAndUserIdAndRemovedAtIsNull(projectId, invitee.getId());
        if (alreadyMember) {
            throw new IllegalArgumentException("Người dùng " + invitee.getUsername() + " đã là thành viên chính thức của dự án.");
        }

        // Kiểm tra xem đã có lời mời PENDING chưa
        boolean alreadyPending = projectInvitationRepository.existsByProjectIdAndInviteeIdAndStatus(
                projectId, invitee.getId(), InvitationStatus.PENDING
        );
        if (alreadyPending) {
            throw new ConflictException("INVITATION_ALREADY_PENDING", 
                    "Người dùng " + invitee.getUsername() + " đã có một lời mời đang chờ phản hồi.");
        }

        Instant expiresAt = Instant.now().plus(7, ChronoUnit.DAYS);
        ProjectInvitationEntity invitation = ProjectInvitationEntity.builder()
                .projectId(projectId)
                .inviterId(inviterUserId)
                .inviteeId(invitee.getId())
                .role(request.role())
                .status(InvitationStatus.PENDING)
                .expiresAt(expiresAt)
                .version(0L)
                .build();

        invitation = projectInvitationRepository.save(invitation);
        log.info("Created ProjectInvitation id={} for project={} invitee={}", invitation.getId(), projectId, invitee.getId());

        // Bắn sự kiện bất đồng bộ qua RabbitMQ -> đẩy Notification với deep-link
        String deepLink = "/workspace?action=open-invite-modal&invitationId=" + invitation.getId();
        workflowEventPublisher.publishInvitationCreated(new InvitationCreatedEvent(
                invitation.getId(),
                projectId,
                project.getName(),
                inviterUserId,
                inviter.getFullName() != null ? inviter.getFullName() : inviter.getUsername(),
                invitee.getId(),
                invitee.getEmail(),
                invitation.getRole().name(),
                deepLink,
                invitation.getCreatedAt()
        ));

        return toResponse(invitation, project.getName(), inviter.getFullName() != null ? inviter.getFullName() : inviter.getUsername(), invitee.getEmail());
    }

    /**
     * 2. Lấy chi tiết lời mời cho Popup Modal.
     */
    @Transactional(readOnly = true)
    public InvitationDetailResponse getInvitationDetail(Long invitationId, Long currentUserId) {
        ProjectInvitationEntity invitation = projectInvitationRepository.findById(invitationId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lời mời với ID: " + invitationId));

        ProjectEntity project = projectRepository.findById(invitation.getProjectId())
                .orElseThrow(() -> new ResourceNotFoundException("Dự án của lời mời không còn tồn tại"));

        UserEntity inviter = userRepository.findById(invitation.getInviterId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy thông tin người mời"));

        return new InvitationDetailResponse(
                invitation.getId(),
                project.getId(),
                project.getName(),
                project.getDescription(),
                inviter.getFullName() != null ? inviter.getFullName() : inviter.getUsername(),
                invitation.getRole(),
                invitation.getStatus(),
                invitation.getExpiresAt()
        );
    }

    /**
     * 3. Người được mời chấp thuận lời mời (Atomic Transaction).
     */
    @Transactional
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
            throw new IllegalArgumentException("Lời mời tham gia dự án đã hết hạn.");
        }

        // Cập nhật trạng thái Lời mời
        invitation.setStatus(InvitationStatus.ACCEPTED);
        invitation.setRespondedAt(Instant.now());
        projectInvitationRepository.save(invitation);

        // Chèn vào bảng PROJECT_MEMBER
        ProjectMemberEntity member = ProjectMemberEntity.builder()
                .projectId(invitation.getProjectId())
                .userId(currentUserId)
                .role(invitation.getRole())
                .joinedAt(Instant.now())
                .build();
        projectMemberRepository.save(member);
        log.info("User id={} accepted invitation id={} and joined project={}", currentUserId, invitationId, invitation.getProjectId());

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
    @Transactional
    public void rejectInvitation(Long invitationId, Long currentUserId) {
        ProjectInvitationEntity invitation = projectInvitationRepository.findById(invitationId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lời mời với ID: " + invitationId));

        if (!invitation.getInviteeId().equals(currentUserId)) {
            throw new ForbiddenException("ACCESS_DENIED", "Bạn không có quyền từ chối lời mời này.");
        }

        if (invitation.getStatus() != InvitationStatus.PENDING) {
            throw new ConflictException("INVITATION_NOT_PENDING", "Lời mời không ở trạng thái chờ phản hồi.");
        }

        invitation.setStatus(InvitationStatus.REJECTED);
        invitation.setRespondedAt(Instant.now());
        projectInvitationRepository.save(invitation);
        log.info("User id={} rejected invitation id={}", currentUserId, invitationId);
    }

    /**
     * 5. Chủ dự án thu hồi lời mời.
     */
    @Transactional
    public void revokeInvitation(Long projectId, Long invitationId, Long currentUserId) {
        projectAuthorizationService.verifyProjectOwner(projectId, currentUserId);

        ProjectInvitationEntity invitation = projectInvitationRepository.findById(invitationId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lời mời với ID: " + invitationId));

        if (!invitation.getProjectId().equals(projectId)) {
            throw new IllegalArgumentException("Lời mời không thuộc dự án này.");
        }

        if (invitation.getStatus() != InvitationStatus.PENDING) {
            throw new ConflictException("INVITATION_NOT_PENDING", "Chỉ có thể thu hồi lời mời đang ở trạng thái PENDING.");
        }

        invitation.setStatus(InvitationStatus.REVOKED);
        invitation.setRespondedAt(Instant.now());
        projectInvitationRepository.save(invitation);
        log.info("Owner id={} revoked invitation id={} in project={}", currentUserId, invitationId, projectId);
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
                    return toResponse(
                            inv,
                            project.getName(),
                            inviter != null ? (inviter.getFullName() != null ? inviter.getFullName() : inviter.getUsername()) : "Owner",
                            invitee != null ? invitee.getEmail() : "Unknown"
                    );
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
