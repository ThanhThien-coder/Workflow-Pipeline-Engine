package com.pipeline.wpe.controller;

import com.pipeline.wpe.dto.request.node.SubmitTaskArtifactRequest;
import com.pipeline.wpe.dto.request.node.UpdateNodeStatusRequest;
import com.pipeline.wpe.dto.response.node.KanbanTaskResponse;
import com.pipeline.wpe.dto.response.node.SubmitTaskArtifactResponse;
import com.pipeline.wpe.security.CurrentUserProvider;
import com.pipeline.wpe.service.ProjectAuthorizationService;
import com.pipeline.wpe.service.engine.StateMachineService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Người thực hiện thao tác luôn lấy từ {@link CurrentUserProvider#requireCurrentUserId()} (token đăng nhập,
 * hoặc header X-Debug-User-Id ở chế độ dev). Không còn nhận {@code ?currentUserId=} và không còn rơi về user 2:
 * trước đây Cộng sự gửi {@code ?currentUserId=<id Owner>} là tự duyệt được bài của mình (X1 bước 3, phần NodeController).
 */
@RestController
@RequestMapping({"/api/v1", "/api"})
@RequiredArgsConstructor
@Tag(name = "05. My Tasks Kanban & FSM", description = "Máy trạng thái FSM Kanban, Thực thi công việc cá nhân và Cổng nghiệm thu")
public class NodeController {

    private final StateMachineService stateMachineService;
    private final CurrentUserProvider currentUserProvider;
    private final ProjectAuthorizationService projectAuthorizationService;

    @GetMapping("/projects/{projectId}/my-tasks")
    @Operation(
        summary = "5.1 Lấy danh sách My Tasks cá nhân hóa",
        description = "Hiển thị bảng Kanban cá nhân hóa với 4 cột (TODO, IN_PROGRESS, REVIEW, DONE). Tự động loại bỏ các tác vụ đang bị LOCKED. "
            + "Người gọi phải đăng nhập và là thành viên dự án (401 / 403)."
    )
    public ResponseEntity<List<KanbanTaskResponse>> getMyTasks(
        @PathVariable Long projectId,
        @Parameter(description = "Xem task của thành viên nào (tùy chọn, mặc định là chính người gọi). "
            + "Bảng Kanban theo phase dùng tham số này để tải task của từng thành viên.")
        @RequestParam(required = false) Long userId
    ) {
        Long callerId = currentUserProvider.requireCurrentUserId();
        projectAuthorizationService.verifyProjectMemberOrOwner(projectId, callerId);
        Long targetUserId = (userId != null) ? userId : callerId;
        List<KanbanTaskResponse> tasks = stateMachineService.getMyTasks(projectId, targetUserId);
        return ResponseEntity.ok(tasks);
    }

    @PatchMapping("/nodes/{taskId}/status")
    @Operation(
        summary = "5.2/5.4/5.5 Cập nhật trạng thái tác vụ Kanban & Cổng nghiệm thu",
        description = "Chuyển trạng thái task: TODO -> IN_PROGRESS, IN_PROGRESS -> TODO, REVIEW -> DONE (Owner hoặc Manager), REVIEW -> IN_PROGRESS (Yêu cầu làm lại kèm rejectReason). Áp dụng Optimistic Locking qua trường version."
    )
    public ResponseEntity<KanbanTaskResponse> updateStatus(
        @PathVariable Long taskId,
        @Valid @RequestBody UpdateNodeStatusRequest request
    ) {
        Long actorId = currentUserProvider.requireCurrentUserId();
        KanbanTaskResponse response = stateMachineService.updateStatus(taskId, request, actorId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/nodes/{taskId}/submit")
    @Operation(
        summary = "5.3 Nộp bài chờ nghiệm thu (kèm liên kết Artifact tùy chọn)",
        description = "Thành viên nộp sản phẩm hoàn thành để Owner nghiệm thu (IN_PROGRESS -> REVIEW). Đính kèm liên kết Artifact (PR, Figma, Docs) là tùy chọn (Optional)."
    )
    public ResponseEntity<SubmitTaskArtifactResponse> submitTask(
        @PathVariable Long taskId,
        @RequestBody SubmitTaskArtifactRequest request
    ) {
        Long actorId = currentUserProvider.requireCurrentUserId();
        SubmitTaskArtifactResponse response = stateMachineService.submitTaskArtifact(taskId, request, actorId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/nodes/{taskId}/force-unlock")
    @Operation(
        summary = "Mở khóa cưỡng bức (Force Unlock) cho Chủ dự án",
        description = "Project Owner mở khóa trực tiếp một tác vụ đang bị LOCKED sang TODO để thành viên làm trước bằng mock data mà không phá vỡ liên kết DAG."
    )
    public ResponseEntity<KanbanTaskResponse> forceUnlock(
        @PathVariable Long taskId
    ) {
        Long actorId = currentUserProvider.requireCurrentUserId();
        KanbanTaskResponse response = stateMachineService.forceUnlock(taskId, actorId);
        return ResponseEntity.ok(response);
    }
}
