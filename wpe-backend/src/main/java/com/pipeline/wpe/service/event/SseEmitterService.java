package com.pipeline.wpe.service.event;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Service quản lý các kết nối thời gian thực Server-Sent Events (SSE).
 * Đẩy trực tiếp các sự kiện thay đổi trạng thái, mở khóa downstream task và chuông thông báo
 * xuống trình duyệt của người dùng mà không cần reload trang.
 */
@Slf4j
@Service
public class SseEmitterService {

    // Timeout 30 phút cho mỗi kết nối SSE
    private static final long SSE_TIMEOUT = 30 * 60 * 1000L;

    // Lưu danh sách Emitter theo User ID: Key = userId, Value = SseEmitter
    private final Map<Long, SseEmitter> userEmitters = new ConcurrentHashMap<>();

    /**
     * Đăng ký kết nối SSE cho một người dùng.
     */
    public SseEmitter subscribe(Long userId) {
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT);

        userEmitters.put(userId, emitter);
        log.info("User ID [{}] đã kết nối SSE Stream.", userId);

        emitter.onCompletion(() -> {
            log.info("SSE Stream cho User ID [{}] hoàn tất.", userId);
            userEmitters.remove(userId);
        });

        emitter.onTimeout(() -> {
            log.info("SSE Stream cho User ID [{}] đã timeout.", userId);
            userEmitters.remove(userId);
        });

        emitter.onError(e -> {
            log.warn("Lỗi kết nối SSE cho User ID [{}]: {}", userId, e.getMessage());
            userEmitters.remove(userId);
        });

        // Gửi sự kiện INIT chào sân để xác nhận kết nối thành công
        try {
            emitter.send(SseEmitter.event()
                .name("INIT")
                .data("Connected successfully to Workflow Pipeline Real-time Stream"));
        } catch (IOException e) {
            log.warn("Không thể gửi sự kiện INIT tới User ID [{}]: {}", userId, e.getMessage());
            userEmitters.remove(userId);
        }

        return emitter;
    }

    /**
     * Bắn sự kiện thời gian thực tới một User cụ thể theo userId.
     */
    public void sendToUser(Long userId, String eventName, Object data) {
        SseEmitter emitter = userEmitters.get(userId);
        if (emitter != null) {
            try {
                emitter.send(SseEmitter.event()
                    .name(eventName)
                    .data(data));
                log.info("Đã bắn SSE event [{}] tới User ID [{}]", eventName, userId);
            } catch (IOException e) {
                log.warn("Lỗi khi bắn SSE event [{}] tới User ID [{}]. Gỡ emitter.", eventName, userId);
                userEmitters.remove(userId);
            }
        } else {
            log.debug("User ID [{}] chưa mở kết nối SSE. Bỏ qua push real-time.", userId);
        }
    }

    /**
     * Phát sóng (broadcast) sự kiện tới tất cả người dùng đang kết nối.
     */
    public void broadcast(String eventName, Object data) {
        userEmitters.forEach((userId, emitter) -> {
            try {
                emitter.send(SseEmitter.event()
                    .name(eventName)
                    .data(data));
            } catch (IOException e) {
                userEmitters.remove(userId);
            }
        });
    }

    /**
     * Kiểm tra xem user có đang kết nối SSE không.
     */
    public boolean isUserConnected(Long userId) {
        return userEmitters.containsKey(userId);
    }
}
