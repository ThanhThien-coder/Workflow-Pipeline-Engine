package com.pipeline.wpe.admin;

import com.pipeline.wpe.service.admin.EmailMasker;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class EmailMaskerTest {

    @Test
    @DisplayName("Email thường - che phần sau ký tự đầu tiên trước dấu @")
    void testMask_regularEmail() {
        String masked = EmailMasker.mask("alex.kim@pipeline.engine");
        assertThat(masked).isEqualTo("a***@pipeline.engine");
    }

    @Test
    @DisplayName("Phần trước @ chỉ có 1 ký tự")
    void testMask_singleCharBeforeAt() {
        String masked = EmailMasker.mask("a@x.com");
        assertThat(masked).isEqualTo("a***@x.com");
    }

    @Test
    @DisplayName("Chuỗi không có @ - trả về ***")
    void testMask_noAtSign() {
        String masked = EmailMasker.mask("invalid-email-string");
        assertThat(masked).isEqualTo("***");
    }

    @Test
    @DisplayName("Chuỗi null hoặc rỗng hoặc bắt đầu bằng @ - trả về ***")
    void testMask_nullOrEmptyOrLeadingAt() {
        assertThat(EmailMasker.mask(null)).isEqualTo("***");
        assertThat(EmailMasker.mask("")).isEqualTo("***");
        assertThat(EmailMasker.mask("@domain.com")).isEqualTo("***");
    }
}
