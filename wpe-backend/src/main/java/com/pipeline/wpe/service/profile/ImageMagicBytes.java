package com.pipeline.wpe.service.profile;

import java.util.Optional;

/**
 * Nhận diện định dạng ảnh bằng magic bytes (chữ ký ở đầu file), không tin Content-Type hay đuôi file
 * do client gửi (hai thứ đó đổi được tùy ý, VD đổi tên .exe/.txt thành .png).
 * <ul>
 *   <li>PNG: {@code 89 50 4E 47}</li>
 *   <li>JPEG: {@code FF D8 FF}</li>
 *   <li>WebP: {@code RIFF} ở byte 0–3 và {@code WEBP} ở byte 8–11</li>
 * </ul>
 */
public final class ImageMagicBytes {

    /** Số byte đầu cần đọc để nhận diện cả 3 định dạng. */
    public static final int HEADER_LENGTH = 12;

    private static final byte[] PNG = {(byte) 0x89, 0x50, 0x4E, 0x47};
    private static final byte[] JPEG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF};
    private static final byte[] RIFF = {'R', 'I', 'F', 'F'};
    private static final byte[] WEBP = {'W', 'E', 'B', 'P'};

    private ImageMagicBytes() {
    }

    public static Optional<ImageType> detect(byte[] header) {
        if (header == null) {
            return Optional.empty();
        }
        if (startsWith(header, 0, PNG)) {
            return Optional.of(ImageType.PNG);
        }
        if (startsWith(header, 0, JPEG)) {
            return Optional.of(ImageType.JPEG);
        }
        if (startsWith(header, 0, RIFF) && startsWith(header, 8, WEBP)) {
            return Optional.of(ImageType.WEBP);
        }
        return Optional.empty();
    }

    private static boolean startsWith(byte[] data, int offset, byte[] signature) {
        if (data.length < offset + signature.length) {
            return false;
        }
        for (int i = 0; i < signature.length; i++) {
            if (data[offset + i] != signature[i]) {
                return false;
            }
        }
        return true;
    }
}
