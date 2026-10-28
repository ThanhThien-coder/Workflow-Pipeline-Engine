package com.pipeline.wpe.service.impl;

import com.pipeline.wpe.dto.request.user.ChangePasswordRequest;
import com.pipeline.wpe.dto.request.user.UpdateProfileRequest;
import com.pipeline.wpe.dto.response.user.UserProfileResponse;
import com.pipeline.wpe.entity.ProjectEntity;
import com.pipeline.wpe.entity.ProjectMemberEntity;
import com.pipeline.wpe.entity.UserEntity;
import com.pipeline.wpe.exception.ResourceNotFoundException;
import com.pipeline.wpe.repository.ProjectMemberRepository;
import com.pipeline.wpe.repository.ProjectRepository;
import com.pipeline.wpe.repository.RefreshTokenRepository;
import com.pipeline.wpe.repository.UserRepository;
import com.pipeline.wpe.service.FileStorageService;
import com.pipeline.wpe.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final PasswordEncoder passwordEncoder;
    private final FileStorageService fileStorageService;

    @Override
    @Transactional(readOnly = true)
    public UserProfileResponse getMyProfile(Long userId) {
        UserEntity user = findUserOrThrow(userId);
        return mapToProfileResponse(user);
    }

    @Override
    @Transactional
    public UserProfileResponse updateProfile(Long userId, UpdateProfileRequest request) {
        UserEntity user = findUserOrThrow(userId);

        // Kiểm tra trùng email nếu người dùng đổi email
        if (!user.getEmail().equalsIgnoreCase(request.email().trim())) {
            if (userRepository.existsByEmail(request.email().trim())) {
                throw new IllegalArgumentException("Email '" + request.email() + "' đã được sử dụng bởi một tài khoản khác.");
            }
            user.setEmail(request.email().trim());
        }

        user.setFullName(request.displayName().trim());
        if (request.title() != null) {
            user.setTitle(request.title().trim());
        }
        if (request.bio() != null) {
            user.setBio(request.bio().trim());
        }
        if (request.skills() != null) {
            user.setSkills(new ArrayList<>(request.skills()));
        }
        if (request.links() != null) {
            user.setLinks(request.links());
        }

        UserEntity saved = userRepository.save(user);
        log.info("Cập nhật hồ sơ thành công cho user ID: {}", userId);
        return mapToProfileResponse(saved);
    }

    @Override
    @Transactional
    public void changePassword(Long userId, ChangePasswordRequest request) {
        UserEntity user = findUserOrThrow(userId);

        // 1. Kiểm tra mật khẩu cũ
        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Mật khẩu hiện tại không chính xác.");
        }

        // 2. Không cho phép trùng mật khẩu cũ
        if (passwordEncoder.matches(request.newPassword(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Mật khẩu mới không được trùng với mật khẩu hiện tại.");
        }

        // 3. Cập nhật mật khẩu băm mới
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));

        // 4. Tăng token_version để vô hiệu hóa JWT token cũ
        user.setTokenVersion(user.getTokenVersion() + 1);
        userRepository.save(user);

        // 5. Thu hồi tất cả Refresh Token của user trên các thiết bị
        refreshTokenRepository.revokeAllByUserId(userId);

        log.info("Đổi mật khẩu thành công và tăng token_version cho user ID: {}", userId);
    }

    @Override
    @Transactional
    public UserProfileResponse uploadAvatar(Long userId, MultipartFile file) {
        UserEntity user = findUserOrThrow(userId);
        String avatarUrl = fileStorageService.storeAvatar(file);
        user.setAvatarUrl(avatarUrl);
        UserEntity saved = userRepository.save(user);
        log.info("Cập nhật avatarUrl cho user ID {}: {}", userId, avatarUrl);
        return mapToProfileResponse(saved);
    }

    @Override
    @Transactional
    public UserProfileResponse removeAvatar(Long userId) {
        UserEntity user = findUserOrThrow(userId);
        user.setAvatarUrl(null);
        UserEntity saved = userRepository.save(user);
        log.info("Đã xóa avatar cho user ID: {}", userId);
        return mapToProfileResponse(saved);
    }

    private UserEntity findUserOrThrow(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng với ID: " + userId));
    }

    private UserProfileResponse mapToProfileResponse(UserEntity user) {
        Map<String, String> linksMap = user.getLinks() != null ? user.getLinks() : Map.of();
        UserProfileResponse.ProfileLinksDto linksDto = new UserProfileResponse.ProfileLinksDto(
                linksMap.getOrDefault("github", ""),
                linksMap.getOrDefault("linkedin", ""),
                linksMap.getOrDefault("website", "")
        );

        UserProfileResponse.ProfilePrivacyDto privacyDto = new UserProfileResponse.ProfilePrivacyDto(
                "public",
                true,
                true
        );

        // Lấy danh sách dự án thành viên tham gia
        List<ProjectMemberEntity> memberships = projectMemberRepository.findByUserIdAndRemovedAtIsNull(user.getId());
        List<UserProfileResponse.ProfileProjectDto> projectDtos = new ArrayList<>();
        for (ProjectMemberEntity m : memberships) {
            projectRepository.findById(m.getProjectId()).ifPresent(p -> {
                projectDtos.add(new UserProfileResponse.ProfileProjectDto(
                        String.valueOf(p.getId()),
                        p.getName(),
                        "ACTIVE PHASES",
                        m.getRole().name(),
                        "Team Member",
                        true,
                        new UserProfileResponse.ProfileProjectStats(12, 15, 92)
                ));
            });
        }

        // Hoạt động gần đây mẫu
        List<UserProfileResponse.ProfileActivityDto> recentActivities = List.of(
                new UserProfileResponse.ProfileActivityDto("act-1", "Hoàn thành nhiệm vụ Database Schema 3NF", "2 giờ trước"),
                new UserProfileResponse.ProfileActivityDto("act-2", "Đã cập nhật tài liệu kiến trúc hệ thống", "1 ngày trước")
        );

        return new UserProfileResponse(
                String.valueOf(user.getId()),
                user.getFullName() != null ? user.getFullName() : user.getUsername(),
                user.getEmail(),
                user.getTitle() != null ? user.getTitle() : "Thành viên hệ thống",
                user.getBio() != null ? user.getBio() : "",
                user.getAvatarUrl(),
                user.getSkills() != null ? user.getSkills() : List.of(),
                linksDto,
                privacyDto,
                projectDtos,
                recentActivities
        );
    }
}

