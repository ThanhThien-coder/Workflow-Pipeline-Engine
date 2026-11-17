package com.pipeline.wpe.service.auth;

import com.pipeline.wpe.exception.BadRequestException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PasswordPolicyTest {

    @Test
    @DisplayName("mật khẩu hợp lệ không ném")
    void ok() {
        assertThatCode(() -> PasswordPolicy.validate("abcdefg1")).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("ngắn, không có số, quá 72 byte, null -> WEAK_PASSWORD")
    void weak() {
        for (String p : new String[]{"abc1", "abcdefgh", "a1" + "x".repeat(71), null}) {
            assertThatThrownBy(() -> PasswordPolicy.validate(p))
                .isInstanceOf(BadRequestException.class)
                .satisfies(ex -> {
                    assertThat(((BadRequestException) ex).getErrorCode()).isEqualTo("WEAK_PASSWORD");
                    assertThat(ex.getMessage()).isEqualTo(PasswordPolicy.WEAK_PASSWORD_MESSAGE);
                });
        }
    }
}
