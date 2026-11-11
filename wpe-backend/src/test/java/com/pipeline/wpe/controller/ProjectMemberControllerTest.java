package com.pipeline.wpe.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pipeline.wpe.common.enums.ProjectRole;
import com.pipeline.wpe.dto.request.project.UpdateMemberRoleRequest;
import com.pipeline.wpe.dto.response.project.ProjectMemberResponse;
import com.pipeline.wpe.dto.response.project.RemoveMemberResponse;
import com.pipeline.wpe.exception.ForbiddenException;
import com.pipeline.wpe.security.CurrentUserProvider;
import com.pipeline.wpe.service.ProjectMemberService;
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
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ProjectMemberController.class)
@AutoConfigureMockMvc(addFilters = false)
class ProjectMemberControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private ProjectMemberService projectMemberService;

    @MockBean
    private CurrentUserProvider currentUserProvider;

    private final Instant now = Instant.now();

    private final ProjectMemberResponse sampleMember = new ProjectMemberResponse(
            "2", "sarah.chen", "Sarah Chen", "sarah@wpe.io",
            "COLLABORATOR", now, 3, "SC", null
    );

    @Test
    @DisplayName("GET /api/v1/projects/{projectId}/members - Trả về HTTP 200 và danh sách thành viên")
    void testGetMembers_returns200() throws Exception {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(1L);
        when(projectMemberService.getMembers(10L, 1L)).thenReturn(List.of(sampleMember));

        mockMvc.perform(get("/api/v1/projects/10/members"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].userId").value("2"))
                .andExpect(jsonPath("$[0].username").value("sarah.chen"))
                .andExpect(jsonPath("$[0].role").value("COLLABORATOR"))
                .andExpect(jsonPath("$[0].activeNodeCount").value(3))
                .andExpect(jsonPath("$[0].initials").value("SC"));

        verify(projectMemberService).getMembers(10L, 1L);
    }

    @Test
    @DisplayName("PATCH /api/v1/projects/{projectId}/members/{userId} - Trả về HTTP 200 và thông tin thành viên đã đổi vai trò")
    void testUpdateMemberRole_returns200() throws Exception {
        UpdateMemberRoleRequest request = new UpdateMemberRoleRequest(ProjectRole.COLLABORATOR);

        when(currentUserProvider.requireCurrentUserId()).thenReturn(1L);
        when(projectMemberService.updateRole(eq(10L), eq(2L), eq(ProjectRole.COLLABORATOR), eq(1L)))
                .thenReturn(sampleMember);

        mockMvc.perform(patch("/api/v1/projects/10/members/2")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value("2"))
                .andExpect(jsonPath("$.role").value("COLLABORATOR"));

        verify(projectMemberService).updateRole(10L, 2L, ProjectRole.COLLABORATOR, 1L);
    }

    @Test
    @DisplayName("DELETE /api/v1/projects/{projectId}/members/{userId} - Trả về HTTP 200 và $.unassignedTaskCount")
    void testRemoveMember_returns200() throws Exception {
        RemoveMemberResponse response = new RemoveMemberResponse(2L, 4);

        when(currentUserProvider.requireCurrentUserId()).thenReturn(1L);
        when(projectMemberService.removeMember(10L, 2L, 1L)).thenReturn(response);

        mockMvc.perform(delete("/api/v1/projects/10/members/2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(2))
                .andExpect(jsonPath("$.unassignedTaskCount").value(4));

        verify(projectMemberService).removeMember(10L, 2L, 1L);
    }

    @Test
    @DisplayName("DELETE /api/v1/projects/{projectId}/members/{userId} - Trả về HTTP 403 khi service ném ForbiddenException")
    void testRemoveMember_returns403_whenForbidden() throws Exception {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(2L);
        when(projectMemberService.removeMember(10L, 3L, 2L))
                .thenThrow(new ForbiddenException("ACCESS_DENIED", "Chỉ Chủ dự án mới có quyền thực hiện hành động này."));

        mockMvc.perform(delete("/api/v1/projects/10/members/3"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("ACCESS_DENIED"));
    }
}
