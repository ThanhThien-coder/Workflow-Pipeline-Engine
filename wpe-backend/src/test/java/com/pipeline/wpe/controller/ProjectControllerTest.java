package com.pipeline.wpe.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pipeline.wpe.dto.project.CloneTemplateRequest;
import com.pipeline.wpe.dto.project.CreateProjectRequest;
import com.pipeline.wpe.dto.project.ProjectDetailResponse;
import com.pipeline.wpe.dto.project.ProjectSummaryResponse;
import com.pipeline.wpe.dto.project.UpdateProjectStatusRequest;
import com.pipeline.wpe.exception.ConflictException;
import com.pipeline.wpe.security.CurrentUserProvider;
import com.pipeline.wpe.service.ProjectService;
import com.pipeline.wpe.service.TemplateCloneService;
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

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ProjectController.class)
@AutoConfigureMockMvc(addFilters = false)
class ProjectControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private ProjectService projectService;

    @MockBean
    private TemplateCloneService templateCloneService;

    @MockBean
    private CurrentUserProvider currentUserProvider;

    private final Instant now = Instant.now();

    private final ProjectSummaryResponse sampleSummary = new ProjectSummaryResponse(
        1L, "Core Banking Pipeline", "Microservices pipeline", "ACTIVE",
        2L, "Alex Kim", 10, 6, 2, 60.0, now, now,
        10, 2, 6
    );

    private final ProjectDetailResponse sampleDetail = new ProjectDetailResponse(
        1L, "Core Banking Pipeline", "Microservices pipeline", "ACTIVE",
        2L, "Alex Kim", 10, 6, 2, 60.0, now, now,
        Map.of("healthScore", 95), List.of()
    );

    @Test
    @DisplayName("GET /api/v1/projects - Trả về HTTP 200 và danh sách dự án của tôi")
    void testGetMyProjects_returns200() throws Exception {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(2L);
        when(projectService.getMyProjects(2L, "all", "ts")).thenReturn(List.of(sampleSummary));

        mockMvc.perform(get("/api/v1/projects"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].id").value(1))
            .andExpect(jsonPath("$[0].name").value("Core Banking Pipeline"))
            .andExpect(jsonPath("$[0].progressPercentage").value(60.0));
    }

    @Test
    @DisplayName("GET /api/v1/projects?tab=mine&sort=done - Gọi đúng projectService với tab và sort")
    void testGetMyProjects_withTabAndSort_returns200() throws Exception {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(2L);
        when(projectService.getMyProjects(2L, "mine", "done")).thenReturn(List.of(sampleSummary));

        mockMvc.perform(get("/api/v1/projects")
                .param("tab", "mine")
                .param("sort", "done"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].id").value(1));

        verify(projectService).getMyProjects(2L, "mine", "done");
    }

    @Test
    @DisplayName("GET /api/v1/projects/{id} - Trả về HTTP 200 và chi tiết dự án")
    void testGetProjectDetail_returns200() throws Exception {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(2L);
        when(projectService.getProjectDetail(1L, 2L)).thenReturn(sampleDetail);

        mockMvc.perform(get("/api/v1/projects/1"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(1))
            .andExpect(jsonPath("$.name").value("Core Banking Pipeline"))
            .andExpect(jsonPath("$.latestAiAnalysis.healthScore").value(95));
    }

    @Test
    @DisplayName("POST /api/v1/projects - Trả về HTTP 201 CREATED khi tạo dự án thành công")
    void testCreateProject_returns201() throws Exception {
        CreateProjectRequest request = new CreateProjectRequest("New Pipeline", "New pipeline description", null, "PRIVATE");
        ProjectDetailResponse createdResponse = new ProjectDetailResponse(
            100L, "New Pipeline", "New pipeline description", "DRAFT",
            2L, "Alex Kim", 0, 0, 0, 0.0, now, now,
            null, List.of()
        );

        when(currentUserProvider.requireCurrentUserId()).thenReturn(2L);
        when(projectService.createProject(any(CreateProjectRequest.class), eq(2L))).thenReturn(createdResponse);

        mockMvc.perform(post("/api/v1/projects")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").value(100))
            .andExpect(jsonPath("$.name").value("New Pipeline"))
            .andExpect(jsonPath("$.status").value("DRAFT"));
    }

    @Test
    @DisplayName("POST /api/v1/projects - Trả về HTTP 400 BAD REQUEST khi thiếu tên dự án")
    void testCreateProject_returns400_whenNameIsBlank() throws Exception {
        CreateProjectRequest invalidRequest = new CreateProjectRequest("", "Description", null, "PRIVATE");

        mockMvc.perform(post("/api/v1/projects")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(invalidRequest)))
            .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("PATCH /api/v1/projects/{id}/status - Trả về HTTP 200 OK khi đổi trạng thái")
    void testUpdateProjectStatus_returns200() throws Exception {
        UpdateProjectStatusRequest request = new UpdateProjectStatusRequest("ACTIVE");
        ProjectSummaryResponse updatedSummary = new ProjectSummaryResponse(
            1L, "Core Banking Pipeline", "Microservices pipeline", "ACTIVE",
            2L, "Alex Kim", 10, 6, 2, 60.0, now, now,
            10, 2, 6
        );

        when(currentUserProvider.requireCurrentUserId()).thenReturn(2L);
        when(projectService.updateProjectStatus(eq(1L), any(UpdateProjectStatusRequest.class), eq(2L)))
            .thenReturn(updatedSummary);

        mockMvc.perform(patch("/api/v1/projects/1/status")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(1))
            .andExpect(jsonPath("$.status").value("ACTIVE"));
    }

    @Test
    @DisplayName("PATCH /api/v1/projects/{id}/status - Trả về HTTP 409 khi ném ConflictException USE_PUBLISH")
    void testUpdateProjectStatus_returns409_whenConflictExceptionThrown() throws Exception {
        UpdateProjectStatusRequest request = new UpdateProjectStatusRequest("ACTIVE");

        when(currentUserProvider.requireCurrentUserId()).thenReturn(2L);
        when(projectService.updateProjectStatus(eq(1L), any(UpdateProjectStatusRequest.class), eq(2L)))
            .thenThrow(new ConflictException("USE_PUBLISH", "Dự án nháp chỉ chuyển sang ACTIVE bằng thao tác xuất bản (publish)."));

        mockMvc.perform(patch("/api/v1/projects/1/status")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error").value("USE_PUBLISH"));
    }

    @Test
    @DisplayName("POST /api/v1/projects/clone-template - Trả về HTTP 201 CREATED khi nhân bản DAG thành công")
    void testCloneTemplate_returns201() throws Exception {
        CloneTemplateRequest req = new CloneTemplateRequest(1L, "Cloned Pipeline", "Cloned desc", "PRIVATE");
        ProjectDetailResponse clonedDetail = new ProjectDetailResponse(
            200L, "Cloned Pipeline", "Cloned desc", "DRAFT",
            2L, "Alex Kim", 4, 0, 0, 0.0, now, now,
            null, List.of()
        );

        when(currentUserProvider.requireCurrentUserId()).thenReturn(2L);
        when(templateCloneService.cloneTemplate(any(CloneTemplateRequest.class), eq(2L)))
            .thenReturn(clonedDetail);

        mockMvc.perform(post("/api/v1/projects/clone-template")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").value(200))
            .andExpect(jsonPath("$.name").value("Cloned Pipeline"))
            .andExpect(jsonPath("$.status").value("DRAFT"));
    }

    @Test
    @DisplayName("POST /api/v1/projects/clone-template - Trả về HTTP 400 BAD REQUEST khi thiếu templateId")
    void testCloneTemplate_returns400_whenTemplateIdIsNull() throws Exception {
        CloneTemplateRequest invalidReq = new CloneTemplateRequest(null, "Pipeline Name", "Desc", "PRIVATE");

        mockMvc.perform(post("/api/v1/projects/clone-template")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(invalidReq)))
            .andExpect(status().isBadRequest());
    }
}
