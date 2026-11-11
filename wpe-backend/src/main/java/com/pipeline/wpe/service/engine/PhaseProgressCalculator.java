package com.pipeline.wpe.service.engine;

import com.pipeline.wpe.common.enums.NodeStatus;
import com.pipeline.wpe.entity.NodeEntity;

import java.util.List;

/**
 * Tính tiến độ & trạng thái của một Macro Phase từ danh sách task thuộc Phase đó.
 * Công thức đồng bộ với Frontend (wpe-frontend/src/domain/phaseProgress.ts):
 *   - progressPct = round(số task DONE / tổng số task * 100), Phase rỗng = 0.
 *   - status: rỗng -> TODO, tất cả DONE -> COMPLETED, tất cả LOCKED -> LOCKED,
 *             có task IN_PROGRESS/REVIEW/DONE -> IN_PROGRESS, còn lại -> TODO.
 */
public final class PhaseProgressCalculator {

    public record PhaseProgress(String status, int progressPct, int totalTasks, int doneTasks) {}

    private PhaseProgressCalculator() {}

    public static PhaseProgress compute(List<NodeEntity> phaseTasks) {
        int total = phaseTasks.size();
        int done = (int) phaseTasks.stream().filter(n -> n.getStatus() == NodeStatus.DONE).count();
        int pct = total > 0 ? (int) Math.round(done * 100.0 / total) : 0;

        String status;
        if (total == 0) {
            status = "TODO";
        } else if (done == total) {
            status = "COMPLETED";
        } else if (phaseTasks.stream().allMatch(n -> n.getStatus() == NodeStatus.LOCKED)) {
            status = "LOCKED";
        } else if (phaseTasks.stream().anyMatch(n -> n.getStatus() == NodeStatus.IN_PROGRESS
                || n.getStatus() == NodeStatus.REVIEW
                || n.getStatus() == NodeStatus.DONE)) {
            status = "IN_PROGRESS";
        } else {
            status = "TODO";
        }

        return new PhaseProgress(status, pct, total, done);
    }
}
