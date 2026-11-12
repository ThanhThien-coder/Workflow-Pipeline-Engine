package com.pipeline.wpe.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.HashMap;
import java.util.Map;

/**
 * Cấu hình RabbitMQ Topology trung tâm cho Workflow Pipeline Engine.
 * Định nghĩa Exchange, Queues, Dead Letter Queue (DLQ) và Message Converter.
 */
@Configuration
public class RabbitMQConfig {

    public static final String EXCHANGE_WORKFLOW = "wpe.workflow.exchange";
    public static final String EXCHANGE_DEAD_LETTER = "wpe.workflow.dlx";

    public static final String QUEUE_TASK_COMPLETED = "wpe.task.completed.queue";
    public static final String QUEUE_NOTIFICATION = "wpe.notification.queue";
    public static final String QUEUE_AI_DIAGNOSTICS = "wpe.ai.diagnostics.queue";
    public static final String QUEUE_DEAD_LETTER = "wpe.workflow.dlq";
    public static final String QUEUE_INVITATION = "wpe.invitation.queue";

    public static final String ROUTING_KEY_TASK_COMPLETED = "wpe.task.completed";
    public static final String ROUTING_KEY_NOTIFICATION = "wpe.notification.#";
    public static final String ROUTING_KEY_AI_DIAGNOSTICS = "wpe.ai.diagnostics";
    public static final String ROUTING_KEY_DEAD_LETTER = "wpe.workflow.dlq.key";
    public static final String ROUTING_KEY_INVITATION = "wpe.invitation.#";
    public static final String ROUTING_KEY_INVITATION_CREATED = "wpe.invitation.created";
    public static final String ROUTING_KEY_INVITATION_ACCEPTED = "wpe.invitation.accepted";

    // 1. Exchanges
    @Bean
    public TopicExchange workflowExchange() {
        return new TopicExchange(EXCHANGE_WORKFLOW, true, false);
    }

    @Bean
    public DirectExchange deadLetterExchange() {
        return new DirectExchange(EXCHANGE_DEAD_LETTER, true, false);
    }

    // 2. Dead Letter Queue (DLQ) để hứng message lỗi sau khi retry thất bại
    @Bean
    public Queue deadLetterQueue() {
        return QueueBuilder.durable(QUEUE_DEAD_LETTER).build();
    }

    @Bean
    public Binding deadLetterBinding(Queue deadLetterQueue, DirectExchange deadLetterExchange) {
        return BindingBuilder.bind(deadLetterQueue).to(deadLetterExchange).with(ROUTING_KEY_DEAD_LETTER);
    }

    // 3. Queue 1: Task Completed (Kích hoạt Kahn DAG Engine mở khóa downstream tasks)
    @Bean
    public Queue taskCompletedQueue() {
        Map<String, Object> args = new HashMap<>();
        args.put("x-dead-letter-exchange", EXCHANGE_DEAD_LETTER);
        args.put("x-dead-letter-routing-key", ROUTING_KEY_DEAD_LETTER);
        return QueueBuilder.durable(QUEUE_TASK_COMPLETED).withArguments(args).build();
    }

    @Bean
    public Binding taskCompletedBinding(Queue taskCompletedQueue, TopicExchange workflowExchange) {
        return BindingBuilder.bind(taskCompletedQueue).to(workflowExchange).with(ROUTING_KEY_TASK_COMPLETED);
    }

    // 4. Queue 2: Notification Dispatcher (Xử lý chuông báo & thông báo bất đồng bộ)
    @Bean
    public Queue notificationQueue() {
        Map<String, Object> args = new HashMap<>();
        args.put("x-dead-letter-exchange", EXCHANGE_DEAD_LETTER);
        args.put("x-dead-letter-routing-key", ROUTING_KEY_DEAD_LETTER);
        return QueueBuilder.durable(QUEUE_NOTIFICATION).withArguments(args).build();
    }

    @Bean
    public Binding notificationBinding(Queue notificationQueue, TopicExchange workflowExchange) {
        return BindingBuilder.bind(notificationQueue).to(workflowExchange).with(ROUTING_KEY_NOTIFICATION);
    }

    // 5. Queue 3: AI Diagnostics (Xếp hàng phân tích sự cố & CPM)
    @Bean
    public Queue aiDiagnosticsQueue() {
        Map<String, Object> args = new HashMap<>();
        args.put("x-dead-letter-exchange", EXCHANGE_DEAD_LETTER);
        args.put("x-dead-letter-routing-key", ROUTING_KEY_DEAD_LETTER);
        return QueueBuilder.durable(QUEUE_AI_DIAGNOSTICS).withArguments(args).build();
    }

    @Bean
    public Binding aiDiagnosticsBinding(Queue aiDiagnosticsQueue, TopicExchange workflowExchange) {
        return BindingBuilder.bind(aiDiagnosticsQueue).to(workflowExchange).with(ROUTING_KEY_AI_DIAGNOSTICS);
    }

    // 5b. Queue 4: Lời mời (C2). Trước đây lời mời đi routing key wpe.notification.invitation_* nên rơi vào queue
    // thông báo, bị đọc nhầm thành NotificationEvent rỗng và bỏ qua. Giờ có queue riêng.
    @Bean
    public Queue invitationQueue() {
        Map<String, Object> args = new HashMap<>();
        args.put("x-dead-letter-exchange", EXCHANGE_DEAD_LETTER);
        args.put("x-dead-letter-routing-key", ROUTING_KEY_DEAD_LETTER);
        return QueueBuilder.durable(QUEUE_INVITATION).withArguments(args).build();
    }

    @Bean
    public Binding invitationBinding(Queue invitationQueue, TopicExchange workflowExchange) {
        return BindingBuilder.bind(invitationQueue).to(workflowExchange).with(ROUTING_KEY_INVITATION);
    }

    // 6. JSON Message Converter (Serialize DTO sang JSON thay vì binary Java mặc định)
    @Bean
    public MessageConverter jsonMessageConverter(ObjectMapper objectMapper) {
        return new Jackson2JsonMessageConverter(objectMapper);
    }

    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory, MessageConverter jsonMessageConverter) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(jsonMessageConverter);
        return template;
    }
}
