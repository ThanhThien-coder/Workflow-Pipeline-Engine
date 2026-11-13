# FN1 — Mở link khách báo "Link unavailable", trang khách còn dữ liệu giả

Người làm: chưa chia (đề xuất: C, vì gần FC2)
Trạng thái: chờ nhóm xem
Lỗi xử lý: L25 (phát hiện khi kiểm tay 14/11, sau FC2)
Nhánh git: fix-fn1-trang-khach
Làm trước: FC2 (tạo link khách đúng dự án). Phần "Recent activity" nên dùng lại `ProjectActivityService` của FC5.

> Viết tắt: `BE/` = `wpe-backend/src/main/java/com/pipeline/wpe/`, `BE-test/` = `wpe-backend/src/test/java/com/pipeline/wpe/`, `FE/` = `wpe-frontend/src/`.

## Lỗi người dùng thấy
- Owner tạo link khách thành công (FC2), bấm Copy rồi mở ở tab ẩn danh: trang báo **"Link unavailable — This link is not valid."**, dù token còn hiệu lực.
- Gọi thẳng `GET /api/v1/guest/{token}/overview` thì có dữ liệu, nhưng biểu đồ velocity và "hoạt động gần đây" là số giả.

## Nguyên nhân (đã đọc code)
- `FE/views/GuestView.tsx` dòng ~565–590: vào trang thì gọi `guestService.getLinkInfo(token)` trước. Lỗi thì hiện "This link is not valid."
- `FE/services/impl/HttpGuestService.ts`: chỉ `getOverview` và `submitFeedback` gọi API thật. **`getLinkInfo`, `createSession`, `getAiSummary`, `listFeedback`, `generateAiReport`, `getMyEvaluation`, `submitEvaluation` vẫn gọi `MockGuestApi`.** Mock không biết token thật nên `getLinkInfo` ném lỗi, và trang **không gọi API nào**.
- Backend chỉ có `GET /guest/{token}/overview` và `POST /guest/{token}/feedback` (`BE/controller/GuestGatewayController.java`). Chưa có API lấy thông tin link, phiên khách, góp ý theo phiên, AI hay đánh giá.
- `BE/service/GuestGatewayService.java` dòng 162–178, `getGuestOverview`:
  - `velocity` là mảng cứng T2=2, T3=3, T4=1, T5=4, T6=…
  - `recentActivities` chỉ có 1 dòng "Hệ thống … hôm nay".
- Đường link không thống nhất: backend `shareUrl` = `{frontend}/guest/{token}` (dòng 227), còn FE `utils/guestUrl.ts` tạo `/guest?token=...` và route App chỉ nhận `/guest`. Hiện FE không dùng `shareUrl` nên chưa lỗi, nhưng dễ nhầm.

## Cách sửa (đề xuất, nhóm chốt trước khi làm)
**Backend**
1. Thêm `GET /api/v1/guest/{token}` → `{ projectName, ownerName, expiresAt }`. Token sai hoặc đã thu hồi trả mã giống `/overview` (403 `REVOKED_GUEST`); hết hạn thì dùng mã riêng nếu service đã có. Không cần đăng nhập (kiểm `SecurityConfig` cho phép `/guest/**`).
2. `getGuestOverview`:
   - `velocity` tính thật: số node DONE theo ngày trong 7 ngày gần nhất theo `node.updated_at`. Không có thì trả mảng rỗng, không trả số cứng.
   - `recentActivities` lấy từ `ProjectActivityService` (FC5), chỉ giữ loại an toàn cho khách (`PROJECT_*`, `TASK_STATUS_CHANGED`, `ARTIFACT_SUBMITTED`) và **không lộ email**.
3. Sửa `shareUrl` cho khớp đường FE (`/guest?token=`), hoặc cho FE nhận thêm `/guest/{token}`. Chọn một.

**Frontend**

4. `HttpGuestService.getLinkInfo` gọi API ở bước 1; đổi lỗi `REVOKED_GUEST`/hết hạn sang `GuestLinkErrorCode` đang có.
5. `createSession`: tạo ở FE (id ngẫu nhiên + tên hiển thị, lưu `localStorage` như `GuestView` đang làm). Không cần backend.
6. Các phần **chưa có backend** (`getAiSummary`, `generateAiReport`, `getMyEvaluation`, `submitEvaluation`, `listFeedback` theo phiên): **không trả mock**. Ẩn khối đó hoặc hiện "Chưa hỗ trợ". Muốn làm thật phần đánh giá thì cần bảng mới, tức **migration mới**: dừng hỏi nhóm.
7. `GuestView` hiện các trạng thái rỗng tương ứng.

## Được sửa
- `BE/controller/GuestGatewayController.java`, `BE/service/GuestGatewayService.java`, `BE/dto/response/guest/**` (chỉ thêm), `BE/repository/*.java` (chỉ thêm method đọc)
- `BE-test/**/GuestGateway*`
- `FE/services/impl/HttpGuestService.ts`, `FE/services/impl/http/guest.ts`, `FE/views/GuestView.tsx` (chỉ phần tải thông tin link và ẩn khối chưa hỗ trợ), `FE/types/guest.types.ts` (chỉ thêm trường), `FE/utils/guestUrl.ts` (nếu chọn sửa phía FE ở bước 3), test FE

## Test phải có
- BE: `GET /guest/{token}` với token đúng → 200 kèm tên dự án; token sai → 403 `REVOKED_GUEST`; token đã thu hồi → 403.
- BE: dự án chưa có node DONE → `velocity` rỗng hoặc toàn 0, không còn mảng cứng (trước khi sửa phải fail).
- FE: `HttpGuestService.getLinkInfo` gọi API thật, không gọi `MockGuestApi` (trước khi sửa phải fail).
- FE: `GuestView` với token hợp lệ không còn hiện "This link is not valid".

## Kiểm bằng tay
1. Owner mở Overview → Guest Link → Generate → Copy, mở ở tab ẩn danh: thấy trang khách đúng tên dự án, số liệu khớp Overview.
2. Owner bấm Revoke rồi F5 tab ẩn danh: báo link đã bị thu hồi.
3. Khách gửi góp ý: owner thấy trong Feedback Queue.

## Kết quả (Claude ghi, dán output thật)
