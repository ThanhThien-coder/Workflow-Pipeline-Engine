package com.pipeline.wpe.service.profile;

import java.util.Optional;

public final class ImageTypeDetector {

    public enum ImageType {
        PNG("png"),
        JPEG("jpg"),
        WEBP("webp");

        private final String extension;

        ImageType(String extension) {
            this.extension = extension;
        }

        public String getExtension() {
            return extension;
        }
    }

    private ImageTypeDetector() {}

    /**
     * Nhận diện loại ảnh thông qua magic bytes đầu tệp.
     * Trả về Optional rỗng nếu không phải PNG, JPEG hoặc WebP.
     */
    public static Optional<ImageType> detect(byte[] header) {
        if (header == null || header.length < 3) {
            return Optional.empty();
        }

        // PNG: 89 50 4E 47
        if (header.length >= 4
            && (header[0] & 0xFF) == 0x89
            && (header[1] & 0xFF) == 0x50
            && (header[2] & 0xFF) == 0x4E
            && (header[3] & 0xFF) == 0x47) {
            return Optional.of(ImageType.PNG);
        }

        // JPEG: FF D8 FF
        if ((header[0] & 0xFF) == 0xFF
            && (header[1] & 0xFF) == 0xD8
            && (header[2] & 0xFF) == 0xFF) {
            return Optional.of(ImageType.JPEG);
        }

        // WebP: RIFF (bytes 0-3) và WEBP (bytes 8-11)
        if (header.length >= 12
            && header[0] == 'R' && header[1] == 'I' && header[2] == 'F' && header[3] == 'F'
            && header[8] == 'W' && header[9] == 'E' && header[10] == 'B' && header[11] == 'P') {
            return Optional.of(ImageType.WEBP);
        }

        return Optional.empty();
    }
}
