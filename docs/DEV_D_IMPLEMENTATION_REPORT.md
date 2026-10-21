# BÁO CÁO TRIỂN KHAI VÀ HƯỚNG DẪN BÀN GIAO — THÀNH VIÊN D (DEV D)
## PHÂN HỆ: GUEST GATEWAY, FEEDBACK QUEUE & AI INTEGRATION PROXY (CỤM 7, 8, 9)

> **Nhánh Git**: `feat/guest-feedback-ai`  
> **Người thực hiện**: Thành viên D (Dev D)  
> **Trạng thái**: Hoàn thành 100% (Pass 22/22 Tests, sẵn sàng tích hợp)  
> **Tài liệu tham chiếu chuẩn (SSOT)**: `docs/FRONTEND_BACKEND_INTEGRATION_MAP.md`, `docs/specs/system-overview.md`, `docs/TEAM_DEVELOPMENT_GUIDE.md`

---

## 1. TỔNG HỢP CÁC TÍNH NĂNG ĐÃ TRIỂN KHAI

### 🌐 Cụm 7: Cổng Chia Sẻ Công Khai Cho Khách & Giáo Viên (Guest Share Gateway)
1. **Sinh mới / Gia hạn Token chia sẻ 64 ký tự** (`POST /api/v1/projects/{id}/guest-token`):
   - Sinh chuỗi ngẫu nhiên bảo mật 64 hex characters sử dụng `SecureRandom`.
   - Thiết lập thời hạn mặc định 30 ngày (hỗ trợ tùy biến qua `expiryDays`).
   - Kiểm tra RBAC nghiêm ngặt: Chỉ Chủ dự án (`OWNER`) mới có quyền thực hiện.
   - Lưu trữ tại bảng `GUEST_LINK` (`is_revoked = false`, `expires_at`).
2. **Thu hồi Token chia sẻ** (`DELETE /api/v1/projects/{id}/guest-token`):
   - Chủ dự án đóng quyền truy cập: cập nhật `is_revoked = true`.
3. **Xem trạng thái Guest Link** (`GET /api/v1/projects/{id}/guest-token`):
   - Kiểm tra token, link chia sẻ đầy đủ và thời hạn còn lại.
4. **Cổng đọc công khai Read-only cho khách** (`GET /api/v1/guest/{token}/overview`):
   - Không yêu cầu JWT đăng nhập.
   - Thẩm định 3 lớp bảo mật: Token tồn tại, `is_revoked == false`, và chưa hết hạn (`expires_at > NOW()`). Nếu vi phạm ném `403 REVOKED_GUEST`.
   - Nạp thông tin dự án, tính toán KPI tổng hợp (`totalNodes`, `completedNodes`, `completionPct`, `overdueCount`, `blockingCount`), phân bổ trạng thái (`statusBreakdown`), vận tốc (`velocity`) và danh sách các minh chứng công khai (`ARTIFACTS.is_public_for_guest = true`).

---

### 💬 Cụm 8: Luồng Tiếp Thu Ý Kiến 1 Chiều (Feedback Queue)
1. **Khách gửi góp ý 1 chiều** (`POST /api/v1/guest/{token}/feedback`):
   - Khách/Giáo viên gửi nhận xét định danh (`reviewerName`, `reviewerRole: TEACHER | GUEST`, `content`, `nodeId` tùy chọn).
   - Kiểm tra hợp lệ `token` và tính thuộc về của `nodeId` trong dự án.
   - Lưu vào bảng `PROJECT_FEEDBACK` với trạng thái `status = 'OPEN'`.
   - Bắn sự kiện bất đồng bộ `NotificationEvent` qua RabbitMQ thông báo cho Chủ dự án.
   - **Quy tắc tiếp thu 1 chiều**: Tuyệt đối không mở cổng tranh luận/phản hồi ngược lại khách.
2. **Nhóm dự án xem danh sách góp ý** (`GET /api/v1/projects/{id}/feedbacks`):
   - Thành viên hoặc Owner xem danh sách feedback sắp xếp mới nhất lên đầu.
   - Tự động nạp thông tin chi tiết của task liên quan (`nodeRef: { nodeId, code, title }`).
