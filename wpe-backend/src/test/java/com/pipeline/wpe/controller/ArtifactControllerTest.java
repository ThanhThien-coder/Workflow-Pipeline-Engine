package com.pipeline.wpe.controller;

import com.pipeline.wpe.exception.UnauthorizedException;
import com.pipeline.wpe.security.CurrentUserProvider;
import com.pipeline.wpe.service.ArtifactService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * C4: thêm/xóa/bật tắt link phải đăng nhập (không còn orElse(1L) / orElse(null)); URL không phải http(s) hợp lệ → 400.
 */
@WebMvcTest(ArtifactController.class)
@AutoConfigureMockMvc(addFilters = false)
class ArtifactControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ArtifactService artifactService;

    @MockBean
    private CurrentUserProvider currentUserProvider;

    private static String body(String url) {
        return "{\"name\":\"Link\",\"url\":\"" + url + "\"}";
    }

    @Test
    @DisplayName("POST link javascript:alert(1) → 400 VALIDATION_FAILED, service không được gọi")
    void create_javascriptUrl_validationFailed() throws Exception {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(3L);

        mockMvc.perform(post("/api/v1/projects/1/artifacts").contentType(MediaType.APPLICATION_JSON)
                .content(body("javascript:alert(1)")))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("VALIDATION_FAILED"));
        verify(artifactService, never()).createArtifact(anyLong(), any(), any());
    }

    @Test
    @DisplayName("POST link thiếu host (http:///abc) → 400 VALIDATION_FAILED")
    void create_missingHost_validationFailed() throws Exception {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(3L);

        mockMvc.perform(post("/api/v1/projects/1/artifacts").contentType(MediaType.APPLICATION_JSON)
                .content(body("http:///abc")))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("VALIDATION_FAILED"));
    }

    @Test
    @DisplayName("POST không đăng nhập → 401, không còn ghi nhận là admin (user 1)")
    void create_unauthenticated_401() throws Exception {
        when(currentUserProvider.requireCurrentUserId()).thenThrow(new UnauthorizedException("Yêu cầu đăng nhập"));
        when(currentUserProvider.getCurrentUserId()).thenReturn(java.util.Optional.empty());

        mockMvc.perform(post("/api/v1/projects/1/artifacts").contentType(MediaType.APPLICATION_JSON)
                .content(body("https://github.com/org/repo/pull/42")))
            .andExpect(status().isUnauthorized());
        verify(artifactService, never()).createArtifact(anyLong(), any(), eq(1L));
    }

    @Test
    @DisplayName("POST hợp lệ: service nhận đúng id người gọi")
    void create_valid_passesCurrentUser() throws Exception {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(3L);

        mockMvc.perform(post("/api/v1/projects/1/artifacts").contentType(MediaType.APPLICATION_JSON)
                .content(body("https://github.com/org/repo/pull/42")))
            .andExpect(status().isCreated());
        verify(artifactService).createArtifact(eq(1L), any(), eq(3L));
    }

    @Test
    @DisplayName("DELETE không đăng nhập → 401, service không được gọi")
    void delete_unauthenticated_401() throws Exception {
        when(currentUserProvider.requireCurrentUserId()).thenThrow(new UnauthorizedException("Yêu cầu đăng nhập"));
        when(currentUserProvider.getCurrentUserId()).thenReturn(java.util.Optional.empty());

        mockMvc.perform(delete("/api/v1/projects/1/artifacts/7"))
            .andExpect(status().isUnauthorized());
        verify(artifactService, never()).deleteArtifact(anyLong(), anyLong(), any());
    }

    @Test
    @DisplayName("PATCH bật/tắt kho không đăng nhập → 401, service không được gọi")
    void toggle_unauthenticated_401() throws Exception {
        when(currentUserProvider.requireCurrentUserId()).thenThrow(new UnauthorizedException("Yêu cầu đăng nhập"));
        when(currentUserProvider.getCurrentUserId()).thenReturn(java.util.Optional.empty());

        mockMvc.perform(patch("/api/v1/projects/1/artifacts/7/repository").param("isInRepo", "true"))
            .andExpect(status().isUnauthorized());
        verify(artifactService, never()).toggleRepositoryVisibility(anyLong(), anyLong(), anyBoolean(), any());
    }
}
