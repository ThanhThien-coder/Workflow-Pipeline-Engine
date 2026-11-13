package com.pipeline.wpe.service.profile;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * Lưu ảnh đại diện ra đĩa: {@code ${app.upload.dir:uploads}/avatars/<userId>-<ngẫu nhiên>.<đuôi>}.
 * URL trả cho FE là {@code /uploads/avatars/<tên file>} (StaticResourceConfig phục vụ thư mục này).
 */
@Slf4j
@Component
public class AvatarStorage {

    public static final String URL_PREFIX = "/uploads/avatars/";

    private static final SecureRandom RANDOM = new SecureRandom();

    private final Path avatarDir;

    public AvatarStorage(@Value("${app.upload.dir:uploads}") String uploadDir) {
        this.avatarDir = Paths.get(uploadDir).toAbsolutePath().normalize().resolve("avatars");
    }

    /** Ghi file mới, trả URL dạng /uploads/avatars/... Tên có phần ngẫu nhiên nên đổi ảnh thì URL đổi (trình duyệt không dùng ảnh cũ trong cache). */
    public String save(Long userId, byte[] content, ImageType type) {
        String fileName = userId + "-" + randomToken() + "." + type.extension();
        try {
            Files.createDirectories(avatarDir);
            Files.write(avatarDir.resolve(fileName), content);
        } catch (IOException e) {
            throw new UncheckedIOException("Không lưu được ảnh đại diện", e);
        }
        return URL_PREFIX + fileName;
    }

    /**
     * Xóa file ứng với URL cũ. Bỏ qua URL không thuộc /uploads/avatars/ hoặc trỏ ra ngoài thư mục avatars
     * (VD "../secret"). Lỗi xóa chỉ ghi log: ảnh mới đã lưu xong, không nên làm hỏng request vì file cũ.
     */
    public void deleteByUrl(String url) {
        if (url == null || !url.startsWith(URL_PREFIX)) {
            return;
        }
        String fileName = url.substring(URL_PREFIX.length());
        if (fileName.isEmpty() || fileName.contains("/") || fileName.contains("\\") || fileName.contains("..")) {
            log.warn("Bỏ qua xóa avatar có đường dẫn lạ: {}", url);
            return;
        }
        Path target = avatarDir.resolve(fileName).normalize();
        if (!target.getParent().equals(avatarDir)) {
            return;
        }
        try {
            Files.deleteIfExists(target);
        } catch (IOException e) {
            log.warn("Không xóa được avatar cũ {}: {}", target, e.getMessage());
        }
    }

    private static String randomToken() {
        byte[] bytes = new byte[12];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
