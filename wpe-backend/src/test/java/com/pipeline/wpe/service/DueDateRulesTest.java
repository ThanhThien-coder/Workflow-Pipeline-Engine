package com.pipeline.wpe.service;

import com.pipeline.wpe.common.enums.NodeStatus;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DueDateRulesTest {

    // 16/11/2026 10:00 giờ Việt Nam
    private static final Instant CREATED = Instant.parse("2026-11-16T03:00:00Z");
    // 20/11/2026 12:00 giờ Việt Nam
    private static final Instant NOW = Instant.parse("2026-11-20T05:00:00Z");
    private static final Instant YESTERDAY_END_VN = Instant.parse("2026-11-19T16:59:59Z"); // 23:59:59 19/11 VN
    private static final Instant TODAY_MORNING_VN = Instant.parse("2026-11-19T17:30:00Z"); // 00:30 20/11 VN
    private static final Instant TODAY_EVENING_VN = Instant.parse("2026-11-20T15:00:00Z"); // 22:00 20/11 VN
    private static final Instant TOMORROW_VN = Instant.parse("2026-11-21T05:00:00Z");      // 12:00 21/11 VN

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

    @Test
    @DisplayName("G2: ngày cũ và ngày mới đều null -> cho qua (kể cả task DONE)")
    void bothNull_allowed() {
        assertThatCode(() -> DueDateRules.requireDueDateChangeAllowed(null, null, NodeStatus.DONE, NOW))
            .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("G2: ngày cũ và ngày mới cùng ngày VN -> cho qua (kể cả task DONE hoặc hạn đã qua)")
    void sameVietnamDay_allowed() {
        assertThatCode(() -> DueDateRules.requireDueDateChangeAllowed(TODAY_MORNING_VN, TODAY_EVENING_VN, NodeStatus.DONE, NOW))
            .doesNotThrowAnyException();
        assertThatCode(() -> DueDateRules.requireDueDateChangeAllowed(
            Instant.parse("2026-11-19T01:00:00Z"), YESTERDAY_END_VN, NodeStatus.TODO, NOW))
            .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("G2: task DONE đổi hạn hoặc xóa hạn -> DUE_DATE_LOCKED")
    void doneTask_changeOrClear_rejected() {
        assertThatThrownBy(() -> DueDateRules.requireDueDateChangeAllowed(TOMORROW_VN, TODAY_EVENING_VN, NodeStatus.DONE, NOW))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessage("DUE_DATE_LOCKED: A finished task's due date cannot be changed.");

        assertThatThrownBy(() -> DueDateRules.requireDueDateChangeAllowed(TOMORROW_VN, null, NodeStatus.DONE, NOW))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessage("DUE_DATE_LOCKED: A finished task's due date cannot be changed.");

        assertThatThrownBy(() -> DueDateRules.requireDueDateChangeAllowed(null, TOMORROW_VN, NodeStatus.DONE, NOW))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessage("DUE_DATE_LOCKED: A finished task's due date cannot be changed.");
    }

    @Test
    @DisplayName("G2: hạn đã qua (ngày VN trước hôm nay) mà đổi sang ngày khác -> DUE_DATE_LOCKED")
    void passedDueDate_change_rejected() {
        assertThatThrownBy(() -> DueDateRules.requireDueDateChangeAllowed(YESTERDAY_END_VN, TOMORROW_VN, NodeStatus.IN_PROGRESS, NOW))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessage("DUE_DATE_LOCKED: This due date has passed and is locked so the late record stays accurate.");
    }

    @Test
    @DisplayName("G2: xóa hạn đã qua -> DUE_DATE_LOCKED")
    void passedDueDate_clear_rejected() {
        assertThatThrownBy(() -> DueDateRules.requireDueDateChangeAllowed(YESTERDAY_END_VN, null, NodeStatus.TODO, NOW))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessage("DUE_DATE_LOCKED: This due date has passed and is locked so the late record stays accurate.");
    }

    @Test
    @DisplayName("G2: hạn hôm nay (chưa qua ngày VN) đổi hoặc xóa vẫn được phép")
    void todayDueDate_changeOrClear_allowed() {
        assertThatCode(() -> DueDateRules.requireDueDateChangeAllowed(TODAY_MORNING_VN, TOMORROW_VN, NodeStatus.IN_PROGRESS, NOW))
            .doesNotThrowAnyException();
        assertThatCode(() -> DueDateRules.requireDueDateChangeAllowed(TODAY_MORNING_VN, null, NodeStatus.TODO, NOW))
            .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("G2: đặt hạn lần đầu hoặc đổi hạn tương lai -> cho qua")
    void firstDueOrFutureDue_allowed() {
        assertThatCode(() -> DueDateRules.requireDueDateChangeAllowed(null, TOMORROW_VN, NodeStatus.TODO, NOW))
            .doesNotThrowAnyException();
        assertThatCode(() -> DueDateRules.requireDueDateChangeAllowed(TOMORROW_VN, Instant.parse("2026-11-25T05:00:00Z"), NodeStatus.TODO, NOW))
            .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("G2: chặn xóa task chưa DONE có hạn đã qua")
    void overdueDeleteRule() {
        assertThatThrownBy(() -> DueDateRules.requireNotOverdueForDelete(YESTERDAY_END_VN, NodeStatus.TODO, NOW))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessage("OVERDUE_TASK_LOCKED: An overdue task cannot be deleted; finish it or mark it done late.");

        assertThatCode(() -> DueDateRules.requireNotOverdueForDelete(TODAY_MORNING_VN, NodeStatus.TODO, NOW))
            .doesNotThrowAnyException();
        assertThatCode(() -> DueDateRules.requireNotOverdueForDelete(YESTERDAY_END_VN, NodeStatus.DONE, NOW))
            .doesNotThrowAnyException();
        assertThatCode(() -> DueDateRules.requireNotOverdueForDelete(null, NodeStatus.TODO, NOW))
            .doesNotThrowAnyException();
    }
}
