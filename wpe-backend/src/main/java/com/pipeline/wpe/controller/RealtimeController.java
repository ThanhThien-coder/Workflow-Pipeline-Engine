package com.pipeline.wpe.controller;

import com.pipeline.wpe.security.CurrentUserProvider;
import com.pipeline.wpe.service.event.SseEmitterService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping({"/api/v1/realtime", "/api/realtime"})
@RequiredArgsConstructor
@Tag(name = "00. Real-time Gateway", description = "Đường ống đẩy dữ liệu thời gian thực Server-Sent Events (SSE)")
public class RealtimeController {

    private final SseEmitterService sseEmitterService;
    private final CurrentUserProvider currentUserProvider;

    @GetMapping(value = "/subscribe", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @Operation(
        summary = "Đăng ký nhận sự kiện thời gian thực (SSE)",
        description = "Người nghe lấy từ JWT. Trình duyệt dùng EventSource nên gửi token qua ?access_token= (chỉ endpoint này)."
    )
    public SseEmitter subscribe() {
        Long userId = currentUserProvider.requireCurrentUserId();
        return sseEmitterService.subscribe(userId);
    }
}
