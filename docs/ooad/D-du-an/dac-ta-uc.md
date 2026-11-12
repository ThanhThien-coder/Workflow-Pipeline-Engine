# Đặc tả Use Case — Mảng Dự án, Template, Khách & AI (WPE)

Tài liệu đặc tả chi tiết 3 Use Case trọng tâm của Phân hệ Mảng D theo chuẩn Single Source of Truth (SSOT) và đối chiếu trực tiếp với mã nguồn Spring Boot Backend.

---

## UC1: Mời thành viên tham gia dự án

- **Mã use case**: UC8 (Khớp ma trận phân quyền RBAC `docs/specs/system-overview.md` mục 4)
- **Tên use case**: Mời thành viên
- **Actor chính**: Chủ dự án (Project Owner)
- **Actor phụ**: Người được mời (Invitee), Hệ thống thông báo (RabbitMQ / SSE)
- **Mô tả ngắn**: Chủ dự án gửi lời mời gia nhập dự án tới một người dùng qua email hoặc username kèm vai trò dự kiến (`COLLABORATOR`, `VIEWER` hoặc `MANAGER`). Hệ thống tạo bản ghi lời mời bất đồng bộ, đẩy thông báo thời gian thực và cho phép người được mời phản hồi Chấp nhận (kết nạp bản ghi thành viên mới theo Cách B, kể cả người từng bị xóa) hoặc Từ chối trong thời hạn 7 ngày.
- **Tiền điều kiện**:
  1. Chủ dự án đã đăng nhập và có vai trò `OWNER` trong dự án tương ứng.
  2. Người được mời đã có tài khoản tồn tại trong hệ thống.
  3. Dự án đang ở trạng thái hợp lệ (`ACTIVE` hoặc `DRAFT`).
- **Hậu điều kiện khi thành công**:
  1. Bản ghi lời mời `PROJECT_INVITATION` được tạo với trạng thái `PENDING`, có hạn 7 ngày.
  2. Người được mời nhận thông báo kèm deep-link mở popup xác nhận.
  3. Khi chấp nhận, bản ghi `PROJECT_MEMBER` mới được tạo (không khôi phục dòng cũ) lập tức trong cùng giao dịch và thông báo cho Chủ dự án.
- **Luồng chính**:
  1. Chủ dự án mở màn hình "Cài đặt thành viên" của dự án và bấm chọn nút "Mời thành viên".
  2. Hệ thống hiển thị hộp thoại mời thành viên gồm ô nhập email/username và lựa chọn vai trò (`COLLABORATOR`, `VIEWER`, hoặc `MANAGER`).
  3. Chủ dự án nhập email hoặc username của người cần mời, chọn vai trò mong muốn và bấm nút "Gửi lời mời".
  4. Hệ thống kiểm tra quyền hạn của người gọi (bắt buộc là `OWNER`), tìm kiếm người dùng trong cơ sở dữ liệu, kiểm tra người dùng chưa là thành viên chính thức đang hoạt động và kiểm tra trạng thái lời mời đang chờ (`PENDING`).
  5. Hệ thống khởi tạo bản ghi `PROJECT_INVITATION` với trạng thái `PENDING`, thời hạn hết hạn sau 7 ngày (`expires_at = NOW() + 7 days`), `version = 0`.
  6. Hệ thống tạo bản ghi `NOTIFICATION` cho người được mời mang deep-link `/workspace?action=open-invite-modal&invitationId={id}` và bắn sự kiện `InvitationCreatedEvent` vào RabbitMQ (`wpe.workflow.exchange` / `wpe.invitation.created`) để `InvitationEventConsumer` đẩy thông báo thời gian thực qua SSE.
  7. Hệ thống trả về mã HTTP 201 Created kèm thông tin lời mời và cập nhật danh sách lời mời đang chờ trên màn hình của Chủ dự án.
  8. Người được mời nhận thông báo chuông trên giao diện, bấm vào thông báo để mở hộp thoại chi tiết lời mời và chọn "Chấp nhận".
  9. Hệ thống kiểm tra lời mời còn hiệu lực (trạng thái `PENDING` và chưa quá hạn 7 ngày), thực hiện giao dịch nguyên tử (`@Transactional(noRollbackFor = ConflictException.class)`): cập nhật lời mời sang `ACCEPTED`, tạo bản ghi thành viên mới trong bảng `PROJECT_MEMBER` (nếu chưa là thành viên hoạt động), đánh dấu đã đọc thông báo và bắn sự kiện `InvitationAcceptedEvent` qua RabbitMQ thông báo cho Chủ dự án.
  10. Hệ thống đóng hộp thoại và chuyển hướng người được mời vào Workspace của dự án.
