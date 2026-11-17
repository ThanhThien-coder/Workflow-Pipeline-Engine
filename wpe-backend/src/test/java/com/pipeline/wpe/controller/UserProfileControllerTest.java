package com.pipeline.wpe.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pipeline.wpe.dto.request.profile.*;
import com.pipeline.wpe.dto.response.auth.AuthResponse;
import com.pipeline.wpe.dto.response.profile.ProfileLinksResponse;
import com.pipeline.wpe.dto.response.profile.ProfilePrivacyResponse;
import com.pipeline.wpe.dto.response.profile.ProfileProjectResponse;
import com.pipeline.wpe.dto.response.profile.ProfileResponse;
import com.pipeline.wpe.dto.response.profile.PublicProfileResponse;
import com.pipeline.wpe.exception.ResourceNotFoundException;
import com.pipeline.wpe.exception.BadRequestException;
import com.pipeline.wpe.exception.ConflictException;
import com.pipeline.wpe.exception.ForbiddenException;
import com.pipeline.wpe.security.CurrentUserProvider;
import com.pipeline.wpe.service.admin.AdminAuditService;
import com.pipeline.wpe.service.profile.UserProfileService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(UserProfileController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("Controller Tests for UserProfileController")
class UserProfileControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private UserProfileService userProfileService;

    @MockBean
    private CurrentUserProvider currentUserProvider;

    @MockBean
    private AdminAuditService adminAuditService;

    private ProfileResponse mockProfile() {
        return new ProfileResponse(
            "10",
            "Alex Dev",
            "alex.dev@example.com",
            "Engineer",
            "Bio text",
            "/uploads/avatars/10-photo.png",
            List.of("Java"),
            new ProfileLinksResponse("https://github.com/alexdev", "", ""),
            new ProfilePrivacyResponse("members", false, true),
            List.of(),
            List.of()
        );
    }

    @Test
    @DisplayName("GET /api/v1/users/me/profile -> 200 OK với ProfileResponse")
    void getMyProfile_success() throws Exception {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(10L);
        when(userProfileService.getMyProfile(10L)).thenReturn(mockProfile());

        mockMvc.perform(get("/api/v1/users/me/profile"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.userId").value("10"))
            .andExpect(jsonPath("$.displayName").value("Alex Dev"))
            .andExpect(jsonPath("$.email").value("alex.dev@example.com"));
    }

    @Test
    @DisplayName("PUT /api/v1/users/me/profile -> 200 OK khi cập nhật hợp lệ")
    void updateProfile_success() throws Exception {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(10L);
        UpdateProfileRequest request = new UpdateProfileRequest(
            "Alex New", "alex.new@example.com", "Architect", "New Bio", List.of("Spring"),
            new ProfileLinksRequest("https://github.com/alexnew", "", "")
        );
        when(userProfileService.updateProfile(eq(10L), any(UpdateProfileRequest.class))).thenReturn(mockProfile());

        mockMvc.perform(put("/api/v1/users/me/profile")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.userId").value("10"));
    }

    @Test
    @DisplayName("POST /api/v1/users/me/avatar -> 200 OK khi tải lên file ảnh")
    void uploadAvatar_success() throws Exception {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(10L);
        MockMultipartFile file = new MockMultipartFile("file", "avatar.png", "image/png", new byte[]{1, 2, 3});
        when(userProfileService.uploadAvatar(eq(10L), any())).thenReturn(mockProfile());

        mockMvc.perform(multipart("/api/v1/users/me/avatar").file(file))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.avatarUrl").value("/uploads/avatars/10-photo.png"));
    }

    @Test
    @DisplayName("POST /api/v1/users/me/avatar -> 400 FILE_TOO_LARGE khi file quá lớn")
    void uploadAvatar_fileTooLarge_returnsJsonError() throws Exception {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(10L);
        MockMultipartFile file = new MockMultipartFile("file", "avatar.png", "image/png", new byte[]{1, 2, 3});
        when(userProfileService.uploadAvatar(eq(10L), any()))
            .thenThrow(new BadRequestException("FILE_TOO_LARGE", "Kích thước ảnh tối đa là 2MB."));

        mockMvc.perform(multipart("/api/v1/users/me/avatar").file(file))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("FILE_TOO_LARGE"))
            .andExpect(jsonPath("$.message").value("Kích thước ảnh tối đa là 2MB."));
    }

    @Test
    @DisplayName("PUT /api/v1/users/me/profile -> 400 VALIDATION_FAILED khi dữ liệu không hợp lệ")
    void updateProfile_validationFailed_returnsJsonError() throws Exception {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(10L);
        UpdateProfileRequest request = new UpdateProfileRequest(
            "", "invalid-email", "", "", List.of(), null
        );
        when(userProfileService.updateProfile(eq(10L), any()))
            .thenThrow(new BadRequestException("VALIDATION_FAILED", "Tên hiển thị không hợp lệ."));

        mockMvc.perform(put("/api/v1/users/me/profile")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("VALIDATION_FAILED"))
            .andExpect(jsonPath("$.message").value("Tên hiển thị không hợp lệ."));
    }

    @Test
    @DisplayName("PUT /api/v1/users/me/profile -> 409 EMAIL_TAKEN khi email bị trùng")
    void updateProfile_emailTaken_returns409() throws Exception {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(10L);
        UpdateProfileRequest request = new UpdateProfileRequest(
            "Alex Dev", "other@example.com", "", "", List.of(), null
        );
        when(userProfileService.updateProfile(eq(10L), any()))
            .thenThrow(new ConflictException("EMAIL_TAKEN", "This email is already in use."));

        mockMvc.perform(put("/api/v1/users/me/profile")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error").value("EMAIL_TAKEN"));
    }

    @Test
    @DisplayName("POST /api/v1/users/me/password -> 200 OK với AuthResponse")
    void changePassword_success() throws Exception {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(10L);
        ChangePasswordRequest request = new ChangePasswordRequest("OldPass123!", "NewPass456!");
        when(userProfileService.changePassword(eq(10L), any()))
            .thenReturn(new AuthResponse("fresh-jwt", "fresh-rt", null));

        mockMvc.perform(post("/api/v1/users/me/password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.token").value("fresh-jwt"))
            .andExpect(jsonPath("$.refreshToken").value("fresh-rt"));
    }

    @Test
    @DisplayName("DELETE /api/v1/users/me/avatar -> 200 OK")
    void removeAvatar_success() throws Exception {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(10L);
        when(userProfileService.removeAvatar(10L)).thenReturn(mockProfile());

        mockMvc.perform(delete("/api/v1/users/me/avatar"))
            .andExpect(status().isOk());
    }

    @Test
    @DisplayName("PUT /api/v1/users/me/privacy -> 200 OK")
    void updatePrivacy_success() throws Exception {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(10L);
        UpdatePrivacyRequest request = new UpdatePrivacyRequest("public", true, false);
        when(userProfileService.updatePrivacy(eq(10L), any()))
            .thenReturn(new ProfilePrivacyResponse("public", true, false));

        mockMvc.perform(put("/api/v1/users/me/privacy")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.visibility").value("public"))
            .andExpect(jsonPath("$.showEmail").value(true));
    }

    @Test
    @DisplayName("PATCH /api/v1/users/me/projects/100 -> 200 OK")
    void setProjectPublic_success() throws Exception {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(10L);
        SetProjectPublicRequest request = new SetProjectPublicRequest(true);
        when(userProfileService.setProjectPublic(10L, 100L, true))
            .thenReturn(new ProfileProjectResponse("100", "Project A", "Active", "Owner", "Owner", true,
                new ProfileProjectResponse.Stats(2, 4, 100)));

        mockMvc.perform(patch("/api/v1/users/me/projects/100")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.projectId").value("100"))
            .andExpect(jsonPath("$.isPublic").value(true));
    }

    @Test
    @DisplayName("POST /api/v1/users/me/deactivate -> 204 No Content")
    void deactivateAccount_success() throws Exception {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(10L);

        mockMvc.perform(post("/api/v1/users/me/deactivate"))
            .andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("DELETE /api/v1/users/me -> 204 No Content")
    void deleteAccount_success() throws Exception {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(10L);
        DeleteAccountRequest request = new DeleteAccountRequest("DELETE");

        mockMvc.perform(delete("/api/v1/users/me")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("GET /api/v1/users/{id}/profile -> 200 OK, email/stats null duoc giu nguyen")
    void getUserProfile_success() throws Exception {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(10L);
        when(userProfileService.getPublicProfile(10L, 20L)).thenReturn(new PublicProfileResponse(
            "20", "Sam Lee", "Designer", "Bio", null, List.of("Figma"),
            new ProfileLinksResponse("", "", ""), null, null, List.of(), false
        ));

        mockMvc.perform(get("/api/v1/users/20/profile"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.userId").value("20"))
            .andExpect(jsonPath("$.displayName").value("Sam Lee"))
            .andExpect(jsonPath("$.email").doesNotExist())
            .andExpect(jsonPath("$.stats").doesNotExist())
            .andExpect(jsonPath("$.isSelf").value(false));
    }

    @Test
    @DisplayName("GET /api/v1/users/{id}/profile -> 404 khi khong duoc xem")
    void getUserProfile_notVisible_returns404() throws Exception {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(10L);
        when(userProfileService.getPublicProfile(10L, 20L))
            .thenThrow(new ResourceNotFoundException("Profile not found."));

        mockMvc.perform(get("/api/v1/users/20/profile"))
            .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("GET /api/users/me/profile van route toi ho so cua minh, khong nham voi {id}")
    void getMyProfile_stillRoutesToMe() throws Exception {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(10L);
        when(userProfileService.getMyProfile(10L)).thenReturn(mockProfile());

        mockMvc.perform(get("/api/users/me/profile"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.userId").value("10"));
    }
}
