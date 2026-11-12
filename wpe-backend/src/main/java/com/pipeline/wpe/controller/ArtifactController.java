package com.pipeline.wpe.controller;

import com.pipeline.wpe.dto.artifact.ArtifactResponse;
import com.pipeline.wpe.dto.artifact.CreateArtifactRequest;
import com.pipeline.wpe.security.CurrentUserProvider;
import com.pipeline.wpe.service.ArtifactService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping({"/api/v1/projects/{projectId}/artifacts", "/api/projects/{projectId}/artifacts"})
@RequiredArgsConstructor
@Tag(name = "06. Artifacts Hub", description = "Kho tài nguyên liên kết và sản phẩm nghiệm thu ngoài của dự án")
public class ArtifactController {

    private final ArtifactService artifactService;
    private final CurrentUserProvider currentUserProvider;

    @GetMapping
    @Operation(
        summary = "6.1 Lấy danh sách tài nguyên của dự án",
        description = "Truy vấn danh mục liên kết tài nguyên ngoài (Figma, GitHub PR, Swagger, Docs) theo projectId, có thể lọc theo taskId hoặc kho chung."
    )
    public ResponseEntity<List<ArtifactResponse>> getProjectArtifacts(
        @PathVariable Long projectId,
        @Parameter(description = "ID công việc (Tùy chọn, để lấy tài nguyên của riêng task)")
        @RequestParam(required = false) Long nodeId,
        @Parameter(description = "Chỉ lấy tài nguyên trong Kho chung (is_in_repository = true)")
        @RequestParam(required = false) Boolean inRepo
    ) {
        Long currentUserId = currentUserProvider.getCurrentUserId().orElse(null);
        List<ArtifactResponse> responses = artifactService.getProjectArtifacts(projectId, nodeId, inRepo, currentUserId);
        return ResponseEntity.ok(responses);
    }

    @PostMapping
    @Operation(
        summary = "6.2 Thêm mới liên kết tài nguyên ngoài",
        description = "Thêm liên kết tài nguyên ngoài cấp dự án hoặc cấp task. Tự động nhận diện loại tài nguyên (FIGMA, PR, DOCS, SWAGGER, OTHER_LINK) nếu không chỉ định."
    )
    public ResponseEntity<ArtifactResponse> createArtifact(
        @PathVariable Long projectId,
        @Valid @RequestBody CreateArtifactRequest request
    ) {
        // C4: bắt buộc đăng nhập. Trước đây không đăng nhập vẫn tạo được và bị ghi là của admin (user 1).
        Long currentUserId = currentUserProvider.requireCurrentUserId();
        ArtifactResponse response = artifactService.createArtifact(projectId, request, currentUserId);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @DeleteMapping("/{artifactId}")
    @Operation(
        summary = "6.3 Xóa liên kết tài nguyên",
        description = "Xóa vĩnh viễn liên kết tài nguyên khỏi dự án. Yêu cầu quyền người upload, Owner dự án hoặc Quản trị viên."
    )
    public ResponseEntity<Void> deleteArtifact(
        @PathVariable Long projectId,
        @PathVariable Long artifactId
    ) {
        // C4: bắt buộc đăng nhập. Trước đây orElse(null) làm service bỏ qua luôn bước kiểm quyền xóa.
        Long currentUserId = currentUserProvider.requireCurrentUserId();
        artifactService.deleteArtifact(projectId, artifactId, currentUserId);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{artifactId}/repository")
    @Operation(
        summary = "6.4 Chuyển đổi cờ hiển thị trong Kho tài nguyên chung",
        description = "Bật/tắt trạng thái hiển thị trong Kho tài nguyên chung của dự án (is_in_repository)."
    )
    public ResponseEntity<ArtifactResponse> toggleRepository(
        @PathVariable Long projectId,
        @PathVariable Long artifactId,
        @Parameter(description = "Trạng thái hiển thị trong kho chung")
        @RequestParam(required = false, defaultValue = "true") Boolean isInRepo
    ) {
        // C4: thao tác ghi nên bắt buộc đăng nhập (Viewer bị chặn ở service).
        Long currentUserId = currentUserProvider.requireCurrentUserId();
        ArtifactResponse response = artifactService.toggleRepositoryVisibility(projectId, artifactId, isInRepo, currentUserId);
        return ResponseEntity.ok(response);
    }
}
