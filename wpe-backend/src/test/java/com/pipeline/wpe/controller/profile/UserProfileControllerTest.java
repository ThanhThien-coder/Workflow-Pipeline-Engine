package com.pipeline.wpe.controller.profile;

import com.pipeline.wpe.controller.UserProfileController;
import com.pipeline.wpe.dto.request.profile.ChangePasswordRequest;
import com.pipeline.wpe.dto.request.profile.UpdateProfileRequest;
import com.pipeline.wpe.dto.response.profile.ProfileResponse;
import com.pipeline.wpe.exception.ConflictException;
import com.pipeline.wpe.exception.UnauthorizedException;
import com.pipeline.wpe.security.CurrentUserProvider;
import com.pipeline.wpe.service.profile.ProfileBadRequestException;
import com.pipeline.wpe.service.profile.ProfileService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(UserProfileController.class)
@AutoConfigureMockMvc(addFilters = false)
class UserProfileControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ProfileService profileService;

    @MockBean
    private CurrentUserProvider currentUserProvider;

    private final ProfileResponse sample = new ProfileResponse(
        "2", "Sarah Chen", "sarah.chen@pipeline.engine", "Project Lead", "Hi", "/uploads/avatars/2-abc.png",
        List.of("React"), new ProfileResponse.Links("https://github.com/sarah", "", ""),
        new ProfileResponse.Privacy("members", false, true), List.of(), List.of());

    private static final String UPDATE_BODY = """
        {"displayName":"Sarah Chen","email":"sarah.chen@pipeline.engine","title":"Project Lead","bio":"Hi",
         "skills":["React"],"links":{"github":"https://github.com/sarah","linkedin":"","website":""}}
        """;

    @BeforeEach
    void setUp() {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(2L);
    }

    @Test
    @DisplayName("GET /api/v1/users/me/profile -> 200, đúng dạng ProfileDto (userId là chuỗi)")
    void getProfile_200() throws Exception {
        when(profileService.getMyProfile(2L)).thenReturn(sample);

        mockMvc.perform(get("/api/v1/users/me/profile"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.userId").value("2"))
            .andExpect(jsonPath("$.userId").isString())
            .andExpect(jsonPath("$.displayName").value("Sarah Chen"))
            .andExpect(jsonPath("$.avatarUrl").value("/uploads/avatars/2-abc.png"))
            .andExpect(jsonPath("$.skills[0]").value("React"))
            .andExpect(jsonPath("$.links.github").value("https://github.com/sarah"))
            .andExpect(jsonPath("$.privacy.visibility").value("members"))
            .andExpect(jsonPath("$.projects").isArray())
            .andExpect(jsonPath("$.recentActivity").isArray());
    }

    @Test
    @DisplayName("PUT /api/v1/users/me/profile -> 200 ProfileDto")
    void updateProfile_200() throws Exception {
        when(profileService.updateProfile(eq(2L), any(UpdateProfileRequest.class))).thenReturn(sample);

        mockMvc.perform(put("/api/v1/users/me/profile").contentType(MediaType.APPLICATION_JSON).content(UPDATE_BODY))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.email").value("sarah.chen@pipeline.engine"));
    }

    @Test
    @DisplayName("PUT profile trùng email -> 409 EMAIL_TAKEN")
    void updateProfile_409() throws Exception {
        when(profileService.updateProfile(eq(2L), any(UpdateProfileRequest.class)))
            .thenThrow(new ConflictException("EMAIL_TAKEN", "Email đã được sử dụng."));

        mockMvc.perform(put("/api/v1/users/me/profile").contentType(MediaType.APPLICATION_JSON).content(UPDATE_BODY))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error").value("EMAIL_TAKEN"));
    }

    @Test
    @DisplayName("PUT profile email sai định dạng -> 400 VALIDATION_FAILED")
    void updateProfile_invalidEmail() throws Exception {
        mockMvc.perform(put("/api/v1/users/me/profile").contentType(MediaType.APPLICATION_JSON)
                .content("{\"displayName\":\"Sarah\",\"email\":\"not-an-email\"}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("VALIDATION_FAILED"));
        verify(profileService, never()).updateProfile(any(), any());
    }

    @Test
    @DisplayName("POST /api/v1/users/me/password -> 200 { success: true }")
    void changePassword_200() throws Exception {
        mockMvc.perform(post("/api/v1/users/me/password").contentType(MediaType.APPLICATION_JSON)
                .content("{\"currentPassword\":\"OldPassword1\",\"newPassword\":\"NewPassword9\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.message").value("Password updated successfully"));
        verify(profileService).changePassword(eq(2L), any(ChangePasswordRequest.class));
    }

    @Test
    @DisplayName("POST password sai mật khẩu hiện tại -> 400 WRONG_PASSWORD, body dạng ErrorResponse")
    void changePassword_wrongPassword() throws Exception {
        doThrow(ProfileBadRequestException.wrongPassword())
            .when(profileService).changePassword(eq(2L), any(ChangePasswordRequest.class));

        mockMvc.perform(post("/api/v1/users/me/password").contentType(MediaType.APPLICATION_JSON)
                .content("{\"currentPassword\":\"Wrong1234\",\"newPassword\":\"NewPassword9\"}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.status").value(400))
            .andExpect(jsonPath("$.error").value("WRONG_PASSWORD"))
            .andExpect(jsonPath("$.message").isString())
            .andExpect(jsonPath("$.path").value("/api/v1/users/me/password"))
            .andExpect(jsonPath("$.timestamp").exists());
    }

    @Test
    @DisplayName("POST password mật khẩu mới 7 ký tự -> 400 VALIDATION_FAILED, không gọi service")
    void changePassword_tooShort() throws Exception {
        mockMvc.perform(post("/api/v1/users/me/password").contentType(MediaType.APPLICATION_JSON)
                .content("{\"currentPassword\":\"OldPassword1\",\"newPassword\":\"Short12\"}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("VALIDATION_FAILED"))
            .andExpect(jsonPath("$.validationErrors[0].field").value("newPassword"));
        verify(profileService, never()).changePassword(any(), any());
    }

    @Test
    @DisplayName("Access token cũ (sau đổi mật khẩu) -> 401 TOKEN_EXPIRED")
    void oldAccessToken_401() throws Exception {
        when(currentUserProvider.requireCurrentUserId())
            .thenThrow(new UnauthorizedException(CurrentUserProvider.TOKEN_EXPIRED, "Access token không hợp lệ hoặc đã hết hạn."));

        mockMvc.perform(get("/api/v1/users/me/profile").header("Authorization", "Bearer old.jwt.token"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.error").value("TOKEN_EXPIRED"));
    }

    @Test
    @DisplayName("POST /api/v1/users/me/avatar (field 'file') -> 200 ProfileDto có avatarUrl")
    void uploadAvatar_200() throws Exception {
        when(profileService.uploadAvatar(eq(2L), any(MultipartFile.class))).thenReturn(sample);
        MockMultipartFile file = new MockMultipartFile("file", "a.png", "image/png", new byte[]{(byte) 0x89, 'P', 'N', 'G'});

        mockMvc.perform(multipart("/api/v1/users/me/avatar").file(file))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.avatarUrl").value("/uploads/avatars/2-abc.png"));
    }

    @Test
    @DisplayName("POST avatar sai định dạng -> 400 UNSUPPORTED_MEDIA")
    void uploadAvatar_unsupported() throws Exception {
        when(profileService.uploadAvatar(eq(2L), any(MultipartFile.class)))
            .thenThrow(ProfileBadRequestException.unsupportedMedia());
        MockMultipartFile file = new MockMultipartFile("file", "a.png", "image/png", "text".getBytes());

        mockMvc.perform(multipart("/api/v1/users/me/avatar").file(file))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("UNSUPPORTED_MEDIA"))
            .andExpect(jsonPath("$.path").value("/api/v1/users/me/avatar"));
    }

    @Test
    @DisplayName("POST avatar trên 2MB (service kiểm) -> 400 FILE_TOO_LARGE")
    void uploadAvatar_tooLarge_service() throws Exception {
        when(profileService.uploadAvatar(eq(2L), any(MultipartFile.class)))
            .thenThrow(ProfileBadRequestException.fileTooLarge());
        MockMultipartFile file = new MockMultipartFile("file", "big.png", "image/png", new byte[2 * 1024 * 1024 + 1]);

        mockMvc.perform(multipart("/api/v1/users/me/avatar").file(file))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("FILE_TOO_LARGE"));
    }

    @Test
    @DisplayName("MaxUploadSizeExceededException ném khi đang xử lý request của controller -> 400 FILE_TOO_LARGE")
    void uploadAvatar_maxUploadSizeExceeded() throws Exception {
        when(profileService.uploadAvatar(eq(2L), any(MultipartFile.class)))
            .thenThrow(new MaxUploadSizeExceededException(2L * 1024 * 1024));
        MockMultipartFile file = new MockMultipartFile("file", "big.png", "image/png", new byte[16]);

        mockMvc.perform(multipart("/api/v1/users/me/avatar").file(file))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("FILE_TOO_LARGE"));
    }

    @Test
    @DisplayName("DELETE /api/v1/users/me/avatar -> 200")
    void removeAvatar_200() throws Exception {
        when(profileService.removeAvatar(2L)).thenReturn(sample);

        mockMvc.perform(delete("/api/v1/users/me/avatar"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.userId").value("2"));
    }
}
