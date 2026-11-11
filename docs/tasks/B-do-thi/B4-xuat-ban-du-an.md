# B4 — Xuất bản dự án: kiểm thử và vá `publishPipeline` (Cụm 4.5)

Người làm: B
Người review: C
Trạng thái: chưa làm
Cần có trước: B3
Cần trước bước frontend: không
Mở khóa: B6, B8
Nhánh git: b4-publish
Ước lượng: 0,5–1 ngày

> **Cập nhật 11/11/2026 (sau khi pull):** `POST /projects/{id}/publish` đã có (`WorkflowGraphService.publishPipeline`): chạy Kahn, chuyển ACTIVE, mở khóa node gốc. Task này vá các chỗ chưa đúng đặc tả.

## Vì sao cần task này
Đọc code thấy:
1. Chỉ chặn khi dự án **đã** ACTIVE. Dự án `ARCHIVED`, `PAUSED`, `COMPLETED`… vẫn "xuất bản" được, và bị chuyển thẳng sang ACTIVE.
2. Lỗi "đã xuất bản" trả 400 (`IllegalArgumentException`), trong khi đây là xung đột trạng thái nên phải là 409.
3. Node gốc được mở khóa nhưng người phụ trách **không nhận** SSE `TASK_UNLOCKED` hay thông báo nào.
4. `cycleNodes` trả về gồm cả node đứng sau vòng (B1 đã sửa cách tính, B4 phải dùng kết quả mới).

## Kiến thức phải nắm
Transaction, gửi sự kiện sau khi commit (`TransactionSynchronization.afterCommit`), vòng đời dự án, tính lũy đẳng.

## Bước 0 — Tự đọc, không dùng AI
Đọc: integration map 4.5 và Chương III; `docs/specs/workflow-engine.md` mục 4 và 5.1; hàm `publishPipeline` trong `WorkflowGraphService.java`; `FE/components/settings/KahnCycleModal.tsx`.
Trả lời:
1. Mỗi cạnh đã được kiểm khi thêm (B3), vì sao xuất bản vẫn phải chạy Kahn cả dự án? (gợi ý: dữ liệu clone, seed, SQL gõ tay)
2. Chỉ ra dòng code của lỗi 1 và lỗi 3.
3. Vì sao SSE phải gửi **sau** khi commit?

## Được đọc
> Viết tắt: `BE/` = `wpe-backend/src/main/java/com/pipeline/wpe/`, `BE-test/` = `wpe-backend/src/test/java/com/pipeline/wpe/`, `FE/` = `wpe-frontend/src/`.
- `wpe-backend/src/**`, `FE/**`, `docs/**`

## Được ghi
- `BE/service/WorkflowGraphService.java` (chỉ `publishPipeline`), `BE/dto/response/graph/PublishPipelineResponse.java`
- `BE-test/service/WorkflowGraphServiceTest.java`
- `docs/FRONTEND_BACKEND_INTEGRATION_MAP.md` (4.5), `docs/specs/workflow-engine.md` (5.1), `docs/tasks/B-do-thi/B4-xuat-ban-du-an.md`

## Đặc tả đã chốt
- Chỉ xuất bản được từ `DRAFT` hoặc `PLANNING` (code tạo dự án đang đặt PLANNING; D1 sẽ đổi về DRAFT). Trạng thái khác → 409 `INVALID_PROJECT_STATUS`.
- Có chu trình → 422 `CYCLE_DETECTED`, `cycleNodes` = `cycleNodeCodes` theo cách tính mới của B1.
- Mỗi node vừa mở khóa có người phụ trách: gửi `SseEmitterService.sendToUser(assignee, "TASK_UNLOCKED", …)` và `WorkflowEventPublisher.publishNotification(…)`, **sau khi commit** (theo cách C1 chốt; nếu C1 chưa merge thì tự dùng `TransactionSynchronization.afterCommit` và báo C). Gọi hàm có sẵn, không sửa file của C.
- Giữ response `{ success, status, publishedAt, unlockedTaskCount }`.

## Việc cần làm
1. 🧠 Bước 0.
2. 🧠 Viết test **đỏ** cho lỗi 1–3 trước khi sửa.
3. 🤝 Sửa, cho test xanh.
4. 🧠 Tạo chu trình bằng SQL gõ tay trong DBeaver (vượt qua lớp kiểm của B3), rồi xuất bản → 422.
5. 🤝 Cập nhật docs.

## Tiêu chí xong
- [ ] Test lỗi 1–3: fail trước khi sửa, pass sau khi sửa.
- [ ] Swagger: dự án DRAFT hợp lệ → 200, `unlockedTaskCount` đúng (đối chiếu SQL); dự án ARCHIVED → 409; có chu trình → 422.
- [ ] Mở 2 tab: người phụ trách node gốc nhận `TASK_UNLOCKED` ngay sau khi owner xuất bản.

## Câu hỏi bảo vệ (người review hỏi, trả lời không nhìn code)
1. Gửi SSE trước commit thì có thể sai thế nào?
2. `cycleNodeCodes` khác `blockedNodeCodes` thế nào?
3. Độ phức tạp của xuất bản tính theo số node và số cạnh?

## Cấm
- Sửa file ngoài mục "Được ghi". File dùng chung thì báo nhóm trước (README mục 6).
- Sửa `StateMachineService.java`, `SseEmitterService.java`, `WorkflowEventPublisher.java` (của C).
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
