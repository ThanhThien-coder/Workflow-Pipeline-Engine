# Hướng dẫn Triển khai Hệ thống Production (Docker)

Tài liệu hướng dẫn triển khai toàn diện hệ thống **Workflow Pipeline Engine (WPE)** môi trường production sử dụng Docker Compose.

---

## 1. Sơ đồ kiến trúc mạng

Chỉ duy nhất dịch vụ **Frontend (Nginx)** mở cổng ra máy chủ bên ngoài (cổng `WEB_PORT`, mặc định 80). Toàn bộ các dịch vụ còn lại (Backend, AI Service, PostgreSQL, RabbitMQ) nằm hoàn toàn trong mạng nội bộ Docker (`wpe-prod_default`), không truy cập trực tiếp được từ bên ngoài.

Khi bật HTTPS (mục 3.1), **Caddy** đứng trước Nginx và là dịch vụ duy nhất mở cổng 80/443; Nginx không còn mở cổng ra ngoài.

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
- `SEED_ACCOUNT_PASSWORD`: Mật khẩu riêng (ít nhất 12 ký tự, có chữ số) cho 3 tài khoản mẫu `admin`, `alex.kim`, `sarah.chen`. Xem mục 7.1.
- `APP_PUBLIC_URL`: Địa chỉ công khai của trang web dùng tạo link chia sẻ cho khách và link trong email (mặc định `http://localhost`, ví dụ `https://wpe.example.com`).

### Bước 3: Khởi tạo và chạy hệ thống
Chạy lệnh build và bật các service chạy ngầm:
```bash
docker compose -f docker-compose.prod.yml --env-file deploy/.env up -d --build
```

### Bước 4: Truy cập ứng dụng
Mở trình duyệt và truy cập:
👉 `http://localhost` (hoặc `http://localhost:<WEB_PORT>` nếu đổi cổng trong `deploy/.env`).

Đăng nhập tài khoản `admin@pipeline.engine` bằng mật khẩu đã đặt ở `SEED_ACCOUNT_PASSWORD`, rồi vào Profile đổi mật khẩu riêng cho từng tài khoản mẫu.

### 3.1 Chạy với tên miền và HTTPS (bắt buộc khi đưa lên Internet)
File `deploy/docker-compose.https.yml` thêm **Caddy**: tự xin chứng chỉ Let's Encrypt miễn phí, tự gia hạn, tự chuyển `http://` sang `https://`, gửi header HSTS.
1. Trỏ tên miền về máy chủ: tạo bản ghi DNS `A` (và `AAAA` nếu có IPv6) của tên miền, ví dụ `wpe.example.com`, về IP công khai của máy chủ.
2. Mở cổng `80` và `443` (TCP, thêm `443/UDP` cho HTTP/3) trên tường lửa của máy chủ/nhà cung cấp VPS.
3. Trong `deploy/.env`: `SITE_DOMAIN=wpe.example.com` và `APP_PUBLIC_URL=https://wpe.example.com`.
4. Chạy (thay cho lệnh ở Bước 3):
   ```bash
   docker compose -f docker-compose.prod.yml -f deploy/docker-compose.https.yml --env-file deploy/.env up -d --build
   ```
5. Mở `https://wpe.example.com`. Lần đầu Caddy cần vài giây để lấy chứng chỉ; lỗi chứng chỉ thì xem `docker compose ... logs caddy` (thường do DNS chưa trỏ đúng hoặc cổng 80 bị chặn).

