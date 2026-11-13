package com.pipeline.wpe.controller.profile;

import com.pipeline.wpe.controller.UserProfileController;
import com.pipeline.wpe.security.CurrentUserProvider;
import com.pipeline.wpe.service.profile.ProfileService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** StaticResourceConfig phục vụ <app.upload.dir>/avatars/x.png tại /uploads/avatars/x.png. */
@WebMvcTest(UserProfileController.class)
@AutoConfigureMockMvc(addFilters = false)
class UploadsStaticResourceTest {

    @TempDir
    static Path uploadDir;

    @DynamicPropertySource
    static void uploadProps(DynamicPropertyRegistry registry) {
        registry.add("app.upload.dir", () -> uploadDir.toString());
    }

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ProfileService profileService;

    @MockBean
    private CurrentUserProvider currentUserProvider;

    @Test
    @DisplayName("GET /uploads/avatars/<file> -> 200, đúng nội dung file trên đĩa")
    void servesUploadedAvatar() throws Exception {
        byte[] png = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A};
        Files.createDirectories(uploadDir.resolve("avatars"));
        Files.write(uploadDir.resolve("avatars").resolve("2-test.png"), png);

        mockMvc.perform(get("/uploads/avatars/2-test.png"))
            .andExpect(status().isOk())
            .andExpect(content().bytes(png));
    }

    /**
     * GHI LẠI HÀNH VI HIỆN TẠI (chưa đúng ý): file không có -> Spring ném NoResourceFoundException, nhưng
     * GlobalExceptionHandler (file dùng chung, ngoài phạm vi A5) bắt mọi Exception thành 500.
     * Cần nhóm thêm handler NoResourceFoundException -> 404; khi đó đổi test này thành isNotFound().
     */
    @Test
    @DisplayName("GET /uploads/avatars/<không có> -> hiện là 500 (GlobalExceptionHandler bắt NoResourceFoundException)")
    void missingAvatar_currentBehavior() throws Exception {
        mockMvc.perform(get("/uploads/avatars/nope.png"))
            .andExpect(status().isInternalServerError())
            .andExpect(jsonPath("$.error").value("INTERNAL_SERVER_ERROR"));
    }
}
