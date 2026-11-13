package com.pipeline.wpe.controller;

import com.pipeline.wpe.dto.response.notification.NotificationResponse;
import com.pipeline.wpe.dto.response.notification.UnreadCountResponse;
import com.pipeline.wpe.security.CurrentUserProvider;
import com.pipeline.wpe.service.NotificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping({"/api/v1/notifications", "/api/notifications"})
@RequiredArgsConstructor
@Tag(name = "Notifications", description = "Quản lý thông báo của người dùng hiện tại")
public class NotificationController {

    private final NotificationService notificationService;
    private final CurrentUserProvider currentUserProvider;

    @Operation(summary = "Lấy danh sách thông báo của người dùng hiện tại (mới nhất trước)")
    @GetMapping
    public ResponseEntity<List<NotificationResponse>> getNotifications(
            @RequestParam(defaultValue = "false") boolean unreadOnly,
            @RequestParam(defaultValue = "30") int limit
    ) {
        Long userId = currentUserProvider.requireCurrentUserId();
        return ResponseEntity.ok(notificationService.getNotifications(userId, unreadOnly, limit));
    }

    @Operation(summary = "Lấy số lượng thông báo chưa đọc của người dùng hiện tại")
    @GetMapping("/unread-count")
    public ResponseEntity<UnreadCountResponse> getUnreadCount() {
        Long userId = currentUserProvider.requireCurrentUserId();
        return ResponseEntity.ok(new UnreadCountResponse(notificationService.getUnreadCount(userId)));
    }

    @Operation(summary = "Đánh dấu đã đọc một thông báo của chính mình (của người khác -> 404)")
    @PatchMapping("/{id}/read")
    public ResponseEntity<NotificationResponse> markAsRead(@PathVariable Long id) {
        Long userId = currentUserProvider.requireCurrentUserId();
        return ResponseEntity.ok(notificationService.markAsRead(id, userId));
    }

    @Operation(summary = "Đánh dấu đã đọc tất cả thông báo của người dùng hiện tại")
    @RequestMapping(value = "/read-all", method = {RequestMethod.PATCH, RequestMethod.POST})
    public ResponseEntity<Map<String, Object>> markAllAsRead() {
        Long userId = currentUserProvider.requireCurrentUserId();
        int updatedCount = notificationService.markAllAsRead(userId);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "updatedCount", updatedCount
        ));
    }
}