- **Luồng thay thế**:
  - **8a. Người được mời chọn "Từ chối"**:
    - 8a.1. Người được mời mở hộp thoại chi tiết lời mời và bấm "Từ chối".
    - 8a.2. Hệ thống kiểm tra tính hợp lệ, cập nhật trạng thái lời mời sang `REJECTED`, ghi nhận `responded_at = NOW()`, đánh dấu đã đọc thông báo và đóng hộp thoại. Use case kết thúc.
  - **8b. Chủ dự án chủ động thu hồi lời mời đang chờ**:
    - 8b.1. Chủ dự án xem danh sách "Pending Invitations" và bấm "Thu hồi" tại một lời mời.
    - 8b.2. Hệ thống kiểm tra quyền `OWNER`, cập nhật trạng thái lời mời từ `PENDING` sang `REVOKED`, cập nhật `responded_at = NOW()`, gỡ lời mời khỏi danh sách chờ. Use case kết thúc.
  - **8c. Người được mời không phản hồi trong 7 ngày**:
    - 8c.1. Lời mời hết hạn sau 7 ngày kể từ lúc tạo (`expires_at <= NOW()`).
    - 8c.2. Định kỳ mỗi 1 giờ, tiến trình nền `InvitationExpiryJob.expireOverdueInvitations` tự động quét cơ sở dữ liệu và cập nhật trạng thái các lời mời quá hạn sang `EXPIRED`. Use case kết thúc.
- **Luồng ngoại lệ**:
  - **E1. Người gửi không phải là Chủ dự án (bắt đầu từ bước 4)**: Hệ thống ném `ForbiddenException`, trả về HTTP 403 `ACCESS_DENIED`, hiển thị thông báo "Chỉ chủ dự án mới có quyền gửi lời mời tham gia dự án". Use case kết thúc.
  - **E2. Không tìm thấy người dùng được mời (bắt đầu từ bước 4)**: Hệ thống ném `ResourceNotFoundException`, trả về HTTP 404 `RESOURCE_NOT_FOUND`, hiển thị thông báo "Không tìm thấy người dùng với định danh đã nhập". Use case kết thúc.
  - **E3. Chủ dự án tự mời chính mình (bắt đầu từ bước 4)**: Hệ thống ném `IllegalArgumentException`, trả về HTTP 400 `BAD_REQUEST`, hiển thị thông báo lỗi. Use case kết thúc.
  - **E4. Người được mời đã là thành viên chính thức đang hoạt động của dự án (bắt đầu từ bước 4)**: Hệ thống ném `IllegalArgumentException`, trả về HTTP 400 `BAD_REQUEST`, hiển thị thông báo "Người dùng đã là thành viên chính thức của dự án". Use case kết thúc.
  - **E5. Người được mời đã có lời mời đang chờ phản hồi và còn hạn (bắt đầu từ bước 4)**: Hệ thống ném `ConflictException`, trả về HTTP 409 `INVITATION_ALREADY_PENDING`, hiển thị thông báo "Người dùng đã có một lời mời đang chờ phản hồi". Use case kết thúc.
  - **E5a. Người được mời có lời mời PENDING cũ nhưng đã quá hạn (bắt đầu từ bước 4)**: Hệ thống tự động chuyển trạng thái lời mời cũ sang `EXPIRED`, ghi nhận `responded_at = NOW()`, lưu vào cơ sở dữ liệu (`saveAndFlush`), sau đó tiếp tục tạo lời mời mới bình thường (không chặn người gửi).
  - **E6. Người phản hồi không phải là người nhận lời mời (bắt đầu từ bước 9)**: Hệ thống ném `ForbiddenException`, trả về HTTP 403 `ACCESS_DENIED`. Use case kết thúc.
  - **E7. Lời mời không còn ở trạng thái PENDING khi phản hồi (bắt đầu từ bước 9)**: Do đã bị thu hồi hoặc phản hồi trước đó, hệ thống ném `ConflictException`, trả về HTTP 409 `INVITATION_NOT_PENDING`. Use case kết thúc.
  - **E8. Lời mời đã quá hạn khi người dùng bấm chấp nhận hoặc từ chối (bắt đầu từ bước 9)**: Hệ thống cập nhật trạng thái lời mời sang `EXPIRED`, ghi nhận `responded_at = NOW()`, lưu vào cơ sở dữ liệu (nhờ cấu hình `noRollbackFor = ConflictException.class` nên không bị rollback), ném `ConflictException`, trả về HTTP 409 `INVITATION_EXPIRED`, hiển thị thông báo "Lời mời đã hết hạn". Use case kết thúc.
  - **E9. Xung đột đồng thời Optimistic Locking (bắt đầu từ bước 9)**: Xảy ra khi Chủ dự án thu hồi đúng lúc Người được mời chấp nhận, JPA ném `OptimisticLockingFailureException`, hệ thống trả về HTTP 409 `OPTIMISTIC_LOCK_CONFLICT`. Use case kết thúc.
