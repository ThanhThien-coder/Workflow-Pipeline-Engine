package com.pipeline.wpe.controller;

import com.pipeline.wpe.dto.request.feedback.CreateGuestFeedbackRequest;
import com.pipeline.wpe.dto.request.guest.GenerateGuestTokenRequest;
import com.pipeline.wpe.dto.response.feedback.GuestFeedbackResponse;
import com.pipeline.wpe.dto.response.guest.GuestAccessResponse;
import com.pipeline.wpe.dto.response.guest.GuestOverviewResponse;
import com.pipeline.wpe.service.FeedbackQueueService;
import com.pipeline.wpe.service.GuestGatewayService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@Tag(name = "07. Guest Share Gateway", description = "Cổng chia sẻ công khai cho khách ngoài & Giáo viên xem tiến độ qua Token 64 ký tự")
public class GuestGatewayController {

    private final GuestGatewayService guestGatewayService;
    private final FeedbackQueueService feedbackQueueService;

    @PostMapping({"/api/v1/projects/{id}/guest-token", "/api/projects/{id}/guest-token"})
    @Operation(summary = "7.1 Sinh mới hoặc gia hạn Token chia sẻ (Chỉ Owner)",
               description = "Sinh chuỗi token ngẫu nhiên bảo mật 64 ký tự cho khách ngoài xem tiến độ Read-only.")
    public ResponseEntity<GuestAccessResponse> generateGuestToken(
        @PathVariable("id") Long id,
        @Valid @RequestBody(required = false) GenerateGuestTokenRequest request
    ) {
        Integer expiryDays = request != null ? request.expiryDays() : null;
        GuestAccessResponse response = guestGatewayService.generateOrRenewGuestToken(id, expiryDays);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping({"/api/v1/projects/{id}/guest-token", "/api/projects/{id}/guest-token"})
    @Operation(summary = "7.1 Thu hồi Token chia sẻ của dự án (Chỉ Owner)",
               description = "Hủy quyền truy cập của liên kết khách đã sinh trước đó.")
    public ResponseEntity<GuestAccessResponse> revokeGuestToken(@PathVariable("id") Long id) {
        GuestAccessResponse response = guestGatewayService.revokeGuestToken(id);
        return ResponseEntity.ok(response);
    }

    @GetMapping({"/api/v1/projects/{id}/guest-token", "/api/projects/{id}/guest-token"})
    @Operation(summary = "Lấy trạng thái liên kết khách hiện tại",
               description = "Xem token, URL chia sẻ và hạn dùng hiện tại của dự án.")
    public ResponseEntity<GuestAccessResponse> getGuestTokenStatus(@PathVariable("id") Long id) {
        GuestAccessResponse response = guestGatewayService.getGuestAccessState(id);
        return ResponseEntity.ok(response);
    }

    @GetMapping({"/api/v1/guest/{token}/overview", "/api/guest/{token}/overview"})
    @Operation(summary = "7.2 Khách truy cập Read-only qua link mang Token",
               description = "Cho phép Giáo viên hoặc Khách ngoài xem tổng quan số liệu KPI, tiến độ DAG và minh chứng mà không cần đăng nhập.")
    public ResponseEntity<GuestOverviewResponse> getGuestOverview(@PathVariable("token") String token) {
        GuestOverviewResponse response = guestGatewayService.getGuestOverview(token);
        return ResponseEntity.ok(response);
    }

    @PostMapping({"/api/v1/guest/{token}/feedback", "/api/guest/{token}/feedback"})
    @Operation(summary = "8.1 Khách gửi nhận xét 1 chiều vào task/project qua Token",
               description = "Tiếp thu ý kiến đóng góp từ khách ngoài. Lưu vào Feedback Queue và gửi chuông báo cho Chủ dự án.")
    public ResponseEntity<GuestFeedbackResponse> submitGuestFeedback(
        @PathVariable("token") String token,
        @Valid @RequestBody CreateGuestFeedbackRequest request
    ) {
        GuestFeedbackResponse response = feedbackQueueService.submitGuestFeedback(token, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
}

