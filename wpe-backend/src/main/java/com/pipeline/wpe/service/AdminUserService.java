package com.pipeline.wpe.service;

import com.pipeline.wpe.dto.request.user.SuspendUserRequest;
import com.pipeline.wpe.dto.response.user.AdminUserResponse;

import java.util.List;

public interface AdminUserService {
    List<AdminUserResponse> getUsers(String query, String status);
    AdminUserResponse getUserById(Long id);
    AdminUserResponse suspendUser(Long targetUserId, SuspendUserRequest request);
    AdminUserResponse unbanUser(Long targetUserId);
}

