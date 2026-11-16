package com.pipeline.wpe.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DueDateRulesTest {

    // 16/11/2026 10:00 giờ Việt Nam
    private static final Instant CREATED = Instant.parse("2026-11-16T03:00:00Z");

    @Test
    @DisplayName("G21: hạn chót cùng ngày tạo task (cuối ngày giờ VN) được phép")
    void sameDay_allowed() {
        assertThatCode(() -> DueDateRules.requireNotBeforeCreation(Instant.parse("2026-11-16T16:59:59Z"), CREATED))
            .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("G21: hạn chót sau ngày tạo được phép")
    void laterDay_allowed() {
        assertThatCode(() -> DueDateRules.requireNotBeforeCreation(Instant.parse("2026-11-20T16:59:59Z"), CREATED))
            .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("G21: hạn chót trước ngày tạo -> DUE_DATE_BEFORE_CREATED")
    void earlierDay_rejected() {
        assertThatThrownBy(() -> DueDateRules.requireNotBeforeCreation(Instant.parse("2026-11-15T16:59:59Z"), CREATED))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageStartingWith("DUE_DATE_BEFORE_CREATED")
            .hasMessageContaining("2026-11-16");
    }

    @Test
    @DisplayName("G21: so theo ngày giờ VN, không theo ngày UTC (00:30 sáng 16/11 VN vẫn là ngày 16)")
    void comparesVietnamDay() {
        Instant createdEarlyMorningVn = Instant.parse("2026-11-15T17:30:00Z"); // 00:30 16/11 giờ VN
        assertThatThrownBy(() -> DueDateRules.requireNotBeforeCreation(Instant.parse("2026-11-15T16:59:59Z"), createdEarlyMorningVn))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("Không có hạn chót thì bỏ qua")
    void nullDueDate_ignored() {
        assertThatCode(() -> DueDateRules.requireNotBeforeCreation(null, CREATED)).doesNotThrowAnyException();
    }
}
