# D5 — Cổng khách và hàng đợi góp ý: kiểm bảo mật và nối giao diện (Cụm 7, 8)

Người làm: D
Người review: A
Trạng thái: chưa làm
Cần có trước: T0
Cần trước bước frontend: A2
Mở khóa: X1
Nhánh git: d5-guest
Ước lượng: 1–1,5 ngày

## Vì sao cần task này
Cụm 7 và 8 đã có code và 22 test (xem `docs/DEV_D_IMPLEMENTATION_REPORT.md`). Cần kiểm lại theo SSOT 5 điểm sau:
1. `docs/specs/system-overview.md` mục 5.2 yêu cầu token hợp lệ **và** dự án đang `ACTIVE`. Code có kiểm điều kiện dự án không?
2. `GET /projects/{id}/feedbacks` và `PATCH …/resolve` phải chỉ cho thành viên (UC23). `FeedbackQueueService.getProjectFeedbacks(projectId)` không nhận userId. Đọc kỹ xem quyền được kiểm ở đâu.
3. `GuestGatewayController` gọi `generateOrRenewGuestToken(id, expiryDays)` mà không truyền userId. Chỉ OWNER được tạo link: việc kiểm này nằm ở đâu?
4. Chưa có gì chống một link bị dùng để gửi góp ý hàng loạt.
5. `guestService` trên FE vẫn dùng mock.

## Kiến thức phải nắm
Token bí mật trong URL (capability URL), entropy, rate limit, kiểm quyền ở tầng service, nguyên tắc "một chiều" của góp ý.

## Bước 0 — Tự đọc, không dùng AI
Đọc: integration map Cụm 7, 8; `docs/specs/system-overview.md` mục 5.2 và UC12, UC19–UC23; `docs/DEV_D_IMPLEMENTATION_REPORT.md`; `BE/controller/GuestGatewayController.java`, `BE/service/GuestGatewayService.java`, `BE/controller/FeedbackQueueController.java`, `BE/service/FeedbackQueueService.java` cùng test của chúng; `FE/views/GuestView.tsx`, `FE/services/contracts/IGuestService.ts`, `FE/services/mock/MockWorkflowService.guest.ts`, `FE/components/overview/FeedbackQueueCard.tsx`, `FE/components/popovers/GuestAccessPopover.tsx`.
Trả lời (mỗi ý phải chỉ được dòng code):
1. SSOT yêu cầu token thỏa những điều kiện nào? Code hiện kiểm mấy điều kiện?
2. Ai được tạo và thu hồi link? Code kiểm việc này ở đâu?
3. Khách gửi 1000 góp ý trong 1 phút thì chuyện gì xảy ra?

## Được đọc
> Viết tắt: `BE/` = `wpe-backend/src/main/java/com/pipeline/wpe/`, `BE-test/` = `wpe-backend/src/test/java/com/pipeline/wpe/`, `FE/` = `wpe-frontend/src/`.
- `wpe-backend/src/**`, `FE/**`, `docs/**`

## Được ghi
- `BE/controller/GuestGatewayController.java`, `BE/service/GuestGatewayService.java`
- `BE/controller/FeedbackQueueController.java`, `BE/service/FeedbackQueueService.java`
- `BE/repository/ProjectFeedbackRepository.java`, `BE/repository/GuestLinkRepository.java` (chỉ thêm method)
- `BE-test/**` (test guest và feedback)
- `FE/services/impl/HttpGuestService.ts` (mới), `FE/services/impl/http/guest.ts` (mới), `FE/services/container.ts` (chỉ dòng `guestService`)
- `FE/views/GuestView.tsx`, `FE/components/overview/**`, `FE/components/popovers/GuestAccessPopover.tsx`
- `FE/types/guest.types.ts`, `FE/types/overview.types.ts`, test FE
- `docs/tasks/D-du-an/D5-cong-khach-gop-y.md`

