package com.pipeline.wpe.service.event;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyEmitter;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

/**
 * C2: một user mở nhiều tab (nhiều emitter), gỡ đúng emitter khi tab đóng, heartbeat PING gỡ emitter chết.
 * Dùng emitter giả ghi lại tên sự kiện đã gửi và giữ callback để giả lập tab đóng / timeout / lỗi mạng.
 */
class SseEmitterServiceTest {

    /** Emitter giả: ghi tên sự kiện; send lỗi khi {@code broken = true} (giống tab đã đóng mà server chưa biết). */
    static class FakeEmitter extends SseEmitter {
        final List<String> events = new ArrayList<>();
        boolean broken;
        Runnable onCompletion = () -> { };
        Runnable onTimeout = () -> { };
        Consumer<Throwable> onError = e -> { };

        @Override
        public void send(SseEventBuilder builder) throws IOException {
            if (broken) {
                throw new IOException("Broken pipe");
            }
            events.add(eventName(builder));
        }

        @Override
        public synchronized void onCompletion(Runnable callback) {
            this.onCompletion = callback;
        }

        @Override
        public synchronized void onTimeout(Runnable callback) {
            this.onTimeout = callback;
        }

        @Override
        public synchronized void onError(Consumer<Throwable> callback) {
            this.onError = callback;
        }

        private static String eventName(SseEventBuilder builder) {
            for (ResponseBodyEmitter.DataWithMediaType part : builder.build()) {
                if (part.getData() instanceof String text && text.contains("event:")) {
                    String rest = text.substring(text.indexOf("event:") + "event:".length());
                    return rest.substring(0, rest.indexOf('\n')).trim();
                }
            }
            return "?";
        }
    }

    private final List<FakeEmitter> created = new ArrayList<>();

    private final SseEmitterService service = new SseEmitterService() {
        @Override
        protected SseEmitter createEmitter() {
            FakeEmitter emitter = new FakeEmitter();
            created.add(emitter);
            return emitter;
        }
    };

    private FakeEmitter openTab(long userId) {
        service.subscribe(userId);
        return created.get(created.size() - 1);
    }

    @Test
    @DisplayName("Mở tab mới gửi INIT cho đúng tab đó")
    void subscribe_sendsInit() {
        FakeEmitter tab = openTab(3L);

        assertThat(tab.events).containsExactly("INIT");
        assertThat(service.isUserConnected(3L)).isTrue();
    }

    @Test
    @DisplayName("Cùng user mở 2 tab: sendToUser gửi tới CẢ HAI tab")
    void twoTabs_bothReceive() {
        FakeEmitter tab1 = openTab(3L);
        FakeEmitter tab2 = openTab(3L);

        service.sendToUser(3L, "TASK_STATUS_CHANGED", "payload");

        assertThat(tab1.events).containsExactly("INIT", "TASK_STATUS_CHANGED");
        assertThat(tab2.events).containsExactly("INIT", "TASK_STATUS_CHANGED");
    }

    @Test
    @DisplayName("Tab cũ đóng sau khi tab mới mở: chỉ gỡ tab cũ, tab mới vẫn nhận")
    void closingOldTab_keepsNewTab() {
        FakeEmitter oldTab = openTab(3L);
        FakeEmitter newTab = openTab(3L);

        oldTab.onCompletion.run();
        service.sendToUser(3L, "TASK_UNLOCKED", "payload");

        assertThat(oldTab.events).containsExactly("INIT");
        assertThat(newTab.events).containsExactly("INIT", "TASK_UNLOCKED");
        assertThat(service.isUserConnected(3L)).isTrue();
    }

    @Test
    @DisplayName("Timeout và lỗi mạng gỡ đúng emitter đó; gỡ hết thì user không còn kết nối")
    void timeoutAndError_removeOnlyThatEmitter() {
        FakeEmitter tab1 = openTab(3L);
        FakeEmitter tab2 = openTab(3L);

        tab1.onTimeout.run();
        assertThat(service.isUserConnected(3L)).isTrue();

        tab2.onError.accept(new IOException("reset"));
        assertThat(service.isUserConnected(3L)).isFalse();
    }

    @Test
    @DisplayName("Gửi lỗi ở 1 tab: chỉ gỡ tab lỗi, tab còn lại vẫn nhận lần sau")
    void sendFails_removesOnlyBrokenTab() {
        FakeEmitter broken = openTab(3L);
        FakeEmitter healthy = openTab(3L);
        broken.broken = true;

        service.sendToUser(3L, "TASK_SUBMITTED", "payload");
        broken.broken = false;
        service.sendToUser(3L, "TASK_REJECTED", "payload");

        assertThat(broken.events).containsExactly("INIT");
        assertThat(healthy.events).containsExactly("INIT", "TASK_SUBMITTED", "TASK_REJECTED");
    }

    @Test
    @DisplayName("Heartbeat gửi PING tới mọi emitter của mọi user")
    void heartbeat_pingsEveryEmitter() {
        FakeEmitter alex = openTab(2L);
        FakeEmitter sarah1 = openTab(3L);
        FakeEmitter sarah2 = openTab(3L);

        service.sendHeartbeat();

        assertThat(alex.events).containsExactly("INIT", "PING");
        assertThat(sarah1.events).containsExactly("INIT", "PING");
        assertThat(sarah2.events).containsExactly("INIT", "PING");
    }

    @Test
    @DisplayName("Heartbeat gỡ emitter chết; emitter chết cuối cùng bị gỡ thì user không còn kết nối")
    void heartbeat_removesDeadEmitters() {
        FakeEmitter dead = openTab(3L);
        FakeEmitter alive = openTab(3L);
        dead.broken = true;

        service.sendHeartbeat();
        assertThat(service.isUserConnected(3L)).isTrue();

        alive.broken = true;
        service.sendHeartbeat();
        assertThat(service.isUserConnected(3L)).isFalse();
    }

    @Test
    @DisplayName("Heartbeat chạy định kỳ 25 giây (@Scheduled fixedRate = 25000)")
    void heartbeat_isScheduledEvery25Seconds() throws NoSuchMethodException {
        Scheduled scheduled = SseEmitterService.class.getMethod("sendHeartbeat").getAnnotation(Scheduled.class);

        assertThat(scheduled).isNotNull();
        assertThat(scheduled.fixedRate()).isEqualTo(25000L);
    }

    @Test
    @DisplayName("broadcast gửi tới mọi tab của mọi user")
    void broadcast_reachesEveryTab() {
        FakeEmitter alex = openTab(2L);
        FakeEmitter sarah1 = openTab(3L);
        FakeEmitter sarah2 = openTab(3L);

        service.broadcast("TASK_STATUS_CHANGED", "payload");

        assertThat(alex.events).containsExactly("INIT", "TASK_STATUS_CHANGED");
        assertThat(sarah1.events).containsExactly("INIT", "TASK_STATUS_CHANGED");
        assertThat(sarah2.events).containsExactly("INIT", "TASK_STATUS_CHANGED");
    }

    @Test
    @DisplayName("User chưa mở tab nào: sendToUser bỏ qua, không lỗi")
    void sendToUser_notConnected_noError() {
        assertThatCode(() -> service.sendToUser(99L, "TASK_UNLOCKED", "payload")).doesNotThrowAnyException();
        assertThat(service.isUserConnected(99L)).isFalse();
    }
}
