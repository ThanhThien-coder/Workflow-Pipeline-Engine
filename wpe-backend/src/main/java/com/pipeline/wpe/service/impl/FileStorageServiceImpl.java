package com.pipeline.wpe.service.impl;

import com.pipeline.wpe.service.FileStorageService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Slf4j
@Service
public class FileStorageServiceImpl implements FileStorageService {

    private static final long MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
    private static final List<String> ALLOWED_MIME_TYPES = List.of(
            "image/png",
            "image/jpeg",
            "image/jpg",
            "image/webp"
    );
    private static final Path UPLOAD_DIR = Paths.get("uploads", "avatars");

    @Override
    public String storeAvatar(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File tải lên không được để trống");
        }

        if (file.getSize() > MAX_FILE_SIZE) {
            throw new IllegalArgumentException("Dung lượng file vượt quá giới hạn tối đa 2MB");
        }

        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_MIME_TYPES.contains(contentType.toLowerCase(Locale.ROOT))) {
            throw new IllegalArgumentException("Định dạng file không được hỗ trợ. Chỉ chấp nhận PNG, JPG hoặc WebP");
        }

        String extension = switch (contentType.toLowerCase(Locale.ROOT)) {
            case "image/jpeg", "image/jpg" -> ".jpg";
            case "image/webp" -> ".webp";
            default -> ".png";
        };

        try {
            if (!Files.exists(UPLOAD_DIR)) {
                Files.createDirectories(UPLOAD_DIR);
            }

            String fileName = UUID.randomUUID() + extension;
            Path targetLocation = UPLOAD_DIR.resolve(fileName);
            try (var inputStream = file.getInputStream()) {
                Files.copy(inputStream, targetLocation);
            }

            log.info("Lưu file avatar thành công: {}", targetLocation.toAbsolutePath());
            return "/uploads/avatars/" + fileName;
        } catch (IOException ex) {
            log.error("Lỗi khi lưu file avatar: ", ex);
            throw new RuntimeException("Không thể lưu trữ file ảnh đại diện: " + ex.getMessage());
        }
    }
}