- **Quy tắc nghiệp vụ**:
  - **BR1**: Chỉ tài khoản có vai trò `OWNER` mới có thẩm quyền gửi lời mời hoặc thu hồi lời mời.
  - **BR2**: Một người dùng chỉ có tối đa 1 lời mời ở trạng thái `PENDING` còn hiệu lực cho cùng một dự án tại một thời điểm (kiểm soát bởi ràng buộc Partial Unique Index ở CSDL và kiểm tra nghiệp vụ).
  - **BR3**: Lời mời có thời gian sống mặc định là 7 ngày kể từ lúc tạo (`expires_at = created_at + 7 days`). Tiến trình nền `InvitationExpiryJob` quét mỗi 1 giờ để tự động cập nhật trạng thái `EXPIRED` cho các lời mời quá hạn.
  - **BR4**: Chấp nhận lời mời phải là giao dịch nguyên tử (`@Transactional(noRollbackFor = ConflictException.class)`): vừa đổi trạng thái lời mời sang `ACCEPTED` vừa tạo mới bản ghi `PROJECT_MEMBER` (mỗi lần vào dự án là 1 dòng `project_member` mới theo Cách B, người từng bị xóa thì tạo dòng mới).
- **Nguồn**:
  - `wpe-backend/src/main/java/com/pipeline/wpe/controller/ProjectInvitationController.java`
  - `wpe-backend/src/main/java/com/pipeline/wpe/service/ProjectInvitationService.java`
  - `wpe-backend/src/main/java/com/pipeline/wpe/service/InvitationExpiryJob.java`
  - `wpe-backend/src/main/java/com/pipeline/wpe/service/event/InvitationEventConsumer.java`
  - `wpe-backend/src/main/java/com/pipeline/wpe/entity/ProjectInvitationEntity.java`
  - `docs/specs/system-overview.md` (Mục 2 Phân hệ 2, Mục 4 UC8)
  - `docs/FRONTEND_BACKEND_INTEGRATION_MAP.md` (Cụm 3.3, 3.4)

---

## UC2: Gửi góp ý một chiều từ khách ngoài qua liên kết Token

