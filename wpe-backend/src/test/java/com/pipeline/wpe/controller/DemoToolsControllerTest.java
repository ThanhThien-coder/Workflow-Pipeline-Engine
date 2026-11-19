package com.pipeline.wpe.controller;

import com.pipeline.wpe.common.enums.NodeStatus;
import com.pipeline.wpe.dto.response.graph.GraphNodeResponse;
import com.pipeline.wpe.exception.ForbiddenException;
import com.pipeline.wpe.exception.ResourceNotFoundException;
import com.pipeline.wpe.exception.UnauthorizedException;
import com.pipeline.wpe.security.CurrentUserProvider;
import com.pipeline.wpe.service.demo.DemoToolsService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(DemoToolsController.class)
@AutoConfigureMockMvc(addFilters = false)
class DemoToolsControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private DemoToolsService demoToolsService;

    @MockBean
    private CurrentUserProvider currentUserProvider;

    private GraphNodeResponse overdueNode() {
        return new GraphNodeResponse(
            "100", "1", "code-100", "title", "desc", "TODO", "ALL_COMPLETED", "20",
            Instant.parse("2026-01-01T10:00:00Z"), 8, 1L, Map.of(),
            null, null, Instant.parse("2025-12-01T10:00:00Z"), null, true
        );
    }

    @Test
    @DisplayName("GET /api/v1/demo/status - trả 200 và cờ enabled")
    void status_returns200() throws Exception {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(10L);
        when(demoToolsService.isEnabled()).thenReturn(true);

        mockMvc.perform(get("/api/v1/demo/status"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.enabled").value(true));
    }

    @Test
    @DisplayName("GET /api/v1/demo/status - chưa đăng nhập (provider ném Unauthorized) trả 401")
    void status_returns401_whenNotAuthenticated() throws Exception {
        when(currentUserProvider.requireCurrentUserId()).thenThrow(new UnauthorizedException("Not logged in."));

        mockMvc.perform(get("/api/v1/demo/status"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("make-overdue - trả 200 có isOverdue")
    void makeOverdue_returns200() throws Exception {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(10L);
        when(demoToolsService.makeOverdue(5L, 100L, 10L)).thenReturn(overdueNode());

        mockMvc.perform(post("/api/v1/demo/projects/5/nodes/100/make-overdue"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value("100"))
            .andExpect(jsonPath("$.isOverdue").value(true));
    }

    @Test
    @DisplayName("make-overdue - service ném ResourceNotFoundException trả 404")
    void makeOverdue_returns404() throws Exception {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(10L);
        when(demoToolsService.makeOverdue(5L, 999L, 10L)).thenThrow(new ResourceNotFoundException("Task not found"));

        mockMvc.perform(post("/api/v1/demo/projects/5/nodes/999/make-overdue"))
            .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("overdue-scan - service ném ForbiddenException trả 403")
    void overdueScan_returns403() throws Exception {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(10L);
        when(demoToolsService.overdueScan(5L, 10L)).thenThrow(new ForbiddenException("ACCESS_DENIED", "Only the owner."));

        mockMvc.perform(post("/api/v1/demo/projects/5/overdue-scan"))
            .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("force-status - status không hợp lệ trả 400 và không gọi service")
    void forceStatus_returns400_whenStatusWrong() throws Exception {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(10L);

        mockMvc.perform(post("/api/v1/demo/projects/5/nodes/100/force-status")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"WRONG\"}"))
            .andExpect(status().isBadRequest());

        org.mockito.Mockito.verifyNoInteractions(demoToolsService);
    }

    @Test
    @DisplayName("force-status - thiếu status trả 400")
    void forceStatus_returns400_whenStatusMissing() throws Exception {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(10L);

        mockMvc.perform(post("/api/v1/demo/projects/5/nodes/100/force-status")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
            .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("force-status - hợp lệ trả 200 và gọi service đúng tham số")
    void forceStatus_returns200() throws Exception {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(10L);
        when(demoToolsService.forceStatus(5L, 100L, NodeStatus.REVIEW, 10L)).thenReturn(overdueNode());

        mockMvc.perform(post("/api/v1/demo/projects/5/nodes/100/force-status")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"REVIEW\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value("100"));

        verify(demoToolsService).forceStatus(5L, 100L, NodeStatus.REVIEW, 10L);
    }

    @Test
    @DisplayName("ai-cooldown/reset - trả 204")
    void resetAiCooldown_returns204() throws Exception {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(10L);

        mockMvc.perform(post("/api/v1/demo/projects/5/ai-cooldown/reset"))
            .andExpect(status().isNoContent());

        verify(demoToolsService).resetAiCooldown(5L, 10L);
    }

    @Test
    @DisplayName("guest-link/expire - service ném ForbiddenException trả 403")
    void expireGuestLink_returns403() throws Exception {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(10L);
        doThrow(new ForbiddenException("ACCESS_DENIED", "Only the owner."))
            .when(demoToolsService).expireGuestLink(eq(5L), any(Long.class));

        mockMvc.perform(post("/api/v1/demo/projects/5/guest-link/expire"))
            .andExpect(status().isForbidden());
    }
}
