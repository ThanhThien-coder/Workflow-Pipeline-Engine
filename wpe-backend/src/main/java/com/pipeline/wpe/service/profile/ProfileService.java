package com.pipeline.wpe.service.profile;

import com.pipeline.wpe.dto.request.profile.ChangePasswordRequest;
import com.pipeline.wpe.dto.request.profile.ProfileLinksRequest;
import com.pipeline.wpe.dto.request.profile.UpdateProfileRequest;
import com.pipeline.wpe.dto.response.profile.ProfileResponse;
import com.pipeline.wpe.entity.UserEntity;
import com.pipeline.wpe.exception.ConflictException;
import com.pipeline.wpe.exception.ResourceNotFoundException;
import com.pipeline.wpe.repository.RefreshTokenRepository;
import com.pipeline.wpe.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;

/**
 * Hồ sơ cá nhân, đổi mật khẩu, ảnh đại diện (A5, Cụm 2 integration map).
 * <p>
 * ProfileDto của FE có vài trường DB chưa có; trả giá trị mặc định:
 * privacy = {members, showEmail=false, showStats=true}, projects = [], recentActivity = [].
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ProfileService {

    public static final String EMAIL_TAKEN = "EMAIL_TAKEN";
    /** Đặc tả A5: ảnh tối đa 2MB (khớp spring.servlet.multipart.max-file-size). */
    public static final long MAX_AVATAR_BYTES = 2L * 1024 * 1024;

    private static final ProfileResponse.Privacy DEFAULT_PRIVACY = new ProfileResponse.Privacy("members", false, true);

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final AvatarStorage avatarStorage;

    @Transactional(readOnly = true)
    public ProfileResponse getMyProfile(Long userId) {
        return toResponse(loadUser(userId));
    }

    @Transactional
    public ProfileResponse updateProfile(Long userId, UpdateProfileRequest request) {
        UserEntity user = loadUser(userId);
        String email = request.email().trim();
        boolean takenByOther = userRepository.findByEmail(email)
            .filter(other -> !other.getId().equals(userId))
            .isPresent();
        if (takenByOther) {
            throw emailTaken();
        }

        user.setFullName(request.displayName().trim());
        user.setEmail(email);
        user.setTitle(trimToEmpty(request.title()));
        user.setBio(trimToEmpty(request.bio()));
        user.setSkills(normalizeSkills(request.skills()));
        user.setLinks(normalizeLinks(request.links()));
        try {
            // flush ngay để vi phạm UNIQUE(email) (hai request đổi cùng lúc) thành 409, không thành 500
            user = userRepository.saveAndFlush(user);
        } catch (DataIntegrityViolationException e) {
            throw emailTaken();
        }
        return toResponse(user);
    }

    /**
     * Một transaction: băm BCrypt mật khẩu mới, token_version + 1 (mọi access token đang có mất hiệu lực
     * ở JwtAuthFilter), mọi refresh token của user đặt revoked = true (không làm mới được nữa).
     */
    @Transactional
    public void changePassword(Long userId, ChangePasswordRequest request) {
        UserEntity user = loadUser(userId);
        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw ProfileBadRequestException.wrongPassword();
        }
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        int current = user.getTokenVersion() == null ? 0 : user.getTokenVersion();
        user.setTokenVersion(current + 1);
        userRepository.save(user);
        refreshTokenRepository.revokeAllByUserId(userId);
        log.info("User #{} đổi mật khẩu: token_version -> {}, đã thu hồi mọi refresh token", userId, current + 1);
    }

    @Transactional
    public ProfileResponse uploadAvatar(Long userId, MultipartFile file) {
        UserEntity user = loadUser(userId);
        if (file == null || file.isEmpty()) {
            throw ProfileBadRequestException.unsupportedMedia();
        }
        if (file.getSize() > MAX_AVATAR_BYTES) {
            throw ProfileBadRequestException.fileTooLarge();
        }
        byte[] content;
        try {
            content = file.getBytes();
        } catch (IOException e) {
            throw new UncheckedIOException("Không đọc được file tải lên", e);
        }
        ImageType type = ImageMagicBytes.detect(content).orElseThrow(ProfileBadRequestException::unsupportedMedia);

        String oldUrl = user.getAvatarUrl();
        String newUrl = avatarStorage.save(userId, content, type);
        user.setAvatarUrl(newUrl);
        try {
            user = userRepository.save(user);
        } catch (RuntimeException e) {
            avatarStorage.deleteByUrl(newUrl);
            throw e;
        }
        // Commit xong mới xóa file cũ; rollback thì xóa file mới (tránh mất ảnh cũ hoặc để rác).
        afterCompletion(() -> avatarStorage.deleteByUrl(oldUrl), () -> avatarStorage.deleteByUrl(newUrl));
        return toResponse(user);
    }

    @Transactional
    public ProfileResponse removeAvatar(Long userId) {
        UserEntity user = loadUser(userId);
        String oldUrl = user.getAvatarUrl();
        user.setAvatarUrl(null);
        user = userRepository.save(user);
        afterCompletion(() -> avatarStorage.deleteByUrl(oldUrl), () -> { });
        return toResponse(user);
    }

    // ───────────────────────── Hàm phụ ─────────────────────────

    private UserEntity loadUser(Long userId) {
        return userRepository.findById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng #" + userId));
    }

    private static ConflictException emailTaken() {
        return new ConflictException(EMAIL_TAKEN, "Email đã được sử dụng.");
    }

    /** Có transaction đang chạy: chạy onCommit sau commit, onRollback sau rollback. Không có (unit test): chạy onCommit ngay. */
    private static void afterCompletion(Runnable onCommit, Runnable onRollback) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            onCommit.run();
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status == STATUS_COMMITTED) {
                    onCommit.run();
                } else if (status == STATUS_ROLLED_BACK) {
                    onRollback.run();
                }
            }
        });
    }

    private static String trimToEmpty(String value) {
        return value == null ? "" : value.trim();
    }

    private static List<String> normalizeSkills(List<String> skills) {
        LinkedHashSet<String> unique = new LinkedHashSet<>();
        if (skills != null) {
            for (String skill : skills) {
                String s = trimToEmpty(skill);
                if (!s.isEmpty()) {
                    unique.add(s);
                }
            }
        }
        return new ArrayList<>(unique);
    }

    private static Map<String, String> normalizeLinks(ProfileLinksRequest links) {
        Map<String, String> map = new LinkedHashMap<>();
        map.put("github", links == null ? "" : trimToEmpty(links.github()));
        map.put("linkedin", links == null ? "" : trimToEmpty(links.linkedin()));
        map.put("website", links == null ? "" : trimToEmpty(links.website()));
        return map;
    }

    private ProfileResponse toResponse(UserEntity user) {
        Map<String, String> links = user.getLinks() == null ? Map.of() : user.getLinks();
        String displayName = user.getFullName() != null && !user.getFullName().isBlank()
            ? user.getFullName() : user.getUsername();
        return new ProfileResponse(
            String.valueOf(user.getId()),
            displayName,
            user.getEmail(),
            trimToEmpty(user.getTitle()),
            trimToEmpty(user.getBio()),
            user.getAvatarUrl(),
            user.getSkills() == null ? List.of() : List.copyOf(user.getSkills()),
            new ProfileResponse.Links(
                links.getOrDefault("github", ""),
                links.getOrDefault("linkedin", ""),
                links.getOrDefault("website", "")),
            DEFAULT_PRIVACY,
            List.of(),
            List.of()
        );
    }
}
