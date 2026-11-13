package com.pipeline.wpe.dto.request.profile;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Body của PUT /api/v1/users/me/profile (khớp UpdateProfileCommand của FE).
 * Giới hạn độ dài bám theo cột DB: full_name/email 100, title 150.
 */
public record UpdateProfileRequest(
    @NotBlank(message = "Display name is required")
    @Size(max = 100, message = "Display name must be at most 100 characters")
    String displayName,

    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    @Size(max = 100, message = "Email must be at most 100 characters")
    String email,

    @Size(max = 150, message = "Title must be at most 150 characters")
    String title,

    @Size(max = 2000, message = "Bio must be at most 2000 characters")
    String bio,

    @Size(max = 30, message = "At most 30 skills")
    List<@NotBlank(message = "Skill must not be blank") @Size(max = 50, message = "Skill must be at most 50 characters") String> skills,

    @Valid
    ProfileLinksRequest links
) {}