3. **Đánh dấu Đã xử lý** (`PATCH /api/v1/projects/{id}/feedbacks/{feedbackId}/resolve`):
   - Thành viên tiếp thu và bấm hoàn tất: cập nhật trạng thái `OPEN` ➔ `RESOLVED`.

---

### 🤖 Cụm 9: Chẩn Đoán AI Bấm Nút Chủ Động (On-Demand AI Diagnostics)
1. **Đọc dữ liệu phân tích đã lưu** (`GET /api/v1/projects/{id}/ai-analysis`):
   - Đọc trực tiếp từ cột JSONB `PROJECT.latest_ai_analysis` (độ trễ < 2ms, chi phí 0 token).
2. **Kích hoạt chẩn đoán mới** (`POST /api/projects/{id}/ai-diagnostics`):
   - **Chốt chặn Cooldown (3 phút / 180s)**: Kiểm tra `analyzedAt`. Nếu bấm lặp lại khi chưa hết hạn mức sẽ ném `429 COOLDOWN_ACTIVE` kèm số giây còn lại (`retryAfterSeconds`).
   - **Kiến trúc Pluggable AI Client** (`AiServiceClient`): Tách biệt tầng gọi AI ra một Interface độc lập. Đã có sẵn bộ phân tích heuristic nội bộ tính toán đường găng CPM, điểm nghẽn Stalled Nodes, cảnh báo bẫy tiến độ và đề xuất tách task (`SPLIT_NODE`).
   - Ghi đè kết quả phân tích vào JSONB `latest_ai_analysis` trong Database và trả về `200 OK`.

---

### 🛡️ Hạ Tầng Hỗ Trợ: Bảo Mật, Lỗi Chuẩn & RabbitMQ Consumer
- **`CurrentUserProvider`**: Đọc `userId` từ Spring SecurityContext; chế độ dev hỗ trợ header `X-Debug-User-Id` (mặc định fallback về `2` - `alex.kim`, Project Owner) để test Swagger UI trực tiếp mà không bị chặn bởi Auth.
- **`GlobalExceptionHandler`**: Ánh xạ đầy đủ các mã lỗi theo RFC-7807 chuẩn SSOT:
  - `400 VALIDATION_FAILED` (khi để trống tên, nội dung)
  - `403 ACCESS_DENIED` (khi không đủ quyền Owner/Member)
  - `403 REVOKED_GUEST` (khi token khách bị hủy hoặc hết hạn)
  - `404 RESOURCE_NOT_FOUND` (khi không tìm thấy Project/Feedback/Node)
  - `429 COOLDOWN_ACTIVE` (khi spam nút AI Diagnostics)
- **`WorkflowEventConsumer`**: Triển khai lưu tự động `NotificationEntity` khi nhận `NotificationEvent` từ hàng đợi RabbitMQ.

---

## 2. DANH SÁCH CHI TIẾT CÁC FILE ĐÃ THAY ĐỔI & THÊM MỚI (32 FILES)

### ✏️ 2.1 Các file đã chỉnh sửa (5 files)
| STT | Đường dẫn file | Nội dung thay đổi |
| :-: | :--- | :--- |
| 1 | `wpe-backend/src/main/resources/application.yml` | Bổ sung cấu hình `app.security` (debug user id) và `app.ai` (cooldown 180s, AI service URL). |
| 2 | `wpe-backend/src/main/java/com/pipeline/wpe/security/SecurityConfig.java` | Công khai các endpoint `/api/v1/guest/**` và `/api/guest/**` cho khách truy cập không cần auth. |
| 3 | `wpe-backend/src/main/java/com/pipeline/wpe/exception/ErrorResponse.java` | Bổ sung trường `retryAfterSeconds` phục vụ mã lỗi HTTP 429 Cooldown. |
| 4 | `wpe-backend/src/main/java/com/pipeline/wpe/exception/GlobalExceptionHandler.java` | Bổ sung handler cho `ForbiddenException` (403), `UnauthorizedException` (401), `CooldownActiveException` (429). |
| 5 | `wpe-backend/src/main/java/com/pipeline/wpe/service/event/WorkflowEventConsumer.java` | Tiêm `NotificationRepository` để tự động lưu thông báo vào DB khi nhận event. |

---

### ➕ 2.2 Các file tạo mới (27 files)

