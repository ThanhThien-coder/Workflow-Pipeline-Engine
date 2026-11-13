package com.pipeline.wpe.service.profile;

import com.pipeline.wpe.common.enums.SystemRole;
import com.pipeline.wpe.dto.request.profile.ChangePasswordRequest;
import com.pipeline.wpe.dto.request.profile.ProfileLinksRequest;
import com.pipeline.wpe.dto.request.profile.UpdateProfileRequest;
import com.pipeline.wpe.dto.response.profile.ProfileResponse;
import com.pipeline.wpe.entity.UserEntity;
import com.pipeline.wpe.exception.ConflictException;
import com.pipeline.wpe.repository.RefreshTokenRepository;
import com.pipeline.wpe.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ProfileServiceTest {

    // cost 4 cho test chạy nhanh
    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder(4);

    @Mock
    private UserRepository userRepository;
    @Mock
    private RefreshTokenRepository refreshTokenRepository;

    @TempDir
    Path uploadDir;

    private ProfileService service;
    private UserEntity sarah;

    @BeforeEach
    void setUp() {
        service = new ProfileService(userRepository, refreshTokenRepository, passwordEncoder,
            new AvatarStorage(uploadDir.toString()));
        sarah = UserEntity.builder()
            .id(2L).username("sarah.chen").email("sarah.chen@pipeline.engine").fullName("Sarah Chen")
            .passwordHash(passwordEncoder.encode("OldPassword1"))
            .systemRole(SystemRole.USER).isLocked(false).tokenVersion(3).build();
        when(userRepository.findById(2L)).thenReturn(Optional.of(sarah));
        when(userRepository.save(any(UserEntity.class))).thenAnswer(inv -> inv.getArgument(0));
        when(userRepository.saveAndFlush(any(UserEntity.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private UpdateProfileRequest updateRequest(String email) {
        return new UpdateProfileRequest("Sarah C.", email, "Project Lead", "Hello",
            List.of("React", "Spring Boot"),
            new ProfileLinksRequest("https://github.com/sarah", "", null));
    }

    private Path avatarsDir() {
        return uploadDir.resolve("avatars");
    }

    private long avatarFileCount() throws IOException {
        if (!Files.exists(avatarsDir())) {
            return 0;
        }
        try (Stream<Path> files = Files.list(avatarsDir())) {
            return files.count();
        }
    }

    // ───────────── Hồ sơ ─────────────

    @Test
    @DisplayName("getMyProfile: user mới (cột hồ sơ trống) -> giá trị mặc định đúng kiểu ProfileDto")
    void getMyProfile_defaults() {
        ProfileResponse res = service.getMyProfile(2L);

        assertThat(res.userId()).isEqualTo("2");
        assertThat(res.displayName()).isEqualTo("Sarah Chen");
        assertThat(res.email()).isEqualTo("sarah.chen@pipeline.engine");
        assertThat(res.title()).isEmpty();
        assertThat(res.bio()).isEmpty();
        assertThat(res.avatarUrl()).isNull();
        assertThat(res.skills()).isEmpty();
        assertThat(res.links()).isEqualTo(new ProfileResponse.Links("", "", ""));
        assertThat(res.privacy()).isEqualTo(new ProfileResponse.Privacy("members", false, true));
        assertThat(res.projects()).isEmpty();
        assertThat(res.recentActivity()).isEmpty();
    }

    @Test
    @DisplayName("getMyProfile: chưa có full_name -> displayName lấy username")
    void getMyProfile_displayNameFallback() {
        sarah.setFullName(null);
        assertThat(service.getMyProfile(2L).displayName()).isEqualTo("sarah.chen");
    }

    @Test
    @DisplayName("updateProfile: lưu họ tên, email, chức danh, tiểu sử, kỹ năng, liên kết")
    void updateProfile_ok() {
        when(userRepository.findByEmail("sarah.new@pipeline.engine")).thenReturn(Optional.empty());

        ProfileResponse res = service.updateProfile(2L, updateRequest("  sarah.new@pipeline.engine "));

        assertThat(sarah.getFullName()).isEqualTo("Sarah C.");
        assertThat(sarah.getEmail()).isEqualTo("sarah.new@pipeline.engine");
        assertThat(sarah.getTitle()).isEqualTo("Project Lead");
        assertThat(sarah.getBio()).isEqualTo("Hello");
        assertThat(sarah.getSkills()).containsExactly("React", "Spring Boot");
        assertThat(sarah.getLinks()).isEqualTo(Map.of("github", "https://github.com/sarah", "linkedin", "", "website", ""));
        verify(userRepository).saveAndFlush(sarah);
        assertThat(res.displayName()).isEqualTo("Sarah C.");
        assertThat(res.links().github()).isEqualTo("https://github.com/sarah");
        assertThat(res.skills()).containsExactly("React", "Spring Boot");
    }

    @Test
    @DisplayName("updateProfile: giữ nguyên email của chính mình -> không báo trùng")
    void updateProfile_sameEmail_ok() {
        when(userRepository.findByEmail("sarah.chen@pipeline.engine")).thenReturn(Optional.of(sarah));

        service.updateProfile(2L, updateRequest("sarah.chen@pipeline.engine"));

        verify(userRepository).saveAndFlush(sarah);
    }

    @Test
    @DisplayName("updateProfile: email đã thuộc user khác -> 409 EMAIL_TAKEN, không lưu")
    void updateProfile_emailTaken() {
        UserEntity alex = UserEntity.builder().id(1L).username("alex.kim").email("alex.kim@pipeline.engine")
            .passwordHash("x").build();
        when(userRepository.findByEmail("alex.kim@pipeline.engine")).thenReturn(Optional.of(alex));

        assertThatThrownBy(() -> service.updateProfile(2L, updateRequest("alex.kim@pipeline.engine")))
            .isInstanceOf(ConflictException.class)
            .extracting("errorCode").isEqualTo("EMAIL_TAKEN");
        verify(userRepository, never()).saveAndFlush(any());
        verify(userRepository, never()).save(any());
        assertThat(sarah.getEmail()).isEqualTo("sarah.chen@pipeline.engine");
    }

    // ───────────── Mật khẩu ─────────────

    @Test
    @DisplayName("changePassword: sai mật khẩu hiện tại -> 400 WRONG_PASSWORD, không đổi gì, không thu hồi phiên")
    void changePassword_wrongCurrent() {
        String oldHash = sarah.getPasswordHash();

        assertThatThrownBy(() -> service.changePassword(2L, new ChangePasswordRequest("WrongPass1", "NewPassword9")))
            .isInstanceOf(ProfileBadRequestException.class)
            .extracting("errorCode").isEqualTo("WRONG_PASSWORD");
        assertThat(sarah.getPasswordHash()).isEqualTo(oldHash);
        assertThat(sarah.getTokenVersion()).isEqualTo(3);
        verify(refreshTokenRepository, never()).revokeAllByUserId(anyLong());
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("changePassword: băm BCrypt mới, token_version + 1, thu hồi mọi refresh token của user")
    void changePassword_revokesSessions() {
        service.changePassword(2L, new ChangePasswordRequest("OldPassword1", "NewPassword9"));

        assertThat(passwordEncoder.matches("NewPassword9", sarah.getPasswordHash())).isTrue();
        assertThat(passwordEncoder.matches("OldPassword1", sarah.getPasswordHash())).isFalse();
        assertThat(sarah.getPasswordHash()).startsWith("$2");
        assertThat(sarah.getTokenVersion()).isEqualTo(4);
        InOrder order = inOrder(userRepository, refreshTokenRepository);
        order.verify(userRepository).save(sarah);
        order.verify(refreshTokenRepository).revokeAllByUserId(2L);
    }

    @Test
    @DisplayName("changePassword chạy trong 1 transaction (@Transactional)")
    void changePassword_isTransactional() throws NoSuchMethodException {
        assertThat(ProfileService.class.getMethod("changePassword", Long.class, ChangePasswordRequest.class)
            .isAnnotationPresent(Transactional.class)).isTrue();
    }

    // ───────────── Ảnh đại diện ─────────────

    @Test
    @DisplayName("uploadAvatar: file .txt đổi tên .png (Content-Type image/png) -> 400 UNSUPPORTED_MEDIA, không ghi file")
    void uploadAvatar_textRenamedPng() throws IOException {
        MockMultipartFile file = new MockMultipartFile("file", "avatar.png", "image/png",
            "this is just a text file".getBytes(StandardCharsets.UTF_8));

        assertThatThrownBy(() -> service.uploadAvatar(2L, file))
            .isInstanceOf(ProfileBadRequestException.class)
            .extracting("errorCode").isEqualTo("UNSUPPORTED_MEDIA");
        assertThat(avatarFileCount()).isZero();
        assertThat(sarah.getAvatarUrl()).isNull();
    }

    @Test
    @DisplayName("uploadAvatar: file rỗng -> 400 UNSUPPORTED_MEDIA")
    void uploadAvatar_empty() {
        MockMultipartFile file = new MockMultipartFile("file", "a.png", "image/png", new byte[0]);

        assertThatThrownBy(() -> service.uploadAvatar(2L, file))
            .extracting("errorCode").isEqualTo("UNSUPPORTED_MEDIA");
    }

    @Test
    @DisplayName("uploadAvatar: ảnh PNG thật trên 2MB -> 400 FILE_TOO_LARGE, không ghi file")
    void uploadAvatar_tooLarge() throws IOException {
        byte[] big = new byte[2 * 1024 * 1024 + 1];
        System.arraycopy(ImageMagicBytesTest.png(), 0, big, 0, ImageMagicBytesTest.png().length);
        MockMultipartFile file = new MockMultipartFile("file", "big.png", "image/png", big);

        assertThatThrownBy(() -> service.uploadAvatar(2L, file))
            .isInstanceOf(ProfileBadRequestException.class)
            .extracting("errorCode").isEqualTo("FILE_TOO_LARGE");
        assertThat(avatarFileCount()).isZero();
    }

    @Test
    @DisplayName("uploadAvatar: PNG hợp lệ -> lưu avatars/2-<ngẫu nhiên>.png, URL /uploads/avatars/...")
    void uploadAvatar_png_ok() throws IOException {
        MockMultipartFile file = new MockMultipartFile("file", "whatever.bin", "application/octet-stream",
            ImageMagicBytesTest.png());

        ProfileResponse res = service.uploadAvatar(2L, file);

        assertThat(res.avatarUrl()).matches("/uploads/avatars/2-[A-Za-z0-9_-]{8,}\\.png");
        assertThat(sarah.getAvatarUrl()).isEqualTo(res.avatarUrl());
        Path saved = avatarsDir().resolve(res.avatarUrl().substring("/uploads/avatars/".length()));
        assertThat(saved).exists();
        assertThat(Files.readAllBytes(saved)).isEqualTo(ImageMagicBytesTest.png());
        verify(userRepository).save(sarah);
    }

    @Test
    @DisplayName("uploadAvatar: đuôi file theo magic bytes (JPEG -> .jpg, WebP -> .webp)")
    void uploadAvatar_extensionFromMagicBytes() {
        String jpg = service.uploadAvatar(2L, new MockMultipartFile("file", "x.png", "image/png", ImageMagicBytesTest.jpeg())).avatarUrl();
        assertThat(jpg).endsWith(".jpg");
        String webp = service.uploadAvatar(2L, new MockMultipartFile("file", "x.jpg", "image/jpeg", ImageMagicBytesTest.webp())).avatarUrl();
        assertThat(webp).endsWith(".webp");
    }

    @Test
    @DisplayName("uploadAvatar lần 2: xóa file ảnh cũ, chỉ còn file mới")
    void uploadAvatar_replacesOldFile() throws IOException {
        String first = service.uploadAvatar(2L, new MockMultipartFile("file", "a.png", "image/png", ImageMagicBytesTest.png())).avatarUrl();
        String second = service.uploadAvatar(2L, new MockMultipartFile("file", "b.jpg", "image/jpeg", ImageMagicBytesTest.jpeg())).avatarUrl();

        assertThat(second).isNotEqualTo(first);
        assertThat(avatarsDir().resolve(first.substring("/uploads/avatars/".length()))).doesNotExist();
        assertThat(avatarsDir().resolve(second.substring("/uploads/avatars/".length()))).exists();
        assertThat(avatarFileCount()).isEqualTo(1);
    }

    @Test
    @DisplayName("removeAvatar: xóa file, avatarUrl = null")
    void removeAvatar_ok() throws IOException {
        String url = service.uploadAvatar(2L, new MockMultipartFile("file", "a.png", "image/png", ImageMagicBytesTest.png())).avatarUrl();

        ProfileResponse res = service.removeAvatar(2L);

        assertThat(res.avatarUrl()).isNull();
        assertThat(sarah.getAvatarUrl()).isNull();
        assertThat(avatarsDir().resolve(url.substring("/uploads/avatars/".length()))).doesNotExist();
        assertThat(avatarFileCount()).isZero();
    }

    @Test
    @DisplayName("avatarUrl cũ không phải /uploads/avatars/<tên> (VD ../../x) -> không xóa file ngoài thư mục avatars")
    void deleteByUrl_ignoresPathTraversal() throws IOException {
        Path outside = Files.writeString(uploadDir.resolve("secret.txt"), "keep me");
        sarah.setAvatarUrl("/uploads/avatars/../secret.txt");

        service.removeAvatar(2L);

        assertThat(outside).exists();
    }
}
