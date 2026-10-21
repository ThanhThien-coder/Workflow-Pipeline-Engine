package com.pipeline.wpe.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pipeline.wpe.common.enums.FeedbackStatus;
import com.pipeline.wpe.common.enums.ReviewerRole;
import com.pipeline.wpe.dto.request.feedback.CreateGuestFeedbackRequest;
import com.pipeline.wpe.dto.request.guest.GenerateGuestTokenRequest;
import com.pipeline.wpe.dto.response.feedback.GuestFeedbackResponse;
import com.pipeline.wpe.dto.response.guest.GuestAccessResponse;
import com.pipeline.wpe.dto.response.guest.GuestOverviewResponse;
import com.pipeline.wpe.exception.ForbiddenException;
import com.pipeline.wpe.service.FeedbackQueueService;
import com.pipeline.wpe.service.GuestGatewayService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(GuestGatewayController.class)
@AutoConfigureMockMvc(addFilters = false)
class GuestGatewayControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private GuestGatewayService guestGatewayService;

    @MockBean
    private FeedbackQueueService feedbackQueueService;

    @Test
    @DisplayName("POST /api/v1/projects/{id}/guest-token - Sinh token trả về 200")
    void testGenerateGuestToken() throws Exception {
        GuestAccessResponse response = new GuestAccessResponse(
            true, "token64chars", "http://localhost:5173/guest/token64chars", Instant.now()
        );
        when(guestGatewayService.generateOrRenewGuestToken(eq(1L), any())).thenReturn(response);

        mockMvc.perform(post("/api/v1/projects/1/guest-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new GenerateGuestTokenRequest(30))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.enabled").value(true))
            .andExpect(jsonPath("$.token").value("token64chars"));
    }

    @Test
    @DisplayName("DELETE /api/v1/projects/{id}/guest-token - Thu hồi token trả về 200")
    void testRevokeGuestToken() throws Exception {
        when(guestGatewayService.revokeGuestToken(1L)).thenReturn(GuestAccessResponse.disabled());

        mockMvc.perform(delete("/api/v1/projects/1/guest-token"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.enabled").value(false));
    }

    @Test
    @DisplayName("GET /api/v1/guest/{token}/overview - Khách xem overview trả về 200")
    void testGetGuestOverview_Success() throws Exception {
        GuestOverviewResponse response = new GuestOverviewResponse(
            "Test Project", "Phase 1", Instant.now(), 10, 2, 5, 50.0, 0, 1, 10,
            List.of(), List.of(), List.of(), List.of()
        );
        when(guestGatewayService.getGuestOverview("valid-token")).thenReturn(response);

        mockMvc.perform(get("/api/v1/guest/valid-token/overview"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.projectName").value("Test Project"))
            .andExpect(jsonPath("$.completionPct").value(50.0));
    }

    @Test
    @DisplayName("GET /api/v1/guest/{token}/overview - Token bị thu hồi trả về 403 Forbidden")
    void testGetGuestOverview_RevokedToken() throws Exception {
        when(guestGatewayService.getGuestOverview("revoked-token"))
            .thenThrow(new ForbiddenException("REVOKED_GUEST", "Liên kết chia sẻ này đã bị Chủ dự án thu hồi."));

        mockMvc.perform(get("/api/v1/guest/revoked-token/overview"))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.error").value("REVOKED_GUEST"));
    }

    @Test
    @DisplayName("POST /api/v1/guest/{token}/feedback - Khách gửi nhận xét trả về 201 Created")
    void testSubmitGuestFeedback_Success() throws Exception {
        CreateGuestFeedbackRequest request = new CreateGuestFeedbackRequest(
            "TS. Nguyen Van A", ReviewerRole.TEACHER, "Góp ý chất lượng", 2L
        );
        GuestFeedbackResponse response = new GuestFeedbackResponse(
            1L, 1L, 2L, "TS. Nguyen Van A", ReviewerRole.TEACHER, "Góp ý chất lượng", FeedbackStatus.OPEN, Instant.now()
        );
        when(feedbackQueueService.submitGuestFeedback(eq("token123"), any())).thenReturn(response);

        mockMvc.perform(post("/api/v1/guest/token123/feedback")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").value(1))
            .andExpect(jsonPath("$.status").value("OPEN"));
    }

    @Test
    @DisplayName("POST /api/v1/guest/{token}/feedback - Dữ liệu trống trả về 400 VALIDATION_FAILED")
    void testSubmitGuestFeedback_ValidationFailed() throws Exception {
        CreateGuestFeedbackRequest invalid = new CreateGuestFeedbackRequest(
            "", null, "", null
        );

        mockMvc.perform(post("/api/v1/guest/token123/feedback")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(invalid)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("VALIDATION_FAILED"));
    }
}

