package com.pipeline.wpe.service.event;

import com.pipeline.wpe.config.RabbitMQConfig;
import com.pipeline.wpe.dto.event.InvitationAcceptedEvent;
import com.pipeline.wpe.dto.event.InvitationCreatedEvent;
import com.pipeline.wpe.dto.response.notification.NotificationResponse;
import com.pipeline.wpe.entity.NotificationEntity;
import com.pipeline.wpe.repository.NotificationRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.amqp.rabbit.annotation.RabbitHandler;
import org.springframework.amqp.rabbit.annotation.RabbitListener;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * C2: sự kiện lời mời có queue riêng; người được mời nhận NOTIFICATION_RECEIVED đúng 1 lần,
 * consumer KHÔNG lưu thêm thông báo (ProjectInvitationService đã lưu sẵn).
 */
@ExtendWith(MockitoExtension.class)
class InvitationEventConsumerTest {

    @Mock
    private NotificationRepository notificationRepository;
    @Mock
    private SseEmitterService sseEmitterService;

    @InjectMocks
    private InvitationEventConsumer consumer;

    private static final String DEEP_LINK = "/workspace?action=open-invite-modal&invitationId=7";

    private final InvitationCreatedEvent created = new InvitationCreatedEvent(7L, 1L, "Core Banking Pipeline",
        2L, "Alex Kim", 1L, "admin@pipeline.engine", "COLLABORATOR", DEEP_LINK, Instant.now());

    private static NotificationEntity notification(long id, String linkUrl) {
        return NotificationEntity.builder().id(id).userId(1L).title("Lời mời tham gia dự án: Core Banking Pipeline")
            .message("Alex Kim đã mời bạn").linkUrl(linkUrl).isRead(false)
            .createdAt(Instant.parse("2026-11-12T08:00:00Z")).build();
    }

    @Test
    @DisplayName("Lời mời mới: đẩy đúng thông báo đã lưu (theo deep-link) qua SSE 1 lần, không lưu thêm")
    void created_pushesSavedNotificationOnce_withoutSaving() {
        NotificationEntity saved = notification(10L, DEEP_LINK);
        when(notificationRepository.findByUserIdOrderByCreatedAtDesc(1L))
            .thenReturn(List.of(notification(11L, "/projects/9/tasks"), saved));

        consumer.handleInvitationCreated(created);

        verify(sseEmitterService, times(1))
            .sendToUser(eq(1L), eq("NOTIFICATION_RECEIVED"), eq(NotificationResponse.from(saved)));
        verify(notificationRepository, never()).save(any());
    }

    @Test
    @DisplayName("Lời mời mới nhưng không tìm thấy thông báo đã lưu: không đẩy SSE, không tự tạo bản ghi")
    void created_notificationMissing_noPushNoSave() {
        when(notificationRepository.findByUserIdOrderByCreatedAtDesc(1L)).thenReturn(List.of());

        consumer.handleInvitationCreated(created);

        verify(sseEmitterService, never()).sendToUser(anyLong(), anyString(), any());
        verify(notificationRepository, never()).save(any());
    }

    @Test
    @DisplayName("Lời mời được chấp nhận: chỉ ghi log, không lưu thông báo, không đẩy SSE")
    void accepted_noSaveNoPush() {
        consumer.handleInvitationAccepted(new InvitationAcceptedEvent(7L, 1L, "Core Banking Pipeline",
            1L, "admin", "COLLABORATOR", Instant.now()));

        verify(notificationRepository, never()).save(any());
        verify(sseEmitterService, never()).sendToUser(anyLong(), anyString(), any());
    }

    @Test
    @DisplayName("Lớp nghe queue wpe.invitation.queue; 2 hàm là @RabbitHandler (Spring chọn hàm theo kiểu sự kiện)")
    void listensOnInvitationQueue() throws NoSuchMethodException {
        RabbitListener listener = InvitationEventConsumer.class.getAnnotation(RabbitListener.class);

        assertThat(listener).isNotNull();
        assertThat(listener.queues()).containsExactly(RabbitMQConfig.QUEUE_INVITATION);
        assertThat(InvitationEventConsumer.class.getMethod("handleInvitationCreated", InvitationCreatedEvent.class)
            .isAnnotationPresent(RabbitHandler.class)).isTrue();
        assertThat(InvitationEventConsumer.class.getMethod("handleInvitationAccepted", InvitationAcceptedEvent.class)
            .isAnnotationPresent(RabbitHandler.class)).isTrue();
    }
}
