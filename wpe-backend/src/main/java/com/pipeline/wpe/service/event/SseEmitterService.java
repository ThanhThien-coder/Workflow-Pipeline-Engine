package com.pipeline.wpe.service.event;

import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;

/**
 * Service quản lý các kết nối thời gian thực Server-Sent Events (SSE).
 * Đẩy trực tiếp các sự kiện thay đổi trạng thái, mở khóa downstream task và chuông thông báo
 * xuống trình duyệt của người dùng mà không cần reload trang.
 *
 * <p><b>Nhiều tab (C2):</b> mỗi user giữ một tập emitter, mỗi tab một emitter. {@link #sendToUser} gửi tới mọi tab.
 * Tab đóng, timeout hay lỗi thì chỉ gỡ đúng emitter của tab đó. Tập emitter dùng {@link CopyOnWriteArraySet}:
 * duyệt để gửi (thường xuyên) không cần khóa và không bị {@code ConcurrentModificationException} khi một tab
 * đóng giữa chừng; thêm/gỡ (hiếm) thì chép lại tập, chấp nhận được vì mỗi user chỉ có vài tab.
 *
 * <p><b>Heartbeat (C2):</b> cứ 25 giây gửi sự kiện {@code PING} tới mọi emitter, để proxy/trình duyệt không cắt
 * kết nối im lặng và để server phát hiện emitter chết (gửi lỗi thì gỡ).
 *
 * <p>Map emitter nằm trong RAM của từng instance: chạy nhiều instance backend thì user nối vào instance A sẽ không
 * nhận sự kiện phát ra ở instance B (cần pub/sub dùng chung, ví dụ Redis hoặc RabbitMQ fanout).
 */
@Slf4j
@Service
public class SseEmitterService {

    // Timeout 30 phút cho mỗi kết nối SSE
    private static final long SSE_TIMEOUT = 30 * 60 * 1000L;

    /** Chu kỳ heartbeat: 25 giây, ngắn hơn timeout nhàn rỗi 30–60 giây phổ biến của proxy. */
    static final long HEARTBEAT_INTERVAL_MS = 25_000L;

    // Key = userId, Value = các emitter đang mở của user đó (mỗi tab một emitter)
    private final Map<Long, Set<SseEmitter>> userEmitters = new ConcurrentHashMap<>();

    /**
     * Đăng ký kết nối SSE cho một người dùng (một tab).
     */
    public SseEmitter subscribe(Long userId) {
        SseEmitter emitter = createEmitter();

        // Thêm bên trong compute để nguyên tử với removeEmitter: tab cuối vừa đóng (map bỏ tập) đúng lúc tab mới mở
        // thì tab mới vẫn vào một tập còn nằm trong map, không bị thêm vào tập đã bị bỏ.
        userEmitters.compute(userId, (id, emitters) -> {
            Set<SseEmitter> set = (emitters != null) ? emitters : new CopyOnWriteArraySet<>();
            set.add(emitter);
            return set;
        });
        log.info("User ID [{}] đã kết nối SSE Stream ({} tab).", userId, connectionCount(userId));

        emitter.onCompletion(() -> {
            log.info("SSE Stream cho User ID [{}] hoàn tất.", userId);
            removeEmitter(userId, emitter);
        });

        emitter.onTimeout(() -> {
            log.info("SSE Stream cho User ID [{}] đã timeout.", userId);
            removeEmitter(userId, emitter);
        });

        emitter.onError(e -> {
            log.warn("Lỗi kết nối SSE cho User ID [{}]: {}", userId, e.getMessage());
            removeEmitter(userId, emitter);
        });

        // Gửi sự kiện INIT chào sân để xác nhận kết nối thành công
        try {
            emitter.send(SseEmitter.event()
                .name("INIT")
                .data("Connected successfully to Workflow Pipeline Real-time Stream"));
        } catch (IOException e) {
            log.warn("Không thể gửi sự kiện INIT tới User ID [{}]: {}", userId, e.getMessage());
            removeEmitter(userId, emitter);
        }

        return emitter;
    }

    /**
     * Bắn sự kiện thời gian thực tới mọi tab của một User cụ thể theo userId.
     */
    public void sendToUser(Long userId, String eventName, Object data) {
        Set<SseEmitter> emitters = userEmitters.get(userId);
        if (emitters == null || emitters.isEmpty()) {
            log.debug("User ID [{}] chưa mở kết nối SSE. Bỏ qua push real-time.", userId);
            return;
        }
        int sent = 0;
        for (SseEmitter emitter : emitters) {
            if (trySend(userId, emitter, eventName, data)) {
                sent++;
            }
        }
        log.info("Đã bắn SSE event [{}] tới User ID [{}] ({} tab)", eventName, userId, sent);
    }

    /**
     * Phát sóng (broadcast) sự kiện tới mọi tab của tất cả người dùng đang kết nối.
     */
    public void broadcast(String eventName, Object data) {
        userEmitters.forEach((userId, emitters) -> {
            for (SseEmitter emitter : emitters) {
                trySend(userId, emitter, eventName, data);
            }
        });
    }

    /**
     * Kiểm tra xem user có đang kết nối SSE không (còn ít nhất một tab).
     */
    public boolean isUserConnected(Long userId) {
        Set<SseEmitter> emitters = userEmitters.get(userId);
        return emitters != null && !emitters.isEmpty();
    }

    /**
     * Heartbeat: gửi {@code PING} tới mọi emitter; emitter nào gửi lỗi (tab đã đóng mà server chưa biết) thì gỡ.
     */
    @Scheduled(fixedRate = HEARTBEAT_INTERVAL_MS)
    public void sendHeartbeat() {
        broadcast("PING", "keep-alive");
    }

    /** Tạo emitter mới; test ghi đè để thay bằng emitter giả. */
    protected SseEmitter createEmitter() {
        return new SseEmitter(SSE_TIMEOUT);
    }

    private boolean trySend(Long userId, SseEmitter emitter, String eventName, Object data) {
        try {
            emitter.send(SseEmitter.event().name(eventName).data(data));
            return true;
        } catch (IOException | IllegalStateException e) {
            // IllegalStateException: emitter đã complete. IOException: kết nối đã đứt.
            log.warn("Lỗi khi bắn SSE event [{}] tới User ID [{}]: {}. Gỡ emitter của tab này.",
                eventName, userId, e.getMessage());
            removeEmitter(userId, emitter);
            return false;
        }
    }

    /** Gỡ đúng emitter của một tab; tab cuối cùng đóng thì bỏ luôn user khỏi map. */
    private void removeEmitter(Long userId, SseEmitter emitter) {
        userEmitters.computeIfPresent(userId, (id, emitters) -> {
            emitters.remove(emitter);
            return emitters.isEmpty() ? null : emitters;
        });
    }

    private int connectionCount(Long userId) {
        Set<SseEmitter> emitters = userEmitters.get(userId);
        return emitters == null ? 0 : emitters.size();
    }
}
