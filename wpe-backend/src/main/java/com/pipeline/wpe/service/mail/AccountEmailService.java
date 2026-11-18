package com.pipeline.wpe.service.mail;

import jakarta.annotation.PreDestroy;
import jakarta.mail.internet.MimeMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.util.StringUtils;
import org.springframework.web.util.HtmlUtils;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.Executor;

/**
 * Gửi email tài khoản (đặt lại mật khẩu, xác nhận đã đổi mật khẩu).
 * Gửi bất đồng bộ và chỉ sau khi transaction commit, để thời gian trả lời của API không phụ thuộc vào việc
 * email có tồn tại hay không. Lỗi gửi chỉ ghi log cảnh báo, không làm hỏng request và không log token.
 */
@Slf4j
@Service
public class AccountEmailService {

    public static final String RESET_SUBJECT = "Reset your Workflow Pipeline Engine password";
    public static final String CHANGED_SUBJECT = "Your Workflow Pipeline Engine password was changed";

    private static final DateTimeFormatter CHANGED_AT_FORMAT =
        DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm 'UTC'").withZone(ZoneOffset.UTC);

    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final String host;
    private final String from;
    private final String fromName;
    private final String frontendBaseUrl;
    private final Executor executor;
    private final ThreadPoolTaskExecutor ownedExecutor;

    @Autowired
    public AccountEmailService(
        ObjectProvider<JavaMailSender> mailSenderProvider,
        @Value("${spring.mail.host:}") String host,
        @Value("${app.mail.from:}") String from,
        @Value("${app.mail.from-name:Workflow Pipeline Engine}") String fromName,
        @Value("${app.frontend.base-url:http://localhost:5173}") String frontendBaseUrl
    ) {
        this.mailSenderProvider = mailSenderProvider;
        this.host = host;
        this.from = from;
        this.fromName = fromName;
        this.frontendBaseUrl = frontendBaseUrl;
        ThreadPoolTaskExecutor pool = new ThreadPoolTaskExecutor();
        pool.setCorePoolSize(1);
        pool.setMaxPoolSize(2);
        pool.setQueueCapacity(100);
        pool.setThreadNamePrefix("mail-");
        pool.initialize();
        this.ownedExecutor = pool;
        this.executor = pool;
    }

    /** Dùng cho test: truyền executor riêng (VD chạy ngay trên luồng gọi). */
    AccountEmailService(
        ObjectProvider<JavaMailSender> mailSenderProvider,
        String host,
        String from,
        String fromName,
        String frontendBaseUrl,
        Executor executor
    ) {
        this.mailSenderProvider = mailSenderProvider;
        this.host = host;
        this.from = from;
        this.fromName = fromName;
        this.frontendBaseUrl = frontendBaseUrl;
        this.executor = executor;
        this.ownedExecutor = null;
    }

    @PreDestroy
    void shutdown() {
        if (ownedExecutor != null) {
            ownedExecutor.shutdown();
        }
    }

    /** "Mail bật" = có host và địa chỉ gửi, và Spring tạo được JavaMailSender. */
    public boolean isEnabled() {
        return StringUtils.hasText(host) && StringUtils.hasText(from) && mailSenderProvider.getIfAvailable() != null;
    }

    /** Lên lịch gửi email đặt lại mật khẩu sau commit. Không làm gì nếu mail tắt. */
    public void sendPasswordResetAfterCommit(Long userId, String toEmail, String fullName, String username, String rawToken, long ttlMinutes) {
        if (!isEnabled()) {
            log.debug("Mail is disabled; password reset email not sent.");
            return;
        }
        EmailContent content = buildPasswordResetContent(toEmail, displayName(fullName, username), rawToken, ttlMinutes);
        afterCommit(() -> dispatch(userId, toEmail, content));
    }

    /** Lên lịch gửi email xác nhận đã đổi mật khẩu sau commit. Không làm gì nếu mail tắt. */
    public void sendPasswordChangedAfterCommit(Long userId, String toEmail, String fullName, String username, Instant changedAt) {
        if (!isEnabled()) {
            log.debug("Mail is disabled; password changed email not sent.");
            return;
        }
        EmailContent content = buildPasswordChangedContent(toEmail, displayName(fullName, username), changedAt);
        afterCommit(() -> dispatch(userId, toEmail, content));
    }

