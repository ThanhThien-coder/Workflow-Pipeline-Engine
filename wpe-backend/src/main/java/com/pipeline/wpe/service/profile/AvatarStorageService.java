package com.pipeline.wpe.service.profile;

import com.pipeline.wpe.exception.BadRequestException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.security.SecureRandom;
import java.util.HexFormat;

@Slf4j
@Service
public class AvatarStorageService {

    public static final long MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
    private static final String AVATARS_DIR_NAME = "avatars";
    private static final String AVATAR_URL_PREFIX = "/uploads/avatars/";

    private final String uploadDir;
    private final SecureRandom secureRandom = new SecureRandom();

    public AvatarStorageService(@Value("${app.upload.dir:uploads}") String uploadDir) {
        this.uploadDir = uploadDir;
    }

    public Path getAvatarsDirectory() {
        return Paths.get(uploadDir, AVATARS_DIR_NAME).toAbsolutePath().normalize();
    }

    /**
     * Lưu ảnh đại diện mới vào <app.upload.dir>/avatars/<userId>-<16_hex>.<ext>.
     */
    public String storeAvatar(Long userId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("VALIDATION_FAILED", "Tệp ảnh không được để trống.");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new BadRequestException("FILE_TOO_LARGE", "Kích thước ảnh vượt quá giới hạn cho phép (tối đa 2MB).");
        }

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            log.error("Không thể đọc dữ liệu ảnh tải lên của user #{}", userId, e);
            throw new BadRequestException("VALIDATION_FAILED", "Không thể đọc dữ liệu tệp tải lên.");
        }

        ImageTypeDetector.ImageType imageType = ImageTypeDetector.detect(bytes)
            .orElseThrow(() -> new BadRequestException("UNSUPPORTED_MEDIA",
                "Định dạng ảnh không được hỗ trợ. Chỉ chấp nhận PNG, JPEG hoặc WebP."));

        byte[] randomBytes = new byte[8];
        secureRandom.nextBytes(randomBytes);
        String hexRandom = HexFormat.of().formatHex(randomBytes);
        String fileName = userId + "-" + hexRandom + "." + imageType.getExtension();

        Path avatarsDir = getAvatarsDirectory();
        try {
            Files.createDirectories(avatarsDir);
            Path tempFile = Files.createTempFile(avatarsDir, "avatar-upload-", ".tmp");
            try {
                Files.write(tempFile, bytes);
                Path targetPath = avatarsDir.resolve(fileName).normalize();
                Files.move(tempFile, targetPath, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
            } finally {
                Files.deleteIfExists(tempFile);
            }
        } catch (IOException e) {
            log.error("Lỗi khi ghi tệp ảnh đại diện cho user #{}: {}", userId, fileName, e);
            throw new RuntimeException("Không thể lưu ảnh đại diện. Vui lòng thử lại sau.", e);
        }

        return AVATAR_URL_PREFIX + fileName;
    }

    /**
     * Xóa ảnh đại diện cũ. Chống Path Traversal bằng normalize() và startsWith().
     * Lỗi xóa file cũ chỉ ghi log, không làm hỏng request.
     */
    public void deleteAvatar(String avatarUrl) {
        if (avatarUrl == null || !avatarUrl.startsWith(AVATAR_URL_PREFIX)) {
            return;
        }

        String fileName = avatarUrl.substring(AVATAR_URL_PREFIX.length());
        Path avatarsDir = getAvatarsDirectory();
        Path targetPath = avatarsDir.resolve(fileName).normalize();

        if (!targetPath.startsWith(avatarsDir)) {
            log.warn("Cảnh báo bảo mật: Phát hiện đường dẫn không hợp lệ khi xóa ảnh đại diện: {}", avatarUrl);
            return;
        }

        try {
            Files.deleteIfExists(targetPath);
        } catch (Exception e) {
            log.warn("Không thể xóa tệp ảnh đại diện cũ tại: {}", targetPath, e);
        }
    }
}
