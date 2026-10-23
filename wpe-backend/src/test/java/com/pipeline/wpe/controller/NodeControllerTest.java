package com.pipeline.wpe.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pipeline.wpe.dto.request.node.SubmitTaskArtifactRequest;
import com.pipeline.wpe.dto.request.node.UpdateNodeStatusRequest;
import com.pipeline.wpe.dto.response.node.KanbanTaskResponse;
import com.pipeline.wpe.dto.response.node.NodeArtifactResponse;
import com.pipeline.wpe.dto.response.node.SubmitTaskArtifactResponse;
import com.pipeline.wpe.security.CurrentUserProvider;
import com.pipeline.wpe.service.engine.StateMachineService;
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
import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(NodeController.class)
@AutoConfigureMockMvc(addFilters = false)
class NodeControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private StateMachineService stateMachineService;

    @MockBean
    private CurrentUserProvider currentUserProvider;

    private final KanbanTaskResponse sampleTask = new KanbanTaskResponse(
        "10", "1", "WPE-010", "Test Task", "Description", "TODO",
        "2", "ALL_COMPLETED", null, Instant.now(), false, 0L, Map.of(), List.of()
    );

    @Test
    @DisplayName("GET /api/v1/projects/{id}/my-tasks - Trả về 200 OK danh sách task")
    void testGetMyTasks_returns200() throws Exception {
        when(currentUserProvider.getCurrentUserId()).thenReturn(Optional.of(2L));
        when(stateMachineService.getMyTasks(eq(1L), eq(2L))).thenReturn(List.of(sampleTask));

        mockMvc.perform(get("/api/v1/projects/1/my-tasks"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].id").value("10"))
            .andExpect(jsonPath("$[0].code").value("WPE-010"))
            .andExpect(jsonPath("$[0].status").value("TODO"));
    }

    @Test
    @DisplayName("PATCH /api/v1/nodes/{id}/status - Cập nhật trạng thái trả về 200 OK")
    void testUpdateStatus_returns200() throws Exception {
        when(currentUserProvider.getCurrentUserId()).thenReturn(Optional.of(2L));
        when(stateMachineService.updateStatus(eq(10L), any(UpdateNodeStatusRequest.class), eq(2L)))
            .thenReturn(sampleTask);

        UpdateNodeStatusRequest request = new UpdateNodeStatusRequest("IN_PROGRESS", null, 0L);

        mockMvc.perform(patch("/api/v1/nodes/10/status")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value("10"))
            .andExpect(jsonPath("$.code").value("WPE-010"));
    }

    @Test
    @DisplayName("POST /api/v1/nodes/{id}/submit - Nộp bài trả về 200 OK kèm task và artifact")
    void testSubmitTask_returns200() throws Exception {
        when(currentUserProvider.getCurrentUserId()).thenReturn(Optional.of(2L));
        NodeArtifactResponse sampleArtifact = new NodeArtifactResponse(
            "1", "PR", "https://github.com/pr/1", "PR #1", "PR #1", Instant.now()
        );
        SubmitTaskArtifactResponse submitResponse = new SubmitTaskArtifactResponse(sampleTask, sampleArtifact);

        when(stateMachineService.submitTaskArtifact(eq(10L), any(), eq(2L)))
            .thenReturn(submitResponse);

        SubmitTaskArtifactRequest request = new SubmitTaskArtifactRequest(
            "10", "PR", "https://github.com/pr/1", "Done", "PR #1", null, 0L
        );

        mockMvc.perform(post("/api/v1/nodes/10/submit")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.task.id").value("10"))
            .andExpect(jsonPath("$.artifact.url").value("https://github.com/pr/1"));
    }

    @Test
    @DisplayName("POST /api/v1/nodes/{id}/force-unlock - Force unlock trả về 200 OK")
    void testForceUnlock_returns200() throws Exception {
        when(currentUserProvider.getCurrentUserId()).thenReturn(Optional.of(2L));
        when(stateMachineService.forceUnlock(eq(10L), eq(2L))).thenReturn(sampleTask);

        mockMvc.perform(post("/api/v1/nodes/10/force-unlock"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value("10"))
            .andExpect(jsonPath("$.status").value("TODO"));
    }
}
