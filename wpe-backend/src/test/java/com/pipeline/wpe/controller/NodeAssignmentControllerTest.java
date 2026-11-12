package com.pipeline.wpe.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pipeline.wpe.dto.request.node.UpdateNodeAssignmentRequest;
import com.pipeline.wpe.dto.response.graph.GraphNodeResponse;
import com.pipeline.wpe.exception.ForbiddenException;
import com.pipeline.wpe.security.CurrentUserProvider;
import com.pipeline.wpe.service.NodeAssignmentService;
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
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(NodeAssignmentController.class)
@AutoConfigureMockMvc(addFilters = false)
class NodeAssignmentControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private NodeAssignmentService nodeAssignmentService;

    @MockBean
    private CurrentUserProvider currentUserProvider;

    private final GraphNodeResponse sampleResponse = new GraphNodeResponse(
        "100", "1", "example-node-100", "example-title", "example-desc",
        "TODO", "ALL_COMPLETED", "20", Instant.parse("2026-12-01T10:00:00Z"),
        8, 1L, Map.of()
    );

    @Test
    @DisplayName("PATCH /api/v1/nodes/{id}/assignment - Thành công trả HTTP 200")
    void testUpdateAssignment_returns200() throws Exception {
        UpdateNodeAssignmentRequest request = new UpdateNodeAssignmentRequest(20L, Instant.parse("2026-12-01T10:00:00Z"), 1L);

        when(currentUserProvider.requireCurrentUserId()).thenReturn(10L);
        when(nodeAssignmentService.updateAssignment(eq(100L), any(UpdateNodeAssignmentRequest.class), eq(10L)))
            .thenReturn(sampleResponse);

        mockMvc.perform(patch("/api/v1/nodes/100/assignment")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value("100"))
            .andExpect(jsonPath("$.assignedUserId").value("20"))
            .andExpect(jsonPath("$.code").value("example-node-100"));

        verify(nodeAssignmentService).updateAssignment(eq(100L), any(UpdateNodeAssignmentRequest.class), eq(10L));
    }

    @Test
    @DisplayName("PATCH /api/v1/nodes/{id}/assignment - Không có quyền trả HTTP 403 khi service ném ForbiddenException")
    void testUpdateAssignment_returns403_whenForbidden() throws Exception {
        UpdateNodeAssignmentRequest request = new UpdateNodeAssignmentRequest(20L, null, 1L);

        when(currentUserProvider.requireCurrentUserId()).thenReturn(99L);
        when(nodeAssignmentService.updateAssignment(eq(100L), any(UpdateNodeAssignmentRequest.class), eq(99L)))
            .thenThrow(new ForbiddenException("ACCESS_DENIED", "example-forbidden"));

        mockMvc.perform(patch("/api/v1/nodes/100/assignment")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.error").value("ACCESS_DENIED"));
    }
}
