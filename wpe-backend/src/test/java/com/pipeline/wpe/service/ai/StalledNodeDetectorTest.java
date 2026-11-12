package com.pipeline.wpe.service.ai;

import com.pipeline.wpe.common.enums.NodeStatus;
import com.pipeline.wpe.entity.NodeEntity;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Collections;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class StalledNodeDetectorTest {

    private final Instant now = Instant.parse("2026-11-12T12:00:00Z");

    @Test
    @DisplayName("Node IN_PROGRESS 8h bắt đầu 21h trước -> ngâm (> 2.5 * 8h = 20h)")
    void testFindStalled_InProgress21HoursAgo_IsStalled() {
        NodeEntity node = NodeEntity.builder()
            .id(1L)
            .code("TASK-01")
            .status(NodeStatus.IN_PROGRESS)
            .estimatedHours(8)
            .startedAt(now.minus(21, ChronoUnit.HOURS))
            .build();

        List<NodeEntity> stalled = StalledNodeDetector.findStalled(List.of(node), now);

        assertThat(stalled).containsExactly(node);
    }

    @Test
    @DisplayName("Node IN_PROGRESS 8h bắt đầu 19h trước -> không ngâm (< 20h)")
    void testFindStalled_InProgress19HoursAgo_NotStalled() {
        NodeEntity node = NodeEntity.builder()
            .id(2L)
            .code("TASK-02")
            .status(NodeStatus.IN_PROGRESS)
            .estimatedHours(8)
            .startedAt(now.minus(19, ChronoUnit.HOURS))
            .build();

        List<NodeEntity> stalled = StalledNodeDetector.findStalled(List.of(node), now);

        assertThat(stalled).isEmpty();
    }

    @Test
    @DisplayName("Node TODO bắt đầu 25h trước -> không ngâm (chỉ xét IN_PROGRESS)")
    void testFindStalled_TodoStatus_NotStalled() {
        NodeEntity node = NodeEntity.builder()
            .id(3L)
            .code("TASK-03")
            .status(NodeStatus.TODO)
            .estimatedHours(8)
            .startedAt(now.minus(25, ChronoUnit.HOURS))
            .build();

        List<NodeEntity> stalled = StalledNodeDetector.findStalled(List.of(node), now);

        assertThat(stalled).isEmpty();
    }

    @Test
    @DisplayName("Node IN_PROGRESS nhưng startedAt null -> không ngâm")
    void testFindStalled_StartedAtNull_NotStalled() {
        NodeEntity node = NodeEntity.builder()
            .id(4L)
            .code("TASK-04")
            .status(NodeStatus.IN_PROGRESS)
            .estimatedHours(8)
            .startedAt(null)
            .build();

        List<NodeEntity> stalled = StalledNodeDetector.findStalled(List.of(node), now);

        assertThat(stalled).isEmpty();
    }

    @Test
    @DisplayName("estimatedHours null mặc định 8h -> 21h trước bị ngâm")
    void testFindStalled_EstimatedHoursNull_DefaultsTo8() {
        NodeEntity node = NodeEntity.builder()
            .id(5L)
            .code("TASK-05")
            .status(NodeStatus.IN_PROGRESS)
            .estimatedHours(null)
            .startedAt(now.minus(21, ChronoUnit.HOURS))
            .build();

        List<NodeEntity> stalled = StalledNodeDetector.findStalled(List.of(node), now);

        assertThat(stalled).containsExactly(node);
    }

    @Test
    @DisplayName("Danh sách rỗng hoặc null -> trả về danh sách rỗng an toàn")
    void testFindStalled_EmptyOrNullInputs() {
        assertThat(StalledNodeDetector.findStalled(null, now)).isEmpty();
        assertThat(StalledNodeDetector.findStalled(Collections.emptyList(), now)).isEmpty();
        assertThat(StalledNodeDetector.findStalled(List.of(), null)).isEmpty();
    }
}
