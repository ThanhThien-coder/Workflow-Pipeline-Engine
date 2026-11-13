package com.pipeline.wpe.service.admin;

import com.pipeline.wpe.common.enums.ProjectStatus;
import com.pipeline.wpe.common.enums.SystemRole;
import com.pipeline.wpe.dto.request.admin.SuspendUserRequest;
import com.pipeline.wpe.dto.response.admin.AdminUserResponse;
import com.pipeline.wpe.dto.response.admin.WorkspaceOverviewResponse;
import com.pipeline.wpe.entity.ProjectEntity;
import com.pipeline.wpe.entity.UserEntity;
import com.pipeline.wpe.exception.ForbiddenException;
import com.pipeline.wpe.exception.ResourceNotFoundException;
import com.pipeline.wpe.repository.ProjectRepository;
import com.pipeline.wpe.repository.RefreshTokenRepository;
import com.pipeline.wpe.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * A6 — Quản trị người dùng và workspace cho System Admin (integration map 10.1, 10.2).
 * <p>
 * Quyền ADMIN được kiểm ở {@code AdminController} bằng {@code @PreAuthorize}. Service này chỉ đọc
 * metadata dự án (đếm thành viên, đếm node), không phụ thuộc NodeRepository hay ArtifactRepository,
 * nên không có đường nào trả tiêu đề hay nội dung task cho Admin (system-overview Phân hệ 5 mục 4).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminService {

    public static final String CANNOT_SUSPEND_ADMIN = "CANNOT_SUSPEND_ADMIN";

    private final UserRepository userRepository;
    private final ProjectRepository projectRepository;
    private final RefreshTokenRepository refreshTokenRepository;

    // ------------------------------------------------------------------ users

    @Transactional(readOnly = true)
    public List<AdminUserResponse> getUsers(String query, String status) {
        Set<Boolean> lockedValues = toLockedValues(status);
        String pattern = toLikePattern(query);

        List<UserEntity> users = userRepository.searchForAdmin(pattern, lockedValues);
        if (users.isEmpty()) {
            return List.of();
        }
        Map<Long, Long> workspaceCounts = countWorkspacesPerUser();
        return users.stream()
            .map(u -> toUserResponse(u, workspaceCounts.getOrDefault(u.getId(), 0L)))
            .toList();
    }

    /**
     * Khóa tài khoản: {@code is_locked = true}, {@code token_version += 1} (access token đang dùng bị
     * JwtAuthFilter bỏ qua ngay ở request kế tiếp), thu hồi mọi refresh token (không làm mới được nữa).
     * <p>
     * {@code durationDays} CHỈ ghi log: DB chưa có cột lưu hạn khóa, khóa tới khi Admin gọi unban.
     */
    @Transactional
    public AdminUserResponse suspendUser(Long userId, SuspendUserRequest request, Long actorId) {
        UserEntity user = findUser(userId);
        if (user.getSystemRole() == SystemRole.ADMIN) {
            throw new ForbiddenException(CANNOT_SUSPEND_ADMIN, "Không được khóa tài khoản có quyền ADMIN.");
        }

        user.setIsLocked(true);
        int currentVersion = user.getTokenVersion() == null ? 0 : user.getTokenVersion();
        user.setTokenVersion(currentVersion + 1);
        UserEntity saved = userRepository.save(user);
        refreshTokenRepository.revokeAllByUserId(user.getId());

        log.info("[ADMIN] admin #{} khoa user #{} ly do='{}' durationDays={} (chua luu han khoa: khoa toi khi unban)",
            actorId, user.getId(), request.reason(), request.durationDays());
        return toUserResponse(saved, countWorkspacesPerUser().getOrDefault(saved.getId(), 0L));
    }

    /** Mở khóa: {@code is_locked = false}. Phiên cũ đã bị thu hồi lúc khóa, user phải đăng nhập lại. */
    @Transactional
    public AdminUserResponse unbanUser(Long userId, Long actorId) {
        UserEntity user = findUser(userId);
        user.setIsLocked(false);
        UserEntity saved = userRepository.save(user);
        log.info("[ADMIN] admin #{} mo khoa user #{}", actorId, user.getId());
        return toUserResponse(saved, countWorkspacesPerUser().getOrDefault(saved.getId(), 0L));
    }

    // ------------------------------------------------------------- workspaces

    @Transactional(readOnly = true)
    public List<WorkspaceOverviewResponse> getWorkspaces() {
        List<ProjectEntity> projects = projectRepository.findAllByOrderByUpdatedAtDesc();
        if (projects.isEmpty()) {
            return List.of();
        }
        Map<Long, Long> memberCounts = toCountMap(projectRepository.countActiveMembersGroupByProject());
        Map<Long, Long> nodeCounts = toCountMap(projectRepository.countNodesGroupByProject());
        Set<Long> ownerIds = projects.stream().map(ProjectEntity::getOwnerId).collect(Collectors.toSet());
        Map<Long, UserEntity> owners = userRepository.findAllById(ownerIds).stream()
            .collect(Collectors.toMap(UserEntity::getId, Function.identity()));

        return projects.stream()
            .map(p -> toWorkspaceResponse(p, owners.get(p.getOwnerId()), memberCounts, nodeCounts))
            .toList();
    }

    /** Lưu trữ dự án: {@code status = ARCHIVED} ({@code updated_at} do @UpdateTimestamp tự cập nhật). */
    @Transactional
    public WorkspaceOverviewResponse archiveWorkspace(Long projectId, Long actorId) {
        ProjectEntity project = projectRepository.findById(projectId)
            .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy dự án #" + projectId));
        project.setStatus(ProjectStatus.ARCHIVED);
        ProjectEntity saved = projectRepository.save(project);
        log.info("[ADMIN] admin #{} luu tru du an #{}", actorId, projectId);

        UserEntity owner = userRepository.findById(saved.getOwnerId()).orElse(null);
        return toWorkspaceResponse(saved, owner,
            toCountMap(projectRepository.countActiveMembersGroupByProject()),
            toCountMap(projectRepository.countNodesGroupByProject()));
    }

    // ---------------------------------------------------------------- helpers

    private UserEntity findUser(Long userId) {
        return userRepository.findById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng #" + userId));
    }

    /** Số dự án mỗi user làm chủ + số dự án đang tham gia mà không làm chủ (không đếm trùng). */
    private Map<Long, Long> countWorkspacesPerUser() {
        Map<Long, Long> counts = new HashMap<>(toCountMap(projectRepository.countProjectsGroupByOwner()));
        toCountMap(projectRepository.countJoinedProjectsGroupByMember())
            .forEach((id, count) -> counts.merge(id, count, Long::sum));
        return counts;
    }

    private static Set<Boolean> toLockedValues(String status) {
        if (status == null || status.isBlank() || "ALL".equalsIgnoreCase(status.trim())) {
            return Set.of(true, false);
        }
        return switch (status.trim().toUpperCase(Locale.ROOT)) {
            case "ACTIVE" -> Set.of(false);
            case "SUSPENDED" -> Set.of(true);
            default -> throw new IllegalArgumentException(
                "status không hợp lệ: '" + status + "'. Chỉ nhận ACTIVE, SUSPENDED hoặc ALL.");
        };
    }

    private static String toLikePattern(String query) {
        if (query == null || query.isBlank()) {
            return "%";
        }
        return "%" + query.trim().toLowerCase(Locale.ROOT) + "%";
    }

    private static Map<Long, Long> toCountMap(List<Object[]> rows) {
        Map<Long, Long> map = new HashMap<>();
        if (rows == null) {
            return map;
        }
        for (Object[] row : rows) {
            if (row == null || row.length < 2 || row[0] == null || row[1] == null) {
                continue;
            }
            map.put(((Number) row[0]).longValue(), ((Number) row[1]).longValue());
        }
        return map;
    }

    private static String displayName(UserEntity u) {
        return u.getFullName() != null && !u.getFullName().isBlank() ? u.getFullName() : u.getUsername();
    }

    private static AdminUserResponse toUserResponse(UserEntity u, long workspaceCount) {
        return new AdminUserResponse(
            String.valueOf(u.getId()),
            u.getUsername(),
            displayName(u),
            EmailMasker.mask(u.getEmail()),
            u.getSystemRole() == null ? SystemRole.USER.name() : u.getSystemRole().name(),
            workspaceCount,
            null, // lastLoginAt: DB chưa lưu
            null, // maskedIp: DB chưa lưu
            Boolean.TRUE.equals(u.getIsLocked()) ? "SUSPENDED" : "ACTIVE"
        );
    }

    private static WorkspaceOverviewResponse toWorkspaceResponse(ProjectEntity p, UserEntity owner,
                                                                 Map<Long, Long> memberCounts,
                                                                 Map<Long, Long> nodeCounts) {
        return new WorkspaceOverviewResponse(
            String.valueOf(p.getId()),
            p.getName(),
            p.getOwnerId() == null ? null : String.valueOf(p.getOwnerId()),
            owner == null ? null : displayName(owner),
            p.getStatus() == null ? null : p.getStatus().name(),
            memberCounts.getOrDefault(p.getId(), 0L),
            nodeCounts.getOrDefault(p.getId(), 0L),
            p.getUpdatedAt()
        );
    }
}