Khi đã bật HTTPS, mọi lệnh `docker compose` ở các mục dưới đều thêm `-f deploy/docker-compose.https.yml` ngay sau `-f docker-compose.prod.yml`. Chứng chỉ lưu ở volume `caddy_data`; đừng xóa volume này (Let's Encrypt giới hạn số lần cấp lại).

Thử trên máy không có tên miền: `SITE_DOMAIN=localhost`, `HTTP_PORT=8091`, `HTTPS_PORT=8443` rồi mở `https://localhost:8443` (Caddy dùng chứng chỉ tự ký nên trình duyệt sẽ cảnh báo).

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
- **Sao lưu ảnh đại diện người dùng (Backup volume uploads)**:
  Ảnh đại diện người dùng được lưu trong volume `uploads` (`/app/uploads`). Cần sao lưu volume này cùng cơ sở dữ liệu:
  ```bash
  docker run --rm -v wpe-prod_uploads:/data -v $(pwd):/backup alpine tar czf /backup/uploads_backup.tar.gz -C /data .
  ```

---

## 7. Lưu ý bảo mật quan trọng

1. **Tài khoản mẫu không dùng mật khẩu công khai**: Migration `V2__seed_initial_data.sql` tạo sẵn 3 tài khoản mẫu (`admin`, `alex.kim`, `sarah.chen`), mật khẩu của chúng ghi công khai trong `README.md`. Khi backend khởi động (mọi profile trừ `dev`), tài khoản mẫu nào còn mật khẩu công khai sẽ được đổi sang `SEED_ACCOUNT_PASSWORD` và bị đăng xuất khỏi mọi phiên. Thiếu biến này (hoặc ngắn hơn 12 ký tự, không có chữ số) thì backend **không khởi động** và log ghi rõ cách sửa. Tài khoản đã tự đổi mật khẩu thì không bị đụng. `SEED_ACCOUNT_GUARD_ENABLED=false` chỉ dùng khi thử trên máy, không dùng trên production.
2. **HTTPS**: Nginx chỉ phục vụ HTTP. Khi đưa ra Internet, chạy kèm Caddy theo mục 3.1. Nginx chỉ tin header IP thật từ Caddy (IP cố định `10.203.77.10` trong mạng `edge`), nên nhật ký admin ghi đúng IP người dùng và khách không giả được IP bằng header. Nếu đặt thêm Cloudflare (chế độ proxy) trước Caddy thì IP ghi được là IP của Cloudflare.
3. **Header bảo mật**: Nginx gửi kèm mọi phản hồi `Content-Security-Policy` (chỉ nạp tài nguyên từ chính tên miền), `X-Frame-Options: DENY` (trang khác không nhúng được WPE), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` (cấu hình ở `deploy/nginx-security-headers.conf`). Caddy thêm `Strict-Transport-Security`.
4. **Khóa nội bộ `AI_INTERNAL_KEY`**: Backend Spring Boot đã được tích hợp để tự động gửi header `X-Internal-Key` kèm theo mọi request sang AI microservice. AI service kiểm khóa này: thiếu hoặc sai khóa thì trả `401`. Hai bên phải dùng cùng một giá trị `AI_INTERNAL_KEY` trong `deploy/.env`.
5. **Không commit file bí mật**: Không commit file `deploy/.env` lên repository Git.

---

## 8. Cấu hình Dịch vụ AI (Google Gemini)

- **Chế độ mặc định (Phân tích dự phòng)**: Nếu để trống biến `GEMINI_API_KEY` trong `deploy/.env`, microservice AI vẫn tính toán đường găng CPM, xác định nút tắc nghẽn và tự động áp dụng thuật toán phân tích dự phòng (heuristic fallback) nội bộ để trả lời chẩn đoán nhanh chóng, không tốn token.
- **Kích hoạt Google Gemini**: Để sử dụng mô hình trí tuệ nhân tạo Gemini (mặc định `gemini-3.8-flash`, model này quá tải hoặc lỗi thì tự gọi `gemini-3.1-flash-lite` qua `GEMINI_FALLBACK_MODEL`), điền API Key vào biến `GEMINI_API_KEY` trong `deploy/.env` rồi chạy lại:
  ```bash
  docker compose -f docker-compose.prod.yml --env-file deploy/.env up -d
  ```
- **Khi model quá tải**: service gọi lần lượt `GEMINI_MODEL` rồi `GEMINI_FALLBACK_MODEL`; mỗi model đứng trước model cuối chờ tối đa `GEMINI_TIMEOUT_MS` (12 giây), cả chuỗi tối đa `GEMINI_TOTAL_TIMEOUT_MS` (25 giây, dưới mức 30 giây backend chờ). Hết model mới dùng phân tích dự phòng. Kết quả ghi model đã trả lời ở `tokenUsage.model`.
- **Bảo mật key**: mỗi môi trường dùng một key riêng, chỉ đặt trong `deploy/.env` của máy chủ. Key đã lộ (dán vào chat, commit nhầm) thì thu hồi ở Google AI Studio và tạo key mới.
- **Gói miễn phí**: không tốn tiền nhưng Google được dùng dữ liệu gửi lên để cải thiện sản phẩm. Dùng dữ liệu thật của người dùng thì cân nhắc gói trả phí.

---

## 9. Gửi email (quên mật khẩu, xác nhận đổi mật khẩu)

- **Tắt mặc định**: để trống `MAIL_HOST` hoặc `MAIL_FROM` thì không gửi email; trang đăng nhập báo người dùng liên hệ quản trị viên khi quên mật khẩu. Mọi chức năng khác vẫn chạy.
- **Bật**: điền nhóm biến `MAIL_*` trong `deploy/.env` (xem chú thích trong `deploy/prod.env.example`) rồi chạy lại `docker compose ... up -d`. Ví dụ Gmail: `MAIL_HOST=smtp.gmail.com`, `MAIL_PORT=587`, `MAIL_USERNAME`/`MAIL_FROM` = địa chỉ Gmail, `MAIL_PASSWORD` = App Password 16 ký tự (bật xác minh 2 bước rồi tạo ở mục App passwords của tài khoản Google), không dùng mật khẩu đăng nhập.
- **Link trong email** dùng `APP_PUBLIC_URL`, nên biến này phải là địa chỉ công khai thật của trang (ví dụ `https://wpe.example.com`). Link hết hạn sau `PASSWORD_RESET_TTL_MINUTES` phút (mặc định 30) và chỉ dùng được 1 lần; mỗi tài khoản nhận tối đa 1 email mỗi 60 giây.
- **Thử trên máy, không cần SMTP thật**: chạy kèm Mailpit (hộp thư giả) rồi xem email ở `http://127.0.0.1:8025`:
  ```bash
  docker compose -f docker-compose.prod.yml -f deploy/docker-compose.mailtest.yml --env-file deploy/.env up -d
  ```
  Không dùng `deploy/docker-compose.mailtest.yml` trên production thật.

---

## 10. Công cụ demo (`DEMO_TOOLS_ENABLED`)

- **Tắt mặc định**: `DEMO_TOOLS_ENABLED=false` trong `deploy/.env` (xem `deploy/prod.env.example`). Khi tắt, mọi endpoint `/api/v1/demo/*` (trừ `GET /api/v1/demo/status`) trả 404.
- **Chỉ bật khi demo/test đồ án**: đổi thành `true` rồi chạy lại `docker compose ... up -d`; demo xong thì tắt lại. Các công cụ này cố ý bỏ qua luật nghiệp vụ (ép trạng thái task, giả lập quá hạn, hết hạn link/lời mời) nên không để bật trên hệ thống dùng thật.
- Khi bật, chỉ chủ dự án hoặc tài khoản `ADMIN` dùng được; mỗi lần dùng được ghi log cảnh báo và nhật ký quản trị (`DEMO_TOOL_USED`).
