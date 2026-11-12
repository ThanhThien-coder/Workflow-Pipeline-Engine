# D8 — Sơ đồ thiết kế OOAD: mảng Dự án, Template, Khách & AI (khớp code thật)

Người làm: D
Người review: A
Trạng thái: chờ kiểm
Cần có trước: D7, D2
Cần trước bước frontend: không
Mở khóa: X3
Nhánh git: d8-ooad-thiet-ke
Ước lượng: 1–1,5 ngày

> ⚡ **Chế độ sprint:** Claude làm hết các bước, kể cả 🧠; bỏ qua Bước 0 và mục "Dành cho Claude". Luồng làm: [SPRINT_2_NGAY.md](../SPRINT_2_NGAY.md) mục 2–3.
> - **Claude tự chạy bằng dòng lệnh:** render các file `.puml` ra PNG.
> - **Dời về buổi kiểm chung (mục 7):** không có.
> - **Không làm trong sprint:** vẽ tay bản đầu trên giấy. Claude vẽ từ code thật; vòng hiểu là người làm giải thích lại 1 sơ đồ sequence (task số 7 thì 1 sơ đồ activity).

## Vì sao cần task này
Sơ đồ thiết kế trả lời câu hỏi "hệ thống làm việc đó **bằng những lớp nào, gọi nhau ra sao**". Mảng của D có 2 actor tương tác qua một lời mời, có khách không đăng nhập, và có interface `AiServiceClient` với nhiều cài đặt. Đây là các ví dụ đẹp để giải thích OOP khi bảo vệ.

> Hạn OOAD tới trước khi code xong: vẽ theo code hiện có và đặc tả D2, D5, D6, đánh dấu "dự kiến" ở phần chưa code. Code xong thì cập nhật lại.

## Sản phẩm (lưu ở `docs/ooad/D-du-an/`)
1. `seq-moi-thanh-vien.puml` — sequence "Mời thành viên → người được mời chấp nhận", có 2 actor. Thể hiện thông báo bất đồng bộ (RabbitMQ/SSE), `alt [lời mời đã hết hạn] → EXPIRED`, và `alt [đụng optimistic lock với Revoke] → 409`.
2. `seq-gop-y-khach.puml` — sequence "Khách gửi góp ý": `GuestGatewayController` → `FeedbackQueueService` → repository. Có `alt [token bị thu hồi / hết hạn / dự án không ACTIVE] → 403` và `alt [vượt 10 góp ý/giờ] → 429`.
3. (Nếu D6 đã xong) `seq-chan-doan-ai.puml` — có `alt [đang cooldown] → 429`, `opt [có GEMINI_API_KEY]`.
4. `comm-moi-thanh-vien.puml` — sơ đồ communication chuyển từ sơ đồ 1.
5. `class-du-an.puml` — class diagram thiết kế: `ProjectController`/`ProjectService`, `ProjectInvitationController`/`ProjectInvitationService`, `ProjectMemberService`, `ProjectAuthorizationService`, `TemplateController`/`TemplateCloneService`, các lớp Guest và Feedback, `AiDiagnosticService`, interface `AiServiceClient` cùng các cài đặt (ký hiệu realization), các entity `ProjectEntity`, `ProjectMemberEntity`, `ProjectInvitationEntity`, `GuestLinkEntity`, `ProjectFeedbackEntity`, `PipelineTemplateEntity`, và các enum liên quan.
6. `state-loi-moi.puml` — 2 sơ đồ trạng thái:
   - Lời mời: PENDING → ACCEPTED / REJECTED / REVOKED / EXPIRED (`[đã quá expires_at khi chấp nhận]`).
   - Góp ý: OPEN → RESOLVED.
7. `nhat-quan.md` — ma trận nhất quán: message → phương thức → `file:dòng`.

## Bước 0 — Tự đọc, không dùng AI
Đọc: cẩm nang mục 3.4, 3.5, 3.6, 3.7 và mục 4; code D1, D2 (và D5, D6 nếu đã xong); ghi chép các task đó của chính bạn.
Trả lời:
1. Trong sơ đồ 1, vì sao người được mời là một lifeline actor riêng, không gộp với Chủ dự án?
2. Realization khác generalization thế nào về ký hiệu và ý nghĩa? Chỉ ví dụ trong code dự án.
3. Sơ đồ state lời mời có trạng thái kết thúc không? Những trạng thái nào là kết thúc?

## Được đọc
- `docs/**`, `wpe-backend/src/**`, `wpe-frontend/src/**`

## Được ghi
- `docs/ooad/D-du-an/**`, `docs/ooad/png/D-*.png`
- `docs/tasks/D-du-an/D8-ooad-thiet-ke.md`

## Việc cần làm
1. 🧠 Bước 0.
2. 🧠 Vẽ tay sơ đồ 1, 5, 6 trước, nhìn code thật để vẽ (không dùng AI).
3. 🧠 Tự lập ma trận nhất quán. Message nào không có phương thức thật thì sửa sơ đồ, hoặc ghi lý do.
4. 🤝 Nhờ Claude soát lỗi ký hiệu và đối chiếu với code. Bạn tự sửa.
5. 🤝 Vẽ các sơ đồ còn lại, chép sang PlantUML, render, xuất PNG.
6. Mở PR. Người review (A) chọn ngẫu nhiên 5 message và dò tới code.