#### Tầng Controller (3 files):
- `wpe-backend/src/main/java/com/pipeline/wpe/controller/GuestGatewayController.java`
- `wpe-backend/src/main/java/com/pipeline/wpe/controller/FeedbackQueueController.java`
- `wpe-backend/src/main/java/com/pipeline/wpe/controller/AiDiagnosticController.java`

#### Tầng Service & Security (7 files):
- `wpe-backend/src/main/java/com/pipeline/wpe/service/GuestGatewayService.java`
- `wpe-backend/src/main/java/com/pipeline/wpe/service/FeedbackQueueService.java`
- `wpe-backend/src/main/java/com/pipeline/wpe/service/ProjectAuthorizationService.java`
- `wpe-backend/src/main/java/com/pipeline/wpe/service/ai/AiDiagnosticService.java`
- `wpe-backend/src/main/java/com/pipeline/wpe/service/ai/AiServiceClient.java`
- `wpe-backend/src/main/java/com/pipeline/wpe/service/ai/AiServiceClientImpl.java`
- `wpe-backend/src/main/java/com/pipeline/wpe/security/CurrentUserProvider.java`

#### Tầng DTO Requests (2 files):
- `wpe-backend/src/main/java/com/pipeline/wpe/dto/request/guest/GenerateGuestTokenRequest.java`
- `wpe-backend/src/main/java/com/pipeline/wpe/dto/request/feedback/CreateGuestFeedbackRequest.java`

#### Tầng DTO Responses (6 files):
- `wpe-backend/src/main/java/com/pipeline/wpe/dto/response/guest/GuestAccessResponse.java`
- `wpe-backend/src/main/java/com/pipeline/wpe/dto/response/guest/GuestOverviewResponse.java`
- `wpe-backend/src/main/java/com/pipeline/wpe/dto/response/feedback/GuestFeedbackResponse.java`
- `wpe-backend/src/main/java/com/pipeline/wpe/dto/response/feedback/ProjectFeedbackResponse.java`
- `wpe-backend/src/main/java/com/pipeline/wpe/dto/response/feedback/ResolveFeedbackResponse.java`
- `wpe-backend/src/main/java/com/pipeline/wpe/dto/response/ai/AiAnalysisResult.java`

#### Tầng Ngoại Lệ Nghiệp Vụ (3 files):
- `wpe-backend/src/main/java/com/pipeline/wpe/exception/ForbiddenException.java`
- `wpe-backend/src/main/java/com/pipeline/wpe/exception/CooldownActiveException.java`
- `wpe-backend/src/main/java/com/pipeline/wpe/exception/UnauthorizedException.java`

#### Tầng Kiểm Thử Tự Động Test Suite (6 files):
- `wpe-backend/src/test/java/com/pipeline/wpe/service/GuestGatewayServiceTest.java` (5 tests)
- `wpe-backend/src/test/java/com/pipeline/wpe/service/FeedbackQueueServiceTest.java` (3 tests)
- `wpe-backend/src/test/java/com/pipeline/wpe/service/ai/AiDiagnosticServiceTest.java` (3 tests)
- `wpe-backend/src/test/java/com/pipeline/wpe/controller/GuestGatewayControllerTest.java` (6 tests)
- `wpe-backend/src/test/java/com/pipeline/wpe/controller/FeedbackQueueControllerTest.java` (2 tests)
- `wpe-backend/src/test/java/com/pipeline/wpe/controller/AiDiagnosticControllerTest.java` (3 tests)

---

## 3. KẾT QUẢ KIỂM THỬ TỰ ĐỘNG (UNIT & CONTROLLER TESTS)

Toàn bộ **22/22 tests** đều vượt qua 100% khi chạy `mvn test`:
```text
[INFO] Running com.pipeline.wpe.controller.AiDiagnosticControllerTest
[INFO] Tests run: 3, Failures: 0, Errors: 0, Skipped: 0
[INFO] Running com.pipeline.wpe.controller.FeedbackQueueControllerTest
[INFO] Tests run: 2, Failures: 0, Errors: 0, Skipped: 0
[INFO] Running com.pipeline.wpe.controller.GuestGatewayControllerTest
[INFO] Tests run: 6, Failures: 0, Errors: 0, Skipped: 0
[INFO] Running com.pipeline.wpe.service.ai.AiDiagnosticServiceTest
[INFO] Tests run: 3, Failures: 0, Errors: 0, Skipped: 0
[INFO] Running com.pipeline.wpe.service.FeedbackQueueServiceTest
[INFO] Tests run: 3, Failures: 0, Errors: 0, Skipped: 0
[INFO] Running com.pipeline.wpe.service.GuestGatewayServiceTest
[INFO] Tests run: 5, Failures: 0, Errors: 0, Skipped: 0
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS (Total time: 11.700 s)
```

