package com.pipeline.wpe.service.profile;

import com.pipeline.wpe.common.enums.NodeStatus;
import com.pipeline.wpe.common.enums.ProjectRole;
import com.pipeline.wpe.common.enums.ProjectStatus;
import com.pipeline.wpe.common.enums.SystemRole;
import com.pipeline.wpe.dto.request.profile.*;
import com.pipeline.wpe.dto.response.auth.AuthResponse;
import com.pipeline.wpe.dto.response.profile.*;
import com.pipeline.wpe.entity.*;
import com.pipeline.wpe.exception.BadRequestException;
import com.pipeline.wpe.exception.ConflictException;
import com.pipeline.wpe.exception.ForbiddenException;
import com.pipeline.wpe.exception.ResourceNotFoundException;
import com.pipeline.wpe.repository.*;
import com.pipeline.wpe.service.auth.AuthService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserProfileService {

    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

    private final UserRepository userRepository;
    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final WorkPhaseRepository workPhaseRepository;
    private final NodeRepository nodeRepository;
    private final ArtifactRepository artifactRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final AuthService authService;
    private final AvatarStorageService avatarStorageService;
    private final PasswordEncoder passwordEncoder;
    private final SecureRandom secureRandom = new SecureRandom();

    /**
     * Lấy toàn bộ hồ sơ của người dùng hiện tại (bao gồm dự án tham gia và hoạt động gần đây).
     */
    @Transactional(readOnly = true)
    public ProfileResponse getMyProfile(Long userId) {
        UserEntity user = getUserOrThrow(userId);
        return buildProfileResponse(user);
    }

    /**
     * Cập nhật thông tin cơ bản của hồ sơ.
     */
    @Transactional
    public ProfileResponse updateProfile(Long userId, UpdateProfileRequest request) {
        if (request == null) {
            throw new BadRequestException("VALIDATION_FAILED", "Dữ liệu yêu cầu không được để trống.");
        }

        String displayName = request.displayName() != null ? request.displayName().trim() : "";
        if (displayName.length() < 2 || displayName.length() > 60) {
            throw new BadRequestException("VALIDATION_FAILED", "Tên hiển thị phải có độ dài từ 2 đến 60 ký tự.");
        }

        String email = request.email() != null ? request.email().trim() : "";
        if (email.isEmpty() || email.length() > 255 || !EMAIL_PATTERN.matcher(email).matches()) {
            throw new BadRequestException("VALIDATION_FAILED", "Định dạng email không hợp lệ hoặc vượt quá 255 ký tự.");
        }

        String title = request.title() != null ? request.title().trim() : "";
        if (title.length() > 60) {
            throw new BadRequestException("VALIDATION_FAILED", "Chức danh không được vượt quá 60 ký tự.");
        }

        String bio = request.bio() != null ? request.bio().trim() : "";
        if (bio.length() > 280) {
            throw new BadRequestException("VALIDATION_FAILED", "Tiểu sử không được vượt quá 280 ký tự.");
        }

        List<String> processedSkills = validateAndProcessSkills(request.skills());
        Map<String, String> processedLinks = validateAndProcessLinks(request.links());

        UserEntity user = getUserOrThrow(userId);

        if (!user.getEmail().equalsIgnoreCase(email)) {
            userRepository.findByEmailIgnoreCase(email).ifPresent(other -> {
                if (!other.getId().equals(userId)) {
                    throw new ConflictException("EMAIL_TAKEN", "Email đã được sử dụng bởi người dùng khác.");
                }
            });
        }

        user.setFullName(displayName);
        user.setEmail(email);
        user.setTitle(title);
        user.setBio(bio);
        user.setSkills(processedSkills);
        user.setLinks(processedLinks);

        user = userRepository.save(user);
        log.info("Cập nhật hồ sơ thành công cho user #{}", userId);

        return buildProfileResponse(user);
    }

    /**
     * Đổi mật khẩu trong 1 transaction và cấp cặp token mới cho phiên hiện tại.
     */
    @Transactional
    public AuthResponse changePassword(Long userId, ChangePasswordRequest request) {
        if (request == null || request.currentPassword() == null || request.newPassword() == null) {
            throw new BadRequestException("VALIDATION_FAILED", "Yêu cầu đầy đủ mật khẩu hiện tại và mật khẩu mới.");
        }

        UserEntity user = getUserOrThrow(userId);

        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw new BadRequestException("WRONG_PASSWORD", "Mật khẩu hiện tại không chính xác.");
        }

        String newPassword = request.newPassword();
        if (newPassword.length() < 8 || !newPassword.matches(".*\\d.*") || newPassword.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new BadRequestException("WEAK_PASSWORD", "Mật khẩu mới phải từ 8 ký tự trở lên, chứa ít nhất một chữ số và không quá 72 byte.");
        }

        if (passwordEncoder.matches(newPassword, user.getPasswordHash())) {
            throw new BadRequestException("SAME_PASSWORD", "Mật khẩu mới không được trùng với mật khẩu hiện tại.");
        }

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setTokenVersion(user.getTokenVersion() + 1);
        userRepository.save(user);

        refreshTokenRepository.revokeAllByUserId(user.getId());
        log.info("Đổi mật khẩu thành công cho user #{}. Đã tăng token_version và thu hồi các phiên cũ.", userId);

        return authService.issueSession(user);
    }

    /**
     * Tải lên ảnh đại diện mới.
     */
    @Transactional
    public ProfileResponse uploadAvatar(Long userId, MultipartFile file) {
        UserEntity user = getUserOrThrow(userId);
        String oldAvatarUrl = user.getAvatarUrl();

        String newAvatarUrl = avatarStorageService.storeAvatar(userId, file);
        user.setAvatarUrl(newAvatarUrl);
        user = userRepository.save(user);

        if (oldAvatarUrl != null) {
            avatarStorageService.deleteAvatar(oldAvatarUrl);
        }

        return buildProfileResponse(user);
    }

    /**
     * Xóa ảnh đại diện.
     */
    @Transactional
    public ProfileResponse removeAvatar(Long userId) {
        UserEntity user = getUserOrThrow(userId);
        String oldAvatarUrl = user.getAvatarUrl();

        user.setAvatarUrl(null);
        user = userRepository.save(user);

        if (oldAvatarUrl != null) {
            avatarStorageService.deleteAvatar(oldAvatarUrl);
        }

        return buildProfileResponse(user);
    }

    /**
     * Cập nhật cài đặt quyền riêng tư.
     */
    @Transactional
    public ProfilePrivacyResponse updatePrivacy(Long userId, UpdatePrivacyRequest request) {
        if (request == null || request.visibility() == null || request.showEmail() == null || request.showStats() == null) {
            throw new BadRequestException("VALIDATION_FAILED", "Dữ liệu quyền riêng tư không hợp lệ hoặc thiếu trường bắt buộc.");
        }

        String visibility = request.visibility().trim();
        if (!Set.of("private", "members", "public").contains(visibility)) {
            throw new BadRequestException("VALIDATION_FAILED", "Phạm vi hiển thị chỉ nhận các giá trị: private, members, public.");
        }

        UserEntity user = getUserOrThrow(userId);

        Map<String, Object> privacyMap = new HashMap<>();
        privacyMap.put("visibility", visibility);
        privacyMap.put("showEmail", request.showEmail());
        privacyMap.put("showStats", request.showStats());

        user.setProfilePrivacy(privacyMap);
        userRepository.save(user);

        return new ProfilePrivacyResponse(visibility, request.showEmail(), request.showStats());
    }

    /**
     * Đánh dấu hiển thị / ẩn dự án trên hồ sơ công khai.
     */
    @Transactional
    public ProfileProjectResponse setProjectPublic(Long userId, Long projectId, Boolean isPublic) {
        if (isPublic == null) {
            throw new BadRequestException("VALIDATION_FAILED", "Trường isPublic là bắt buộc.");
        }

        UserEntity user = getUserOrThrow(userId);

        ProjectEntity project = projectRepository.findById(projectId)
            .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy dự án với ID: " + projectId));

        boolean isOwner = project.getOwnerId().equals(userId);
        boolean isActiveMember = isOwner || projectMemberRepository.existsByProjectIdAndUserIdAndRemovedAtIsNull(projectId, userId);
        if (!isActiveMember) {
            throw new ResourceNotFoundException("Không tìm thấy dự án với ID: " + projectId);
        }

        List<Long> publicIds = new ArrayList<>(user.getPublicProjectIds());
        if (Boolean.TRUE.equals(isPublic)) {
            if (!publicIds.contains(projectId)) {
                publicIds.add(projectId);
            }
        } else {
            publicIds.remove(projectId);
        }

        user.setPublicProjectIds(publicIds);
        userRepository.save(user);

        List<WorkPhaseEntity> rootPhases = workPhaseRepository.findByProjectIdAndParentPhaseIdIsNullOrderByOrderIndexAsc(projectId);
        List<NodeEntity> projectNodes = nodeRepository.findByProjectId(projectId);
        List<ProjectMemberEntity> members = projectMemberRepository.findByProjectIdAndRemovedAtIsNull(projectId);

        return mapToProfileProject(project, userId, user.getPublicProjectIds(), rootPhases, projectNodes, members);
    }

    /**
     * Tự vô hiệu hóa tài khoản tạm thời.
     */
    @Transactional
    public void deactivateAccount(Long userId) {
        UserEntity user = getUserOrThrow(userId);
        if (user.getSystemRole() == SystemRole.ADMIN) {
            throw new ForbiddenException("ADMIN_SELF_SERVICE", "Quản trị viên không thể tự vô hiệu hóa hoặc xóa tài khoản.");
        }

        user.setDeactivatedAt(Instant.now());
        user.setTokenVersion(user.getTokenVersion() + 1);
        userRepository.save(user);

        refreshTokenRepository.revokeAllByUserId(user.getId());
        log.info("Vô hiệu hóa tài khoản thành công cho user #{}", userId);
    }

    /**
     * Xóa vĩnh viễn (ẩn danh hóa) tài khoản.
     */
    @Transactional
    public void deleteAccount(Long userId, DeleteAccountRequest request) {
        if (request == null || !"DELETE".equals(request.confirmation())) {
            throw new BadRequestException("CONFIRMATION_MISMATCH", "Xác nhận không khớp. Vui lòng nhập đúng chữ DELETE.");
        }

        UserEntity user = getUserOrThrow(userId);
        if (user.getSystemRole() == SystemRole.ADMIN) {
            throw new ForbiddenException("ADMIN_SELF_SERVICE", "Quản trị viên không thể tự vô hiệu hóa hoặc xóa tài khoản.");
        }

        if (projectRepository.countByOwnerId(userId) > 0) {
            throw new ConflictException("OWNS_PROJECTS", "Hãy chuyển quyền sở hữu hoặc xóa các dự án của bạn trước.");
        }

        if (user.getAvatarUrl() != null) {
            avatarStorageService.deleteAvatar(user.getAvatarUrl());
            user.setAvatarUrl(null);
        }

        user.setUsername("deleted_" + user.getId());
        user.setEmail("deleted-" + user.getId() + "@deleted.invalid");
        user.setFullName("Deleted user");
        user.setTitle(null);
        user.setBio(null);
        user.setSkills(new ArrayList<>());
        user.setLinks(new HashMap<>());
        user.setPublicProjectIds(new ArrayList<>());

        Map<String, Object> privatePrivacy = new HashMap<>();
        privatePrivacy.put("visibility", "private");
        privatePrivacy.put("showEmail", false);
        privatePrivacy.put("showStats", false);
        user.setProfilePrivacy(privatePrivacy);

        byte[] randomBytes = new byte[32];
        secureRandom.nextBytes(randomBytes);
        user.setPasswordHash(passwordEncoder.encode(HexFormat.of().formatHex(randomBytes)));

        user.setDeletedAt(Instant.now());
        user.setTokenVersion(user.getTokenVersion() + 1);
        userRepository.save(user);

        refreshTokenRepository.revokeAllByUserId(user.getId());

        List<ProjectMemberEntity> activeMemberships = projectMemberRepository.findByUserIdAndRemovedAtIsNull(userId);
        Instant now = Instant.now();
        for (ProjectMemberEntity m : activeMemberships) {
            m.setRemovedAt(now);
        }
        projectMemberRepository.saveAll(activeMemberships);

        log.info("Đã ẩn danh hóa tài khoản và thu hồi quyền của user #{}", userId);
    }

    // ==========================================
    // Internal Helper Methods
    // ==========================================

    private UserEntity getUserOrThrow(Long userId) {
        UserEntity user = userRepository.findById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng với ID: " + userId));
        if (user.getDeletedAt() != null) {
            throw new ResourceNotFoundException("Không tìm thấy người dùng với ID: " + userId);
        }
        return user;
    }

    private List<String> validateAndProcessSkills(List<String> rawSkills) {
        if (rawSkills == null) {
            return new ArrayList<>();
        }
        if (rawSkills.size() > 12) {
            throw new BadRequestException("VALIDATION_FAILED", "Số lượng kỹ năng không được vượt quá 12.");
        }

        List<String> result = new ArrayList<>();
        Set<String> lowerSet = new HashSet<>();

        for (String s : rawSkills) {
            String trimmed = s != null ? s.trim() : "";
            if (trimmed.isEmpty() || trimmed.length() > 24) {
                throw new BadRequestException("VALIDATION_FAILED", "Mỗi kỹ năng phải có độ dài từ 1 đến 24 ký tự.");
            }
            if (!lowerSet.add(trimmed.toLowerCase(Locale.ROOT))) {
                throw new BadRequestException("VALIDATION_FAILED", "Danh sách kỹ năng không được chứa phần tử trùng lặp: " + trimmed);
            }
            result.add(trimmed);
        }

        return result;
    }

    private Map<String, String> validateAndProcessLinks(ProfileLinksRequest linksRequest) {
        Map<String, String> linksMap = new HashMap<>();
        String github = "";
        String linkedin = "";
        String website = "";

        if (linksRequest != null) {
            github = linksRequest.github() != null ? linksRequest.github().trim() : "";
            linkedin = linksRequest.linkedin() != null ? linksRequest.linkedin().trim() : "";
            website = linksRequest.website() != null ? linksRequest.website().trim() : "";
        }

        if (!validateUrl(github, "github.com")) {
            throw new BadRequestException("INVALID_LINK", "Liên kết GitHub không hợp lệ (phải thuộc tên miền github.com và tối đa 200 ký tự).");
        }
        if (!validateUrl(linkedin, "linkedin.com")) {
            throw new BadRequestException("INVALID_LINK", "Liên kết LinkedIn không hợp lệ (phải thuộc tên miền linkedin.com và tối đa 200 ký tự).");
        }
        if (!validateUrl(website, null)) {
            throw new BadRequestException("INVALID_LINK", "Liên kết Website không hợp lệ (phải có định dạng http/https và tối đa 200 ký tự).");
        }

        linksMap.put("github", github);
        linksMap.put("linkedin", linkedin);
        linksMap.put("website", website);
        return linksMap;
    }

    private boolean validateUrl(String url, String requiredHost) {
        if (url == null || url.isEmpty()) {
            return true;
        }
        if (url.length() > 200) {
            return false;
        }
        try {
            URI uri = URI.create(url);
            String scheme = uri.getScheme();
            if (scheme == null || (!scheme.equalsIgnoreCase("http") && !scheme.equalsIgnoreCase("https"))) {
                return false;
            }
            String host = uri.getHost();
            if (host == null || host.isBlank()) {
                return false;
            }
            if (requiredHost != null) {
                String lowerHost = host.toLowerCase(Locale.ROOT);
                String lowerRequired = requiredHost.toLowerCase(Locale.ROOT);
                return lowerHost.equals(lowerRequired) || lowerHost.endsWith("." + lowerRequired);
            }
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private ProfileResponse buildProfileResponse(UserEntity user) {
        List<ProjectEntity> accessibleProjects = projectRepository.findAllAccessibleProjects(user.getId());
        List<Long> projectIds = accessibleProjects.stream().map(ProjectEntity::getId).toList();

        Map<Long, List<NodeEntity>> nodesByProject = projectIds.isEmpty() ? Map.of() :
            nodeRepository.findByProjectIdIn(projectIds).stream().collect(Collectors.groupingBy(NodeEntity::getProjectId));

        Map<Long, List<WorkPhaseEntity>> rootPhasesByProject = projectIds.isEmpty() ? Map.of() :
            workPhaseRepository.findByProjectIdInAndParentPhaseIdIsNullOrderByOrderIndexAsc(projectIds).stream()
                .collect(Collectors.groupingBy(WorkPhaseEntity::getProjectId));

        Map<Long, List<ProjectMemberEntity>> membersByProject = projectIds.isEmpty() ? Map.of() :
            projectMemberRepository.findByProjectIdIn(projectIds).stream()
                .filter(m -> m.getRemovedAt() == null)
                .collect(Collectors.groupingBy(ProjectMemberEntity::getProjectId));

        List<ProfileProjectResponse> projectResponses = accessibleProjects.stream()
            .map(p -> mapToProfileProject(
                p,
                user.getId(),
                user.getPublicProjectIds(),
                rootPhasesByProject.getOrDefault(p.getId(), List.of()),
                nodesByProject.getOrDefault(p.getId(), List.of()),
                membersByProject.getOrDefault(p.getId(), List.of())
            ))
            .toList();

        List<ProfileActivityResponse> recentActivity = buildRecentActivity(user.getId(), accessibleProjects, nodesByProject, membersByProject);

        ProfileLinksResponse linksResponse = toProfileLinksResponse(user.getLinks());
        ProfilePrivacyResponse privacyResponse = toProfilePrivacyResponse(user.getProfilePrivacy());

        return new ProfileResponse(
            String.valueOf(user.getId()),
            user.getFullName() != null ? user.getFullName() : "",
            user.getEmail(),
            user.getTitle() != null ? user.getTitle() : "",
            user.getBio() != null ? user.getBio() : "",
            user.getAvatarUrl(),
            user.getSkills(),
            linksResponse,
            privacyResponse,
            projectResponses,
            recentActivity
        );
    }

    private ProfileProjectResponse mapToProfileProject(
        ProjectEntity project,
        Long userId,
        List<Long> publicProjectIds,
        List<WorkPhaseEntity> rootPhases,
        List<NodeEntity> projectNodes,
        List<ProjectMemberEntity> activeMembers
    ) {
        boolean isOwner = project.getOwnerId().equals(userId);
        String role = "Collaborator";
        if (isOwner) {
            role = "Owner";
        } else {
            for (ProjectMemberEntity m : activeMembers) {
                if (m.getUserId().equals(userId)) {
                    if (m.getRole() == ProjectRole.MANAGER) {
                        role = "Manager";
                    }
                    break;
                }
            }
        }

        String phaseLabel = calculatePhaseLabel(project.getStatus(), rootPhases, projectNodes);

        List<NodeEntity> userNodes = projectNodes.stream()
            .filter(n -> Objects.equals(n.getAssignedUserId(), userId))
            .toList();
        int tasksTotal = userNodes.size();
        List<NodeEntity> doneNodes = userNodes.stream()
            .filter(n -> n.getStatus() == NodeStatus.DONE)
            .toList();
        int tasksDone = doneNodes.size();

        int onTimePct = 0;
        if (tasksDone > 0) {
            long onTimeCount = doneNodes.stream()
                .filter(n -> n.getDueDate() == null || (n.getCompletedAt() != null && !n.getCompletedAt().isAfter(n.getDueDate())))
                .count();
            onTimePct = (int) Math.round(100.0 * onTimeCount / tasksDone);
        }

        String contribution;
        if (tasksTotal > 0) {
            contribution = "Completed " + tasksDone + " of " + tasksTotal + " assigned tasks";
        } else if (isOwner) {
            contribution = "Project owner";
        } else {
            contribution = "No tasks assigned yet";
        }

        boolean isPublic = publicProjectIds != null && publicProjectIds.contains(project.getId());

        return new ProfileProjectResponse(
            String.valueOf(project.getId()),
            project.getName(),
            phaseLabel,
            role,
            contribution,
            isPublic,
            new ProfileProjectResponse.Stats(tasksDone, tasksTotal, onTimePct)
        );
    }

    private String calculatePhaseLabel(ProjectStatus status, List<WorkPhaseEntity> rootPhases, List<NodeEntity> projectNodes) {
        if (status == null) {
            return "Active";
        }
        return switch (status) {
            case DRAFT -> "Draft";
            case PLANNING -> "Planning";
            case PAUSED -> "Paused";
            case INACTIVE -> "Inactive";
            case COMPLETED -> "Completed";
            case ARCHIVED -> "Archived";
            case ACTIVE -> {
                if (rootPhases == null || rootPhases.isEmpty()) {
                    yield "Active";
                }
                int n = rootPhases.size();
                for (int k = 1; k <= n; k++) {
                    WorkPhaseEntity phase = rootPhases.get(k - 1);
                    boolean hasUnfinished = projectNodes.stream()
                        .filter(node -> Objects.equals(node.getPhaseId(), phase.getId()))
                        .anyMatch(node -> node.getStatus() != NodeStatus.DONE);
                    if (hasUnfinished) {
                        yield "Phase " + k + "/" + n + " · " + phase.getName();
                    }
                }
                yield "All phases done";
            }
        };
    }

    private List<ProfileActivityResponse> buildRecentActivity(
        Long userId,
        List<ProjectEntity> accessibleProjects,
        Map<Long, List<NodeEntity>> nodesByProject,
        Map<Long, List<ProjectMemberEntity>> membersByProject
    ) {
        Map<Long, String> projectNameMap = accessibleProjects.stream()
            .collect(Collectors.toMap(ProjectEntity::getId, ProjectEntity::getName));
        List<Long> projectIds = accessibleProjects.stream().map(ProjectEntity::getId).toList();

        List<ProfileActivityResponse> activities = new ArrayList<>();

        // 1. Task hoàn thành của user
        for (Map.Entry<Long, List<NodeEntity>> entry : nodesByProject.entrySet()) {
            String projectName = projectNameMap.getOrDefault(entry.getKey(), "dự án");
            for (NodeEntity node : entry.getValue()) {
                if (Objects.equals(node.getAssignedUserId(), userId) && node.getCompletedAt() != null) {
                    activities.add(new ProfileActivityResponse(
                        "task-" + node.getId(),
                        "Completed " + node.getCode() + " " + node.getTitle() + " in " + projectName,
                        node.getCompletedAt()
                    ));
                }
            }
        }

        // 2. Tài liệu / Artifacts do user tải lên
        if (!projectIds.isEmpty()) {
            List<ArtifactEntity> artifacts = artifactRepository.findByProjectIdIn(projectIds);
            for (ArtifactEntity artifact : artifacts) {
                if (Objects.equals(artifact.getUploadedBy(), userId) && artifact.getCreatedAt() != null) {
                    String projectName = projectNameMap.getOrDefault(artifact.getProjectId(), "dự án");
                    activities.add(new ProfileActivityResponse(
                        "artifact-" + artifact.getId(),
                        "Uploaded " + artifact.getName() + " to " + projectName,
                        artifact.getCreatedAt()
                    ));
                }
            }
        }

        // 3. Gia nhập thành viên dự án
        for (Map.Entry<Long, List<ProjectMemberEntity>> entry : membersByProject.entrySet()) {
            String projectName = projectNameMap.getOrDefault(entry.getKey(), "dự án");
            for (ProjectMemberEntity m : entry.getValue()) {
                if (Objects.equals(m.getUserId(), userId) && m.getJoinedAt() != null) {
                    String roleName = m.getRole() == ProjectRole.MANAGER ? "Manager" : "Collaborator";
                    activities.add(new ProfileActivityResponse(
                        "member-" + m.getId(),
                        "Joined " + projectName + " as " + roleName,
                        m.getJoinedAt()
                    ));
                }
            }
        }

        // 4. Dự án sở hữu
        for (ProjectEntity project : accessibleProjects) {
            if (Objects.equals(project.getOwnerId(), userId) && project.getCreatedAt() != null) {
                activities.add(new ProfileActivityResponse(
                    "project-" + project.getId(),
                    "Created project " + project.getName(),
                    project.getCreatedAt()
                ));
            }
        }

        return activities.stream()
            .sorted(Comparator.comparing(ProfileActivityResponse::occurredAt, Comparator.nullsLast(Comparator.reverseOrder())))
            .limit(10)
            .toList();
    }

    private ProfileLinksResponse toProfileLinksResponse(Map<String, String> links) {
        if (links == null) {
            return new ProfileLinksResponse("", "", "");
        }
        return new ProfileLinksResponse(
            links.getOrDefault("github", ""),
            links.getOrDefault("linkedin", ""),
            links.getOrDefault("website", "")
        );
    }

    private ProfilePrivacyResponse toProfilePrivacyResponse(Map<String, Object> privacy) {
        if (privacy == null) {
            return new ProfilePrivacyResponse("members", false, true);
        }
        String visibility = String.valueOf(privacy.getOrDefault("visibility", "members"));
        boolean showEmail = Boolean.TRUE.equals(privacy.get("showEmail"));
        boolean showStats = privacy.get("showStats") == null || Boolean.TRUE.equals(privacy.get("showStats"));
        return new ProfilePrivacyResponse(visibility, showEmail, showStats);
    }
}
