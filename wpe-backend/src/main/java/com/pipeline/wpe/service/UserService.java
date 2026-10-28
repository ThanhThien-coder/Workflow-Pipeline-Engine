package com.pipeline.wpe.service;

import com.pipeline.wpe.dto.request.user.ChangePasswordRequest;
import com.pipeline.wpe.dto.request.user.UpdateProfileRequest;
import com.pipeline.wpe.dto.response.user.UserProfileResponse;
import org.springframework.web.multipart.MultipartFile;

public interface UserService {
    UserProfileResponse getMyProfile(Long userId);
    UserProfileResponse updateProfile(Long userId, UpdateProfileRequest request);
    void changePassword(Long userId, ChangePasswordRequest request);
    UserProfileResponse uploadAvatar(Long userId, MultipartFile file);
    UserProfileResponse removeAvatar(Long userId);
}