- **Mã use case**: UC22 (Khớp ma trận phân quyền RBAC `docs/specs/system-overview.md` mục 4)
- **Tên use case**: Gửi góp ý
- **Actor chính**: Khách ngoài / Giáo viên (Guest via Token)
- **Actor phụ**: Chủ dự án (Project Owner - nhận thông báo)
- **Mô tả ngắn**: Khách ngoài hoặc Giáo viên hướng dẫn truy cập qua đường dẫn mang Token chia sẻ 64 ký tự hợp lệ để gửi nhận xét, góp ý chuyên môn vào toàn dự án hoặc một tác vụ cụ thể. Tuân thủ nghiêm ngặt **Quy tắc tiếp thu 1 chiều**: nhóm thực thi chỉ tiếp thu và giải quyết, tuyệt đối không có cơ chế tranh luận hay phản hồi ngược lại.
- **Tiền điều kiện**:
  1. Khách sở hữu Guest Token 64 ký tự còn hiệu lực (`is_revoked = false`, `expires_at > NOW()`).
  2. Dự án liên kết đang ở trạng thái hoạt động (`status = ACTIVE`).
- **Hậu điều kiện khi thành công**:
  1. Bản ghi góp ý được lưu vào bảng `PROJECT_FEEDBACK` với trạng thái ban đầu `OPEN`.
  2. Hệ thống phát sự kiện thông báo `NotificationEvent` tới Chủ dự án qua hàng đợi RabbitMQ.
  3. Màn hình khách hiển thị thông báo gửi thành công và ghi nhận đóng góp.
- **Luồng chính**:
  1. Khách truy cập vào liên kết chia sẻ mang Token trên trình duyệt (định dạng `/guest/{token}`).
  2. Hệ thống xác thực token hợp lệ và hiển thị giao diện tổng quan dự án chỉ đọc (Read-only view) cùng khung nhập góp ý.
  3. Khách nhập họ tên (`reviewerName`), chọn vai trò thẩm định (`TEACHER` hoặc `GUEST`), nhập nội dung góp ý (tối đa 2000 ký tự), chọn tác vụ liên quan (tùy chọn) và bấm nút "Gửi nhận xét".
  4. Hệ thống xác thực tính hợp lệ của Guest Token trong bảng `GUEST_LINK` (kiểm tra tồn tại, chưa bị thu hồi, chưa hết hạn và dự án đang `ACTIVE`).
  5. Hệ thống kiểm tra hạn mức tần suất gửi (Rate Limit): đếm số góp ý của dự án trong 1 giờ gần nhất; đảm bảo chưa đạt ngưỡng 10 góp ý/giờ.
  6. Hệ thống kiểm tra độ dài nội dung góp ý (tối đa 2000 ký tự, không được để trống) và kiểm tra tác vụ được chọn (nếu có) phải thuộc về dự án này.
  7. Hệ thống tạo bản ghi mới trong bảng `PROJECT_FEEDBACK` với trạng thái `status = 'OPEN'`.
  8. Hệ thống phát sự kiện `NotificationEvent` qua RabbitMQ thông báo cho Chủ dự án về nhận xét mới.
  9. Hệ thống trả về mã HTTP 201 Created kèm dữ liệu góp ý vừa tạo và hiển thị thông báo cảm ơn trên màn hình khách.
- **Luồng thay thế**:
  - **3a. Khách gửi góp ý chung cho toàn dự án**:
    - 3a.1. Khách để trống trường chọn tác vụ (`nodeId = null`).
    - 3a.2. Hệ thống lưu góp ý với `node_id = NULL` và tiếp tục bước 4 bình thường.
