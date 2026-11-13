package com.pipeline.wpe.service.profile;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

class ImageMagicBytesTest {

    static byte[] bytes(int... values) {
        byte[] out = new byte[values.length];
        for (int i = 0; i < values.length; i++) {
            out[i] = (byte) values[i];
        }
        return out;
    }

    /** Đầu file PNG thật: 89 50 4E 47 0D 0A 1A 0A + vài byte IHDR. */
    static byte[] png() {
        return bytes(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52);
    }

    static byte[] jpeg() {
        return bytes(0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01);
    }

    /** RIFF <4 byte kích thước> WEBP VP8 */
    static byte[] webp() {
        return bytes('R', 'I', 'F', 'F', 0x24, 0x00, 0x00, 0x00, 'W', 'E', 'B', 'P', 'V', 'P', '8', ' ');
    }

    @Test
    @DisplayName("PNG 89 50 4E 47 -> PNG")
    void png_detected() {
        assertThat(ImageMagicBytes.detect(png())).contains(ImageType.PNG);
    }

    @Test
    @DisplayName("JPEG FF D8 FF -> JPEG")
    void jpeg_detected() {
        assertThat(ImageMagicBytes.detect(jpeg())).contains(ImageType.JPEG);
    }

    @Test
    @DisplayName("WebP: RIFF ở byte 0-3 và WEBP ở byte 8-11 -> WEBP")
    void webp_detected() {
        assertThat(ImageMagicBytes.detect(webp())).contains(ImageType.WEBP);
    }

    @Test
    @DisplayName("Nội dung văn bản (file .txt đổi tên .png) -> không nhận")
    void text_rejected() {
        assertThat(ImageMagicBytes.detect("hello, I am not an image".getBytes(StandardCharsets.UTF_8))).isEmpty();
    }

    @Test
    @DisplayName("RIFF nhưng không phải WEBP (file WAV) -> không nhận")
    void riffWave_rejected() {
        byte[] wav = bytes('R', 'I', 'F', 'F', 0x24, 0x00, 0x00, 0x00, 'W', 'A', 'V', 'E', 'f', 'm', 't', ' ');
        assertThat(ImageMagicBytes.detect(wav)).isEmpty();
    }

    @Test
    @DisplayName("Sai 1 byte của PNG / JPEG -> không nhận")
    void nearMiss_rejected() {
        assertThat(ImageMagicBytes.detect(bytes(0x89, 0x50, 0x4E, 0x48, 0x0D, 0x0A, 0x1A, 0x0A))).isEmpty();
        assertThat(ImageMagicBytes.detect(bytes(0xFF, 0xD8, 0xFE, 0xE0))).isEmpty();
    }

    @Test
    @DisplayName("File quá ngắn, rỗng hoặc null -> không nhận, không ném lỗi")
    void tooShort_rejected() {
        assertThat(ImageMagicBytes.detect(bytes(0x89, 0x50, 0x4E))).isEmpty();
        assertThat(ImageMagicBytes.detect(bytes('R', 'I', 'F', 'F', 0, 0, 0, 0, 'W', 'E', 'B'))).isEmpty();
        assertThat(ImageMagicBytes.detect(new byte[0])).isEmpty();
        assertThat(ImageMagicBytes.detect(null)).isEmpty();
    }
}
