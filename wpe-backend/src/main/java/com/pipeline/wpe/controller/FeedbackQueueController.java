package com.pipeline.wpe.controller;

import com.pipeline.wpe.dto.response.feedback.ProjectFeedbackResponse;
import com.pipeline.wpe.dto.response.feedback.ResolveFeedbackResponse;
import com.pipeline.wpe.service.FeedbackQueueService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@Tag(name = "08. Feedback Queue", description = "Luồng tiếp thu ý kiến 1 chiều từ Khách ngoài & Giáo viên hướng dẫn")
public class FeedbackQueueController {

    private final FeedbackQueueService feedbackQueueService;

    @GetMapping({"/api/v1/projects/{id}/feedbacks", "/api/projects/{id}/feedbacks"})
    @Operation(summary = "8.2 Nhóm xem danh sách feedback trên Overview",
               description = "Hiển thị các góp ý từ Giáo viên/Khách ngoài trên thẻ Feedback Queue của màn hình Tổng quan.")
    public ResponseEntity<List<ProjectFeedbackResponse>> getProjectFeedbacks(@PathVariable("id") Long id) {
        List<ProjectFeedbackResponse> response = feedbackQueueService.getProjectFeedbacks(id);
        return ResponseEntity.ok(response);
    }

    @PatchMapping({"/api/v1/projects/{id}/feedbacks/{feedbackId}/resolve", "/api/projects/{id}/feedbacks/{feedbackId}/resolve"})
    @Operation(summary = "8.3 Nhóm đánh dấu giải quyết OPEN -> RESOLVED (1 chiều)",
               description = "Thành viên dự án tiếp thu ý kiến và bấm 'Đánh dấu Đã xử lý' để đóng góp ý. Không có ô phản hồi ngược lại.")
    public ResponseEntity<ResolveFeedbackResponse> resolveFeedback(
        @PathVariable("id") Long id,
        @PathVariable("feedbackId") Long feedbackId
    ) {
        ResolveFeedbackResponse response = feedbackQueueService.resolveFeedback(id, feedbackId);
        return ResponseEntity.ok(response);
    }
}
