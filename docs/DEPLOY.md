# Hướng dẫn Triển khai Hệ thống Production (Docker)

Tài liệu hướng dẫn triển khai toàn diện hệ thống **Workflow Pipeline Engine (WPE)** môi trường production sử dụng Docker Compose.

---

## 1. Sơ đồ kiến trúc mạng

Chỉ duy nhất dịch vụ **Frontend (Nginx)** mở cổng ra máy chủ bên ngoài (cổng `WEB_PORT`, mặc định 80). Toàn bộ các dịch vụ còn lại (Backend, AI Service, PostgreSQL, RabbitMQ) nằm hoàn toàn trong mạng nội bộ Docker (`wpe-prod_default`), không truy cập trực tiếp được từ bên ngoài.

```text
Trình duyệt người dùng
       │
       ▼ (HTTP :WEB_PORT)
┌────────────────────────────────────────────────────────┐
│ Nginx (Frontend Container)                             │
│ ├── Phục vụ file tĩnh SPA (React /dist)                │
│ └── /api/*  ──proxy_pass──┐                           │
└───────────────────────────┼────────────────────────────┘
                            │ (Nội bộ Docker)
                            ▼
               ┌─────────────────────────┐
               │ Backend (Spring Boot)   │
               │ Cổng nội bộ: 8080       │
               └──┬──────────┬─────────┬─┘
                  │          │         │
        ┌─────────┘          │         └─────────┐
        ▼                    ▼                   ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  PostgreSQL   │    │   RabbitMQ    │    │  AI Service   │
│  (Port 5432)  │    │  (Port 5672)  │    │  (Port 8081)  │
└───────────────┘    └───────────────┘    └───────────────┘
```

---

## 2. Yêu cầu môi trường

- Máy chủ Linux / Windows / macOS đã cài đặt **Docker Desktop** hoặc **Docker Engine** tích hợp sẵn Docker Compose v2 (`docker compose`).
- Tối thiểu 4GB RAM khả dụng để biên dịch và chạy đồng thời các container (Spring Boot, Node/Vite build, PostgreSQL, RabbitMQ, Python FastAPI).

---

## 3. Khởi chạy lần đầu

### Bước 1: Chuẩn bị file cấu hình môi trường
Sao chép file mẫu `deploy/prod.env.example` thành file `deploy/.env` (file này đã được git bỏ qua để chống lộ bí mật):
```bash
cp deploy/prod.env.example deploy/.env
```

### Bước 2: Sinh các khóa bảo mật và điền vào `deploy/.env`
Mở `deploy/.env` và sinh các chuỗi bí mật an toàn (ít nhất 32 byte) bằng lệnh Python hoặc chuỗi ngẫu nhiên:
```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```
Điền giá trị vào các biến bắt buộc:
- `POSTGRES_PASSWORD`: Mật khẩu cho cơ sở dữ liệu PostgreSQL.
- `RABBITMQ_PASSWORD`: Mật khẩu cho hàng đợi RabbitMQ.
- `JWT_SECRET`: Khóa bí mật ký JWT Token (ít nhất 32 byte).
- `AI_INTERNAL_KEY`: Khóa xác thực nội bộ giữa Backend và AI Service (sinh chuỗi an toàn tương tự JWT_SECRET).

### Bước 3: Khởi tạo và chạy hệ thống
Chạy lệnh build và bật các service chạy ngầm:
```bash
docker compose -f docker-compose.prod.yml --env-file deploy/.env up -d --build
```

### Bước 4: Truy cập ứng dụng
Mở trình duyệt và truy cập:
👉 `http://localhost` (hoặc `http://localhost:<WEB_PORT>` nếu đổi cổng trong `deploy/.env`).

---

## 4. Kiểm tra nhanh trạng thái hệ thống

Kiểm tra tất cả 5 service đã ở trạng thái `healthy`:
```bash
docker compose -f docker-compose.prod.yml --env-file deploy/.env ps
```
Kiểm tra sức khỏe Backend qua Nginx:
```bash
curl http://localhost/api/v1/health
```
*(Hoặc thay cổng tương ứng: `curl http://localhost:<WEB_PORT>/api/v1/health`)*. Kết quả mong đợi là HTTP 200 kèm phản hồi JSON trạng thái `UP`.

