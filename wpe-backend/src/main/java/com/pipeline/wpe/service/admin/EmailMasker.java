package com.pipeline.wpe.service.admin;

/**
 * A6 — Che email trước khi trả cho Admin (integration map 10.1, data masking).
 * <p>
 * Quy tắc đã chốt: ký tự đầu + {@code ***@} + tên miền, ví dụ {@code alex.kim@pipeline.engine -> a***@pipeline.engine}.
 * <ul>
 *   <li>Phần trước @ chỉ 1 ký tự vẫn thêm {@code ***} để không lộ độ dài thật.</li>
 *   <li>Không có @ (dữ liệu hỏng), null hoặc rỗng: trả {@code ***}, không bao giờ trả lại chuỗi gốc.</li>
 *   <li>Nhiều @: tên miền tính từ @ cuối cùng.</li>
 * </ul>
 * Che ở backend để email thật không bao giờ rời máy chủ (che ở frontend thì vẫn lộ trong tab Network).
 */
public final class EmailMasker {

    static final String MASK = "***";

    private EmailMasker() {}

    public static String mask(String email) {
        if (email == null || email.isBlank()) {
            return MASK;
        }
        String trimmed = email.trim();
        int at = trimmed.lastIndexOf('@');
        if (at < 0) {
            return MASK;
        }
        String domain = trimmed.substring(at + 1);
        if (at == 0) {
            return MASK + "@" + domain;
        }
        return trimmed.charAt(0) + MASK + "@" + domain;
    }
}