## Đặc tả đã chốt
- Token hợp lệ khi thỏa đủ: tồn tại, `is_revoked = false`, `expires_at > now`, **và** dự án đang `ACTIVE`. Thiếu điều kiện nào → 403 `REVOKED_GUEST`.
- Tạo, thu hồi, xem link khách: chỉ OWNER. Xem danh sách và resolve góp ý: thành viên (`verifyProjectMemberOrOwner`). Sai quyền → 403 `ACCESS_DENIED`. **Endpoint nào cũng phải có test quyền.**
- Chống spam: mỗi token tối đa 10 góp ý mỗi giờ (đếm `project_feedback.created_at` trong 1 giờ gần nhất của dự án gắn với token). Vượt → 429 `COOLDOWN_ACTIVE` kèm `retryAfterSeconds`. Nội dung tối đa 2000 ký tự, tên tối đa 100 ký tự.
- FE: `HttpGuestService` (mới) chỉ gọi thật 2 phương thức `getOverview` và `submitFeedback`. Các phương thức còn lại (`getLinkInfo`, `createSession`, `getAiSummary`, `listFeedback`, `generateAiReport`, `getMyEvaluation`, `submitEvaluation`) chưa có trong SSOT → giữ mock và ghi danh sách. Trên màn Overview, tạo/thu hồi link khách và xem/resolve góp ý gọi API thật qua `FE/services/impl/http/guest.ts`.

## Việc cần làm
1. 🧠 Bước 0 (trả lời bằng cách chỉ dòng code).
2. 🧠 Với mỗi lỗ hổng tìm được, viết test đỏ **trước khi sửa**.
3. 🤝 Sửa, cho test xanh.
4. 🤝 Phần FE.
5. 🧠 Chạy thật:
   - alex tạo link → mở link trong cửa sổ ẩn danh → gửi góp ý → alex thấy góp ý trong Feedback Queue → resolve;
   - thu hồi link → trang khách báo link hết hiệu lực.

## Tiêu chí xong
- [ ] Test pass. Endpoint nào cũng có test quyền.
- [ ] Kịch bản chạy thật ở bước 5 đúng (ghi kết quả).
- [ ] Góp ý thứ 11 trong 1 giờ → 429.

## Câu hỏi bảo vệ (người review hỏi, trả lời không nhìn code)
1. Token 64 ký tự hex có bao nhiêu bit entropy? Vì sao đủ an toàn?
2. Khách không đăng nhập mà vẫn an toàn nhờ những lớp bảo vệ nào?
3. Rate limit theo token khác rate limit theo IP ở đâu? Mỗi cách bỏ sót trường hợp nào?

## Cấm
- Sửa file ngoài mục "Được ghi". File dùng chung thì báo nhóm trước (README mục 6).
- Đọc, in, commit `.env*`, khóa, mật khẩu thật, API key. Dùng `git add -f`.
- Mở chức năng trả lời lại khách (vi phạm nguyên tắc góp ý một chiều).
- Tự ghi trạng thái `xong`. Chỉ người review ghi sau khi kiểm.

## Dành cho Claude (đọc trước khi làm)
Người dán file này là **người làm** task. Mục tiêu kép: task chạy đúng **và** người làm hiểu hết những gì đã làm.
1. Chưa sửa code vội. Yêu cầu người làm tóm tắt mục tiêu task và đọc câu trả lời Bước 0 của họ. Sai hoặc thiếu thì giải thích, rồi hỏi lại.
2. Bước 🧠: không viết hộ. Chỉ gợi ý, đặt câu hỏi dẫn dắt, chỉ chỗ sai.
3. Bước 🤝: làm từng phần nhỏ. Mỗi phần nói rõ sửa file nào, vì sao, chạy kiểm thế nào. Yêu cầu người làm tự chạy lệnh và đọc kết quả.
4. Chỉ sửa file trong "Được ghi". Cần đụng file khác, nhất là file dùng chung, thì dừng lại và nói lý do để người làm hỏi nhóm.
5. "Đặc tả đã chốt" là quyết định của nhóm, không tự đổi. Thấy đặc tả sai thì báo ra, không tự làm theo ý mình.
6. Không đọc hay in `.env*`, khóa, mật khẩu, API key.
7. Làm xong: hỏi người làm 3 câu trong "Câu hỏi bảo vệ", nhắc họ điền ghi chép bằng lời của họ, chỉ đổi trạng thái thành `chờ kiểm`.

## Ghi chép của người làm
> Viết bằng lời của bạn. Người review đọc phần này trước khi đọc code.

### Trả lời Bước 0

### Đã làm gì (file nào, vì sao)

### Kết quả test (dán output thật, không chép tay)

### Điều chưa chắc / cần nhóm quyết
