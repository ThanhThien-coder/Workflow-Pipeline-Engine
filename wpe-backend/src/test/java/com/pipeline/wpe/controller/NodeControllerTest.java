package com.pipeline.wpe.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pipeline.wpe.dto.request.node.SubmitTaskArtifactRequest;
import com.pipeline.wpe.dto.request.node.UpdateNodeStatusRequest;
import com.pipeline.wpe.dto.response.node.KanbanTaskResponse;
import com.pipeline.wpe.dto.response.node.NodeArtifactResponse;
import com.pipeline.wpe.dto.response.node.SubmitTaskArtifactResponse;
import com.pipeline.wpe.exception.ForbiddenException;
import com.pipeline.wpe.exception.UnauthorizedException;
import com.pipeline.wpe.security.CurrentUserProvider;
import com.pipeline.wpe.service.ProjectAuthorizationService;
import com.pipeline.wpe.service.engine.StateMachineService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
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
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
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

    @MockBean
    private ProjectAuthorizationService projectAuthorizationService;

    private final KanbanTaskResponse sampleTask = new KanbanTaskResponse(
        "10", "1", "WPE-010", "Test Task", "Description", "TODO",
        "2", "ALL_COMPLETED", null, Instant.now(), false, 0L, Map.of(), List.of()
    );

    private String statusBody(String status) throws Exception {
        return objectMapper.writeValueAsString(new UpdateNodeStatusRequest(status, null, 0L));
    }

    private String submitBody() throws Exception {
        return objectMapper.writeValueAsString(new SubmitTaskArtifactRequest(
            "10", "PR", "https://github.com/pr/1", "Done", "PR #1", null, 0L));
    }

    @Test
    @DisplayName("GET /api/v1/projects/{id}/my-tasks - Trả về 200 OK danh sách task")
    void testGetMyTasks_returns200() throws Exception {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(2L);
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
        when(currentUserProvider.requireCurrentUserId()).thenReturn(2L);
        when(stateMachineService.updateStatus(eq(10L), any(UpdateNodeStatusRequest.class), eq(2L)))
            .thenReturn(sampleTask);

        mockMvc.perform(patch("/api/v1/nodes/10/status")
                .contentType(MediaType.APPLICATION_JSON)
                .content(statusBody("IN_PROGRESS")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value("10"))
            .andExpect(jsonPath("$.code").value("WPE-010"));
    }

    @Test
    @DisplayName("POST /api/v1/nodes/{id}/submit - Nộp bài trả về 200 OK kèm task và artifact")
    void testSubmitTask_returns200() throws Exception {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(2L);
        NodeArtifactResponse sampleArtifact = new NodeArtifactResponse(
            "1", "PR", "https://github.com/pr/1", "PR #1", "PR #1", Instant.now()
        );
        SubmitTaskArtifactResponse submitResponse = new SubmitTaskArtifactResponse(sampleTask, sampleArtifact);

        when(stateMachineService.submitTaskArtifact(eq(10L), any(), eq(2L)))
            .thenReturn(submitResponse);

        mockMvc.perform(post("/api/v1/nodes/10/submit")
                .contentType(MediaType.APPLICATION_JSON)
                .content(submitBody()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.task.id").value("10"))
            .andExpect(jsonPath("$.artifact.url").value("https://github.com/pr/1"));
    }

    @Test
    @DisplayName("POST /api/v1/nodes/{id}/force-unlock - Force unlock trả về 200 OK")
    void testForceUnlock_returns200() throws Exception {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(2L);
        when(stateMachineService.forceUnlock(eq(10L), eq(2L))).thenReturn(sampleTask);

        mockMvc.perform(post("/api/v1/nodes/10/force-unlock"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value("10"))
            .andExpect(jsonPath("$.status").value("TODO"));
    }

    /**
     * Trước đây controller nhận {@code ?currentUserId=} và rơi về user 2 khi không có ai đăng nhập:
     * Cộng sự (user 3) gửi {@code ?currentUserId=1} là được coi như Owner để tự duyệt bài.
     */
    @Nested
    @DisplayName("Không giả danh được người khác (lỗ hổng ?currentUserId=)")
    class NoImpersonation {

        @Test
        @DisplayName("PATCH status kèm ?currentUserId=1: service nhận người đăng nhập (3), không nhận 1")
        void updateStatus_ignoresCurrentUserIdParam() throws Exception {
            when(currentUserProvider.requireCurrentUserId()).thenReturn(3L);
            when(stateMachineService.updateStatus(eq(10L), any(UpdateNodeStatusRequest.class), anyLong()))
                .thenReturn(sampleTask);

            mockMvc.perform(patch("/api/v1/nodes/10/status").param("currentUserId", "1")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(statusBody("DONE")))
                .andExpect(status().isOk());

            verify(stateMachineService).updateStatus(eq(10L), any(UpdateNodeStatusRequest.class), eq(3L));
            verify(stateMachineService, never()).updateStatus(anyLong(), any(), eq(1L));
        }

        @Test
        @DisplayName("POST submit kèm ?currentUserId=1: service nhận người đăng nhập (3)")
        void submit_ignoresCurrentUserIdParam() throws Exception {
            when(currentUserProvider.requireCurrentUserId()).thenReturn(3L);

            mockMvc.perform(post("/api/v1/nodes/10/submit").param("currentUserId", "1")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(submitBody()))
                .andExpect(status().isOk());

            verify(stateMachineService).submitTaskArtifact(eq(10L), any(), eq(3L));
            verify(stateMachineService, never()).submitTaskArtifact(anyLong(), any(), eq(1L));
        }

        @Test
        @DisplayName("POST force-unlock kèm ?currentUserId=1: service nhận người đăng nhập (3)")
        void forceUnlock_ignoresCurrentUserIdParam() throws Exception {
            when(currentUserProvider.requireCurrentUserId()).thenReturn(3L);

            mockMvc.perform(post("/api/v1/nodes/10/force-unlock").param("currentUserId", "1"))
                .andExpect(status().isOk());

            verify(stateMachineService).forceUnlock(10L, 3L);
            verify(stateMachineService, never()).forceUnlock(anyLong(), eq(1L));
        }
    }

    @Nested
    @DisplayName("Không đăng nhập hoặc token sai → 401, không rơi về user 2")
    class Unauthenticated {

        private void tokenRac() {
            when(currentUserProvider.requireCurrentUserId())
                .thenThrow(new UnauthorizedException("TOKEN_EXPIRED", "Access token không hợp lệ hoặc đã hết hạn."));
            when(currentUserProvider.getCurrentUserId()).thenReturn(Optional.empty());
        }

        @Test
        @DisplayName("PATCH status với token rác → 401, service không được gọi")
        void updateStatus_401() throws Exception {
            tokenRac();
            mockMvc.perform(patch("/api/v1/nodes/10/status").header("Authorization", "Bearer token-rac")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(statusBody("DONE")))
                .andExpect(status().isUnauthorized());
            verify(stateMachineService, never()).updateStatus(anyLong(), any(), any());
        }

        @Test
        @DisplayName("POST submit với token rác → 401, service không được gọi")
        void submit_401() throws Exception {
            tokenRac();
            mockMvc.perform(post("/api/v1/nodes/10/submit").header("Authorization", "Bearer token-rac")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(submitBody()))
                .andExpect(status().isUnauthorized());
            verify(stateMachineService, never()).submitTaskArtifact(anyLong(), any(), any());
        }

        @Test
        @DisplayName("POST force-unlock với token rác → 401, service không được gọi")
        void forceUnlock_401() throws Exception {
            tokenRac();
            mockMvc.perform(post("/api/v1/nodes/10/force-unlock").header("Authorization", "Bearer token-rac"))
                .andExpect(status().isUnauthorized());
            verify(stateMachineService, never()).forceUnlock(anyLong(), any());
        }

        @Test
        @DisplayName("GET my-tasks với token rác → 401, không đọc task của ai")
        void myTasks_401() throws Exception {
            tokenRac();
            mockMvc.perform(get("/api/v1/projects/1/my-tasks").header("Authorization", "Bearer token-rac"))
                .andExpect(status().isUnauthorized());
            verify(stateMachineService, never()).getMyTasks(anyLong(), any());
        }
    }

    @Nested
    @DisplayName("GET my-tasks: chỉ thành viên dự án mới xem được")
    class MyTasksMembership {

        @Test
        @DisplayName("Không phải thành viên → 403, không đọc task")
        void nonMember_403() throws Exception {
            when(currentUserProvider.requireCurrentUserId()).thenReturn(99L);
            when(projectAuthorizationService.verifyProjectMemberOrOwner(1L, 99L))
                .thenThrow(new ForbiddenException("ACCESS_DENIED", "Bạn không phải là thành viên của dự án này."));

            mockMvc.perform(get("/api/v1/projects/1/my-tasks").param("userId", "2"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("ACCESS_DENIED"));
            verify(stateMachineService, never()).getMyTasks(anyLong(), any());
        }

        @Test
        @DisplayName("Thành viên xem task của đồng đội (?userId=5): được, service nhận userId 5")
        void member_canViewTeammate() throws Exception {
            when(currentUserProvider.requireCurrentUserId()).thenReturn(2L);
            when(stateMachineService.getMyTasks(1L, 5L)).thenReturn(List.of(sampleTask));

            mockMvc.perform(get("/api/v1/projects/1/my-tasks").param("userId", "5"))
                .andExpect(status().isOk());
            verify(projectAuthorizationService).verifyProjectMemberOrOwner(1L, 2L);
            verify(stateMachineService).getMyTasks(1L, 5L);
        }
    }
}
