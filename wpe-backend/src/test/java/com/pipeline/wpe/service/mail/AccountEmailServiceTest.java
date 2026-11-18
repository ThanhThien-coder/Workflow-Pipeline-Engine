package com.pipeline.wpe.service.mail;

import jakarta.mail.Message;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class AccountEmailServiceTest {

    @SuppressWarnings("unchecked")
    private ObjectProvider<JavaMailSender> provider(JavaMailSender sender) {
        ObjectProvider<JavaMailSender> p = mock(ObjectProvider.class);
        when(p.getIfAvailable()).thenReturn(sender);
        return p;
    }

    private AccountEmailService service(JavaMailSender sender, String host, String from) {
        return new AccountEmailService(provider(sender), host, from, "Workflow Pipeline Engine",
            "https://app.example.com/", Runnable::run);
    }

    private JavaMailSender realSender() {
        JavaMailSender sender = mock(JavaMailSender.class);
        when(sender.createMimeMessage()).thenReturn(new JavaMailSenderImpl().createMimeMessage());
        return sender;
    }

    @Test
    @DisplayName("isEnabled: cần host, from và JavaMailSender")
    void isEnabled() {
        JavaMailSender sender = mock(JavaMailSender.class);
        assertThat(service(sender, "smtp.example.com", "noreply@example.com").isEnabled()).isTrue();
        assertThat(service(sender, "", "noreply@example.com").isEnabled()).isFalse();
        assertThat(service(sender, "smtp.example.com", "").isEnabled()).isFalse();
        assertThat(service(null, "smtp.example.com", "noreply@example.com").isEnabled()).isFalse();
    }

    @Test
    @DisplayName("email đặt lại: subject đúng, link dạng base/reset-password#token=..., có ttl")
    void resetContent() {
        AccountEmailService s = service(mock(JavaMailSender.class), "h", "f@example.com");
        AccountEmailService.EmailContent c = s.buildPasswordResetContent("alex@example.com", "Alex", "example-token_1", 30);

        assertThat(c.subject()).isEqualTo("Reset your Workflow Pipeline Engine password");
        assertThat(c.text()).contains("https://app.example.com/reset-password#token=example-token_1")
            .contains("alex@example.com").contains("30 minutes").contains("only be used once").contains("Hi Alex");
        assertThat(c.html()).contains("href=\"https://app.example.com/reset-password#token=example-token_1\"");
    }

    @Test
    @DisplayName("email đặt lại: tên có <script> bị escape trong HTML")
    void resetContentEscapesName() {
        AccountEmailService s = service(mock(JavaMailSender.class), "h", "f@example.com");
        AccountEmailService.EmailContent c = s.buildPasswordResetContent("a@example.com", "<script>alert(1)</script>", "t", 30);

        assertThat(c.html()).doesNotContain("<script>").contains("&lt;script&gt;");
    }

    @Test
    @DisplayName("email xác nhận: subject đúng, giờ UTC đúng định dạng")
    void changedContent() {
        AccountEmailService s = service(mock(JavaMailSender.class), "h", "f@example.com");
        AccountEmailService.EmailContent c = s.buildPasswordChangedContent("a@example.com", "<b>Bob</b>",
            Instant.parse("2026-03-04T05:06:07Z"));

        assertThat(c.subject()).isEqualTo("Your Workflow Pipeline Engine password was changed");
        assertThat(c.text()).contains("2026-03-04 05:06 UTC").contains("a@example.com").contains("signed out");
        assertThat(c.html()).doesNotContain("<b>Bob</b>").contains("&lt;b&gt;Bob&lt;/b&gt;");
    }

    @Test
    @DisplayName("gửi: người nhận, from kèm tên, subject đúng")
    void sendsMessage() throws Exception {
        JavaMailSender sender = realSender();
        service(sender, "smtp.example.com", "noreply@example.com")
            .sendPasswordResetAfterCommit(5L, "alex@example.com", "", "alex", "example-token", 30);

        ArgumentCaptor<MimeMessage> msg = ArgumentCaptor.forClass(MimeMessage.class);
        verify(sender).send(msg.capture());
        MimeMessage m = msg.getValue();
        assertThat(m.getSubject()).isEqualTo("Reset your Workflow Pipeline Engine password");
        assertThat(((InternetAddress) m.getRecipients(Message.RecipientType.TO)[0]).getAddress()).isEqualTo("alex@example.com");
        InternetAddress from = (InternetAddress) m.getFrom()[0];
        assertThat(from.getAddress()).isEqualTo("noreply@example.com");
        assertThat(from.getPersonal()).isEqualTo("Workflow Pipeline Engine");
    }

    @Test
    @DisplayName("mail tắt -> không gửi gì")
    void disabledSendsNothing() {
        JavaMailSender sender = mock(JavaMailSender.class);
        AccountEmailService s = service(sender, "", "");
        s.sendPasswordResetAfterCommit(5L, "a@example.com", "A", "a", "t", 30);
        s.sendPasswordChangedAfterCommit(5L, "a@example.com", "A", "a", Instant.now());
        verifyNoInteractions(sender);
    }

    @Test
    @DisplayName("lỗi SMTP không ném ra ngoài")
    void smtpFailureSwallowed() {
        JavaMailSender sender = realSender();
        doThrow(new MailSendException("smtp down")).when(sender).send(any(MimeMessage.class));
        AccountEmailService s = service(sender, "smtp.example.com", "noreply@example.com");

        assertThatCode(() -> s.sendPasswordChangedAfterCommit(5L, "a@example.com", "A", "a", Instant.now()))
            .doesNotThrowAnyException();
        verify(sender).send(any(MimeMessage.class));
    }
}