- **Luồng ngoại lệ**:
  - **E1. Token chia sẻ không tồn tại hoặc bị để trống (bắt đầu từ bước 4)**: Hệ thống ném `ForbiddenException`, trả về HTTP 403 `REVOKED_GUEST`, thông báo "Token chia sẻ không hợp lệ hoặc bị thiếu". Use case kết thúc.
  - **E2. Token đã bị Chủ dự án thu hồi (bắt đầu từ bước 4)**: Hệ thống ném `ForbiddenException`, trả về HTTP 403 `REVOKED_GUEST`, thông báo "Liên kết chia sẻ này đã bị Chủ dự án thu hồi". Use case kết thúc.
  - **E3. Token chia sẻ đã hết hạn sử dụng (bắt đầu từ bước 4)**: Hệ thống ném `ForbiddenException`, trả về HTTP 403 `REVOKED_GUEST`, thông báo "Liên kết chia sẻ đã hết hạn". Use case kết thúc.
  - **E4. Dự án không ở trạng thái ACTIVE (bắt đầu từ bước 4)**: Hệ thống ném `ForbiddenException`, trả về HTTP 403 `REVOKED_GUEST`, thông báo "Dự án hiện không mở cho khách xem". Use case kết thúc.
  - **E5. Vượt quá hạn mức 10 góp ý trong vòng 1 giờ (bắt đầu từ bước 5)**: Hệ thống ném `CooldownActiveException`, trả về HTTP 429 `COOLDOWN_ACTIVE` kèm thời gian chờ tính bằng giây (`retryAfterSeconds`), thông báo vui lòng thử lại sau. Use case kết thúc.
  - **E6. Nội dung góp ý vượt quá 2000 ký tự hoặc không hợp lệ (bắt đầu từ bước 6)**: Hệ thống ném `IllegalArgumentException` (nếu vượt quá 2000 ký tự), trả về HTTP 400 `BAD_REQUEST`, hoặc `MethodArgumentNotValidException` (nếu để trống), trả về HTTP 400 `VALIDATION_FAILED`. Use case kết thúc.
  - **E7. Tác vụ được chọn không thuộc dự án (bắt đầu từ bước 6)**: Hệ thống ném `IllegalArgumentException` (trả về HTTP 400 `BAD_REQUEST`) hoặc `ResourceNotFoundException` (trả về HTTP 404 `RESOURCE_NOT_FOUND`). Use case kết thúc.
- **Quy tắc nghiệp vụ**:
  - **BR1**: Quy tắc tiếp thu 1 chiều: Khách gửi góp ý, Chủ dự án hoặc Quản lý (`OWNER` hoặc `MANAGER`) xem và bấm "Đánh dấu Đã xử lý" (chuyển `OPEN` sang `RESOLVED`). Cộng sự và Người xem chỉ được xem góp ý. Tuyệt đối không có cơ chế nhắn tin phản hồi ngược lại khách.
  - **BR2**: Áp dụng Rate Limit trượt tối đa 10 góp ý trên mỗi dự án trong 1 giờ để chống spam dữ liệu.
  - **BR3**: Nội dung góp ý tối đa 2000 ký tự.
  - **BR4**: Khách ngoài chỉ được phép truy cập xem tiến độ và gửi góp ý khi dự án ở trạng thái `ACTIVE`.
- **Nguồn**:
  - `wpe-backend/src/main/java/com/pipeline/wpe/controller/GuestGatewayController.java`
  - `wpe-backend/src/main/java/com/pipeline/wpe/service/GuestGatewayService.java`
  - `wpe-backend/src/main/java/com/pipeline/wpe/service/FeedbackQueueService.java`
  - `wpe-backend/src/main/java/com/pipeline/wpe/entity/GuestLinkEntity.java`
  - `wpe-backend/src/main/java/com/pipeline/wpe/entity/ProjectFeedbackEntity.java`
  - `docs/specs/system-overview.md` (Mục 2 Phân hệ 4, Mục 4 UC22)
  - `docs/FRONTEND_BACKEND_INTEGRATION_MAP.md` (Cụm 7.2, 8.1)

---

## UC3: Chạy chẩn đoán tiến độ và phát hiện điểm nghẽn bằng AI

