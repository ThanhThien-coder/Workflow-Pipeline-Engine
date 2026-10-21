package com.pipeline.wpe.controller;

import com.pipeline.wpe.exception.CooldownActiveException;
import com.pipeline.wpe.service.ai.AiDiagnosticService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AiDiagnosticController.class)
@AutoConfigureMockMvc(addFilters = false)
class AiDiagnosticControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AiDiagnosticService aiDiagnosticService;

    @Test
    @DisplayName("GET /api/v1/projects/{id}/ai-analysis - Đọc cached analysis trả về 200")
    void testGetLatestAiAnalysis() throws Exception {
        Map<String, Object> analysis = Map.of(
            "analyzedAt", Instant.now().toString(),
            "criticalPath", List.of("WPE-001", "WPE-002")
        );
        when(aiDiagnosticService.getLatestAnalysis(1L)).thenReturn(analysis);

        mockMvc.perform(get("/api/v1/projects/1/ai-analysis"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.criticalPath[0]").value("WPE-001"));
    }

    @Test
    @DisplayName("POST /api/v1/projects/{id}/ai-diagnostics - Kích hoạt phân tích mới trả về 200")
    void testTriggerAiDiagnostics_Success() throws Exception {
        Map<String, Object> analysis = Map.of(
            "analyzedAt", Instant.now().toString(),
            "bottlenecks", List.of()
        );
        when(aiDiagnosticService.triggerAiDiagnostics(1L)).thenReturn(analysis);

        mockMvc.perform(post("/api/v1/projects/1/ai-diagnostics"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.analyzedAt").exists());
    }

    @Test
    @DisplayName("POST /api/v1/projects/{id}/ai-diagnostics - Cooldown còn hiệu lực trả về 429 COOLDOWN_ACTIVE")
    void testTriggerAiDiagnostics_CooldownActive() throws Exception {
        when(aiDiagnosticService.triggerAiDiagnostics(1L))
            .thenThrow(new CooldownActiveException(145L));

        mockMvc.perform(post("/api/v1/projects/1/ai-diagnostics"))
            .andExpect(status().isTooManyRequests())
            .andExpect(jsonPath("$.error").value("COOLDOWN_ACTIVE"))
            .andExpect(jsonPath("$.retryAfterSeconds").value(145));
    }
}

