package com.pipeline.wpe.service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

/**
 * G21: hạn chót của task không được sớm hơn ngày tạo task (so theo ngày, giờ Việt Nam; cùng ngày được phép).
 */
public final class DueDateRules {

    public static final String DUE_DATE_BEFORE_CREATED = "DUE_DATE_BEFORE_CREATED";

    private static final ZoneId VIETNAM_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private DueDateRules() {
    }

    /**
     * @param createdAt ngày tạo task; null (task chưa lưu) thì lấy thời điểm hiện tại
     * @throws IllegalArgumentException message bắt đầu bằng {@value #DUE_DATE_BEFORE_CREATED}
     */
    public static void requireNotBeforeCreation(Instant dueDate, Instant createdAt) {
        if (dueDate == null) {
            return;
        }
        LocalDate createdDay = (createdAt != null ? createdAt : Instant.now()).atZone(VIETNAM_ZONE).toLocalDate();
        LocalDate dueDay = dueDate.atZone(VIETNAM_ZONE).toLocalDate();
        if (dueDay.isBefore(createdDay)) {
            throw new IllegalArgumentException(DUE_DATE_BEFORE_CREATED
                + ": Due date cannot be earlier than the day the task was created (" + createdDay + ").");
        }
    }
}
