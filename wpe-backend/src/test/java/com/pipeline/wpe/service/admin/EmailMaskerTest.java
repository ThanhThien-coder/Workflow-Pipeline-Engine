package com.pipeline.wpe.service.admin;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class EmailMaskerTest {

    @Test
    @DisplayName("Email bình thường: giữ ký tự đầu + ***@ + tên miền")
    void normalEmail() {
        assertThat(EmailMasker.mask("alex.kim@pipeline.engine")).isEqualTo("a***@pipeline.engine");
        assertThat(EmailMasker.mask("sarah.chen@pipeline.engine")).isEqualTo("s***@pipeline.engine");
    }

    @Test
    @DisplayName("Phần trước @ chỉ có 1 ký tự: vẫn thêm *** để không lộ độ dài")
    void singleCharLocalPart() {
        assertThat(EmailMasker.mask("a@x.io")).isEqualTo("a***@x.io");
    }

    @Test
    @DisplayName("Chuỗi không có @: che toàn bộ, không trả lại chuỗi gốc")
    void noAtSign() {
        assertThat(EmailMasker.mask("khongphaiemail")).isEqualTo("***");
    }

    @Test
    @DisplayName("null, rỗng, phần trước @ rỗng: không ném lỗi, không lộ dữ liệu")
    void edgeCases() {
        assertThat(EmailMasker.mask(null)).isEqualTo("***");
        assertThat(EmailMasker.mask("   ")).isEqualTo("***");
        assertThat(EmailMasker.mask("@pipeline.engine")).isEqualTo("***@pipeline.engine");
        // Có nhiều @: tên miền tính từ @ cuối cùng
        assertThat(EmailMasker.mask("a@b@pipeline.engine")).isEqualTo("a***@pipeline.engine");
    }
}