- **Mã use case**: UC21 (Khớp ma trận phân quyền RBAC `docs/specs/system-overview.md` mục 4 và Cụm 9 On-Demand AI Diagnosis)
- **Tên use case**: Chạy chẩn đoán AI
- **Actor chính**: Thành viên dự án (Chủ dự án, Quản lý, Cộng sự, Người xem)
- **Actor phụ**: Dịch vụ AI (qua `AiServiceClient`: `AiServiceClientImpl` chạy heuristic mock nội bộ mặc định khi `app.ai.mode=mock`, hoặc `HttpAiServiceClient` gửi `AiDiagnosisRequest` sang Python microservice khi `app.ai.mode=http`, tự động fallback về mock nếu lỗi)
- **Mô tả ngắn**: Thành viên dự án chủ động bấm nút "AI Diagnosis" trên màn hình Tổng quan để kích hoạt phân tích cấu trúc đồ thị quy trình DAG, tính toán đường găng CPM (Critical Path Method), phát hiện điểm nghẽn, bẫy tiến độ và đề xuất giải pháp khắc phục. Kết quả phân tích được lưu đệm vào CSDL phục vụ truy vấn tức thì.
- **Tiền điều kiện**:
  1. Người dùng đã đăng nhập và là thành viên chính thức hoặc Chủ sở hữu của dự án.
  2. Dự án đã được thiết lập các giai đoạn và tác vụ trong quy trình.
- **Hậu điều kiện khi thành công**:
  1. Kết quả phân tích mới nhất được lưu đè vào cột JSONB `PROJECT.latest_ai_analysis` trong cơ sở dữ liệu.
  2. Giao diện cập nhật các chỉ số AI thông minh (Đường găng CPM, Điểm nghẽn Bottlenecks, Bẫy tiến độ Task Traps, Lời khuyên tối ưu).
  3. Bắt đầu đếm ngược thời gian Cooldown 180 giây trên nút bấm của giao diện.
- **Luồng chính**:
  1. Thành viên dự án truy cập vào màn hình Tổng quan (Overview) của dự án.
  2. Hệ thống tải dữ liệu tổng quan, bao gồm dữ liệu phân tích AI đã lưu đệm từ trước trong cột `PROJECT.latest_ai_analysis` (độ trễ < 2ms, chi phí 0 token) và hiển thị lên giao diện.
  3. Thành viên bấm nút "AI Diagnosis" để yêu cầu phân tích mới.
  4. Hệ thống kiểm tra quyền hạn của người dùng (xác thực là `OWNER`, `MANAGER`, `COLLABORATOR` hoặc `VIEWER` của dự án qua `verifyProjectMemberOrOwner`).
  5. Hệ thống kiểm tra thời gian giãn cách Cooldown: lấy mốc thời gian `analyzedAt` trong bản ghi phân tích trước đó; kiểm tra khoảng cách thời gian đã đủ 180 giây (3 phút) kể từ lần phân tích gần nhất hay chưa.
  6. Hệ thống thu thập toàn bộ dữ liệu ngữ cảnh của dự án: danh sách tác vụ (`NODE`), cấu trúc cạnh phụ thuộc (`NODE_DEPENDENCY`), và các góp ý chưa giải quyết (`PROJECT_FEEDBACK` có `status = 'OPEN'`).
  7. Hệ thống chuyển tiếp dữ liệu ngữ cảnh tới `AiServiceClient` (khi `app.ai.mode=mock` dùng `AiServiceClientImpl` tính toán heuristic nội bộ; khi `app.ai.mode=http` dùng `HttpAiServiceClient` gửi payload `AiDiagnosisRequest` sang microservice Python, tự động chuyển về fallback mock nếu gặp sự cố) để tính toán đường găng CPM, phân tích điểm nghẽn, phát hiện bẫy tiến độ và sinh các khuyến nghị hành động tối ưu.
  8. Hệ thống ghi đè kết quả phân tích JSON mới vào cột `latest_ai_analysis` của `ProjectEntity` và lưu xuống cơ sở dữ liệu qua `ProjectRepository`.
  9. Hệ thống trả về kết quả phân tích kèm mã HTTP 200 OK và giao diện cập nhật hiển thị dữ liệu mới, đồng thời bắt đầu đếm ngược bộ đếm Cooldown 180 giây.