---

## 4. HƯỚNG DẪN VIỆC CẦN LÀM KHI CÁC THÀNH VIÊN KHÁC HOÀN THÀNH

Phần của Dev D đã được thiết kế phân tách ranh giới độc lập (Loose Coupling) thông qua JPA Repositories và DI interfaces. Khi các bạn khác xong, bạn chỉ cần thực hiện các điểm sau:

### 🔹 4.1 Khi Dev A, Dev B, Dev C hoàn thành phần của họ:
- **KHÔNG CẦN SỬA CODE LOGIC CỦA DEV D**:
  - Khi Dev A thêm thành viên và tải Artifacts lên: Cổng Guest của Dev D tự động hiển thị đúng.
  - Khi Dev B tạo Phase và nối cạnh DAG: Cổng Guest của Dev D tự động hiển thị tên Phase và số lượng Nodes.
  - Khi Dev C cập nhật trạng thái Task sang `DONE`: Các chỉ số `completedNodes` và `completionPct` của Dev D tự động tính toán chính xác số liệu mới.

### 🔹 4.2 Khi nhóm Auth hoàn thành JWT Filter:
- Mở file [`CurrentUserProvider.java`](file:///c:/STUDY/OOAD/Workflow-Pipeline-Engine/wpe-backend/src/main/java/com/pipeline/wpe/security/CurrentUserProvider.java):
  - Hiện tại hàm `getCurrentUserId()` đã đọc từ `SecurityContextHolder.getContext().getAuthentication()`.
  - Nếu nhóm Auth lưu user trong một đối tượng riêng (ví dụ `CustomUserDetails`), chỉ cần bổ sung 2 dòng cast:
    ```java
    if (principal instanceof CustomUserDetails userDetails) {
        return Optional.of(userDetails.getId());
    }
    ```
  - Trong `application.yml`: Khi đưa lên môi trường thật, đổi:
    ```yaml
    app:
      security:
        debug-user-id-enabled: false
    ```'

### 🔹 4.3 Khi nhóm AI gửi Contract & Endpoint chính thức:
- Mở file [`AiServiceClientImpl.java`](file:///c:/STUDY/OOAD/Workflow-Pipeline-Engine/wpe-backend/src/main/java/com/pipeline/wpe/service/ai/AiServiceClientImpl.java):
  - Nhóm AI sẽ cung cấp URL (ví dụ: `POST http://localhost:8081/api/ai/diagnose`).
  - Thay thế khối tính toán heuristic giả lập trong hàm `requestDiagnosis()` bằng lời gọi `RestTemplate` hoặc `WebClient`:
    ```java
    // Gọi microservice AI của nhóm AI
    ResponseEntity<Map> response = restTemplate.postForEntity(aiServiceUrl + "/diagnose", payload, Map.class);
    return response.getBody();
    ```
  - Mọi logic Cooldown 3 phút, lưu vào JSONB `PROJECT.latest_ai_analysis` và xử lý HTTP 429 đã hoàn chỉnh sẵn.

### 🔹 4.4 Ghép nối với Frontend (React):
- Frontend chỉ cần triển khai `HttpWorkflowService` và `HttpGuestService` gọi vào các endpoint của Dev D:
  - `POST /api/v1/projects/{id}/guest-token`
  - `DELETE /api/v1/projects/{id}/guest-token`
  - `GET /api/v1/guest/{token}/overview`
  - `POST /api/v1/guest/{token}/feedback`
  - `GET /api/v1/projects/{id}/feedbacks`
  - `PATCH /api/v1/projects/{id}/feedbacks/{feedbackId}/resolve`
  - `GET /api/v1/projects/{id}/ai-analysis`
  - `POST /api/v1/projects/{id}/ai-diagnostics`
- Cả 2 dạng tiền tố `/api/v1/...` và `/api/...` đều được hỗ trợ song song.

