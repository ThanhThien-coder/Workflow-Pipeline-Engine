package com.pipeline.wpe.controller;

import com.pipeline.wpe.security.CurrentUserProvider;
import com.pipeline.wpe.service.event.SseEmitterService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(RealtimeController.class)
@AutoConfigureMockMvc(addFilters = false)
class RealtimeControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private SseEmitterService sseEmitterService;

    @MockBean
    private CurrentUserProvider currentUserProvider;

    @Test
    @DisplayName("GET /api/v1/realtime/subscribe - Trả về SSE Stream thành công theo userId đăng nhập")
    void testSubscribe_returnsSseEmitter() throws Exception {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(2L);
        when(sseEmitterService.subscribe(eq(2L))).thenReturn(new SseEmitter(10000L));

        mockMvc.perform(get("/api/v1/realtime/subscribe")
                .accept(MediaType.TEXT_EVENT_STREAM_VALUE))
            .andExpect(status().isOk());

        verify(currentUserProvider).requireCurrentUserId();
        verify(sseEmitterService).subscribe(2L);
    }

    @Test
    @DisplayName("GET /api/v1/realtime/subscribe?userId=3 - Bỏ qua param userId, lấy từ requireCurrentUserId")
    void testSubscribe_ignoresQueryParamUserId() throws Exception {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(7L);
        when(sseEmitterService.subscribe(eq(7L))).thenReturn(new SseEmitter(10000L));

        mockMvc.perform(get("/api/v1/realtime/subscribe")
                .param("userId", "3")
                .accept(MediaType.TEXT_EVENT_STREAM_VALUE))
            .andExpect(status().isOk());

        verify(currentUserProvider).requireCurrentUserId();
        verify(sseEmitterService).subscribe(7L);
        verify(sseEmitterService, never()).subscribe(3L);
    }
}
