package com.pipeline.wpe.service.profile;

import lombok.Getter;

/**
 * Lỗi 400 riêng của hồ sơ cá nhân, mang mã lỗi cho FE: WRONG_PASSWORD, UNSUPPORTED_MEDIA, FILE_TOO_LARGE.
 * Được UserProfileController tự bắt (@ExceptionHandler cục bộ) vì GlobalExceptionHandler là file dùng chung.
 */
@Getter
public class ProfileBadRequestException extends RuntimeException {

    public static final String WRONG_PASSWORD = "WRONG_PASSWORD";
    public static final String UNSUPPORTED_MEDIA = "UNSUPPORTED_MEDIA";
    public static final String FILE_TOO_LARGE = "FILE_TOO_LARGE";

    private final String errorCode;

    public ProfileBadRequestException(String errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }

    public static ProfileBadRequestException wrongPassword() {
        return new ProfileBadRequestException(WRONG_PASSWORD, "Mật khẩu hiện tại không đúng.");
    }

    public static ProfileBadRequestException unsupportedMedia() {
        return new ProfileBadRequestException(UNSUPPORTED_MEDIA, "Chỉ nhận ảnh PNG, JPEG hoặc WebP.");
    }

    public static ProfileBadRequestException fileTooLarge() {
        return new ProfileBadRequestException(FILE_TOO_LARGE, "Ảnh đại diện tối đa 2MB.");
    }
}
