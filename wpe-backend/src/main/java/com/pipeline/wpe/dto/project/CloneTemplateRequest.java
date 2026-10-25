package com.pipeline.wpe.dto.project;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

@Schema(description = "Yêu cầu nhân bản quy trình từ mẫu có sẵn (DAG Clone Request)")
public record CloneTemplateRequest(
    @NotNull(message = "ID mẫu quy trình không được để trống")
    @Schema(description = "ID của mẫu quy trình hoặc dự án nguồn", example = "1")
    Long templateId,

    @NotBlank(message = "Tên dự án không được để trống")
    @Size(max = 100, message = "Tên dự án không được vượt quá 100 ký tự")
    @Schema(description = "Tên của dự án mới được khởi tạo", example = "E-Commerce Microservices Pipeline")
    String projectName,

    @Schema(description = "Mô tả chi tiết dự án", example = "Nhân bản từ mẫu chuẩn ngân hàng số")
    String description,

    @Schema(description = "Chế độ hiển thị dự án (PUBLIC hoặc PRIVATE)", example = "PRIVATE", defaultValue = "PRIVATE")
    String visibility
) {
    public CloneTemplateRequest {
        if (visibility == null || visibility.isBlank()) {
            visibility = "PRIVATE";
        }
    }

    public CloneTemplateRequest(Long templateId, String projectName, String description) {
        this(templateId, projectName, description, "PRIVATE");
    }

    public CloneTemplateRequest withTemplateId(Long newTemplateId) {
        return new CloneTemplateRequest(newTemplateId, this.projectName, this.description, this.visibility);
    }
}
