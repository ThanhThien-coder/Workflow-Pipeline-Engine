package com.pipeline.wpe.controller;

import com.pipeline.wpe.dto.response.activity.ProjectActivityItemResponse;
import com.pipeline.wpe.exception.ForbiddenException;
import com.pipeline.wpe.security.CurrentUserProvider;
import com.pipeline.wpe.service.ProjectActivityService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ProjectActivityController.class)
@AutoConfigureMockMvc(addFilters = false)
class ProjectActivityControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ProjectActivityService projectActivityService;

    @MockBean
    private CurrentUserProvider currentUserProvider;

    @Test
    @DisplayName("GET /api/v1/projects/{id}/activity?limit=10 - Trả về HTTP 200 và danh sách hoạt động")
    void getProjectActivity_returns200() throws Exception {
        Instant now = Instant.parse("2026-11-13T10:00:00Z");
        List<ProjectActivityItemResponse> sample = List.of(
                new ProjectActivityItemResponse(
                        "node-1-updated",
                        "TASK_STATUS_CHANGED",
                        "Sarah Chen",
                        "Task WPE-001 (Database Schema 3NF) ở trạng thái DONE (lần cập nhật gần nhất)",
                        "WPE-001",
                        now
                ),
                new ProjectActivityItemResponse(
                        "project-1-created",
                        "PROJECT_CREATED",
                        "Alex Kim",
                        "Đã tạo dự án \"Core Banking Pipeline\"",
                        null,
                        now.minusSeconds(3600)
                )
        );

        when(currentUserProvider.requireCurrentUserId()).thenReturn(2L);
        when(projectActivityService.getProjectActivity(1L, 2L, 10)).thenReturn(sample);

        mockMvc.perform(get("/api/v1/projects/1/activity").param("limit", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("node-1-updated"))
                .andExpect(jsonPath("$[0].type").value("TASK_STATUS_CHANGED"))
                .andExpect(jsonPath("$[0].actorName").value("Sarah Chen"))
                .andExpect(jsonPath("$[0].targetCode").value("WPE-001"))
                .andExpect(jsonPath("$[1].id").value("project-1-created"));

        verify(projectActivityService).getProjectActivity(1L, 2L, 10);
    }

    @Test
    @DisplayName("GET /api/v1/projects/{id}/activity - Người ngoài dự án nhận HTTP 403")
    void getProjectActivity_whenOutsider_returns403() throws Exception {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(99L);
        when(projectActivityService.getProjectActivity(1L, 99L, 50))
                .thenThrow(new ForbiddenException("ACCESS_DENIED", "Bạn không phải là thành viên của dự án này."));

        mockMvc.perform(get("/api/v1/projects/1/activity"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("ACCESS_DENIED"));
    }
}