---

## 5. Cập nhật mã nguồn (Update Code)

Khi có code mới từ Git:
```bash
git pull
docker compose -f docker-compose.prod.yml --env-file deploy/.env up -d --build
```
Dữ liệu của cơ sở dữ liệu PostgreSQL (`pgdata`) và RabbitMQ (`rabbitmq_data`) được lưu trữ tại Docker named volumes nên không bị mất khi cập nhật image hoặc chạy lại container.

---

## 6. Xem log, dừng dịch vụ và sao lưu dữ liệu

- **Xem log thời gian thực của backend**:
  ```bash
  docker compose -f docker-compose.prod.yml --env-file deploy/.env logs -f backend
  ```
- **Dừng hệ thống (bảo toàn dữ liệu)**:
  ```bash
  docker compose -f docker-compose.prod.yml --env-file deploy/.env down
  ```
- ⚠️ **Cảnh báo xóa toàn bộ dữ liệu**:
  Lệnh `docker compose ... down -v` sẽ **XÓA SẠCH** toàn bộ volume cơ sở dữ liệu và hàng đợi. Không được dùng cờ `-v` trên môi trường production nếu không muốn mất dữ liệu!
- **Sao lưu cơ sở dữ liệu (Backup PostgreSQL)**:
  ```bash
  docker compose -f docker-compose.prod.yml --env-file deploy/.env exec postgres pg_dump -U wpe_user wpe_db > backup.sql
  ```

---

## 7. Lưu ý bảo mật quan trọng

1. **Đổi mật khẩu tài khoản mẫu**: Migration `V2__seed_initial_data.sql` tạo sẵn các tài khoản mẫu thử nghiệm (`admin`, `alex.kim`, `sarah.chen`) với mật khẩu phổ biến được chia sẻ trong nhóm phát triển. Khi đưa hệ thống lên mạng thật hoặc internet công cộng, bắt buộc phải đổi mật khẩu hoặc vô hiệu hóa các tài khoản này ngay sau lần khởi động đầu tiên.
2. **Cấu hình HTTPS ngoài Internet**: Bản cấu hình Docker Compose này chỉ phục vụ HTTP thuần túy trên cổng 80. Khi triển khai ra ngoài Internet, bắt buộc phải đặt hệ thống phía sau một Reverse Proxy có HTTPS (như Cloudflare, Nginx ngoài máy chủ vật lý, Traefik, Caddy, hoặc AWS ALB).
3. **Khóa nội bộ `AI_INTERNAL_KEY`**: Backend Spring Boot đã được tích hợp để tự động gửi header `X-Internal-Key` kèm theo mọi request sang AI microservice. Mã nguồn AI service trên nhánh `main` hiện chưa kiểm khóa (phần của Abdul, đang ở nhánh `ai-python-de-xuat`). Khi phần đó được ghép, compose này dùng được ngay, không cần sửa.
4. **Không commit file bí mật**: Không commit file `deploy/.env` lên repository Git.

---

## 8. Cấu hình Dịch vụ AI (Google Gemini)

- **Chế độ mặc định (Phân tích dự phòng)**: Nếu để trống biến `GEMINI_API_KEY` trong `deploy/.env`, microservice AI vẫn tính toán đường găng CPM, xác định nút tắc nghẽn và tự động áp dụng thuật toán phân tích dự phòng (heuristic fallback) nội bộ để trả lời chẩn đoán nhanh chóng, không tốn token.
- **Kích hoạt Google Gemini**: Để sử dụng mô hình trí tuệ nhân tạo Gemini (ví dụ: `gemini-2.5-flash`), điền API Key vào biến `GEMINI_API_KEY` trong `deploy/.env` rồi chạy lại:
  ```bash
  docker compose -f docker-compose.prod.yml --env-file deploy/.env up -d
  ```
