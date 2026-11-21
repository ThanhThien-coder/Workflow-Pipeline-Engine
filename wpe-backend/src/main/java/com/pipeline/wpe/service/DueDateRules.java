package com.pipeline.wpe.service;

import com.pipeline.wpe.common.enums.NodeStatus;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Objects;

/**
 * G21 & G2: quy tắc hạn chót của task (so theo ngày, giờ Việt Nam).
 */
public final class DueDateRules {

    public static final String DUE_DATE_BEFORE_CREATED = "DUE_DATE_BEFORE_CREATED";
    public static final String DUE_DATE_LOCKED = "DUE_DATE_LOCKED";
    public static final String OVERDUE_TASK_LOCKED = "OVERDUE_TASK_LOCKED";

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
        LocalDate createdDay = toVietnamDay(createdAt != null ? createdAt : Instant.now());
        LocalDate dueDay = toVietnamDay(dueDate);
        if (dueDay.isBefore(createdDay)) {
            throw new IllegalArgumentException(DUE_DATE_BEFORE_CREATED
                + ": Due date cannot be earlier than the day the task was created (" + createdDay + ").");
        }
    }

    /**
     * Khóa đổi hoặc xóa hạn chót khi task đã DONE hoặc khi hạn cũ đã qua ngày (theo giờ Việt Nam).
     *
     * @throws IllegalArgumentException message bắt đầu bằng {@value #DUE_DATE_LOCKED}
     */
    public static void requireDueDateChangeAllowed(Instant oldDue, Instant newDue, NodeStatus status, Instant now) {
        LocalDate oldDay = oldDue != null ? toVietnamDay(oldDue) : null;
        LocalDate newDay = newDue != null ? toVietnamDay(newDue) : null;
        if (Objects.equals(oldDay, newDay)) {
            return;
        }
        if (status == NodeStatus.DONE) {
            throw new IllegalArgumentException(DUE_DATE_LOCKED
                + ": A finished task's due date cannot be changed.");
        }
        LocalDate today = toVietnamDay(now != null ? now : Instant.now());
        if (oldDay != null && oldDay.isBefore(today)) {
            throw new IllegalArgumentException(DUE_DATE_LOCKED
                + ": This due date has passed and is locked so the late record stays accurate.");
        }
    }

    /**
     * Chặn xóa task chưa DONE mà đã quá hạn (ngày hạn trước hôm nay theo giờ Việt Nam).
     *
     * @throws IllegalArgumentException message bắt đầu bằng {@value #OVERDUE_TASK_LOCKED}
     */
    public static void requireNotOverdueForDelete(Instant dueDate, NodeStatus status, Instant now) {
        if (status == NodeStatus.DONE || dueDate == null) {
            return;
        }
        LocalDate today = toVietnamDay(now != null ? now : Instant.now());
        if (toVietnamDay(dueDate).isBefore(today)) {
            throw new IllegalArgumentException(OVERDUE_TASK_LOCKED
                + ": An overdue task cannot be deleted; finish it or mark it done late.");
        }
    }

    private static LocalDate toVietnamDay(Instant instant) {
        return instant.atZone(VIETNAM_ZONE).toLocalDate();
    }
}