- **Luồng thay thế**:
  - **2a. Dự án chưa từng chạy chẩn đoán AI trước đó**:
    - 2a.1. Hệ thống phát hiện trường `latest_ai_analysis` rỗng hoặc null, hiển thị thông báo "Chưa có dữ liệu chẩn đoán AI cho dự án này. Vui lòng bấm nút 'AI Diagnosis' để kích hoạt phân tích".
    - 2a.2. Tiếp tục bước 3 khi thành viên bấm nút.
- **Luồng ngoại lệ**:
  - **E1. Người dùng không phải thành viên hoặc Chủ sở hữu dự án (bắt đầu từ bước 4)**: Hệ thống ném `ForbiddenException`, trả về HTTP 403 `ACCESS_DENIED`, hiển thị thông báo "Bạn không phải là thành viên của dự án này". Use case kết thúc.
  - **E2. Không tìm thấy dự án tương ứng (bắt đầu từ bước 4)**: Hệ thống ném `ResourceNotFoundException`, trả về HTTP 404 `RESOURCE_NOT_FOUND`. Use case kết thúc.
  - **E3. Bấm nút khi chưa hết thời gian Cooldown 180 giây (bắt đầu từ bước 5)**: Hệ thống tính toán số giây còn lại (`remainingSeconds = 180 - elapsed`), ném `CooldownActiveException`, trả về HTTP 429 `COOLDOWN_ACTIVE` kèm trường `retryAfterSeconds` trong JSON phản hồi, hiển thị thông báo yêu cầu chờ hết thời gian Cooldown. Use case kết thúc.
  - **E4. Lỗi kết nối microservice AI bên ngoài (ở chế độ HTTP) (bắt đầu từ bước 7)**: Khi microservice Python bị quá tải hoặc timeout, `HttpAiServiceClient` tự động chuyển sang fallback mock nội bộ từ `AiServiceClientImpl`, ghi log cảnh báo và trả về kết quả mang nguồn `MOCK_FALLBACK` kèm ghi chú để trải nghiệm người dùng không bị gián đoạn. Use case kết thúc thành công.
- **Quy tắc nghiệp vụ**:
  - **BR1**: Mọi thành viên thuộc dự án (`OWNER`, `MANAGER`, `COLLABORATOR`, `VIEWER`) đều có quyền kích hoạt chẩn đoán AI.
  - **BR2**: Hạn mức giãn cách tối thiểu giữa 2 lần bấm phân tích liên tiếp là 180 giây (3 phút) nhằm chống lãng phí token và tránh quá tải API.
  - **BR3**: Kết quả phân tích được lưu đệm trực tiếp vào cột JSONB `PROJECT.latest_ai_analysis` để khi tải trang (Page Load) hệ thống đọc trực tiếp từ CSDL mà tuyệt đối không gọi lại dịch vụ AI bên ngoài.
- **Nguồn**:
  - `wpe-backend/src/main/java/com/pipeline/wpe/controller/AiDiagnosticController.java`
  - `wpe-backend/src/main/java/com/pipeline/wpe/service/ai/AiDiagnosticService.java`
  - `wpe-backend/src/main/java/com/pipeline/wpe/service/ai/AiServiceClient.java`
  - `wpe-backend/src/main/java/com/pipeline/wpe/service/ai/AiServiceClientImpl.java`
  - `wpe-backend/src/main/java/com/pipeline/wpe/service/ai/HttpAiServiceClient.java`
  - `wpe-backend/src/main/java/com/pipeline/wpe/service/ai/AiDiagnosisRequest.java`
  - `wpe-backend/src/main/java/com/pipeline/wpe/exception/CooldownActiveException.java`
  - `docs/specs/ai-diagnostics.md`
  - `docs/specs/system-overview.md` (Mục 2 Phân hệ 4, Mục 4 UC21)
  - `docs/FRONTEND_BACKEND_INTEGRATION_MAP.md` (Cụm 9.1, 9.2)
