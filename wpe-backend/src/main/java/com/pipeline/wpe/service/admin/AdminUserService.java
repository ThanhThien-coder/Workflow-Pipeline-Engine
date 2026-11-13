package com.pipeline.wpe.service.admin;

import com.pipeline.wpe.common.enums.ProjectRole;
import com.pipeline.wpe.common.enums.SystemRole;
import com.pipeline.wpe.dto.request.admin.SuspendUserRequest;
import com.pipeline.wpe.dto.response.admin.AdminUserResponse;
import com.pipeline.wpe.entity.UserEntity;
import com.pipeline.wpe.exception.ForbiddenException;
import com.pipeline.wpe.exception.ResourceNotFoundException;
import com.pipeline.wpe.repository.ProjectMemberRepository;
import com.pipeline.wpe.repository.ProjectRepository;
import com.pipeline.wpe.repository.UserRepository;
import com.pipeline.wpe.service.auth.RefreshTokenService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class AdminUserService {

    private final UserRepository userRepository;
    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final RefreshTokenService refreshTokenService;

    @Transactional(readOnly = true)
    public List<AdminUserResponse> listUsers(String query, String status) {
        List<UserEntity> users = userRepository.findAll().stream()
            .sorted(Comparator.comparing(UserEntity::getId))
            .filter(user -> {
                if (query != null && !query.isBlank()) {
                    String q = query.trim().toLowerCase();
                    boolean matchUsername = user.getUsername() != null && user.getUsername().toLowerCase().contains(q);
                    boolean matchFullName = user.getFullName() != null && user.getFullName().toLowerCase().contains(q);
                    boolean matchEmail = user.getEmail() != null && user.getEmail().toLowerCase().contains(q);
                    if (!matchUsername && !matchFullName && !matchEmail) {
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

        return toResponse(saved);
    }

    @Transactional
    public AdminUserResponse unbanUser(Long userId, Long actorUserId) {
        UserEntity user = userRepository.findById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("Người dùng không tồn tại: " + userId));

        user.setIsLocked(false);
        UserEntity saved = userRepository.save(user);

        log.info("Actor {} unbanned user {}", actorUserId, userId);

        return toResponse(saved);
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
