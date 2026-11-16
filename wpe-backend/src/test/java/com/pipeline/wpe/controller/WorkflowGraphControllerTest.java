package com.pipeline.wpe.controller;

import com.pipeline.wpe.dto.response.graph.WorkflowGraphResponse;
import com.pipeline.wpe.exception.UnauthorizedException;
import com.pipeline.wpe.security.CurrentUserProvider;
import com.pipeline.wpe.service.WorkflowGraphService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(WorkflowGraphController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("Controller Tests for WorkflowGraphController - Anti-Impersonation Check")
class WorkflowGraphControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private WorkflowGraphService workflowGraphService;

    @MockBean
    private CurrentUserProvider currentUserProvider;

    @Test
    @DisplayName("GET /api/v1/projects/1/graph?currentUserId=3 - Bỏ qua currentUserId param, lấy callerId từ requireCurrentUserId (7)")
    void testGetGraph_ignoresCurrentUserIdParam() throws Exception {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(7L);
        when(workflowGraphService.getGraph(eq(1L), eq(7L))).thenReturn(new WorkflowGraphResponse(
            List.of(), List.of(), List.of(), List.of()
        ));

        mockMvc.perform(get("/api/v1/projects/1/graph")
                .param("currentUserId", "3"))
            .andExpect(status().isOk());

        verify(currentUserProvider).requireCurrentUserId();
        verify(workflowGraphService).getGraph(1L, 7L);
        verify(workflowGraphService, never()).getGraph(eq(1L), eq(3L));
    }

    @Test
    @DisplayName("GET /api/v1/projects/1/graph - Khi requireCurrentUserId ném UnauthorizedException thì trả 401 và không gọi service")
    void testGetGraph_unauthorized_returns401() throws Exception {
        when(currentUserProvider.requireCurrentUserId())
            .thenThrow(new UnauthorizedException("TOKEN_EXPIRED", "Access token không hợp lệ hoặc đã hết hạn."));

        mockMvc.perform(get("/api/v1/projects/1/graph"))
            .andExpect(status().isUnauthorized());

        verify(currentUserProvider).requireCurrentUserId();
        verify(workflowGraphService, never()).getGraph(any(), any());
    }
}
