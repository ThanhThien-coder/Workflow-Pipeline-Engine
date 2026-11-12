# T0 — Ghi chép của C
Trạng thái: xong

> Làm theo **chế độ sprint**: chỉ bước 2–5 (máy mình chạy được Docker, backend, frontend), xem `docs/tasks/SPRINT_2_NGAY.md` mục 6. Bước 6–11 để dành giai đoạn Học lại.

## Kết quả cài đặt và test (12/11/2026)
- **JDK:** Temurin 17.0.20.1.
- **Node / npm:** Node 24.16.0, npm 11.13.0. `node_modules` đã có; `package.json` không đổi sau lần pull nên không cần `npm install` lại.
- **Docker:** Docker 29.8.2, Compose v5.6.0. Docker Desktop lúc đầu đang tắt, mở lên thì engine chạy. Container `wpe_postgres_local` và `wpe_rabbitmq_local` đang chạy; RabbitMQ UI `http://localhost:15672` trả 200.
- **Backend:** `./mvnw spring-boot:run` → `Started WpeApplication in 6.239 seconds`. `GET /api/v1/health` → `status: UP`, `database: CONNECTED`. Swagger UI `http://localhost:8080/swagger-ui.html` trả 200.
- **Flyway:** DB local đang ở V3, chạy thêm V4, V5, V6, V8, V9 thành công (`now at version v9`). Log khởi động không có dòng ERROR.
- **Frontend:** `npm run dev` → Vite 5.4.21 ready, `http://localhost:5173` trả 200 (trang "Workflow Pipeline Engine").
- **Chưa chạy:** `./mvnw test`, `npm test` (T0 rút gọn không yêu cầu). Chưa tự bấm qua hết các màn hình frontend.

## Sự cố gặp phải
- Lần chạy backend đầu tiên lỗi biên dịch: `bad class file ... target/classes/... NoSuchFileException`. Nghi do Java Language Server của IDE build lại vào cùng `target/classes` sau khi pull 58 commit. Cách xử lý: `./mvnw clean test-compile` rồi chạy lại thì được.

## Để giai đoạn Học lại
- Bước 6: chạy test FE và BE, dán dòng tổng kết.
- Bước 7: thực hành Swagger một task đi hết vòng đời.
- Bước 8: lần theo 11 chặng của "Owner duyệt task".
- Bước 9–10: vẽ sơ đồ khối, trả lời 10 câu hỏi tổng quan.

## Điều chưa hiểu
