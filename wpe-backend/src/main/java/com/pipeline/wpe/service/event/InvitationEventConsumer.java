package com.pipeline.wpe.service.event;

import com.pipeline.wpe.config.RabbitMQConfig;
import com.pipeline.wpe.dto.event.InvitationAcceptedEvent;
import com.pipeline.wpe.dto.event.InvitationCreatedEvent;
import com.pipeline.wpe.dto.response.notification.NotificationResponse;
import com.pipeline.wpe.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitHandler;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import java.util.Objects;

/**
 * Consumer của queue lời mời {@code wpe.invitation.queue} (C2).
 *
 * <p>Trước C2, lời mời gửi routing key {@code wpe.notification.invitation_*}, rơi vào queue thông báo và bị đọc nhầm
 * thành {@code NotificationEvent} rỗng (log "Recipient=null, Title=null"), còn 2 hàm xử lý lời mời không có
 * {@code @RabbitListener} nên không bao giờ chạy: người được mời không nhận realtime.
 *
 * <p>Một queue chở 2 kiểu sự kiện nên dùng {@code @RabbitListener} ở mức lớp và {@code @RabbitHandler} cho từng hàm:
 * Spring đọc kiểu từ header {@code __TypeId__} rồi chọn đúng hàm. Gắn {@code @RabbitListener} riêng cho từng hàm trên
 * cùng một queue thì 2 consumer giành message của nhau, lời mời mới có thể rơi vào hàm "đã chấp nhận".
 *
 * <p>Consumer này <b>không lưu thông báo</b>: {@code ProjectInvitationService} đã lưu trong cùng transaction tạo lời mời,
 * và sự kiện chỉ được gửi sau commit (C1), nên ở đây đọc lại được bản ghi đó để đẩy SSE đúng 1 lần.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@RabbitListener(queues = RabbitMQConfig.QUEUE_INVITATION)
public class InvitationEventConsumer {

    private final NotificationRepository notificationRepository;
    private final SseEmitterService sseEmitterService;

    /**
     * Lời mời mới: tìm thông báo đã lưu cho người được mời (theo deep-link) và đẩy {@code NOTIFICATION_RECEIVED}.
     */
    @RabbitHandler
    public void handleInvitationCreated(InvitationCreatedEvent event) {
        log.info("Processing InvitationCreatedEvent: Invitation ID={}, Project={}, Invitee={}",
                event.invitationId(), event.projectName(), event.inviteeId());
        if (event.inviteeId() == null) {
            return;
        }
        notificationRepository.findByUserIdOrderByCreatedAtDesc(event.inviteeId()).stream()
                .filter(n -> Objects.equals(n.getLinkUrl(), event.linkUrl()))
                .findFirst()
                .ifPresentOrElse(
                        n -> sseEmitterService.sendToUser(event.inviteeId(), "NOTIFICATION_RECEIVED",
                                NotificationResponse.from(n)),
                        () -> log.warn("Không thấy thông báo lời mời {} của user {} (link {}), bỏ qua SSE.",
                                event.invitationId(), event.inviteeId(), event.linkUrl()));
    }

    /**
     * Lời mời được chấp nhận: hiện chưa có thông báo nào cho người mời trong đặc tả, chỉ ghi log để message được
     * xử lý (không nằm lại queue, không vào DLQ).
     */
    @RabbitHandler
    public void handleInvitationAccepted(InvitationAcceptedEvent event) {
        log.info("Processing InvitationAcceptedEvent: Invitation ID={}, Project={}, Invitee={}",
                event.invitationId(), event.projectName(), event.inviteeId());
    }
}
