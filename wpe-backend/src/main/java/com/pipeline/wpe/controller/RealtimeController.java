package com.pipeline.wpe.controller;

import com.pipeline.wpe.security.CurrentUserProvider;
import com.pipeline.wpe.service.event.SseEmitterService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/v1/realtime")
@RequiredArgsConstructor
@Tag(name = "00. Real-time Gateway", description = "Đường ống đẩy dữ liệu thời gian thực Server-Sent Events (SSE)")
public class RealtimeController {

    private final SseEmitterService sseEmitterService;
    private final CurrentUserProvider currentUserProvider;

    @GetMapping(value = "/subscribe", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @Operation(
        summary = "Đăng ký nhận sự kiện thời gian thực (SSE)",
        description = "Mở kết nối Server-Sent Events (SSE) để tự động nhận các sự kiện: TASK_UNLOCKED, TASK_STATUS_CHANGED, NOTIFICATION_RECEIVED mà không cần reload (F5) trang."
    )
    public SseEmitter subscribe(
        @Parameter(description = "ID người dùng cần lắng nghe sự kiện (Tùy chọn, mặc định lấy từ token hoặc dev context)")
        @RequestParam(required = false) Long userId
    ) {
        Long targetUserId = (userId != null) ? userId : currentUserProvider.getCurrentUserId().orElse(2L);
        return sseEmitterService.subscribe(targetUserId);
    }
}
