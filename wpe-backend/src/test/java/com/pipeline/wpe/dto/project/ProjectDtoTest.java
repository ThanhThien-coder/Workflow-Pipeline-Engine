package com.pipeline.wpe.dto.project;

import com.pipeline.wpe.common.enums.ProjectStatus;
import com.pipeline.wpe.entity.ProjectEntity;
import com.pipeline.wpe.entity.WorkPhaseEntity;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class ProjectDtoTest {

    @Test
    @DisplayName("CreateProjectRequest: Gán visibility mặc định là PRIVATE nếu null hoặc rỗng")
    void shouldSetDefaultVisibilityWhenNullOrBlank() {
        CreateProjectRequest req1 = new CreateProjectRequest("Banking System", "Core system", 1L, null);
        assertThat(req1.visibility()).isEqualTo("PRIVATE");

        CreateProjectRequest req2 = new CreateProjectRequest("Banking System", "Core system", 1L, "  ");
        assertThat(req2.visibility()).isEqualTo("PRIVATE");

        CreateProjectRequest req3 = new CreateProjectRequest("Banking System", "Core system", 1L, "PUBLIC");
        assertThat(req3.visibility()).isEqualTo("PUBLIC");

        CreateProjectRequest req4 = new CreateProjectRequest("Banking System", "Core system", 1L);
        assertThat(req4.visibility()).isEqualTo("PRIVATE");
    }

    @Test
    @DisplayName("UpdateProjectStatusRequest: Tạo request đổi trạng thái thành công")
    void shouldCreateUpdateProjectStatusRequest() {
        UpdateProjectStatusRequest req = new UpdateProjectStatusRequest("ACTIVE");
        assertThat(req.status()).isEqualTo("ACTIVE");
    }

    @Test
    @DisplayName("ProjectSummaryResponse: Tính toán progressPercentage chính xác từ số lượng nodes")
    void shouldCalculateProgressPercentageCorrectly() {
        Instant now = Instant.now();
        ProjectEntity project = ProjectEntity.builder()
            .id(1L)
            .name("Core Pipeline")
            .description("Pipeline desc")
            .status(ProjectStatus.ACTIVE)
            .ownerId(2L)
            .createdAt(now)
            .updatedAt(now)
            .build();

        // 10 nodes, 4 completed => 40.0%
        ProjectSummaryResponse summary = ProjectSummaryResponse.fromEntity(
            project, "Alex Kim", 10, 4, 3
        );

        assertThat(summary.id()).isEqualTo(1L);
        assertThat(summary.name()).isEqualTo("Core Pipeline");
        assertThat(summary.status()).isEqualTo("ACTIVE");
        assertThat(summary.ownerName()).isEqualTo("Alex Kim");
        assertThat(summary.totalNodes()).isEqualTo(10);
        assertThat(summary.completedNodes()).isEqualTo(4);
        assertThat(summary.inProgressNodes()).isEqualTo(3);
        assertThat(summary.progressPercentage()).isEqualTo(40.0);

        // 0 nodes => 0.0%
        ProjectSummaryResponse emptySummary = ProjectSummaryResponse.fromEntity(
            project, "Alex Kim", 0, 0, 0
        );
        assertThat(emptySummary.progressPercentage()).isEqualTo(0.0);
    }

    @Test
    @DisplayName("ProjectDetailResponse: Khởi tạo đầy đủ chi tiết với AI Analysis và danh sách Phases")
    void shouldBuildProjectDetailResponse() {
        Instant now = Instant.now();
        Map<String, Object> aiAnalysis = Map.of("healthScore", 95, "bottleneckCount", 0);

        ProjectEntity project = ProjectEntity.builder()
            .id(1L)
            .name("Core Pipeline")
            .description("Pipeline desc")
            .status(ProjectStatus.ACTIVE)
            .ownerId(2L)
            .latestAiAnalysis(aiAnalysis)
            .createdAt(now)
            .updatedAt(now)
            .build();

        WorkPhaseEntity phaseEntity = WorkPhaseEntity.builder()
            .id(10L)
            .projectId(1L)
            .name("Foundation")
            .subTitle("Setup")
            .accentColor("emerald")
            .orderIndex(1)
            .build();

        WorkPhaseSummaryResponse phaseSummary = WorkPhaseSummaryResponse.fromEntity(phaseEntity, 5);

        ProjectDetailResponse detail = ProjectDetailResponse.fromEntity(
            project, "Alex Kim", 10, 5, 2, List.of(phaseSummary)
        );

        assertThat(detail.id()).isEqualTo(1L);
        assertThat(detail.latestAiAnalysis()).containsEntry("healthScore", 95);
        assertThat(detail.phases()).hasSize(1);
        assertThat(detail.phases().get(0).name()).isEqualTo("Foundation");
        assertThat(detail.phases().get(0).nodeCount()).isEqualTo(5);
        assertThat(detail.progressPercentage()).isEqualTo(50.0);
    }
}
