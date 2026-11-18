package com.pipeline.wpe.service.auth;

import com.pipeline.wpe.entity.UserEntity;
import com.pipeline.wpe.exception.BadRequestException;
import com.pipeline.wpe.repository.RefreshTokenRepository;
import com.pipeline.wpe.repository.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Chạy 1 lần khi khởi động (sau Flyway): tài khoản seed còn mật khẩu mẫu công khai trong README
 * thì bắt buộc đổi sang SEED_ACCOUNT_PASSWORD, nếu không thì backend không khởi động.
 */
@Slf4j
@Component
public class SeedAccountGuard implements ApplicationRunner {

    /** Mật khẩu mẫu đã công khai trong README. */
    static final String PUBLIC_SEED_PASSWORD = "Password123!";
    static final List<String> SEED_USERNAMES = List.of("admin", "alex.kim", "sarah.chen");
    static final int MIN_LENGTH = 12;

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final boolean guardEnabled;
    private final String newPassword;

    public SeedAccountGuard(
        UserRepository userRepository,
        RefreshTokenRepository refreshTokenRepository,
        PasswordEncoder passwordEncoder,
        @Value("${app.seed-accounts.guard-enabled:true}") boolean guardEnabled,
        @Value("${app.seed-accounts.password:}") String newPassword
    ) {
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.guardEnabled = guardEnabled;
        this.newPassword = newPassword;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (!guardEnabled) {
            return;
        }
        List<UserEntity> exposed = userRepository.findByUsernameInAndDeletedAtIsNull(SEED_USERNAMES).stream()
            .filter(u -> u.getDeletedAt() == null)
            .filter(u -> u.getPasswordHash() != null
                && passwordEncoder.matches(PUBLIC_SEED_PASSWORD, u.getPasswordHash()))
            .toList();
        if (exposed.isEmpty()) {
            log.info("Seed account guard: no account uses the public sample password.");
            return;
        }

        List<String> names = exposed.stream().map(UserEntity::getUsername).toList();
        String problem = validateNewPassword();
        if (problem != null) {
            throw new IllegalStateException(
                "Seed accounts " + names + " still use the public sample password from the README. "
                    + "Set SEED_ACCOUNT_PASSWORD (at least " + MIN_LENGTH + " characters, containing a digit, "
                    + "different from the sample password) in deploy/.env: " + problem + ". "
                    + "Use SEED_ACCOUNT_GUARD_ENABLED=false only for local testing on a developer machine.");
        }

        String hash = passwordEncoder.encode(newPassword);
        for (UserEntity user : exposed) {
            user.setPasswordHash(hash);
            user.setTokenVersion((user.getTokenVersion() == null ? 0 : user.getTokenVersion()) + 1);
            userRepository.save(user);
            refreshTokenRepository.revokeAllByUserId(user.getId());
        }
        log.info("Seed account guard: replaced the public sample password of {} account(s): {}.", names.size(), names);
    }

    /** Trả về lý do không hợp lệ (không chứa giá trị mật khẩu), hoặc null nếu dùng được. */
    private String validateNewPassword() {
        if (newPassword == null || newPassword.isBlank()) {
            return "it is empty";
        }
        try {
            PasswordPolicy.validate(newPassword);
        } catch (BadRequestException e) {
            return "it does not meet the password policy";
        }
        if (newPassword.length() < MIN_LENGTH) {
            return "it is shorter than " + MIN_LENGTH + " characters";
        }
        if (newPassword.equals(PUBLIC_SEED_PASSWORD)) {
            return "it equals the public sample password";
        }
        return null;
    }
}
