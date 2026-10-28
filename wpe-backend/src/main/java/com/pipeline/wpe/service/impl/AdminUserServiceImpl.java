package com.pipeline.wpe.service.impl;

import com.pipeline.wpe.common.enums.SystemRole;
import com.pipeline.wpe.common.util.SecurityUtils;
import com.pipeline.wpe.dto.request.user.SuspendUserRequest;
import com.pipeline.wpe.dto.response.user.AdminUserResponse;
import com.pipeline.wpe.entity.UserEntity;
import com.pipeline.wpe.exception.ResourceNotFoundException;
import com.pipeline.wpe.repository.ProjectMemberRepository;
import com.pipeline.wpe.repository.RefreshTokenRepository;
import com.pipeline.wpe.repository.UserRepository;
import com.pipeline.wpe.service.AdminUserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class AdminUserServiceImpl implements AdminUserService {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final ProjectMemberRepository projectMemberRepository;

    @Override
    @Transactional(readOnly = true)
    public List<AdminUserResponse> getUsers(String query, String status) {
        String queryParam = (query != null && !query.isBlank()) ? query.trim() : null;
        String statusParam = (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status.trim()))
                ? status.trim().toUpperCase() : null;

        List<UserEntity> users = userRepository.searchUsers(queryParam, statusParam);

        return users.stream()
                .map(this::mapToAdminUserResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public AdminUserResponse getUserById(Long id) {
        UserEntity user = findUserOrThrow(id);
        return mapToAdminUserResponse(user);
    }

    @Override
    @Transactional
    public AdminUserResponse suspendUser(Long targetUserId, SuspendUserRequest request) {
        Long currentUserId = SecurityUtils.getCurrentUserId();
        UserEntity target = findUserOrThrow(targetUserId);

        // Quy tắc bảo mật: Không được tự khóa chính mình
        if (target.getId().equals(currentUserId)) {
            throw new IllegalArgumentException("Quản trị viên không thể tự khóa tài khoản của chính mình.");
        }

        // Quy tắc bảo mật: Không cho phép khóa tài khoản Super Admin hoặc Admin khác
        if (target.getSystemRole() == SystemRole.ADMIN) {
            throw new IllegalArgumentException("Không được phép khóa tài khoản Quản trị viên hệ thống.");
        }

        // Thực hiện khóa và thu hồi mọi phiên đăng nhập
        target.setIsLocked(true);
        target.setTokenVersion(target.getTokenVersion() + 1);
        UserEntity saved = userRepository.save(target);

        // Đánh dấu toàn bộ refresh token thành revoked
        refreshTokenRepository.revokeAllByUserId(targetUserId);

        log.warn("Admin [ID: {}] đã khóa tài khoản [ID: {}]. Lý do: {}, Ghi chú: {}",
                currentUserId, targetUserId, request.reason(), request.note());

        return mapToAdminUserResponse(saved);
    }

    @Override
    @Transactional
    public AdminUserResponse unbanUser(Long targetUserId) {
        Long currentUserId = SecurityUtils.getCurrentUserId();
        UserEntity target = findUserOrThrow(targetUserId);

        target.setIsLocked(false);
        UserEntity saved = userRepository.save(target);

        log.info("Admin [ID: {}] đã mở khóa tài khoản [ID: {}]", currentUserId, targetUserId);
        return mapToAdminUserResponse(saved);
    }

    private UserEntity findUserOrThrow(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng với ID: " + userId));
    }

    private AdminUserResponse mapToAdminUserResponse(UserEntity user) {
        int workspaceCount = (int) projectMemberRepository.countByUserIdAndRemovedAtIsNull(user.getId());

        String roleStr;
        if (user.getSystemRole() == SystemRole.ADMIN) {
            roleStr = (user.getId() == 1L) ? "SUPER_ADMIN" : "ADMIN";
        } else {
            roleStr = "STANDARD_USER";
        }

        String statusStr = Boolean.TRUE.equals(user.getIsLocked()) ? "SUSPENDED" : "ACTIVE";
        String lastLogin = user.getLastLoginAt() != null ? user.getLastLoginAt().toString() : user.getCreatedAt().toString();

        return new AdminUserResponse(
                String.valueOf(user.getId()),
                user.getFullName() != null ? user.getFullName() : user.getUsername(),
                maskEmail(user.getEmail()),
                roleStr,
                workspaceCount,
                lastLogin,
                maskIp(user.getLastLoginIp()),
                statusStr
        );
    }

    /**
     * Cơ chế che địa chỉ email nhạy cảm (Data Masking)
     * Ví dụ: alex.kim@pipeline.engine -> al***im@pipeline.engine
     */
    private String maskEmail(String email) {
        if (email == null || !email.contains("@")) {
            return "******";
        }
        int atIndex = email.indexOf('@');
        String local = email.substring(0, atIndex);
        String domain = email.substring(atIndex);

        if (local.length() <= 2) {
            return local.charAt(0) + "***" + domain;
        } else if (local.length() <= 4) {
            return local.substring(0, 1) + "***" + local.substring(local.length() - 1) + domain;
        } else {
            return local.substring(0, 2) + "***" + local.substring(local.length() - 2) + domain;
        }
    }

    /**
     * Cơ chế che địa chỉ IP nhạy cảm (Data Masking)
     * Ví dụ: 172.16.0.42 -> 172.16.0.***
     */
    private String maskIp(String ip) {
        if (ip == null || ip.isBlank()) {
            return "127.0.0.***";
        }
        int lastDot = ip.lastIndexOf('.');
        if (lastDot != -1) {
            return ip.substring(0, lastDot + 1) + "***";
        }
        return "***.***.***.***";
    }
}

