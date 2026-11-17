package com.pipeline.wpe.service.profile;

import com.pipeline.wpe.common.enums.NodeStatus;
import com.pipeline.wpe.common.enums.ProjectRole;
import com.pipeline.wpe.common.enums.ProjectStatus;
import com.pipeline.wpe.common.enums.SystemRole;
import com.pipeline.wpe.dto.request.profile.*;
import com.pipeline.wpe.dto.response.auth.AuthResponse;
import com.pipeline.wpe.dto.response.profile.ProfilePrivacyResponse;
import com.pipeline.wpe.dto.response.profile.ProfileProjectResponse;
import com.pipeline.wpe.dto.response.profile.ProfileResponse;
import com.pipeline.wpe.entity.*;
import com.pipeline.wpe.exception.BadRequestException;
import com.pipeline.wpe.exception.ConflictException;
import com.pipeline.wpe.exception.ForbiddenException;
import com.pipeline.wpe.exception.ResourceNotFoundException;
import com.pipeline.wpe.repository.*;
import com.pipeline.wpe.service.auth.AuthService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserProfileServiceTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private ProjectRepository projectRepository;
    @Mock
    private ProjectMemberRepository projectMemberRepository;
    @Mock
    private WorkPhaseRepository workPhaseRepository;
    @Mock
    private NodeRepository nodeRepository;
    @Mock
    private ArtifactRepository artifactRepository;
    @Mock
    private RefreshTokenRepository refreshTokenRepository;
    @Mock
    private AuthService authService;
    @Mock
    private AvatarStorageService avatarStorageService;
    @Mock
    private com.pipeline.wpe.service.mail.AccountEmailService accountEmailService;

    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder(4);

    private UserProfileService userProfileService;

    private UserEntity sampleUser;

    @BeforeEach
    void setUp() {
        userProfileService = new UserProfileService(
            userRepository,
            projectRepository,
            projectMemberRepository,
            workPhaseRepository,
            nodeRepository,
            artifactRepository,
            refreshTokenRepository,
            authService,
            avatarStorageService,
            passwordEncoder,
            accountEmailService
        );

        sampleUser = UserEntity.builder()
            .id(10L)
            .username("alex.dev")
            .email("alex.dev@example.com")
            .fullName("Alex Dev")
            .passwordHash(passwordEncoder.encode("OldPassword123!"))
            .systemRole(SystemRole.USER)
            .isLocked(false)
            .tokenVersion(1)
            .avatarUrl("/uploads/avatars/10-old.png")
            .title("Senior Engineer")
            .bio("Passionate about distributed workflows")
            .skills(new ArrayList<>(List.of("Java", "Spring Boot", "PostgreSQL")))
            .links(new HashMap<>(Map.of("github", "https://github.com/alexdev", "linkedin", "https://linkedin.com/in/alexdev", "website", "https://alex.io")))
            .profilePrivacy(new HashMap<>(Map.of("visibility", "members", "showEmail", false, "showStats", true)))
            .publicProjectIds(new ArrayList<>(List.of(100L)))
            .build();
    }

    // ==========================================
    // 1. Get Profile
    // ==========================================

    @Test
    @DisplayName("getMyProfile: trả về đầy đủ thông tin hồ sơ, danh sách dự án và hoạt động gần đây")
    void getMyProfile_success() {
        when(userRepository.findById(10L)).thenReturn(Optional.of(sampleUser));

        ProjectEntity project = ProjectEntity.builder()
            .id(100L)
            .name("E-commerce Flow")
            .ownerId(10L)
            .status(ProjectStatus.ACTIVE)
            .createdAt(Instant.parse("2026-01-01T00:00:00Z"))
            .updatedAt(Instant.parse("2026-01-02T00:00:00Z"))
            .build();
        when(projectRepository.findAllAccessibleProjects(10L)).thenReturn(List.of(project));

        WorkPhaseEntity rootPhase = WorkPhaseEntity.builder()
            .id(1L)
            .projectId(100L)
            .name("Core Services")
            .orderIndex(0)
            .build();
        when(workPhaseRepository.findByProjectIdInAndParentPhaseIdIsNullOrderByOrderIndexAsc(List.of(100L)))
            .thenReturn(List.of(rootPhase));

        NodeEntity node = NodeEntity.builder()
            .id(201L)
            .projectId(100L)
            .phaseId(1L)
            .code("WPE-001")
            .title("Setup Auth")
            .status(NodeStatus.DONE)
            .assignedUserId(10L)
            .dueDate(Instant.parse("2026-01-10T00:00:00Z"))
            .completedAt(Instant.parse("2026-01-08T00:00:00Z"))
            .build();
        when(nodeRepository.findByProjectIdIn(List.of(100L))).thenReturn(List.of(node));
        when(projectMemberRepository.findByProjectIdIn(List.of(100L))).thenReturn(List.of());
        when(artifactRepository.findByProjectIdIn(List.of(100L))).thenReturn(List.of());

        ProfileResponse res = userProfileService.getMyProfile(10L);

        assertThat(res.userId()).isEqualTo("10");
        assertThat(res.displayName()).isEqualTo("Alex Dev");
        assertThat(res.email()).isEqualTo("alex.dev@example.com");
        assertThat(res.title()).isEqualTo("Senior Engineer");
        assertThat(res.bio()).isEqualTo("Passionate about distributed workflows");
        assertThat(res.avatarUrl()).isEqualTo("/uploads/avatars/10-old.png");
        assertThat(res.skills()).containsExactly("Java", "Spring Boot", "PostgreSQL");
        assertThat(res.links().github()).isEqualTo("https://github.com/alexdev");
        assertThat(res.privacy().visibility()).isEqualTo("members");
        assertThat(res.projects()).hasSize(1);
        ProfileProjectResponse projRes = res.projects().get(0);
        assertThat(projRes.projectId()).isEqualTo("100");
        assertThat(projRes.role()).isEqualTo("Owner");
        assertThat(projRes.isPublic()).isTrue();
        assertThat(projRes.stats().tasksDone()).isEqualTo(1);
        assertThat(projRes.stats().tasksTotal()).isEqualTo(1);
        assertThat(projRes.stats().onTimePct()).isEqualTo(100);
        assertThat(res.recentActivity()).isNotEmpty();
    }

    // ==========================================
    // 2. Update Profile & Validation
    // ==========================================

    @Test
    @DisplayName("updateProfile: cập nhật thành công thông tin hợp lệ")
    void updateProfile_success() {
        when(userRepository.findById(10L)).thenReturn(Optional.of(sampleUser));
        when(userRepository.save(any(UserEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        UpdateProfileRequest req = new UpdateProfileRequest(
            "Alex Nguyen",
            "alex.new@example.com",
            "Lead Architect",
            "Updated bio",
            List.of("Go", "Docker"),
            new ProfileLinksRequest("https://github.com/alexn", "https://linkedin.com/in/alexn", "https://alexn.dev")
        );

        ProfileResponse res = userProfileService.updateProfile(10L, req);

        assertThat(res.displayName()).isEqualTo("Alex Nguyen");
        assertThat(res.email()).isEqualTo("alex.new@example.com");
        assertThat(res.title()).isEqualTo("Lead Architect");
        assertThat(res.bio()).isEqualTo("Updated bio");
        assertThat(res.skills()).containsExactly("Go", "Docker");
        assertThat(res.links().github()).isEqualTo("https://github.com/alexn");
    }

    @Test
    @DisplayName("updateProfile: tên hiển thị dưới 2 ký tự -> 400 VALIDATION_FAILED")
    void updateProfile_displayNameTooShort_throwsValidationFailed() {
        UpdateProfileRequest req = new UpdateProfileRequest(
            "A",
            "alex@example.com",
            "Title",
            "Bio",
            List.of(),
            new ProfileLinksRequest("", "", "")
        );

        assertThatThrownBy(() -> userProfileService.updateProfile(10L, req))
            .isInstanceOf(BadRequestException.class)
            .satisfies(ex -> assertThat(((BadRequestException) ex).getErrorCode()).isEqualTo("VALIDATION_FAILED"));
    }

    @Test
    @DisplayName("updateProfile: email sai định dạng -> 400 VALIDATION_FAILED")
    void updateProfile_invalidEmail_throwsValidationFailed() {
        UpdateProfileRequest req = new UpdateProfileRequest(
            "Alex Dev",
            "not-an-email",
            "Title",
            "Bio",
            List.of(),
            new ProfileLinksRequest("", "", "")
        );

        assertThatThrownBy(() -> userProfileService.updateProfile(10L, req))
            .isInstanceOf(BadRequestException.class)
            .satisfies(ex -> assertThat(((BadRequestException) ex).getErrorCode()).isEqualTo("VALIDATION_FAILED"));
    }

    @Test
    @DisplayName("updateProfile: kỹ năng trùng lặp không phân biệt hoa thường -> 400 VALIDATION_FAILED")
    void updateProfile_duplicateSkills_throwsValidationFailed() {
        UpdateProfileRequest req = new UpdateProfileRequest(
            "Alex Dev",
            "alex@example.com",
            "Title",
            "Bio",
            List.of("Java", "java"),
            new ProfileLinksRequest("", "", "")
        );

        assertThatThrownBy(() -> userProfileService.updateProfile(10L, req))
            .isInstanceOf(BadRequestException.class)
            .satisfies(ex -> assertThat(((BadRequestException) ex).getErrorCode()).isEqualTo("VALIDATION_FAILED"));
    }

    @Test
    @DisplayName("updateProfile: liên kết GitHub sai domain -> 400 INVALID_LINK")
    void updateProfile_invalidGithubLink_throwsInvalidLink() {
        UpdateProfileRequest req = new UpdateProfileRequest(
            "Alex Dev",
            "alex@example.com",
            "Title",
            "Bio",
            List.of("Java"),
            new ProfileLinksRequest("https://gitlab.com/alexdev", "", "")
        );

        assertThatThrownBy(() -> userProfileService.updateProfile(10L, req))
            .isInstanceOf(BadRequestException.class)
            .satisfies(ex -> assertThat(((BadRequestException) ex).getErrorCode()).isEqualTo("INVALID_LINK"));
    }

    @Test
    @DisplayName("updateProfile: liên kết LinkedIn sai domain -> 400 INVALID_LINK")
    void updateProfile_invalidLinkedInLink_throwsInvalidLink() {
        UpdateProfileRequest req = new UpdateProfileRequest(
            "Alex Dev",
            "alex@example.com",
            "Title",
            "Bio",
            List.of("Java"),
            new ProfileLinksRequest("", "https://facebook.com/alexdev", "")
        );

        assertThatThrownBy(() -> userProfileService.updateProfile(10L, req))
            .isInstanceOf(BadRequestException.class)
            .satisfies(ex -> assertThat(((BadRequestException) ex).getErrorCode()).isEqualTo("INVALID_LINK"));
    }

    @Test
    @DisplayName("updateProfile: email bị trùng với người dùng khác -> 409 EMAIL_TAKEN")
    void updateProfile_emailTaken_throwsConflict() {
        when(userRepository.findById(10L)).thenReturn(Optional.of(sampleUser));
        UserEntity otherUser = UserEntity.builder().id(99L).email("other@example.com").build();
        when(userRepository.findByEmailIgnoreCase("other@example.com")).thenReturn(Optional.of(otherUser));

        UpdateProfileRequest req = new UpdateProfileRequest(
            "Alex Dev",
            "other@example.com",
            "Title",
            "Bio",
            List.of("Java"),
            new ProfileLinksRequest("", "", "")
        );

        assertThatThrownBy(() -> userProfileService.updateProfile(10L, req))
            .isInstanceOf(ConflictException.class)
            .satisfies(ex -> assertThat(((ConflictException) ex).getErrorCode()).isEqualTo("EMAIL_TAKEN"));
    }

    // ==========================================
    // 3. Change Password
    // ==========================================

    @Test
    @DisplayName("changePassword: đổi mật khẩu thành công -> tăng tokenVersion, thu hồi token cũ, cấp phiên mới")
    void changePassword_success() {
        when(userRepository.findById(10L)).thenReturn(Optional.of(sampleUser));
        when(userRepository.save(any(UserEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        AuthResponse expectedAuth = new AuthResponse("new-jwt", "new-rt", null);
        when(authService.issueSession(any(UserEntity.class))).thenReturn(expectedAuth);

        ChangePasswordRequest req = new ChangePasswordRequest("OldPassword123!", "NewPassword456!");
        AuthResponse res = userProfileService.changePassword(10L, req);

        assertThat(res).isEqualTo(expectedAuth);
        assertThat(sampleUser.getTokenVersion()).isEqualTo(2);
        assertThat(passwordEncoder.matches("NewPassword456!", sampleUser.getPasswordHash())).isTrue();
        verify(refreshTokenRepository).revokeAllByUserId(10L);
        verify(authService).issueSession(sampleUser);
    }

    @Test
    @DisplayName("changePassword: thành công -> lên lịch gửi email xác nhận; thất bại -> không gửi")
    void changePassword_schedulesConfirmationEmail() {
        when(userRepository.findById(10L)).thenReturn(Optional.of(sampleUser));
        when(userRepository.save(any(UserEntity.class))).thenAnswer(inv -> inv.getArgument(0));
        when(authService.issueSession(any(UserEntity.class))).thenReturn(new AuthResponse("new-jwt", "new-rt", null));

        userProfileService.changePassword(10L, new ChangePasswordRequest("OldPassword123!", "NewPassword456!"));

        verify(accountEmailService).sendPasswordChangedAfterCommit(
            eq(10L), eq(sampleUser.getEmail()), eq(sampleUser.getFullName()), eq(sampleUser.getUsername()), any(Instant.class));

        clearInvocations(accountEmailService);
        assertThatThrownBy(() -> userProfileService.changePassword(10L, new ChangePasswordRequest("OldPassword123!", "short")))
            .isInstanceOf(BadRequestException.class);
        verifyNoInteractions(accountEmailService);
    }

    @Test
    @DisplayName("changePassword: mật khẩu hiện tại không đúng -> 400 WRONG_PASSWORD")
    void changePassword_wrongCurrentPassword_throwsWrongPassword() {
        when(userRepository.findById(10L)).thenReturn(Optional.of(sampleUser));

        ChangePasswordRequest req = new ChangePasswordRequest("WrongPass123!", "NewPassword456!");

        assertThatThrownBy(() -> userProfileService.changePassword(10L, req))
            .isInstanceOf(BadRequestException.class)
            .satisfies(ex -> assertThat(((BadRequestException) ex).getErrorCode()).isEqualTo("WRONG_PASSWORD"));
    }

    @Test
    @DisplayName("changePassword: mật khẩu mới quá yếu (< 8 ký tự hoặc không có số) -> 400 WEAK_PASSWORD")
    void changePassword_weakNewPassword_throwsWeakPassword() {
        when(userRepository.findById(10L)).thenReturn(Optional.of(sampleUser));

        ChangePasswordRequest reqShort = new ChangePasswordRequest("OldPassword123!", "Pass1!");
        assertThatThrownBy(() -> userProfileService.changePassword(10L, reqShort))
            .isInstanceOf(BadRequestException.class)
            .satisfies(ex -> assertThat(((BadRequestException) ex).getErrorCode()).isEqualTo("WEAK_PASSWORD"));

        ChangePasswordRequest reqNoDigit = new ChangePasswordRequest("OldPassword123!", "PasswordNoDigits!");
        assertThatThrownBy(() -> userProfileService.changePassword(10L, reqNoDigit))
            .isInstanceOf(BadRequestException.class)
            .satisfies(ex -> assertThat(((BadRequestException) ex).getErrorCode()).isEqualTo("WEAK_PASSWORD"));
    }

    @Test
    @DisplayName("changePassword: mật khẩu mới trùng mật khẩu cũ -> 400 SAME_PASSWORD")
    void changePassword_samePassword_throwsSamePassword() {
        when(userRepository.findById(10L)).thenReturn(Optional.of(sampleUser));

        ChangePasswordRequest req = new ChangePasswordRequest("OldPassword123!", "OldPassword123!");

        assertThatThrownBy(() -> userProfileService.changePassword(10L, req))
            .isInstanceOf(BadRequestException.class)
            .satisfies(ex -> assertThat(((BadRequestException) ex).getErrorCode()).isEqualTo("SAME_PASSWORD"));
    }

    // ==========================================
    // 4. Avatar Management
    // ==========================================

    @Test
    @DisplayName("uploadAvatar: lưu ảnh mới thành công và xóa file ảnh cũ")
    void uploadAvatar_success() {
        when(userRepository.findById(10L)).thenReturn(Optional.of(sampleUser));
        when(userRepository.save(any(UserEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        MockMultipartFile file = new MockMultipartFile("file", "test.png", "image/png", new byte[]{1, 2, 3});
        when(avatarStorageService.storeAvatar(10L, file)).thenReturn("/uploads/avatars/10-new.png");

        ProfileResponse res = userProfileService.uploadAvatar(10L, file);

        assertThat(res.avatarUrl()).isEqualTo("/uploads/avatars/10-new.png");
        verify(avatarStorageService).deleteAvatar("/uploads/avatars/10-old.png");
    }

    @Test
    @DisplayName("removeAvatar: xóa ảnh thành công, đặt avatarUrl = null")
    void removeAvatar_success() {
        when(userRepository.findById(10L)).thenReturn(Optional.of(sampleUser));
        when(userRepository.save(any(UserEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        ProfileResponse res = userProfileService.removeAvatar(10L);

        assertThat(res.avatarUrl()).isNull();
        verify(avatarStorageService).deleteAvatar("/uploads/avatars/10-old.png");
    }

    // ==========================================
    // 5. Privacy Settings
    // ==========================================

    @Test
    @DisplayName("updatePrivacy: cập nhật quyền riêng tư hợp lệ")
    void updatePrivacy_success() {
        when(userRepository.findById(10L)).thenReturn(Optional.of(sampleUser));
        when(userRepository.save(any(UserEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        UpdatePrivacyRequest req = new UpdatePrivacyRequest("public", true, false);
        ProfilePrivacyResponse res = userProfileService.updatePrivacy(10L, req);

        assertThat(res.visibility()).isEqualTo("public");
        assertThat(res.showEmail()).isTrue();
        assertThat(res.showStats()).isFalse();
    }

    @Test
    @DisplayName("updatePrivacy: visibility không hợp lệ -> 400 VALIDATION_FAILED")
    void updatePrivacy_invalidVisibility_throwsValidationFailed() {
        UpdatePrivacyRequest req = new UpdatePrivacyRequest("global", true, true);

        assertThatThrownBy(() -> userProfileService.updatePrivacy(10L, req))
            .isInstanceOf(BadRequestException.class)
            .satisfies(ex -> assertThat(((BadRequestException) ex).getErrorCode()).isEqualTo("VALIDATION_FAILED"));
    }

    // ==========================================
    // 6. Set Project Public & 404 Checks
    // ==========================================

    @Test
    @DisplayName("setProjectPublic: dự án không thuộc sở hữu và user không phải thành viên -> 404 ResourceNotFound")
    void setProjectPublic_notMember_throws404() {
        when(userRepository.findById(10L)).thenReturn(Optional.of(sampleUser));
        ProjectEntity project = ProjectEntity.builder().id(999L).ownerId(888L).build();
        when(projectRepository.findById(999L)).thenReturn(Optional.of(project));
        when(projectMemberRepository.existsByProjectIdAndUserIdAndRemovedAtIsNull(999L, 10L)).thenReturn(false);

        assertThatThrownBy(() -> userProfileService.setProjectPublic(10L, 999L, true))
            .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("setProjectPublic: user là thành viên -> cập nhật publicProjectIds thành công")
    void setProjectPublic_success() {
        when(userRepository.findById(10L)).thenReturn(Optional.of(sampleUser));
        ProjectEntity project = ProjectEntity.builder().id(999L).ownerId(888L).name("Collab Project").status(ProjectStatus.PLANNING).build();
        when(projectRepository.findById(999L)).thenReturn(Optional.of(project));
        when(projectMemberRepository.existsByProjectIdAndUserIdAndRemovedAtIsNull(999L, 10L)).thenReturn(true);
        when(workPhaseRepository.findByProjectIdAndParentPhaseIdIsNullOrderByOrderIndexAsc(999L)).thenReturn(List.of());
        when(nodeRepository.findByProjectId(999L)).thenReturn(List.of());
        when(projectMemberRepository.findByProjectIdAndRemovedAtIsNull(999L)).thenReturn(List.of(
            ProjectMemberEntity.builder().projectId(999L).userId(10L).role(ProjectRole.COLLABORATOR).build()
        ));

        ProfileProjectResponse res = userProfileService.setProjectPublic(10L, 999L, true);

        assertThat(res.projectId()).isEqualTo("999");
        assertThat(res.isPublic()).isTrue();
        assertThat(sampleUser.getPublicProjectIds()).contains(999L);
    }

    // ==========================================
    // 7. Deactivate & Delete Account
    // ==========================================

    @Test
    @DisplayName("deactivateAccount: user ADMIN không được tự vô hiệu hóa -> 403 ADMIN_SELF_SERVICE")
    void deactivateAccount_admin_throwsForbidden() {
        sampleUser.setSystemRole(SystemRole.ADMIN);
        when(userRepository.findById(10L)).thenReturn(Optional.of(sampleUser));

        assertThatThrownBy(() -> userProfileService.deactivateAccount(10L))
            .isInstanceOf(ForbiddenException.class)
            .satisfies(ex -> assertThat(((ForbiddenException) ex).getErrorCode()).isEqualTo("ADMIN_SELF_SERVICE"));
    }

    @Test
    @DisplayName("deactivateAccount: user thường thành công -> đặt deactivatedAt, tăng tokenVersion, thu hồi tokens")
    void deactivateAccount_success() {
        when(userRepository.findById(10L)).thenReturn(Optional.of(sampleUser));

        userProfileService.deactivateAccount(10L);

        assertThat(sampleUser.getDeactivatedAt()).isNotNull();
        assertThat(sampleUser.getTokenVersion()).isEqualTo(2);
        verify(refreshTokenRepository).revokeAllByUserId(10L);
    }

    @Test
    @DisplayName("deleteAccount: sai từ khóa xác nhận -> 400 CONFIRMATION_MISMATCH")
    void deleteAccount_confirmationMismatch_throwsBadRequest() {
        DeleteAccountRequest req = new DeleteAccountRequest("delete");

        assertThatThrownBy(() -> userProfileService.deleteAccount(10L, req))
            .isInstanceOf(BadRequestException.class)
            .satisfies(ex -> assertThat(((BadRequestException) ex).getErrorCode()).isEqualTo("CONFIRMATION_MISMATCH"));
    }

    @Test
    @DisplayName("deleteAccount: ADMIN không thể xóa -> 403 ADMIN_SELF_SERVICE")
    void deleteAccount_admin_throwsForbidden() {
        sampleUser.setSystemRole(SystemRole.ADMIN);
        when(userRepository.findById(10L)).thenReturn(Optional.of(sampleUser));

        DeleteAccountRequest req = new DeleteAccountRequest("DELETE");
        assertThatThrownBy(() -> userProfileService.deleteAccount(10L, req))
            .isInstanceOf(ForbiddenException.class)
            .satisfies(ex -> assertThat(((ForbiddenException) ex).getErrorCode()).isEqualTo("ADMIN_SELF_SERVICE"));
    }

    @Test
    @DisplayName("deleteAccount: đang sở hữu dự án -> 409 OWNS_PROJECTS")
    void deleteAccount_ownsProjects_throwsConflict() {
        when(userRepository.findById(10L)).thenReturn(Optional.of(sampleUser));
        when(projectRepository.countByOwnerId(10L)).thenReturn(2L);

        DeleteAccountRequest req = new DeleteAccountRequest("DELETE");
        assertThatThrownBy(() -> userProfileService.deleteAccount(10L, req))
            .isInstanceOf(ConflictException.class)
            .satisfies(ex -> assertThat(((ConflictException) ex).getErrorCode()).isEqualTo("OWNS_PROJECTS"));
    }

    @Test
    @DisplayName("deleteAccount: thành công -> ẩn danh hóa, xóa ảnh, tăng tokenVersion, xóa membership")
    void deleteAccount_success() {
        when(userRepository.findById(10L)).thenReturn(Optional.of(sampleUser));
        when(projectRepository.countByOwnerId(10L)).thenReturn(0L);

        ProjectMemberEntity membership = ProjectMemberEntity.builder()
            .id(1L).projectId(200L).userId(10L).role(ProjectRole.COLLABORATOR).build();
        when(projectMemberRepository.findByUserIdAndRemovedAtIsNull(10L)).thenReturn(List.of(membership));

        DeleteAccountRequest req = new DeleteAccountRequest("DELETE");
        userProfileService.deleteAccount(10L, req);

        assertThat(sampleUser.getUsername()).isEqualTo("deleted_10");
        assertThat(sampleUser.getEmail()).isEqualTo("deleted-10@deleted.invalid");
        assertThat(sampleUser.getFullName()).isEqualTo("Deleted user");
        assertThat(sampleUser.getTitle()).isNull();
        assertThat(sampleUser.getBio()).isNull();
        assertThat(sampleUser.getSkills()).isEmpty();
        assertThat(sampleUser.getLinks()).isEmpty();
        assertThat(sampleUser.getPublicProjectIds()).isEmpty();
        assertThat(sampleUser.getAvatarUrl()).isNull();
        assertThat(sampleUser.getDeletedAt()).isNotNull();
        assertThat(sampleUser.getTokenVersion()).isEqualTo(2);

        verify(avatarStorageService).deleteAvatar("/uploads/avatars/10-old.png");
        verify(refreshTokenRepository).revokeAllByUserId(10L);
        assertThat(membership.getRemovedAt()).isNotNull();
        verify(projectMemberRepository).saveAll(List.of(membership));
    }

    // ==========================================
    // 8. Phase Label & onTimePct Calculations
    // ==========================================

    @Test
    @DisplayName("phaseLabel & onTimePct: tính toán chính xác nhãn pha và tỷ lệ đúng hạn")
    void phaseLabel_and_onTimePct_calculations() {
        when(userRepository.findById(10L)).thenReturn(Optional.of(sampleUser));

        ProjectEntity projActive = ProjectEntity.builder()
            .id(50L).name("Active Project").ownerId(10L).status(ProjectStatus.ACTIVE).build();
        ProjectEntity projCompleted = ProjectEntity.builder()
            .id(51L).name("Done Project").ownerId(10L).status(ProjectStatus.COMPLETED).build();
        when(projectRepository.findAllAccessibleProjects(10L)).thenReturn(List.of(projActive, projCompleted));

        WorkPhaseEntity p1 = WorkPhaseEntity.builder().id(1L).projectId(50L).name("Discovery").orderIndex(0).build();
        WorkPhaseEntity p2 = WorkPhaseEntity.builder().id(2L).projectId(50L).name("Delivery").orderIndex(1).build();
        when(workPhaseRepository.findByProjectIdInAndParentPhaseIdIsNullOrderByOrderIndexAsc(List.of(50L, 51L)))
            .thenReturn(List.of(p1, p2));

        // Node in p1 is DONE on time
        NodeEntity n1 = NodeEntity.builder()
            .id(1L).projectId(50L).phaseId(1L).code("T-1").title("T1").status(NodeStatus.DONE).assignedUserId(10L)
            .dueDate(Instant.parse("2026-03-01T00:00:00Z")).completedAt(Instant.parse("2026-02-28T00:00:00Z")).build();
        // Node in p1 not assigned to user is DONE
        NodeEntity n2 = NodeEntity.builder()
            .id(2L).projectId(50L).phaseId(1L).code("T-2").title("T2").status(NodeStatus.DONE).assignedUserId(99L).build();
        // Node in p2 is IN_PROGRESS (so p2 is first unfinished phase)
        NodeEntity n3 = NodeEntity.builder()
            .id(3L).projectId(50L).phaseId(2L).code("T-3").title("T3").status(NodeStatus.IN_PROGRESS).assignedUserId(10L)
            .dueDate(Instant.parse("2026-03-10T00:00:00Z")).build();

        when(nodeRepository.findByProjectIdIn(List.of(50L, 51L))).thenReturn(List.of(n1, n2, n3));
        when(projectMemberRepository.findByProjectIdIn(List.of(50L, 51L))).thenReturn(List.of());
        when(artifactRepository.findByProjectIdIn(List.of(50L, 51L))).thenReturn(List.of());

        ProfileResponse res = userProfileService.getMyProfile(10L);

        ProfileProjectResponse activeProjRes = res.projects().stream().filter(p -> p.projectId().equals("50")).findFirst().orElseThrow();
        // p1 has all done nodes, p2 has n3 which is IN_PROGRESS -> phaseLabel = "Phase 2/2 · Delivery"
        assertThat(activeProjRes.phaseLabel()).isEqualTo("Phase 2/2 · Delivery");
        assertThat(activeProjRes.stats().tasksTotal()).isEqualTo(2); // n1 and n3 assigned to 10L
        assertThat(activeProjRes.stats().tasksDone()).isEqualTo(1); // n1 done
        assertThat(activeProjRes.stats().onTimePct()).isEqualTo(100); // 1 on time / 1 done

        ProfileProjectResponse completedProjRes = res.projects().stream().filter(p -> p.projectId().equals("51")).findFirst().orElseThrow();
        assertThat(completedProjRes.phaseLabel()).isEqualTo("Completed");
    }
}
