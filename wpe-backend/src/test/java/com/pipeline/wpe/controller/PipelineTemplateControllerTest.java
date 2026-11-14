package com.pipeline.wpe.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pipeline.wpe.dto.request.template.CreateTemplateRequest;
import com.pipeline.wpe.dto.request.template.SetTemplateHiddenRequest;
import com.pipeline.wpe.security.CurrentUserProvider;
import com.pipeline.wpe.service.PipelineTemplateService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(PipelineTemplateController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("Controller Tests for PipelineTemplateController - Anti-Impersonation Check")
class PipelineTemplateControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private PipelineTemplateService templateService;

    @MockBean
    private CurrentUserProvider currentUserProvider;

    @Test
    @DisplayName("PUT /api/v1/templates/{id}?currentUserId=1 - Bỏ qua ?currentUserId, lấy userId từ CurrentUserProvider")
    void testUpdateTemplate_IgnoresQueryParamCurrentUserId() throws Exception {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(2L);
        CreateTemplateRequest request = new CreateTemplateRequest(
            "SDLC Updated",
            "Mô tả cập nhật",
            "Software Engineering",
            true,
            Map.of("nodes", List.of())
        );

        mockMvc.perform(put("/api/v1/templates/tpl-sdlc")
                .param("currentUserId", "1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isOk());

        verify(currentUserProvider).requireCurrentUserId();
        verify(templateService).updateTemplateBySlugOrId(eq("tpl-sdlc"), any(CreateTemplateRequest.class), eq(2L));
        verify(templateService, never()).updateTemplateBySlugOrId(any(), any(), eq(1L));
    }

    @Test
    @DisplayName("DELETE /api/v1/templates/{id}?currentUserId=1 - Bỏ qua ?currentUserId, lấy userId từ CurrentUserProvider")
    void testDeleteTemplate_IgnoresQueryParamCurrentUserId() throws Exception {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(2L);

        mockMvc.perform(delete("/api/v1/templates/5")
                .param("currentUserId", "1"))
            .andExpect(status().isNoContent());

        verify(currentUserProvider).requireCurrentUserId();
        verify(templateService).deleteTemplateBySlugOrId(eq("5"), eq(2L));
        verify(templateService, never()).deleteTemplateBySlugOrId(any(), eq(1L));
    }

    @Test
    @DisplayName("PATCH /api/v1/templates/{id}/hidden?currentUserId=1 - Bỏ qua ?currentUserId, lấy userId từ CurrentUserProvider")
    void testSetTemplateHidden_IgnoresQueryParamCurrentUserId() throws Exception {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(2L);
        SetTemplateHiddenRequest request = new SetTemplateHiddenRequest(true);

        mockMvc.perform(patch("/api/v1/templates/tpl-sdlc/hidden")
                .param("currentUserId", "1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isOk());

        verify(currentUserProvider).requireCurrentUserId();
        verify(templateService).setTemplateHidden(eq("tpl-sdlc"), eq(true), eq(2L));
        verify(templateService, never()).setTemplateHidden(any(), any(), eq(1L));
    }

    @Test
    @DisplayName("GET /api/v1/templates?currentUserId=1 - Bỏ qua ?currentUserId, lấy userId từ CurrentUserProvider")
    void testGetTemplates_IgnoresQueryParamCurrentUserId() throws Exception {
        when(currentUserProvider.getCurrentUserId()).thenReturn(Optional.of(2L));
        when(templateService.getTemplates(any(), any(), any(), eq(2L), any(), any()))
            .thenReturn(Collections.emptyList());

        mockMvc.perform(get("/api/v1/templates")
                .param("currentUserId", "1"))
            .andExpect(status().isOk());

        verify(currentUserProvider).getCurrentUserId();
        verify(templateService).getTemplates(isNull(), isNull(), isNull(), eq(2L), isNull(), isNull());
        verify(templateService, never()).getTemplates(any(), any(), any(), eq(1L), any(), any());
    }

    @Test
    @DisplayName("POST /api/v1/templates?currentUserId=1 - Bỏ qua ?currentUserId, lấy userId từ CurrentUserProvider")
    void testCreateTemplate_IgnoresQueryParamCurrentUserId() throws Exception {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(2L);
        CreateTemplateRequest request = new CreateTemplateRequest(
            "SDLC New",
            "Mô tả tạo mới",
            "Software Engineering",
            false,
            Map.of("nodes", List.of())
        );

        mockMvc.perform(post("/api/v1/templates")
                .param("currentUserId", "1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isCreated());

        verify(currentUserProvider).requireCurrentUserId();
        verify(templateService).createTemplate(any(CreateTemplateRequest.class), eq(2L));
        verify(templateService, never()).createTemplate(any(), eq(1L));
    }

    @Test
    @DisplayName("GET /api/v1/templates/{id}?currentUserId=1 - Bỏ qua ?currentUserId, lấy userId từ CurrentUserProvider")
    void testGetTemplateById_IgnoresQueryParamCurrentUserId() throws Exception {
        when(currentUserProvider.getCurrentUserId()).thenReturn(Optional.of(2L));

        mockMvc.perform(get("/api/v1/templates/tpl-sdlc")
                .param("currentUserId", "1"))
            .andExpect(status().isOk());

        verify(currentUserProvider).getCurrentUserId();
        verify(templateService).getTemplateByIdOrSlug(eq("tpl-sdlc"), eq(2L));
        verify(templateService, never()).getTemplateByIdOrSlug(any(), eq(1L));
    }

    @Test
    @DisplayName("GET /api/v1/templates - Khách chưa đăng nhập trả callerId là null")
    void testGetTemplates_GuestCallerIdIsNull() throws Exception {
        when(currentUserProvider.getCurrentUserId()).thenReturn(Optional.empty());
        when(templateService.getTemplates(any(), any(), any(), isNull(), any(), any()))
            .thenReturn(Collections.emptyList());

        mockMvc.perform(get("/api/v1/templates"))
            .andExpect(status().isOk());

        verify(currentUserProvider).getCurrentUserId();
        verify(templateService).getTemplates(isNull(), isNull(), isNull(), isNull(), isNull(), isNull());
    }
}
