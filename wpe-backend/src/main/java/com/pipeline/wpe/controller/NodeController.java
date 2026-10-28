package com.pipeline.wpe.controller;

import com.pipeline.wpe.dto.request.node.SubmitTaskArtifactRequest;
import com.pipeline.wpe.dto.request.node.UpdateNodeStatusRequest;
import com.pipeline.wpe.dto.response.node.KanbanTaskResponse;
import com.pipeline.wpe.dto.response.node.SubmitTaskArtifactResponse;
import com.pipeline.wpe.security.CurrentUserProvider;
import com.pipeline.wpe.service.engine.StateMachineService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping({"/api/v1", "/api"})
@RequiredArgsConstructor
@Tag(name = "05. My Tasks Kanban & FSM", description = "Máy trạng thái FSM Kanban, Thực thi công việc cá nhân và Cổng nghiệm thu")
public class NodeController {

    private final StateMachineService stateMachineService;
    private final CurrentUserProvider currentUserProvider;

    @GetMapping("/projects/{projectId}/my-tasks")
    @Operation(
        summary = "5.1 Lấy danh sách My Tasks cá nhân hóa",
        description = "Hiển thị bảng Kanban cá nhân hóa với 4 cột (TODO, IN_PROGRESS, REVIEW, DONE). Tự động loại bỏ các tác vụ đang bị LOCKED."
    )
    public ResponseEntity<List<KanbanTaskResponse>> getMyTasks(
        @PathVariable Long projectId,
        @Parameter(description = "ID người phụ trách (Tùy chọn, mặc định lấy từ token đăng nhập)")
        @RequestParam(required = false) Long userId
    ) {
        Long targetUserId = (userId != null) ? userId : currentUserProvider.getCurrentUserId().orElse(2L);
        List<KanbanTaskResponse> tasks = stateMachineService.getMyTasks(projectId, targetUserId);
        return ResponseEntity.ok(tasks);
    }

    @PatchMapping("/nodes/{taskId}/status")
    @Operation(
        summary = "5.2/5.4/5.5 Cập nhật trạng thái tác vụ Kanban & Cổng nghiệm thu",
        description = "Chuyển trạng thái task: TODO -> IN_PROGRESS, IN_PROGRESS -> TODO, REVIEW -> DONE (Chỉ Owner), REVIEW -> IN_PROGRESS (Yêu cầu làm lại kèm rejectReason). Áp dụng Optimistic Locking qua trường version."
    )
    public ResponseEntity<KanbanTaskResponse> updateStatus(
        @PathVariable Long taskId,
        @Valid @RequestBody UpdateNodeStatusRequest request,
        @Parameter(description = "ID người thực hiện thao tác (Tùy chọn khi test, mặc định đọc từ Security Context)")
        @RequestParam(required = false) Long currentUserId
    ) {
        Long actorId = (currentUserId != null) ? currentUserId : currentUserProvider.getCurrentUserId().orElse(2L);
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
        @RequestBody SubmitTaskArtifactRequest request,
        @Parameter(description = "ID người nộp bài (Tùy chọn)")
        @RequestParam(required = false) Long currentUserId
    ) {
        Long actorId = (currentUserId != null) ? currentUserId : currentUserProvider.getCurrentUserId().orElse(2L);
        SubmitTaskArtifactResponse response = stateMachineService.submitTaskArtifact(taskId, request, actorId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/nodes/{taskId}/force-unlock")
    @Operation(
        summary = "Mở khóa cưỡng bức (Force Unlock) cho Chủ dự án",
        description = "Project Owner mở khóa trực tiếp một tác vụ đang bị LOCKED sang TODO để thành viên làm trước bằng mock data mà không phá vỡ liên kết DAG."
    )
    public ResponseEntity<KanbanTaskResponse> forceUnlock(
        @PathVariable Long taskId,
        @Parameter(description = "ID Chủ dự án thực hiện Force Unlock (Tùy chọn)")
        @RequestParam(required = false) Long currentUserId
    ) {
        Long actorId = (currentUserId != null) ? currentUserId : currentUserProvider.getCurrentUserId().orElse(2L);
        KanbanTaskResponse response = stateMachineService.forceUnlock(taskId, actorId);
        return ResponseEntity.ok(response);
    }
}