    // ---------- Nội dung ----------

    public record EmailContent(String subject, String text, String html) {}

    EmailContent buildPasswordResetContent(String email, String name, String rawToken, long ttlMinutes) {
        String link = resetLink(rawToken);
        String text = "Hi " + name + ",\n\n"
            + "We received a request to reset the password for the account " + email + ".\n\n"
            + "Choose a new password using the link below:\n" + link + "\n\n"
            + "This link expires in " + ttlMinutes + " minutes and can only be used once.\n\n"
            + "If you didn't request this, you can ignore this email. Your password won't change.\n";
        String html = "<p>Hi " + esc(name) + ",</p>"
            + "<p>We received a request to reset the password for the account <strong>" + esc(email) + "</strong>.</p>"
            + "<p><a href=\"" + esc(link) + "\" style=\"display:inline-block;padding:10px 18px;background:#2563eb;"
            + "color:#ffffff;text-decoration:none;border-radius:6px;\">Choose a new password</a></p>"
            + "<p>Or copy this link into your browser:<br>" + esc(link) + "</p>"
            + "<p>This link expires in " + ttlMinutes + " minutes and can only be used once.</p>"
            + "<p>If you didn't request this, you can ignore this email. Your password won't change.</p>";
        return new EmailContent(RESET_SUBJECT, text, html);
    }

    EmailContent buildPasswordChangedContent(String email, String name, Instant changedAt) {
        String when = CHANGED_AT_FORMAT.format(changedAt);
        String text = "Hi " + name + ",\n\n"
            + "The password for the account " + email + " was changed on " + when + ".\n\n"
            + "All other sessions have been signed out.\n\n"
            + "If this wasn't you, please contact your workspace administrator right away.\n";
        String html = "<p>Hi " + esc(name) + ",</p>"
            + "<p>The password for the account <strong>" + esc(email) + "</strong> was changed on " + esc(when) + ".</p>"
            + "<p>All other sessions have been signed out.</p>"
            + "<p>If this wasn't you, please contact your workspace administrator right away.</p>";
        return new EmailContent(CHANGED_SUBJECT, text, html);
    }

    String resetLink(String rawToken) {
        String base = frontendBaseUrl == null ? "" : frontendBaseUrl.trim();
        while (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        // Token đặt sau '#' để không đi vào log máy chủ
        return base + "/reset-password#token=" + rawToken;
    }

    private static String displayName(String fullName, String username) {
        return StringUtils.hasText(fullName) ? fullName.trim() : username;
    }

    private static String esc(String value) {
        return HtmlUtils.htmlEscape(value == null ? "" : value);
    }

    // ---------- Gửi ----------

    private void dispatch(Long userId, String toEmail, EmailContent content) {
        try {
            executor.execute(() -> send(userId, toEmail, content));
        } catch (RuntimeException ex) {
            // Hàng đợi đầy hoặc executor đã tắt: chỉ ghi log, không làm hỏng request
            log.warn("Could not queue email '{}' for user #{}: {}", content.subject(), userId, ex.getClass().getSimpleName());
        }
    }

    private void send(Long userId, String toEmail, EmailContent content) {
        try {
            JavaMailSender sender = mailSenderProvider.getIfAvailable();
            if (sender == null) {
                return;
            }
            MimeMessage message = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, StandardCharsets.UTF_8.name());
            helper.setFrom(from, fromName);
            helper.setTo(toEmail);
            helper.setSubject(content.subject());
            helper.setText(content.text(), content.html());
            sender.send(message);
        } catch (Exception ex) {
            // Không log nội dung email (có thể chứa token); chỉ log loại lỗi
            log.warn("Failed to send email '{}' to user #{}: {}", content.subject(), userId, ex.getClass().getSimpleName());
        }
    }

    /**
     * Chạy sau commit. Dùng afterCompletion(STATUS_COMMITTED) như StateMachineService để vẫn chạy khi được
     * đăng ký từ bên trong afterCommit của code khác. Không có transaction thì chạy ngay.
     */
    private void afterCommit(Runnable action) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            action.run();
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status != STATUS_COMMITTED) {
                    return;
                }
                try {
                    action.run();
                } catch (RuntimeException ex) {
                    log.warn("Failed to schedule email after commit: {}", ex.getClass().getSimpleName());
                }
            }
        });
    }
}
