package com.pipeline.wpe.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pipeline.wpe.common.enums.FeedbackStatus;
import com.pipeline.wpe.common.enums.ReviewerRole;
import com.pipeline.wpe.dto.response.feedback.ProjectFeedbackResponse;
import com.pipeline.wpe.dto.response.feedback.ResolveFeedbackResponse;
import com.pipeline.wpe.exception.ForbiddenException;
import com.pipeline.wpe.service.FeedbackQueueService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(FeedbackQueueController.class)
@AutoConfigureMockMvc(addFilters = false)
class FeedbackQueueControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private FeedbackQueueService feedbackQueueService;

    @Test
    @DisplayName("GET /api/v1/projects/{id}/feedbacks - Lấy danh sách feedback trả về 200")
    void testGetProjectFeedbacks() throws Exception {
        ProjectFeedbackResponse item = new ProjectFeedbackResponse(
            1L, "GV A", ReviewerRole.TEACHER,
            new ProjectFeedbackResponse.FeedbackNodeRef(2L, "WPE-002", "Swagger"),
            "Nội dung nhận xét", FeedbackStatus.OPEN, Instant.now()
        );
        when(feedbackQueueService.getProjectFeedbacks(1L)).thenReturn(List.of(item));

        mockMvc.perform(get("/api/v1/projects/1/feedbacks"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].id").value(1))
            .andExpect(jsonPath("$[0].reviewerName").value("GV A"))
            .andExpect(jsonPath("$[0].nodeRef.code").value("WPE-002"));
    }

    @Test
    @DisplayName("PATCH /api/v1/projects/{id}/feedbacks/{id}/resolve - Đổi sang RESOLVED trả về 200")
    void testResolveFeedback() throws Exception {
        ResolveFeedbackResponse response = new ResolveFeedbackResponse(true, 5L, FeedbackStatus.RESOLVED);
        when(feedbackQueueService.resolveFeedback(1L, 5L)).thenReturn(response);

        mockMvc.perform(patch("/api/v1/projects/1/feedbacks/5/resolve"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.feedbackId").value(5))
            .andExpect(jsonPath("$.status").value("RESOLVED"));
    }

    @Test
    @DisplayName("GET /api/v1/projects/{id}/feedbacks - Không có quyền trả về 403 ACCESS_DENIED")
    void testGetProjectFeedbacks_AccessDenied() throws Exception {
        when(feedbackQueueService.getProjectFeedbacks(1L))
            .thenThrow(new ForbiddenException("ACCESS_DENIED", "Bạn không phải là thành viên của dự án này."));

        mockMvc.perform(get("/api/v1/projects/1/feedbacks"))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.error").value("ACCESS_DENIED"));
    }

    @Test
    @DisplayName("PATCH /api/v1/projects/{id}/feedbacks/{id}/resolve - Không có quyền trả về 403 ACCESS_DENIED")
    void testResolveFeedback_AccessDenied() throws Exception {
        when(feedbackQueueService.resolveFeedback(1L, 5L))
            .thenThrow(new ForbiddenException("ACCESS_DENIED", "Bạn không phải là thành viên của dự án này."));

        mockMvc.perform(patch("/api/v1/projects/1/feedbacks/5/resolve"))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.error").value("ACCESS_DENIED"));
    }
}