## Tiêu chí xong
- [ ] Đủ sản phẩm 1, 2, 4, 5, 6, 7 (sản phẩm 3 nếu D6 đã xong), render được, có PNG.
- [ ] Người review dò 5 message ngẫu nhiên đều tìm thấy phương thức thật.
- [ ] Sơ đồ state khớp enum `InvitationStatus` và `FeedbackStatus` trong code.
- [ ] Checklist cẩm nang của từng sơ đồ đạt hết, hoặc mục nào không đạt thì có giải thích.

## Câu hỏi bảo vệ (người review hỏi, trả lời không nhìn tài liệu)
1. Vẽ lại trên bảng sequence "Mời thành viên → chấp nhận" trong 10 phút.
2. Chỉ trên class diagram nơi áp dụng Dependency Inversion và mẫu Strategy.
3. Trong sơ đồ class, `ProjectMemberEntity` là lớp kết hợp giữa những lớp nào? Bội số các đầu là gì?

## Cấm
- Dùng AI vẽ bản đầu tiên của sơ đồ 1, 5, 6.
- Vẽ phương thức không có trong code mà không đánh dấu "dự kiến".
- Tự ghi trạng thái `xong`.

## Dành cho Claude (đọc trước khi làm)
Người dán file này đang **học vẽ sơ đồ thiết kế OOAD** khớp với code thật.
1. Không vẽ hộ bản đầu tiên của sơ đồ 1, 5, 6.
2. Khi soát: đối chiếu từng message và từng lớp với code trong repo (đọc file thật, không đoán). Chỉ ra chỗ lệch và để họ tự sửa.
3. Chấm theo checklist trong `docs/ooad/CAM_NANG_VE_SO_DO.md`.
4. Cuối buổi, hỏi họ 3 câu trong "Câu hỏi bảo vệ".

## Ghi chép của người làm
### Trả lời Bước 0

### Ảnh bản vẽ tay đầu tiên

### Ma trận nhất quán: các chỗ lệch đã tìm thấy và cách xử lý
Sprint 12/11/2026: Antigravity vẽ từ code thật (gồm code D2 ở PR #18), Claude soát và dò ma trận bằng script.

Đủ 7 sản phẩm trong `docs/ooad/D-du-an/`: `seq-moi-thanh-vien.puml`, `seq-gop-y-khach.puml`, `seq-chan-doan-ai.puml`, `comm-moi-thanh-vien.puml`, `class-du-an.puml` (2 sơ đồ: dịch vụ, thực thể), `state-loi-moi.puml` (InvitationStatus, FeedbackStatus), `nhat-quan.md`.

Dò `nhat-quan.md` bằng script (mỗi ô `file:dòng` phải chứa đúng tên phương thức trong ±3 dòng): 41/56 khớp trực tiếp; 15 dòng còn lại là `findById`/`save` kế thừa từ `JpaRepository`, trỏ về dòng khai báo interface và có ghi chú "kế thừa". State lời mời khớp đủ 5 giá trị enum `InvitationStatus`.

**Chưa xuất PNG** (lý do như D7: chưa có PlantUML, tải về bị chặn). Render bằng extension PlantUML trong VS Code.

### Lỗi Claude hoặc người review chỉ ra và cách mình sửa
- Chuyển PENDING → EXPIRED trong code bị rollback (lỗi code ghi ở D7), đã ghi note trong sequence, state và ma trận (⚠ lệch).
- `class-du-an.puml` vẽ `AiServiceClientImpl` theo code hiện tại; D6 (PR riêng) đổi thành `HeuristicAiClient`, cần cập nhật sơ đồ sau khi D6 merge.
- PR này dựng trên nhánh D2 và D7: merge #18 (D2) và #19 (D7) trước thì diff mới gọn.

## Nhật ký sprint (chế độ làm nhanh — xem `docs/tasks/SPRINT_2_NGAY.md`)
Đã học lại: chưa

- **Làm gì:** Vẽ bộ sơ đồ thiết kế mảng D: 3 sequence, 1 communication, class thiết kế, state lời mời và góp ý, ma trận nhất quán message → phương thức → file:dòng.
- **File chính đã sửa:** `docs/ooad/D-du-an/seq-*.puml`, `comm-moi-thanh-vien.puml`, `class-du-an.puml`, `state-loi-moi.puml`, `nhat-quan.md`.
- **Vì sao làm vậy** (tự viết):
- **Cần học lại:** Realization (AiServiceClientImpl ..|> AiServiceClient) khác generalization; message đồng bộ và bất đồng bộ (RabbitMQ) vẽ khác nhau; trạng thái kết thúc của lời mời; tự giải thích lại seq-moi-thanh-vien (vòng hiểu).
