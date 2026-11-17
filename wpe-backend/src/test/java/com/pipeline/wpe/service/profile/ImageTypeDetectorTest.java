package com.pipeline.wpe.service.profile;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class ImageTypeDetectorTest {

    @Test
    @DisplayName("detect: PNG header hợp lệ -> ImageType.PNG (png)")
    void detect_png() {
        byte[] pngBytes = new byte[]{(byte) 0x89, (byte) 0x50, (byte) 0x4E, (byte) 0x47, 0x0D, 0x0A, 0x1A, 0x0A};
        Optional<ImageTypeDetector.ImageType> result = ImageTypeDetector.detect(pngBytes);
        assertThat(result).isPresent();
        assertThat(result.get()).isEqualTo(ImageTypeDetector.ImageType.PNG);
        assertThat(result.get().getExtension()).isEqualTo("png");
    }

    @Test
    @DisplayName("detect: JPEG header hợp lệ -> ImageType.JPEG (jpg)")
    void detect_jpeg() {
        byte[] jpegBytes = new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0x00, 0x10};
        Optional<ImageTypeDetector.ImageType> result = ImageTypeDetector.detect(jpegBytes);
        assertThat(result).isPresent();
        assertThat(result.get()).isEqualTo(ImageTypeDetector.ImageType.JPEG);
        assertThat(result.get().getExtension()).isEqualTo("jpg");
    }

    @Test
    @DisplayName("detect: WebP header hợp lệ (RIFF....WEBP) -> ImageType.WEBP (webp)")
    void detect_webp() {
        byte[] webpBytes = new byte[]{'R', 'I', 'F', 'F', 0x20, 0x00, 0x00, 0x00, 'W', 'E', 'B', 'P', 'V', 'P', '8'};
        Optional<ImageTypeDetector.ImageType> result = ImageTypeDetector.detect(webpBytes);
        assertThat(result).isPresent();
        assertThat(result.get()).isEqualTo(ImageTypeDetector.ImageType.WEBP);
        assertThat(result.get().getExtension()).isEqualTo("webp");
    }

    @Test
    @DisplayName("detect: GIF -> không nhận (empty)")
    void detect_gif_notSupported() {
        byte[] gifBytes = new byte[]{'G', 'I', 'F', '8', '9', 'a'};
        assertThat(ImageTypeDetector.detect(gifBytes)).isEmpty();
    }

    @Test
    @DisplayName("detect: PDF -> không nhận (empty)")
    void detect_pdf_notSupported() {
        byte[] pdfBytes = new byte[]{'%', 'P', 'D', 'F', '-', '1', '.', '4'};
        assertThat(ImageTypeDetector.detect(pdfBytes)).isEmpty();
    }

    @Test
    @DisplayName("detect: file 3 byte không phải JPEG -> không nhận (empty)")
    void detect_3bytes_notJpeg_notSupported() {
        byte[] bytes = new byte[]{1, 2, 3};
        assertThat(ImageTypeDetector.detect(bytes)).isEmpty();
    }

    @Test
    @DisplayName("detect: file 3 byte đúng JPEG FF D8 FF -> nhận diện đúng JPEG")
    void detect_3bytes_jpeg_supported() {
        byte[] bytes = new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF};
        Optional<ImageTypeDetector.ImageType> result = ImageTypeDetector.detect(bytes);
        assertThat(result).isPresent();
        assertThat(result.get()).isEqualTo(ImageTypeDetector.ImageType.JPEG);
    }

    @Test
    @DisplayName("detect: file rỗng hoặc null hoặc quá ngắn -> không nhận (empty)")
    void detect_emptyOrShort_notSupported() {
        assertThat(ImageTypeDetector.detect(new byte[0])).isEmpty();
        assertThat(ImageTypeDetector.detect(null)).isEmpty();
        assertThat(ImageTypeDetector.detect(new byte[]{1, 2})).isEmpty();
    }
}
