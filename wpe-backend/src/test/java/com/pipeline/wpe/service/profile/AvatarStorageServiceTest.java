package com.pipeline.wpe.service.profile;

import com.pipeline.wpe.exception.BadRequestException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AvatarStorageServiceTest {

    @TempDir
    Path tempDir;

    private AvatarStorageService avatarStorageService;

    private static final byte[] VALID_PNG = new byte[]{(byte) 0x89, (byte) 0x50, (byte) 0x4E, (byte) 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3};

    @BeforeEach
    void setUp() {
        avatarStorageService = new AvatarStorageService(tempDir.toString());
    }

    @Test
    @DisplayName("storeAvatar: lưu đúng thư mục avatars, tên theo mẫu <userId>-<16hex>.png và nội dung khớp")
    void storeAvatar_success() throws IOException {
        MockMultipartFile file = new MockMultipartFile("file", "avatar.png", "image/png", VALID_PNG);

        String avatarUrl = avatarStorageService.storeAvatar(42L, file);

        assertThat(avatarUrl).startsWith("/uploads/avatars/42-");
        assertThat(avatarUrl).endsWith(".png");

        String fileName = avatarUrl.substring("/uploads/avatars/".length());
        Path savedFile = tempDir.resolve("avatars").resolve(fileName);

        assertThat(Files.exists(savedFile)).isTrue();
        assertThat(Files.readAllBytes(savedFile)).isEqualTo(VALID_PNG);
    }

    @Test
    @DisplayName("storeAvatar: tệp rỗng -> 400 VALIDATION_FAILED")
    void storeAvatar_emptyFile_throwsValidationFailed() {
        MockMultipartFile emptyFile = new MockMultipartFile("file", "empty.png", "image/png", new byte[0]);

        assertThatThrownBy(() -> avatarStorageService.storeAvatar(42L, emptyFile))
            .isInstanceOf(BadRequestException.class)
            .hasMessageContaining("is required")
            .satisfies(ex -> assertThat(((BadRequestException) ex).getErrorCode()).isEqualTo("VALIDATION_FAILED"));
    }

    @Test
    @DisplayName("storeAvatar: tệp vượt quá 2MB -> 400 FILE_TOO_LARGE")
    void storeAvatar_fileTooLarge_throwsFileTooLarge() {
        byte[] largeBytes = new byte[(int) (AvatarStorageService.MAX_FILE_SIZE + 10)];
        System.arraycopy(VALID_PNG, 0, largeBytes, 0, VALID_PNG.length);
        MockMultipartFile largeFile = new MockMultipartFile("file", "large.png", "image/png", largeBytes);

        assertThatThrownBy(() -> avatarStorageService.storeAvatar(42L, largeFile))
            .isInstanceOf(BadRequestException.class)
            .hasMessageContaining("too large")
            .satisfies(ex -> assertThat(((BadRequestException) ex).getErrorCode()).isEqualTo("FILE_TOO_LARGE"));
    }

    @Test
    @DisplayName("storeAvatar: định dạng không hỗ trợ (GIF/text) -> 400 UNSUPPORTED_MEDIA")
    void storeAvatar_unsupportedMedia_throwsUnsupportedMedia() {
        byte[] textBytes = "This is a plain text file pretending to be an image".getBytes();
        MockMultipartFile textFile = new MockMultipartFile("file", "fake.png", "image/png", textBytes);

        assertThatThrownBy(() -> avatarStorageService.storeAvatar(42L, textFile))
            .isInstanceOf(BadRequestException.class)
            .hasMessageContaining("Unsupported")
            .satisfies(ex -> assertThat(((BadRequestException) ex).getErrorCode()).isEqualTo("UNSUPPORTED_MEDIA"));
    }

    @Test
    @DisplayName("deleteAvatar: xóa tệp cũ hợp lệ trong thư mục avatars")
    void deleteAvatar_validFile_deleted() throws IOException {
        Path avatarsDir = tempDir.resolve("avatars");
        Files.createDirectories(avatarsDir);
        Path oldFile = avatarsDir.resolve("42-abcdef0123456789.png");
        Files.write(oldFile, VALID_PNG);
        assertThat(Files.exists(oldFile)).isTrue();

        avatarStorageService.deleteAvatar("/uploads/avatars/42-abcdef0123456789.png");

        assertThat(Files.exists(oldFile)).isFalse();
    }

    @Test
    @DisplayName("deleteAvatar: không xóa tệp nằm ngoài thư mục avatars (chống path traversal)")
    void deleteAvatar_pathTraversal_notDeleted() throws IOException {
        Path secretFile = tempDir.resolve("secret.txt");
        Files.writeString(secretFile, "critical data");
        assertThat(Files.exists(secretFile)).isTrue();

        avatarStorageService.deleteAvatar("/uploads/avatars/../secret.txt");

        assertThat(Files.exists(secretFile)).isTrue();
    }

    @Test
    @DisplayName("deleteAvatar: URL null hoặc không khớp tiền tố -> bỏ qua, không lỗi")
    void deleteAvatar_nullOrInvalidPrefix_noop() {
        avatarStorageService.deleteAvatar(null);
        avatarStorageService.deleteAvatar("https://external.com/photo.jpg");
        avatarStorageService.deleteAvatar("/static/img.png");
    }
}
