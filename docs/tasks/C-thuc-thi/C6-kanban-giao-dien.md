# C6 — Kanban My Tasks chạy với backend thật và realtime

Người làm: C
Người review: D
Trạng thái: chưa làm
Cần có trước: A2, C2
Cần trước bước frontend: không
Mở khóa: X1
Nhánh git: c6-kanban-ui
Ước lượng: 1,5–2 ngày

## Vì sao cần task này
Kanban đã gọi API thật một phần (`getMyTasks`, `updateTaskStatus`, `submitTaskArtifact`), nhưng:
- `version` đang giữ trong `taskVersionCache` riêng, dễ lệch với dữ liệu thật.
- Lỗi 409 và 403 chưa có cách hiển thị thống nhất.
- Chưa nghe `TASK_SUBMITTED`, `TASK_REJECTED`, `PING`.
- `FE/views/MyTasksView.tsx` tự mở EventSource kèm `?userId=`, và mỗi view có thể mở một kết nối riêng.

## Kiến thức phải nắm
Optimistic UI và rollback; mang `version` trong DTO; EventSource tự kết nối lại; dọn dẹp trong `useEffect`; test hook bằng vitest.

## Bước 0 — Tự đọc, không dùng AI
Đọc: integration map 5.1–5.7 và Chương III (lỗi 409); `FE/views/MyTasksView.tsx`, `FE/components/kanban/**`, `FE/hooks/usePhaseKanban.ts`, `FE/store/slices/kanbanSlice.ts`, `FE/domain/taskTransitions.ts`, `FE/services/impl/http/tasks.ts` và `realtime.ts` (sau A2).
Trả lời:
1. Kéo thẻ sang cột mới: UI đổi trước hay chờ server trả lời? Server từ chối thì sao?
2. `version` gửi kèm `PATCH` lấy từ đâu? Vì sao không nên giữ một cache riêng?
3. EventSource tự kết nối lại thế nào? Khi nào phải đóng nó?

## Được đọc
> Viết tắt: `BE/` = `wpe-backend/src/main/java/com/pipeline/wpe/`, `BE-test/` = `wpe-backend/src/test/java/com/pipeline/wpe/`, `FE/` = `wpe-frontend/src/`.
- `FE/**`, `docs/**`

## Được ghi
- `FE/views/MyTasksView.tsx`, `FE/components/kanban/**`, `FE/hooks/usePhaseKanban.ts`, `FE/store/slices/kanbanSlice.ts`
- `FE/services/impl/http/tasks.ts`, `FE/services/impl/http/realtime.ts`, `FE/types/kanban.types.ts`
- `FE/App.tsx` (chỉ chỗ mở và đóng kết nối SSE)
- Test FE tương ứng
- `docs/tasks/C-thuc-thi/C6-kanban-giao-dien.md`

## Đặc tả đã chốt
- `KanbanTask` (FE) mang `version` lấy từ response. Bỏ `taskVersionCache`.
- Kéo thả: đổi UI ngay (optimistic). Nếu lỗi thì trả thẻ về chỗ cũ và hiện toast:
  - 409 → "Tác vụ đã được cập nhật bởi thành viên khác. Đang tải lại…", rồi tải lại danh sách;
  - 403 → "Bạn không có quyền thực hiện hành động này.";
  - 400 → hiện `message` của server.
- Realtime qua `realtime.ts`: nghe đủ danh mục sự kiện ở C2, cập nhật thẻ theo `id` (không trùng).
  - `TASK_UNLOCKED` → thêm thẻ vào cột TODO, kèm toast xanh.
  - `TASK_REJECTED` → hiện banner lý do từ chối.
  - `INIT` (kết nối lại) → tải lại danh sách để bù sự kiện bị lỡ.
- Cả app chỉ có **một** kết nối SSE: mở ở cấp app sau khi đăng nhập, đóng khi đăng xuất.
- File nghi là thừa: `FE/components/workflow/PhaseKanbanBoard.tsx` (không thấy chỗ nào import theo đường dẫn này). Kiểm lại; nếu không dùng thì xóa trong một PR riêng và báo B.

## Việc cần làm
1. 🧠 Bước 0.
2. 🧠 Viết trước ít nhất 8 test case dạng bảng.
3. 🤝 Code và test.
4. 🧠 Chạy thật với 2 trình duyệt (alex và sarah):
   - sarah bắt đầu làm và nộp bài → alex thấy ngay;
   - alex từ chối → sarah thấy banner lý do;
   - alex duyệt → task kế tiếp của alex tự hiện ở cột TODO.

## Tiêu chí xong
- [ ] `npm test` pass.
- [ ] Kịch bản 2 trình duyệt ở bước 4 chạy đúng (ghi kết quả).
- [ ] Giả lập 409 (2 tab cùng kéo một thẻ): thẻ trả về chỗ cũ và danh sách tải lại.

## Câu hỏi bảo vệ (người review hỏi, trả lời không nhìn code)
1. Optimistic UI có rủi ro gì? Khi nào không nên dùng?
2. Vì sao cả app chỉ nên có 1 kết nối SSE?
3. Mất mạng 1 phút thì Kanban có thể lệch dữ liệu. Khi kết nối lại thì khắc phục thế nào?

## Cấm
- Sửa file ngoài mục "Được ghi". File dùng chung thì báo nhóm trước (README mục 6).
- Đọc, in, commit `.env*`, khóa, mật khẩu thật, API key. Dùng `git add -f`.
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
