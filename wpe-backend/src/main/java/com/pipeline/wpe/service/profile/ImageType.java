package com.pipeline.wpe.service.profile;

/** Ba định dạng ảnh đại diện được nhận (đặc tả A5). */
public enum ImageType {
    PNG("png", "image/png"),
    JPEG("jpg", "image/jpeg"),
    WEBP("webp", "image/webp");

    private final String extension;
    private final String mimeType;

    ImageType(String extension, String mimeType) {
        this.extension = extension;
        this.mimeType = mimeType;
    }

    public String extension() {
        return extension;
    }

    public String mimeType() {
        return mimeType;
    }
}
