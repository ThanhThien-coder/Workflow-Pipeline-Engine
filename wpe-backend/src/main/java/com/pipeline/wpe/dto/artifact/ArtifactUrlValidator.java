package com.pipeline.wpe.dto.artifact;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;

/**
 * Kiểm link tài nguyên/minh chứng (C4): chỉ nhận {@code http}/{@code https}, phải có host, tối đa 500 ký tự.
 *
 * <p>Vì sao: link được hiển thị cho cả nhóm và khách bấm vào. Link {@code javascript:...} hay {@code data:...} khi bấm
 * sẽ chạy mã trong trình duyệt người bấm (XSS). Regex "bắt đầu bằng http" là chưa đủ (lọt {@code http:///abc} thiếu host),
 * nên phân tích bằng {@link URI} rồi kiểm scheme và host.
 *
 * <p>Dùng 2 cách: annotation {@link ValidArtifactUrl} trên DTO (lỗi → 400 {@code VALIDATION_FAILED}),
 * hoặc gọi thẳng {@link #isValid(String)} ở chỗ không có {@code @Valid} (nộp bài).
 */
public final class ArtifactUrlValidator implements ConstraintValidator<ValidArtifactUrl, String> {

    public static final int MAX_LENGTH = 500;

    /** Bean Validation: null để {@code @NotBlank} báo, ở đây coi là hợp lệ để không báo trùng 2 lỗi. */
    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        return value == null || isValid(value);
    }

    public static boolean isValid(String url) {
        if (url == null) {
            return false;
        }
        String trimmed = url.trim();
        if (trimmed.isEmpty() || trimmed.length() > MAX_LENGTH) {
            return false;
        }
        try {
            URI uri = new URI(trimmed);
            String scheme = uri.getScheme();
            if (scheme == null) {
                return false;
            }
            String lower = scheme.toLowerCase(Locale.ROOT);
            if (!lower.equals("http") && !lower.equals("https")) {
                return false;
            }
            String host = uri.getHost();
            return host != null && !host.isBlank();
        } catch (URISyntaxException e) {
            return false;
        }
    }
}
