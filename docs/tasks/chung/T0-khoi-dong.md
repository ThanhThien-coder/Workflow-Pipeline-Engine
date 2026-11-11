# T0 — Khởi động: chạy hệ thống và lần theo một yêu cầu xuyên tầng

Người làm: mỗi người (A, B, C, D) — làm riêng, ghi chép riêng
Người review: người review cố định của bạn (README mục 2)
Trạng thái: theo từng người — ghi ở `docs/tasks/ghi-chep/T0-<A|B|C|D>.md`
Cần có trước: không
Cần trước bước frontend: không
Mở khóa: A1, A2, B1, C1, D1, D5
Nhánh git: t0-<chữ của bạn> (chỉ commit file ghi chép)
Ước lượng: 0,5–1 ngày

## Vì sao cần task này
Trước khi sửa mảng của mình, ai cũng phải chạy được toàn bộ hệ thống và hiểu một yêu cầu đi qua những tầng nào. Làm xong T0 thì khi đọc code mảng khác bạn biết nó nằm ở đâu trong bức tranh chung.

## Kiến thức phải nắm
- Kiến trúc tách FE (React, cổng 5173) và BE (Spring Boot, cổng 8080), JSON qua HTTP.
- Tầng backend: Controller → Service → Repository → Entity, DTO là `record`.
- Tầng frontend: View/Component → Zustand store → `services/container.ts` → interface `I*Service` → bản Mock hoặc Http.
- Bất đồng bộ: RabbitMQ (hàng đợi) và SSE (server đẩy sự kiện xuống trình duyệt).

## Bước 0 — Tự đọc, không dùng AI
Đọc theo thứ tự: `GEMINI.md` → `docs/specs/system-overview.md` → `docs/TEAM_DEVELOPMENT_GUIDE.md` (phần cài đặt) → `docs/specs/backend-architecture.md` → lướt mục lục `docs/FRONTEND_BACKEND_INTEGRATION_MAP.md`.

## Việc cần làm
1. Tạo file `docs/tasks/ghi-chep/T0-<chữ của bạn>.md` theo mẫu ở cuối file này, đặt `Trạng thái: đang làm`.
2. Cài đủ công cụ theo `docs/TEAM_DEVELOPMENT_GUIDE.md` (JDK 17 trở lên, Docker Desktop, Node 18 trở lên, IntelliJ hoặc VS Code).
3. Bật Docker: `cd wpe-backend && docker compose up -d`. Mở `http://localhost:15672` xem RabbitMQ.
4. Chạy backend (IntelliJ: Run `WpeApplication`; sau khi A1 xong thì dùng được `./mvnw spring-boot:run`). Mở `http://localhost:8080/swagger-ui.html`.
5. Chạy frontend ở chế độ mock: `cd wpe-frontend && npm install && npm run dev`. Bấm qua mọi màn hình.
6. Chạy test: `cd wpe-frontend && npm test`. Ngày 11/11/2026 có 1 test lỗi (`WorkflowArtifacts.test.tsx`, A2 xử lý). Test backend chạy trong IntelliJ (chuột phải thư mục `src/test/java` → Run Tests). Dán dòng tổng kết thật vào ghi chép.
7. 🧠 **Thực hành Swagger: một task đi hết vòng đời** (dùng header `X-Debug-User-Id` để đóng vai người dùng; dữ liệu mẫu ở `V2__seed_initial_data.sql`):
   - Đóng vai `3` (sarah, Collaborator): `PATCH /api/v1/nodes/3/status` body `{ "status": "IN_PROGRESS", "version": 0 }` (WPE-003).
   - Vẫn vai `3`: `POST /api/v1/nodes/3/submit` body `{ "version": <version vừa nhận> }`.
   - Đóng vai `2` (alex, Owner): `PATCH /api/v1/nodes/3/status` body `{ "status": "DONE", "version": <version mới> }`.
   - `GET /api/v1/projects/1/my-tasks?userId=2`: WPE-004 phải chuyển từ LOCKED sang TODO. Mở RabbitMQ dashboard xem queue `wpe.task.completed.queue`. Nếu WPE-004 không mở khóa thì ghi lại nguyên văn: có thể bạn vừa gặp lỗi "bắn sự kiện trước khi commit" mà C1 sẽ xử lý.
   - Ghi từng response (status code, version) vào ghi chép. Muốn làm lại từ đầu thì chạy `docker compose down -v && docker compose up -d` (**xóa sạch dữ liệu local**).
