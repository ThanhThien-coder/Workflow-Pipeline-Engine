package com.pipeline.wpe.service.ai;

import com.pipeline.wpe.common.enums.NodeStatus;
import com.pipeline.wpe.entity.NodeEntity;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public final class StalledNodeDetector {

    private StalledNodeDetector() {
        // Lớp chỉ chứa hàm static thuần, không khởi tạo đối tượng
    }

    /**
     * Tìm các node đang bị ngâm quá lâu ở trạng thái IN_PROGRESS.
     * Ngưỡng ngâm: Duration.between(startedAt, now).toMinutes() > 2.5 * duration * 60 (duration: estimatedHours, null hoặc <= 0 -> 8).
     *
     * @param nodes Danh sách node cần kiểm tra
     * @param now Thời điểm hiện tại (do caller truyền vào, không tạo bean Clock)
     * @return Danh sách các node bị ngâm
     */
    public static List<NodeEntity> findStalled(List<NodeEntity> nodes, Instant now) {
        if (nodes == null || now == null) {
            return Collections.emptyList();
        }

        List<NodeEntity> stalled = new ArrayList<>();
        for (NodeEntity node : nodes) {
            if (node == null) continue;
            if (node.getStatus() != NodeStatus.IN_PROGRESS || node.getStartedAt() == null) {
                continue;
            }

            Integer hours = node.getEstimatedHours();
            int duration = (hours == null || hours <= 0) ? 8 : hours;

            long elapsedMinutes = Duration.between(node.getStartedAt(), now).toMinutes();
            double thresholdMinutes = 2.5 * duration * 60.0;

            if (elapsedMinutes > thresholdMinutes) {
                stalled.add(node);
            }
        }

        return stalled;
    }
}
