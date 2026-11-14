package com.pipeline.wpe.dto.artifact;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * C4: link tài nguyên chỉ nhận http/https hợp lệ (có host), tối đa 500 ký tự.
 * Chặn javascript: để link không thành chỗ chạy mã khi người khác bấm (XSS).
 */
class ArtifactUrlValidatorTest {

    @ParameterizedTest(name = "[{index}] hợp lệ: {0}")
    @ValueSource(strings = {
        "https://github.com/org/repo/pull/42",
        "http://localhost:3000/api-docs",
        "https://www.figma.com/file/abc?node-id=1-2",
        "HTTPS://docs.google.com/document/d/xyz",
        "  https://notion.so/page  "
    })
    void validUrls(String url) {
        assertThat(ArtifactUrlValidator.isValid(url)).isTrue();
    }

    @ParameterizedTest(name = "[{index}] bị chặn: {0}")
    @ValueSource(strings = {
        "javascript:alert(1)",
        "JavaScript:alert(document.cookie)",
        "data:text/html,<script>alert(1)</script>",
        "ftp://files.example.com/a.zip",
        "http:///thieu-host",
        "https://",
        "github.com/org/repo",
        "https://exa mple.com/co dau cach",
        ""
    })
    void invalidUrls(String url) {
        assertThat(ArtifactUrlValidator.isValid(url)).isFalse();
    }

    @Test
    @DisplayName("null coi là không hợp lệ")
    void nullUrl_invalid() {
        assertThat(ArtifactUrlValidator.isValid(null)).isFalse();
    }

    @Test
    @DisplayName("Đúng 500 ký tự hợp lệ, 501 ký tự bị chặn")
    void lengthLimit() {
        String prefix = "https://example.com/";
        String exactly500 = prefix + "a".repeat(500 - prefix.length());
        String length501 = exactly500 + "a";

        assertThat(exactly500).hasSize(500);
        assertThat(ArtifactUrlValidator.isValid(exactly500)).isTrue();
        assertThat(ArtifactUrlValidator.isValid(length501)).isFalse();
    }
}
