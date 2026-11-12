package com.pipeline.wpe.service.event;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pipeline.wpe.config.RabbitMQConfig;
import com.pipeline.wpe.dto.event.InvitationAcceptedEvent;
import com.pipeline.wpe.dto.event.InvitationCreatedEvent;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.support.converter.MessageConverter;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * C2: sự kiện lời mời có queue riêng (wpe.invitation.queue, routing wpe.invitation.#) và converter
 * khôi phục đúng kiểu sự kiện từ header __TypeId__ (cần cho @RabbitHandler chọn hàm theo kiểu).
 */
class RabbitMQConfigTest {

    private final RabbitMQConfig config = new RabbitMQConfig();

    @Test
    @DisplayName("Queue lời mời: tên wpe.invitation.queue, có DLQ, gắn vào exchange với wpe.invitation.#")
    void invitationQueue_boundWithInvitationPattern() {
        Queue queue = config.invitationQueue();
        Binding binding = config.invitationBinding(queue, config.workflowExchange());

        assertThat(queue.getName()).isEqualTo("wpe.invitation.queue");
        assertThat(queue.getArguments()).containsEntry("x-dead-letter-exchange", RabbitMQConfig.EXCHANGE_DEAD_LETTER);
        assertThat(binding.getDestination()).isEqualTo("wpe.invitation.queue");
        assertThat(binding.getExchange()).isEqualTo(RabbitMQConfig.EXCHANGE_WORKFLOW);
        assertThat(binding.getRoutingKey()).isEqualTo("wpe.invitation.#");
    }

    @Test
    @DisplayName("Routing key lời mời không còn nằm dưới wpe.notification.* (không rơi vào queue thông báo nữa)")
    void invitationRoutingKeys_outsideNotificationPattern() {
        assertThat(RabbitMQConfig.ROUTING_KEY_INVITATION_CREATED).isEqualTo("wpe.invitation.created");
        assertThat(RabbitMQConfig.ROUTING_KEY_INVITATION_ACCEPTED).isEqualTo("wpe.invitation.accepted");
        assertThat(RabbitMQConfig.ROUTING_KEY_INVITATION_CREATED).doesNotStartWith("wpe.notification.");
        assertThat(RabbitMQConfig.ROUTING_KEY_INVITATION_ACCEPTED).doesNotStartWith("wpe.notification.");
    }

    @Test
    @DisplayName("Converter đọc lại đúng kiểu InvitationCreatedEvent / InvitationAcceptedEvent từ header __TypeId__")
    void converter_restoresInvitationEventTypes() {
        MessageConverter converter = config.jsonMessageConverter(new ObjectMapper().findAndRegisterModules());
        Instant at = Instant.parse("2026-11-12T08:00:00Z");
        InvitationCreatedEvent created = new InvitationCreatedEvent(7L, 1L, "Core Banking Pipeline", 2L, "Alex Kim",
            1L, "admin@pipeline.engine", "COLLABORATOR", "/workspace?action=open-invite-modal&invitationId=7", at);
        InvitationAcceptedEvent accepted = new InvitationAcceptedEvent(7L, 1L, "Core Banking Pipeline", 1L, "admin",
            "COLLABORATOR", at);

        Message createdMessage = converter.toMessage(created, new MessageProperties());
        Message acceptedMessage = converter.toMessage(accepted, new MessageProperties());

        assertThat(converter.fromMessage(createdMessage)).isEqualTo(created);
        assertThat(converter.fromMessage(acceptedMessage)).isEqualTo(accepted);
    }
}
