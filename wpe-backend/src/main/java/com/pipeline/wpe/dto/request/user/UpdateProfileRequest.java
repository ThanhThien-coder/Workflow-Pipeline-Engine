package com.pipeline.wpe.dto.request.user;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

import java.util.List;
import java.util.Map;

@JsonIgnoreProperties(ignoreUnknown = true)
@Schema(description = "Yêu cầu cập nhật hồ sơ cá nhân")
public record UpdateProfileRequest(
    @NotBlank(message = "Tên hiển thị không được để trống")
    @Schema(description = "Họ tên người dùng", example = "Alex Kim")
    String displayName,

    @NotBlank(message = "Email không được để trống")
    @Email(message = "Email không đúng định dạng")
    @Schema(description = "Email liên hệ", example = "alex.kim@pipeline.engine")
    String email,

    @Schema(description = "Chức danh", example = "Principal Architect")
    String title,

    @Schema(description = "Tiểu sử cá nhân", example = "Designing robust distributed pipelines and state machines.")
    String bio,

    @Schema(description = "Danh sách kỹ năng", example = "[\"TypeScript\", \"Spring Boot\", \"DAG\", \"PostgreSQL\"]")
    List<String> skills,

    @Schema(description = "Các liên kết mạng xã hội / website")
    Map<String, String> links
) {}

