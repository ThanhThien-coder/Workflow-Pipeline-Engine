package com.pipeline.wpe.service.admin;

import com.pipeline.wpe.common.enums.ProjectRole;
import com.pipeline.wpe.common.enums.SystemRole;
import com.pipeline.wpe.dto.request.admin.SuspendUserRequest;
import com.pipeline.wpe.dto.response.admin.AdminUserResponse;
import com.pipeline.wpe.entity.UserEntity;
import com.pipeline.wpe.exception.ConflictException;
import com.pipeline.wpe.exception.ForbiddenException;
import com.pipeline.wpe.exception.ResourceNotFoundException;
import com.pipeline.wpe.repository.ArtifactRepository;
import com.pipeline.wpe.repository.NodeRepository;
import com.pipeline.wpe.repository.PipelineTemplateRepository;
import com.pipeline.wpe.repository.ProjectInvitationRepository;
import com.pipeline.wpe.repository.ProjectMemberRepository;
import com.pipeline.wpe.repository.ProjectRepository;
import com.pipeline.wpe.repository.UserRepository;
import com.pipeline.wpe.service.auth.RefreshTokenService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class AdminUserService {

    private final UserRepository userRepository;
    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final PipelineTemplateRepository pipelineTemplateRepository;
    private final ArtifactRepository artifactRepository;
    private final ProjectInvitationRepository projectInvitationRepository;
    private final NodeRepository nodeRepository;
    private final RefreshTokenService refreshTokenService;
    private final AdminAuditService adminAuditService;

    /**
     * Không tìm theo email: email trả cho admin đã che, tìm theo email thật sẽ làm lộ email.
     */
    @Transactional(readOnly = true)
    public List<AdminUserResponse> listUsers(String query, String status) {
        List<UserEntity> users = userRepository.findAll().stream()
            .sorted(Comparator.comparing(UserEntity::getId))
            .filter(user -> {
                if (query != null && !query.isBlank()) {
                    String q = query.trim().toLowerCase();
                    boolean matchUsername = user.getUsername() != null && user.getUsername().toLowerCase().contains(q);
                    boolean matchFullName = user.getFullName() != null && user.getFullName().toLowerCase().contains(q);
                    if (!matchUsername && !matchFullName) {
                        return false;
                    }
                }
                if ("ACTIVE".equalsIgnoreCase(status)) {
                    return !Boolean.TRUE.equals(user.getIsLocked());
                } else if ("SUSPENDED".equalsIgnoreCase(status)) {
                    return Boolean.TRUE.equals(user.getIsLocked());
                }
                return true;
            })
            .toList();

        return users.stream()
            .map(this::toResponse)
            .toList();
    }

    @Transactional
    public AdminUserResponse suspendUser(Long userId, SuspendUserRequest request, Long actorUserId) {
        UserEntity user = userRepository.findById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("Người dùng không tồn tại: " + userId));

        if (user.getSystemRole() == SystemRole.ADMIN) {
            throw new ForbiddenException("CANNOT_SUSPEND_ADMIN", "Không thể khóa tài khoản quản trị viên.");
        }

        user.setIsLocked(true);
        int currentTv = user.getTokenVersion() != null ? user.getTokenVersion() : 0;
        user.setTokenVersion(currentTv + 1);
        UserEntity saved = userRepository.save(user);

        refreshTokenService.revokeAllForUser(userId);

        log.info("Actor {} suspended user {}. Reason: {}, durationDays: {}, note: {}",
            actorUserId,
            userId,
            request != null ? request.reason() : null,
            request != null ? request.durationDays() : null,
            request != null ? request.note() : null
        );

        String detail = String.format("reason=%s, durationDays=%s, note=%s",
            request != null && request.reason() != null ? request.reason() : "",
            request != null && request.durationDays() != null ? request.durationDays() : "",
            request != null && request.note() != null ? request.note() : ""
        );
        adminAuditService.record(actorUserId, null, AdminAuditAction.USER_SUSPENDED, "USER", String.valueOf(userId), detail);

        return toResponse(saved);
    }

    @Transactional
    public AdminUserResponse unbanUser(Long userId, Long actorUserId) {
        UserEntity user = userRepository.findById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("Người dùng không tồn tại: " + userId));

        user.setIsLocked(false);
        UserEntity saved = userRepository.save(user);

        log.info("Actor {} unbanned user {}", actorUserId, userId);

        adminAuditService.record(actorUserId, null, AdminAuditAction.USER_UNBANNED, "USER", String.valueOf(userId), null);

        return toResponse(saved);
    }

    @Transactional
    public AdminUserResponse changeRole(Long userId, String role, Long actorUserId) {
        if (role == null || role.isBlank()) {
            throw new IllegalArgumentException("Vai trò không hợp lệ: " + role);
        }
        String normalizedRole = role.trim().toUpperCase();
        if (!"ADMIN".equals(normalizedRole) && !"USER".equals(normalizedRole)) {
            throw new IllegalArgumentException("Vai trò không hợp lệ: " + role);
        }
        SystemRole newRole = SystemRole.valueOf(normalizedRole);

        UserEntity user = userRepository.findById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("Người dùng không tồn tại: " + userId));

        if (user.getSystemRole() == newRole) {
            return toResponse(user);
        }

        if (newRole == SystemRole.ADMIN) {
            if (Boolean.TRUE.equals(user.getIsLocked())) {
                throw new ConflictException("USER_LOCKED", "Tài khoản đang bị khóa, mở khóa trước khi nâng quyền.");
            }
            user.setSystemRole(SystemRole.ADMIN);
            UserEntity saved = userRepository.save(user);

            adminAuditService.record(actorUserId, null, AdminAuditAction.USER_ROLE_CHANGED, "USER", String.valueOf(userId), "USER -> ADMIN");

            return toResponse(saved);
        } else {
            if (userId.equals(actorUserId)) {
                throw new ForbiddenException("CANNOT_DEMOTE_SELF", "Không thể tự hạ quyền của chính mình.");
            }
            List<UserEntity> activeAdmins = userRepository.lockActiveAdmins();
            boolean isActiveAdmin = activeAdmins != null && activeAdmins.stream().anyMatch(u -> u.getId().equals(userId));
            if (isActiveAdmin && activeAdmins.size() <= 1) {
                throw new ConflictException("LAST_ADMIN", "Không thể hạ quản trị viên hoạt động cuối cùng.");
            }

            user.setSystemRole(SystemRole.USER);
            int currentTv = user.getTokenVersion() != null ? user.getTokenVersion() : 0;
            user.setTokenVersion(currentTv + 1);
            UserEntity saved = userRepository.save(user);

            refreshTokenService.revokeAllForUser(userId);

            adminAuditService.record(actorUserId, null, AdminAuditAction.USER_ROLE_CHANGED, "USER", String.valueOf(userId), "ADMIN -> USER");

            return toResponse(saved);
        }
    }

    @Transactional
    public void deleteUser(Long userId, Long actorUserId) {
        UserEntity user = userRepository.findById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("Người dùng không tồn tại: " + userId));

        if (userId.equals(actorUserId)) {
            throw new ForbiddenException("CANNOT_DELETE_SELF", "Không thể tự xóa tài khoản của chính mình.");
        }

        if (user.getSystemRole() == SystemRole.ADMIN) {
            throw new ForbiddenException("CANNOT_DELETE_ADMIN", "Hạ quyền về USER trước khi xóa.");
        }

        long ownedProjects = projectRepository.countByOwnerId(userId);
        long templates = pipelineTemplateRepository.countByCreatedBy(userId);
        long artifacts = artifactRepository.countByUploadedBy(userId);
        long invitations = projectInvitationRepository.countByInviterIdOrInviteeId(userId, userId);
        long memberships = projectMemberRepository.countByUserId(userId);
        long assignedTasks = nodeRepository.countByAssignedUserId(userId);

        long total = ownedProjects + templates + artifacts + invitations + memberships + assignedTasks;
        if (total > 0) {
            List<String> details = new ArrayList<>();
            if (ownedProjects > 0) {
                details.add(ownedProjects + " dự án sở hữu");
            }
            if (templates > 0) {
                details.add(templates + " template đã tạo");
            }
            if (artifacts > 0) {
                details.add(artifacts + " minh chứng đã tải");
            }
            if (invitations > 0) {
                details.add(invitations + " lời mời");
            }
            if (memberships > 0) {
                details.add(memberships + " lần tham gia dự án");
            }
            if (assignedTasks > 0) {
                details.add(assignedTasks + " task được giao");
            }
            String detailMsg = String.join(", ", details);
            throw new ConflictException("USER_HAS_DATA", "Tài khoản đã có dữ liệu (" + detailMsg + "). Hãy khóa tài khoản thay vì xóa.");
        }

        adminAuditService.record(actorUserId, null, AdminAuditAction.USER_DELETED, "USER", String.valueOf(userId), user.getUsername());
        userRepository.delete(user);
    }

    private AdminUserResponse toResponse(UserEntity user) {
        long ownedCount = projectRepository.countByOwnerId(user.getId());
        long joinedCount = projectMemberRepository.countByUserIdAndRemovedAtIsNullAndRoleNot(user.getId(), ProjectRole.OWNER);
        String name = (user.getFullName() != null && !user.getFullName().isBlank()) ? user.getFullName() : user.getUsername();
        String role = user.getSystemRole() != null ? user.getSystemRole().name() : "USER";
        String status = Boolean.TRUE.equals(user.getIsLocked()) ? "SUSPENDED" : "ACTIVE";
        String maskedEmail = EmailMasker.mask(user.getEmail());

        return new AdminUserResponse(
            String.valueOf(user.getId()),
            name,
            user.getUsername(),
            maskedEmail,
            role,
            status,
            ownedCount,
            joinedCount,
            user.getCreatedAt()
        );
    }
}
