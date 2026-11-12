package com.pipeline.wpe.service.auth;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TokenHasherTest {

    @Test
    @DisplayName("SHA-256 của 'abc' khớp vector chuẩn FIPS 180-2")
    void knownVector_abc() {
        assertThat(TokenHasher.sha256Hex("abc"))
            .isEqualTo("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    }

    @Test
    @DisplayName("SHA-256 của chuỗi rỗng khớp vector chuẩn")
    void knownVector_empty() {
        assertThat(TokenHasher.sha256Hex(""))
            .isEqualTo("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    }

    @Test
    @DisplayName("Kết quả luôn 64 ký tự hex thường, cùng input cùng output, khác input khác output")
    void deterministicLowercaseHex() {
        String a = TokenHasher.sha256Hex("rt_abc");
        assertThat(a).hasSize(64).matches("[0-9a-f]{64}");
        assertThat(TokenHasher.sha256Hex("rt_abc")).isEqualTo(a);
        assertThat(TokenHasher.sha256Hex("rt_abd")).isNotEqualTo(a);
    }

    @Test
    @DisplayName("Input null -> IllegalArgumentException")
    void nullInput_throws() {
        assertThatThrownBy(() -> TokenHasher.sha256Hex(null)).isInstanceOf(IllegalArgumentException.class);
    }
}