8. 🧠 **Lần theo yêu cầu "Owner duyệt task"** từ nút bấm tới khi node con mở khóa. Ghi mỗi chặng dạng `file:dòng` + 1 câu giải thích. Gợi ý các chặng: `FE/components/kanban/TaskDetailModal.tsx` → `FE/hooks/usePhaseKanban.ts` → `FE/services/impl/HttpWorkflowService.ts` (`updateTaskStatus`) → `BE/controller/NodeController.java` (`updateStatus`) → `BE/service/engine/StateMachineService.java` (`updateStatus`) → `BE/service/event/WorkflowEventPublisher.java` → RabbitMQ → `BE/service/event/WorkflowEventConsumer.java` (`handleTaskCompleted`) → `StateMachineService.unlockDownstreamTasks` → `BE/service/event/SseEmitterService.java` → `FE/views/MyTasksView.tsx` (EventSource). Tìm chặng bằng `grep`, đừng đoán.
9. 🧠 Vẽ tay sơ đồ khối toàn hệ thống (FE, BE, PostgreSQL, RabbitMQ, SSE, Gemini) rồi chụp ảnh dán vào ghi chép.
10. 🧠 Trả lời 10 câu hỏi tổng quan dưới đây vào ghi chép, mỗi câu 2–4 dòng, chỉ ra file liên quan.
11. Đổi `Trạng thái: chờ kiểm`, mở PR chỉ chứa file ghi chép, nhờ người review.

### 10 câu hỏi tổng quan (mỗi câu chạm một cụm)
1. Cụm 1: Access token và refresh token khác nhau thế nào? Hiện backend đã cấp JWT chưa (tìm `AuthController`)?
2. Cụm 2: Bảng `users` có những cột nào? Thiếu cột gì để làm trang hồ sơ?
3. Cụm 3: Mời thành viên đi qua những trạng thái nào (`InvitationStatus`)?
4. Cụm 4: DAG là gì? Vì sao phải chặn chu trình trước khi xuất bản?
5. Cụm 5: Kể 5 trạng thái task và ai được chuyển từ REVIEW sang DONE.
6. Cụm 6: Artifact lưu file hay lưu link? Cờ `is_public_for_guest` dùng làm gì?
7. Cụm 7: Khách xem tiến độ cần những gì? Token kiểm những điều kiện nào?
8. Cụm 8: "Góp ý một chiều" nghĩa là gì?
9. Cụm 9: Vì sao AI có cooldown 180 giây? Kết quả lưu ở cột nào?
10. Cụm 10: Admin quản lý gì và không được xem gì?

## Tiêu chí xong
- [ ] File ghi chép có: kết quả 7 bước Swagger (status code, version thật), 11 chặng `file:dòng`, ảnh sơ đồ khối, 10 câu trả lời, dòng tổng kết test FE và BE.
- [ ] FE chạy được ở chế độ mock, BE chạy được với Docker (ghi rõ nếu chưa được và vì sao).

## Câu hỏi bảo vệ (người review hỏi, trả lời không nhìn code)
1. Vì sao API duyệt task trả kết quả ngay mà node con lại được mở khóa sau đó một chút?
2. Nếu RabbitMQ tắt thì bước nào trong 11 chặng hỏng, người dùng thấy gì?
3. Chế độ mock của FE chặn lời gọi ở tầng nào?

## Cấm
- Đọc, in hoặc commit `.env*`, khóa, mật khẩu thật.
- Sửa code ở task này (chỉ đọc và chạy).

## Dành cho Claude (đọc trước khi làm)
Người dán file này là **người làm**. Mục tiêu là họ hiểu hệ thống, không phải bạn làm thay.
1. Không trả lời hộ 10 câu hỏi và không lần chặng hộ. Chỉ gợi ý nên `grep` gì, mở file nào.
2. Người làm trả lời xong thì chấm từng câu: đúng, thiếu hay sai, và chỉ đúng file:dòng để họ tự sửa.
3. Lỗi cài đặt, lỗi chạy thì được hướng dẫn trực tiếp.
4. Không đọc hay in `.env*`.

## Mẫu file ghi chép `docs/tasks/ghi-chep/T0-<chữ>.md`
```markdown
# T0 — Ghi chép của <chữ>
Trạng thái: đang làm

## Kết quả cài đặt và test
## Thực hành Swagger (7 bước)
## 11 chặng của "Owner duyệt task"
## Sơ đồ khối (ảnh)
## 10 câu hỏi tổng quan
## Điều chưa hiểu
```
