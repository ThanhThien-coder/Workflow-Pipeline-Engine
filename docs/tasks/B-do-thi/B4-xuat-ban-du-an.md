# B4 — Xuất bản dự án: Kahn chặn chu trình, DRAFT → ACTIVE (Cụm 4.5)

Người làm: B
Người review: C
Trạng thái: chưa làm
Cần có trước: B3
Cần trước bước frontend: không
Mở khóa: B6, B8
Nhánh git: b4-publish
Ước lượng: 1 ngày

## Vì sao cần task này
Chưa có `POST /projects/{id}/publish`. Đây là chỗ thuật toán Kahn "ra mặt" với người dùng: chặn xuất bản khi đồ thị có chu trình, và mở khóa các task gốc khi đồ thị hợp lệ.

## Kiến thức phải nắm
Transaction, gửi sự kiện sau khi commit (`TransactionSynchronization.afterCommit`), tính lũy đẳng (gọi 2 lần ra cùng kết quả), vòng đời dự án.

## Bước 0 — Tự đọc, không dùng AI
Đọc: integration map 4.5 và Chương III (lỗi 422); `docs/specs/workflow-engine.md` mục 4 và 5.1; `updateProjectStatus` trong `BE/service/ProjectService.java`; phần đặt trạng thái node khi clone trong `BE/service/TemplateCloneService.java`; `FE/components/settings/GeneralSettingsSection.tsx`, `FE/components/settings/KahnCycleModal.tsx`; kiểu `PublishPipelineResult` trong `FE/types/settings.types.ts`.
Trả lời:
1. Mỗi cạnh đã được kiểm chu trình lúc thêm (B3), vì sao lúc xuất bản vẫn phải chạy Kahn trên cả dự án? (gợi ý: dữ liệu clone, seed, SQL gõ tay)
2. Sau khi xuất bản, node nào chuyển sang TODO? Node độc lập (không phase, không cha) thì sao?
3. Bấm xuất bản 2 lần liên tiếp thì chuyện gì xảy ra?

## Được đọc
> Viết tắt: `BE/` = `wpe-backend/src/main/java/com/pipeline/wpe/`, `BE-test/` = `wpe-backend/src/test/java/com/pipeline/wpe/`, `FE/` = `wpe-frontend/src/`.
- `wpe-backend/src/**`, `FE/**`, `docs/**`

## Được ghi
- `BE/controller/GraphController.java` (hoặc `PublishController.java` mới), `BE/service/graph/**`, `BE/dto/response/graph/**`
- `BE-test/**/graph/**`
- `docs/FRONTEND_BACKEND_INTEGRATION_MAP.md` (4.5), `docs/specs/workflow-engine.md` (5.1), `docs/tasks/B-do-thi/B4-xuat-ban-du-an.md`

## Đặc tả đã chốt
- `POST /api/v1/projects/{id}/publish`, chỉ OWNER.
- Chỉ xuất bản được từ `DRAFT` hoặc `PLANNING`. Code tạo và clone hiện đặt `PLANNING`; D1 sẽ đổi về `DRAFT`, nhưng B4 vẫn nhận cả hai. Trạng thái khác → 409 `INVALID_PROJECT_STATUS`.
- Chạy `DagValidator` trên mọi node và dependency của dự án. Có chu trình → 422 `CYCLE_DETECTED`, `cycleNodes` là mã node lấy từ `cycleNodeIds`.
- Hợp lệ:
  - `status = ACTIVE`.
  - Mọi node `LOCKED` có in-degree 0 → `TODO`.
  - Mỗi node vừa mở khóa có người phụ trách: gửi `SseEmitterService.sendToUser(assignee, "TASK_UNLOCKED", …)` và `WorkflowEventPublisher.publishNotification(…)` (gọi hàm có sẵn của C, không sửa file của C).
  - Response `{ success, status, publishedAt, unlockedTaskCount }`.
- Mọi thay đổi DB nằm trong 1 transaction. SSE và thông báo gửi **sau khi commit**, theo cách C1 đã chốt (`TransactionSynchronization.afterCommit`). C1 chưa merge thì tự làm theo cách đó và báo C.

## Việc cần làm
1. 🧠 Bước 0.
2. 🧠 Viết trước ít nhất 8 test case dạng bảng.
3. 🤝 Code và test.
4. 🧠 Tạo chu trình bằng SQL gõ tay trong DBeaver (vượt qua lớp kiểm của B3), rồi xuất bản → 422.
5. 🤝 Cập nhật integration map 4.5 và `workflow-engine.md` 5.1.

## Tiêu chí xong
- [ ] Test pass.
- [ ] Swagger: dự án DRAFT không có chu trình → 200, `unlockedTaskCount` đúng (đối chiếu bằng SQL).
- [ ] Có chu trình (tạo bằng SQL) → 422 với đúng mã node.
- [ ] Xuất bản lại dự án đang ACTIVE → 409.

## Câu hỏi bảo vệ (người review hỏi, trả lời không nhìn code)
1. Vì sao gửi SSE sau khi commit? Gửi trước thì có thể sai thế nào?
2. `cycleNodeIds` khác `blockedNodeIds` thế nào? Vì sao người dùng chỉ thấy `cycleNodes`?
3. Độ phức tạp của thao tác xuất bản là bao nhiêu, tính theo số node và số cạnh?

## Cấm
- Sửa file ngoài mục "Được ghi". File dùng chung thì báo nhóm trước (README mục 6).
- Đọc, in, commit `.env*`, khóa, mật khẩu thật, API key. Dùng `git add -f`.
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
