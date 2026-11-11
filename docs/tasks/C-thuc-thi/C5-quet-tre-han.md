# C5 — Quét task trễ hạn và cảnh báo

Người làm: C
Người review: D
Trạng thái: chưa làm
Cần có trước: C1
Cần trước bước frontend: không
Mở khóa: X1
Nhánh git: c5-overdue
Ước lượng: 0,5–1 ngày

## Vì sao cần task này
`BE/service/engine/TaskOverdueScanner.java` chạy mỗi 15 phút (`@Scheduled(fixedRate = 15 * 60 * 1000, …)`). Cần kiểm 4 điều: đánh dấu `is_overdue` có đúng không; có gửi thông báo lặp lại mỗi 15 phút không; cờ có được gỡ khi gia hạn không (B3 lo phần gỡ khi sửa `dueDate`); và job có test được không, vì nó phụ thuộc thời gian thực.

## Kiến thức phải nắm
`@Scheduled` (fixedRate, fixedDelay, cron); inject `java.time.Clock` để test thời gian; câu `UPDATE` hàng loạt; job lũy đẳng; khóa job khi chạy nhiều instance (ShedLock — chỉ cần biết).

## Bước 0 — Tự đọc, không dùng AI
Đọc: `TaskOverdueScanner.java`; `docs/specs/system-overview.md` (Phân hệ 3, mục 5); phần dùng `is_overdue` và "stalled" trong `docs/specs/ai-diagnostics.md`; `BE/repository/NodeRepository.java`.
Trả lời:
1. Scanner hiện quét node ở những trạng thái nào? Node DONE quá hạn có bị đánh dấu không, có nên không?
2. Backend tắt 2 giờ rồi bật lại thì chuyện gì xảy ra?
3. Vì sao nên inject `Clock` thay vì gọi thẳng `Instant.now()`?

## Được đọc
> Viết tắt: `BE/` = `wpe-backend/src/main/java/com/pipeline/wpe/`, `BE-test/` = `wpe-backend/src/test/java/com/pipeline/wpe/`, `FE/` = `wpe-frontend/src/`.
- `wpe-backend/src/**`, `docs/**`

## Được ghi
- `BE/service/engine/TaskOverdueScanner.java`
- `BE/config/ClockConfig.java` (mới)
- `BE/repository/NodeRepository.java` (chỉ thêm method)
- `BE-test/service/engine/TaskOverdueScannerTest.java` (mới)
- `docs/tasks/C-thuc-thi/C5-quet-tre-han.md`

## Đặc tả đã chốt
- Chỉ xét node `TODO`, `IN_PROGRESS`, `REVIEW` có `due_date < now` và `is_overdue = false`. Đặt `is_overdue = true`, gửi **1** thông báo cho người phụ trách và cho owner. Chỉ gửi đúng lúc cờ đổi từ false sang true.
- Node `DONE` không bao giờ bị đánh dấu. `is_overdue` không tự gỡ; chỉ được gỡ khi `dueDate` bị dời (B3 làm).
- Thêm bean `Clock` (UTC) trong `BE/config/ClockConfig.java`. Scanner dùng bean này. D6 không tạo bean `Clock` thứ hai.
- Đánh dấu overdue **không được làm tăng `version`**: dùng câu `UPDATE` trực tiếp (giống cách B3 lưu tọa độ), để không gây 409 cho người đang thao tác task.

## Việc cần làm
1. 🧠 Bước 0.
2. 🧠 Viết trước ít nhất 6 test case dạng bảng.
3. 🤝 Code và test bằng `Clock.fixed(...)`.
4. 🧠 Chạy thật: dùng SQL đặt `due_date` của WPE-003 về quá khứ; tạm đổi `fixedRate` nhỏ lại trên máy bạn (không commit); kiểm thông báo chỉ được tạo 1 lần.

## Tiêu chí xong
- [ ] Test pass.
- [ ] Thực nghiệm: 3 lần quét liên tiếp chỉ tạo 1 thông báo (đếm bằng SQL).
- [ ] `version` của node không đổi sau khi bị đánh dấu overdue.

## Câu hỏi bảo vệ (người review hỏi, trả lời không nhìn code)
1. Vì sao đánh dấu overdue không được làm tăng `version`?
2. Job chạy cùng lúc trên 2 instance thì sao? ShedLock giải quyết thế nào?
3. `fixedRate` khác `fixedDelay` ở đâu? Job này nên dùng loại nào?

## Cấm
- Sửa file ngoài mục "Được ghi". File dùng chung thì báo nhóm trước (README mục 6).
- Đọc, in, commit `.env*`, khóa, mật khẩu thật, API key. Dùng `git add -f`.
- Commit cấu hình tạm (`fixedRate` nhỏ).
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

## Nhật ký sprint (chế độ làm nhanh — xem `docs/tasks/SPRINT_2_NGAY.md`)
Đã học lại: chưa

- **Làm gì:**
- **File chính đã sửa:**
- **Vì sao làm vậy** (tự viết):
- **Cần học lại:**
