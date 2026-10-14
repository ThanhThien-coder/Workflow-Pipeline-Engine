# TEAM DEVELOPMENT & ONBOARDING GUIDE
## HƯỚNG DẪN CÀI ĐẶT MÔI TRƯỜNG & QUY CHUẨN DÀNH CHO THÀNH VIÊN NHÓM
### DỰ ÁN: WORKFLOW-PIPELINE-ENGINE (WPE)

> **Mục tiêu tài liệu**: Đảm bảo 100% thành viên tải đúng công cụ, đúng phiên bản, thiết lập chạy được ngay mà không gặp lỗi xung đột môi trường hay lệch phiên bản Database.

---

## 🧭 LỘ TRÌNH ĐỌC TÀI LIỆU DỰ ÁN DÀNH CHO THÀNH VIÊN MỚI

Khi mới vào dự án hoặc bắt đầu một phân hệ mới, **đừng nhảy vào code ngay**, hãy đọc theo đúng 5 bước:

```text
[BƯỚC 1: TỔNG QUAN]  Đọc GEMINI.md & docs/specs/system-overview.md (Nắm kiến trúc & 5 phân hệ).
       │
       ▼
[BƯỚC 2: CÀI MÁY]    Làm theo file này (TEAM_DEVELOPMENT_GUIDE.md) để bật Docker & chạy Spring Boot.
       │
       ▼
[BƯỚC 3: KIẾN TRÚC]  Đọc docs/specs/backend-architecture.md (Hiểu luồng Entity ➔ Repo ➔ Service ➔ DTO ➔ Controller).
       │
       ▼
[BƯỚC 4: TRA CỨU DB] Đọc docs/specs/database-schema.md (Hiểu cấu trúc 12 bảng 3NF & quan hệ khóa ngoại).
       │
       ▼
[BƯỚC 5: HỢP ĐỒNG]   Mở docs/FRONTEND_BACKEND_INTEGRATION_MAP.md để lấy đúng URL, DTO Request/Response khi code.
```

---

## 💡 CẨM NANG VỠ LÒNG: TÁCH BIỆT FRONTEND - BACKEND, HTTP API & SWAGGER LÀ GÌ?
> *(Dành cho các bạn sinh viên mới chuyển từ mô hình monolithic cũ như JSP / Servlet / PHP sang kiến trúc hiện đại Client-Server)*

Nếu trước đây bạn quen với việc viết code Java rồi render thẳng ra trang HTML (kiểu JSP hay Thymeleaf - bấm nút một cái là tải lại nguyên cả trang web), thì dự án này hoạt động theo **mô hình hiện đại chuẩn doanh nghiệp**:

```text
┌────────────────────────────────┐         HTTP Request (Gửi JSON)         ┌─────────────────────────────────┐
│     FRONTEND (React SPA)       │ ──────────────────────────────────────► │      BACKEND (Spring Boot)      │
│     Chạy tại: localhost:5173   │                                         │      Chạy tại: localhost:8080   │
│ (Chỉ lo giao diện, màu sắc,    │ ◄────────────────────────────────────── │ (Giữ logic nghiệp vụ, tính DAG, │
│  kéo thả Kanban, đồ thị canvas)│         HTTP Response (Trả về JSON)     │  bảo mật & lưu vào PostgreSQL)  │
└────────────────────────────────┘                                         └─────────────────────────────────┘
```

### 1. Tại sao Frontend và Backend lại tách riêng thành 2 cổng khác nhau?
* **Frontend (React - Port 5173)**: Giống như **"nhân viên tiếp tân / mặt tiền cửa hàng"**. Người dùng bấm chuột, gõ phím, kéo thả thẻ Kanban trên màn hình này. Frontend **hoàn toàn không được phép kết nối thẳng vào Database**.
* **Backend (Spring Boot - Port 8080)**: Giống như **"nhà bếp / kho hàng bí mật"**. Backend nắm giữ toàn bộ dữ liệu, thuật toán kiểm tra chu trình đồ thị (Kahn DAG), phân quyền Admin/Owner và lưu trữ vào PostgreSQL (Port 5432).
* **HTTP & JSON**: Là **"ngôn ngữ giao tiếp chung"** giữa hai bên. Khi bạn bấm nút "Tạo Dự Án" trên React, React sẽ đóng gói thông tin thành một chuỗi văn bản dạng JSON (`{"name": "Dự án mới"}`) rồi gửi một bức thư qua mạng (HTTP Request) sang Spring Boot để nhờ lưu lại.

---

### 2. Cấu tạo của một cuộc hội thoại qua mạng (HTTP Anatomy)

Mỗi lần Frontend muốn nhờ Backend làm việc gì, nó sẽ gửi một **HTTP Request**, gồm 4 phần:

1. **Phương thức (HTTP Method - Bạn muốn làm hành động gì?)**:
   * **`GET`** *(Lấy về)*: "Cho tôi xem danh sách dự án" / "Cho tôi xem chi tiết task". Không gửi kèm dữ liệu thay đổi.
   * **`POST`** *(Tạo mới)*: "Tạo cho tôi một task mới" / "Đăng nhập tài khoản" (Có gửi kèm cục dữ liệu JSON).
   * **`PUT`** *(Thay thế toàn bộ)*: "Cập nhật lại toàn bộ thông tin của nút công việc này".
   * **`PATCH`** *(Cập nhật một phần)*: "Chỉ đổi trạng thái của task từ TODO sang IN_PROGRESS".
   * **`DELETE`** *(Xóa bỏ)*: "Xóa task này khỏi hệ thống".

2. **Địa chỉ Endpoint (URL - Gửi tới chỗ nào?)**:
   * Ví dụ: `http://localhost:8080/api/v1/projects` (đường dẫn API định nghĩa trong Controller).

3. **Tiêu đề đính kèm (Headers - Bì thư dán tem gì?)**:
   * `Content-Type: application/json`: Báo cho server biết "Gói hàng tôi gửi là dữ liệu dạng JSON nhé".
   * `Authorization: Bearer eyJhbGci...`: Đây là **Chiếc Vé Vào Cổng VIP (JWT Token)**. Sau khi bạn Login thành công, server cấp cho bạn cái vé này. Mỗi lần gọi API bảo mật, bạn chìa vé này ra ở Header để server biết bạn là ai (Alex Kim hay Sarah Chen) mà không cần phải gõ lại mật khẩu!

4. **Nội dung gói hàng (Request Body)**:
   * Chuỗi JSON chứa dữ liệu, ví dụ:
     ```json
     {
       "title": "Cài đặt Spring Security",
       "assignedUserId": 3,
       "joinPolicy": "ALL_COMPLETED"
     }
     ```

#### Khi nhận được Request, Backend sẽ trả lời bằng HTTP Response:
* **Mã trạng thái (HTTP Status Code)**:
  * **`200 OK` / `201 Created`**: Thành công tốt đẹp! Dữ liệu đã được lưu hoặc lấy ra.
  * **`400 Bad Request`**: Dữ liệu gửi lên bị sai hoặc thiếu (ví dụ: tên dự án để trống).
  * **`401 Unauthorized`**: Chưa đăng nhập hoặc token đã hết hạn (quên chìa vé VIP).
  * **`403 Forbidden`**: Đã đăng nhập nhưng không đủ quyền (ví dụ: nhân viên thường đòi duyệt task của Owner).
  * **`404 Not Found`**: Không tìm thấy dữ liệu (ví dụ: không có project id = 999).
  * **`409 Conflict` / `422 Unprocessable`**: Vi phạm luật nghiệp vụ (ví dụ: phát hiện vòng lặp vô tận trong đồ thị DAG).
  * **`500 Internal Server Error`**: Lỗi code phía Backend (bị crash exception, ví dụ `NullPointerException`). Lỗi này dev BE phải vào sửa ngay!

---

### 3. Swagger UI là cái gì? Tại sao gọi là "Vũ khí tối thượng" của Backend?

Khi bạn viết xong một API (ví dụ: Đăng nhập hoặc Tạo Task):
* Bình thường, nếu bạn Frontend chưa kịp làm màn hình giao diện, bạn sẽ không biết làm sao để bấm thử xem API mình chạy đúng hay sai.
* Người ta thường phải cài phần mềm **Postman**, tự gõ tay URL, tự gõ tay JSON, rồi xuất file JSON gửi qua Zalo cho nhau rất mất thời gian.
* **Swagger UI (OpenAPI 3)** sinh ra để giải quyết triệt để vấn đề này! Thư viện Spring Boot sẽ tự động soi toàn bộ code Java Controller của bạn và **tự vẽ ra một trang web kiểm thử trực quan** tại:
  👉 **[http://localhost:8080/swagger-ui.html](http://localhost:8080/swagger-ui.html)**

#### Hướng dẫn cách dùng Swagger UI từ A đến Z:
1. Mở link [http://localhost:8080/swagger-ui.html](http://localhost:8080/swagger-ui.html) trên trình duyệt.
2. Bạn sẽ thấy danh sách các nhóm API (Health, Auth, Project, Kanban, AI...). Mỗi API có màu sắc rõ ràng:
   * 🟩 **Màu xanh lá cây**: Phương thức `POST` (Tạo mới).
   * 🟦 **Màu xanh dương**: Phương thức `GET` (Xem/Lấy dữ liệu).
   * 🟧 **Màu cam**: Phương thức `PUT` / `PATCH` (Cập nhật).
   * 🟥 **Màu đỏ**: Phương thức `DELETE` (Xóa).
3. **Cách bấm test một API bất kỳ**:
   * Bấm vào tên API đó để mở rộng ra.
   * Bấm nút **Try it out** ở góc phải trên.
   * Bạn sẽ thấy Swagger điền sẵn một cục JSON mẫu chuẩn. Bạn chỉ việc chỉnh sửa số liệu theo ý mình.
   * Bấm nút to đùng **Execute** màu xanh dương phía dưới.
   * Kéo xuống xem mục **Responses**: Bạn sẽ thấy ngay mã phản hồi (`200` hay `400`) và kết quả JSON trả về trong 0.1 giây!
4. **Cách test API có yêu cầu đăng nhập (Ổ khóa 🔒)**:
   * Chạy API Login (`POST /api/v1/auth/login`) để lấy chuỗi `accessToken`.
   * Kéo lên đầu trang Swagger UI, bấm nút **Authorize** màu xanh lá (có hình ổ khóa).
   * Dán chuỗi `accessToken` vào ô Value ➔ Bấm **Authorize** ➔ Bấm **Close**.
   * Từ lúc này, mọi API bạn bấm **Execute** sẽ tự động đính kèm Token VIP vào!

---

### 4. CORS là gì và tại sao lại có file `WebCorsConfig`?
* Khi trình duyệt mở trang web ở `http://localhost:5173` (React), trình duyệt có cơ chế bảo vệ nghiêm ngặt mang tên **Same-Origin Policy**: Cấm trang web ở cổng này tự tiện bắn request âm thầm sang một server ở cổng khác (`localhost:8080`).
* Nếu Backend không cho phép, trình duyệt sẽ chặn đứng và báo lỗi đỏ lòm: `CORS policy: No 'Access-Control-Allow-Origin' header is present`.
* File [WebCorsConfig.java](file:///c:/Users/Admin/Desktop/J2EE/Workflow-Pipeline-Engine/wpe-backend/src/main/java/com/pipeline/wpe/config/WebCorsConfig.java) của chúng ta đóng vai trò là **"tờ giấy cấp phép thông hành"**: Nó bảo với trình duyệt rằng *"Tôi là Spring Boot, tôi chính thức cho phép React ở cổng 5173 được quyền gửi request và nhận dữ liệu từ tôi!"*. Nhờ vậy hệ thống mới chạy trơn tru mà không bị trình duyệt chặn!

---

## PHẦN 1: BẢNG DANH SÁCH CÔNG CỤ BẮT BUỘC PHẢI TẢI (PREREQUISITES)

Trước khi kéo code về chạy, **bắt buộc máy phải cài đủ 4 thứ này**. Nếu thiếu hoặc sai phiên bản, app sẽ không bao giờ chạy được!

| STT | Công cụ | Phiên bản Bắt buộc | Link Tải Trực Tiếp | Tại sao bắt buộc? |
| :-: | :--- | :---: | :--- | :--- |
| **1** | **JDK (Java Development Kit)** | **Java 17** *(hoặc 21)* | [Tải Eclipse Temurin 17 (LTS)](https://adoptium.net/temurin/releases/?version=17) | **Spring Boot 3 bắt buộc tối thiểu Java 17**. Nếu máy xài Java 8 hay 11 sẽ văng lỗi sập app ngay lập tức! |
| **2** | **Docker Desktop** | Mới nhất | [Tải Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/) | Để chạy PostgreSQL ngầm, không cần cài PostgreSQL lên Windows. |
| **3** | **IDE (Môi trường code)** | IntelliJ IDEA *(Khuyên dùng)* | [Tải IntelliJ IDEA Community (Free)](https://www.jetbrains.com/idea/download/) | Hỗ trợ Spring Boot, Maven và Lombok tốt nhất. *(Nếu dùng VS Code phải cài thêm Java Extension Pack).* |
| **4** | **DBeaver** | Mới nhất | [Tải DBeaver Community](https://dbeaver.io/download/) | Công cụ trực quan để soi vào xem dữ liệu bên trong Database. |

---

## PHẦN 2: QUY TRÌNH 4 BƯỚC THIẾT LẬP TỪ A ĐẾN Z

Sau khi đã cài đủ 4 công cụ ở Phần 1, làm đúng 4 bước sau để khởi động dự án:

### Bước 1: Kéo code & Bật Database bằng Docker (Mất 10 giây)
1. Mở phần mềm **Docker Desktop** trên máy tính lên. Chờ góc dưới bên trái hiện icon **màu xanh lá cây (Engine running)**.
2. Mở Terminal tại thư mục `wpe-backend` và gõ lệnh:
   ```bash
   docker compose up -d
   ```
3. Thấy thông báo `Container wpe_postgres_local Started` là Database đã sẵn sàng trên cổng `5432`.

### Bước 2: Mở IDE & Cấu hình Bắt buộc (Tránh lỗi Lombok)
1. Mở thư mục `wpe-backend` bằng **IntelliJ IDEA**.
2. **Cấu hình JDK 17 cho Dự án**:
   * Vào **File** ➔ **Project Structure** ➔ Mục **Project** ➔ Chọn **SDK: 17** (nếu chưa có thì bấm *Add SDK* trỏ vào thư mục Java 17 vừa cài).
3. **Bật tính năng Annotation Processors (CỰC KỲ QUAN TRỌNG)**:
   * Vào **File** ➔ **Settings** (hoặc `Ctrl + Alt + S`).
   * Tìm đến: **Build, Execution, Deployment** ➔ **Compiler** ➔ **Annotation Processors**.
   * Tích chọn vào ô: **☑ Enable annotation processing** ➔ Bấm **OK**.  
   *(Nếu không bật ô này, thư viện Lombok và MapStruct sẽ không hoạt động, code sẽ báo lỗi đỏ không tìm thấy hàm getter/setter).*

### Bước 3: Chạy Ứng dụng Spring Boot
1. Trong IntelliJ, tìm đến file:  
   `src/main/java/com/pipeline/wpe/WpeApplication.java`
2. Bấm nút **Run** (tam giác xanh màu lá).
3. **Flyway tự động chạy**: Khi ứng dụng khởi động, thư viện Flyway sẽ tự kết nối vào Docker, tự động chạy tạo **12 bảng chuẩn 3NF** và nạp sẵn tài khoản test, project mẫu trong **0.2 giây**!
4. Màn hình console hiện dòng:  
   `Started WpeApplication in ... seconds` ➔ **Thành công 100%!**

### Bước 4: Kết nối DBeaver để Xem Database
1. Mở **DBeaver** ➔ Bấm biểu tượng **New Database Connection** (phích cắm có dấu cộng ở góc trái trên) ➔ Chọn **PostgreSQL** ➔ Bấm **Next**.
2. Điền chính xác 5 thông số sau:
   * **Host**: `localhost`
   * **Port**: `5432`
   * **Database**: `wpe_db` *(BẮT BUỘC CHỮ THƯỜNG, CÓ DẤU GẠCH DƯỚI `_`)*
   * **Username**: `wpe_user`
   * **Password**: `wpe_password`
3. Ở tab phụ bên cạnh mang tên **PostgreSQL**, tích chọn: **☑ Show all databases**.
4. Quay lại bấm **Test Connection** ➔ Hiện chữ **Connected** màu xanh lá cây ➔ Bấm **Finish**.
5. Mở cây thư mục bên trái: `wpe_db` ➔ `Schemas` ➔ `public` ➔ **`Tables`**: Bạn sẽ thấy đủ 12 bảng và dữ liệu mẫu có sẵn để xem trực tiếp!

### Bước 5: Bảng Tài khoản Test & Dữ liệu Seed Sẵn có (Không cần tự tạo tài khoản)
Hệ thống đã nạp sẵn 3 tài khoản qua file `V2__seed_initial_data.sql`. Mọi tài khoản đều dùng chung **mật khẩu mặc định**:
> 🔑 **Mật khẩu test mặc định cho tất cả user**: `Password123!`

| STT | Username | Email | Quyền Hệ thống (System Role) | Vai trò trong Project mẫu (#1) | Mục đích dùng test |
| :-: | :--- | :--- | :---: | :---: | :--- |
| **1** | `admin` | `admin@pipeline.engine` | `ADMIN` | — | Test các tính năng quản trị, giám sát hệ thống |
| **2** | `alex.kim` | `alex.kim@pipeline.engine` | `USER` | **`OWNER`** | Test tạo project, duyệt Review task, tính toán DAG |
| **3** | `sarah.chen` | `sarah.chen@pipeline.engine` | `USER` | **`COLLABORATOR`** | Test kéo thả Kanban, nộp task chờ Review, gửi phản hồi |

* **Dự án mẫu có sẵn**: ID = `1`, Tên: `"Core Banking Pipeline"`, gồm 3 Phân kỳ (Phases) và 4 Nút công việc (`WPE-001` đến `WPE-004`) đã nối quan hệ DAG có sẵn để test.

### Bước 6: Test API trực tiếp bằng Swagger UI (Khỏi cần cài Postman!)
Hệ thống đã tích hợp sẵn **Swagger OpenAPI 3**. Khi Spring Boot đang chạy, bạn chỉ cần mở trình duyệt:
* 🌐 **URL Swagger UI**: [http://localhost:8080/swagger-ui.html](http://localhost:8080/swagger-ui.html)
* **Cách test endpoint cần bảo mật**:
  1. Gọi API Login (`/api/v1/auth/login`) với tài khoản ở Bước 5 để lấy `accessToken`.
  2. Bấm nút **Authorize** màu xanh lá cây ở góc trên bên phải Swagger UI.
  3. Dán chuỗi `accessToken` vào (không cần gõ thêm chữ `Bearer`) ➔ Bấm **Authorize**.
  4. Giờ bạn có thể bấm **Try it out** và test bất kỳ API nào trực tiếp trên trình duyệt!

### Bước 7: Khởi động Frontend React (Dành cho Dev FE hoặc muốn xem trực quan)
Nếu muốn bật giao diện web lên trải nghiệm:
1. Mở Terminal mới tại thư mục: `wpe-frontend`
2. Cài đặt thư viện (chỉ làm lần đầu):
   ```bash
   npm install
   ```
3. Chạy giao diện phát triển:
   ```bash
   npm run dev
   ```
4. Mở trình duyệt vào: [http://localhost:5173](http://localhost:5173).  
   *(Mặc định Frontend đang bật Mock Mode `VITE_USE_MOCK=true` để chạy độc lập. Khi BE đã nối xong API, đổi thành `false` trong `.env.local` để ăn dữ liệu thật từ Spring Boot).*

---

## PHẦN 3: NGUYÊN TẮC BẤT DI BẤT DỊCH VỚI DATABASE (FLYWAY)

Để tránh tuyệt đối lỗi *"máy tao chạy được mà máy mày lỗi"* hay *"kéo code về không tìm thấy bảng/cột"*, cả nhóm phải tuân thủ nghiêm ngặt **3 điều răn**:

1. **TUYỆT ĐỐI KHÔNG SỬA BẰNG TAY TRONG DBEAVER**:
   * Không dùng DBeaver chuột phải sửa cột, thêm bảng, đổi kiểu dữ liệu trực tiếp trên giao diện.
2. **CẤM SỬA VÀO FILE V1 VÀ V2 ĐÃ CÓ**:
   * Hai file `V1__init_schema.sql` và `V2__seed_initial_data.sql` một khi đã chạy thì **bất biến (cấm sửa)**. Nếu ai sửa lén, Flyway sẽ phát hiện lệch checksum và chặn đứng không cho chạy app!
3. **KHI CẦN THÊM BẢNG HOẶC ĐỔI CỘT MỚI: TẠO FILE V3, V4...**:
   * Ví dụ: Bạn cần thêm 1 cột `avatar_url` vào bảng `users`.
   * Hãy vào thư mục `src/main/resources/db/migration/` tạo file mới:  
     `V3__add_avatar_url_to_users.sql`
   * Viết đúng câu lệnh:
     ```sql
     ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500);
     ```
   * Commit file đó lên GitHub. Đồng đội pull về chỉ việc bấm **Run Spring Boot**, database của họ sẽ tự động thêm cột đó trong 0.1 giây mà **không mất dữ liệu cũ**!

---

## PHẦN 4: QUY CHUẨN KHI CODE 1 TÍNH NĂNG BACKEND (LAYERED ARCHITECTURE)

Mọi tính năng đều phải tuân thủ kiến trúc phân tầng đã định nghĩa tại [docs/specs/backend-architecture.md](file:///c:/Users/Admin/Desktop/J2EE/Workflow-Pipeline-Engine/docs/specs/backend-architecture.md). 

Khi bạn được giao làm 1 API (ví dụ: Tạo dự án mới), hãy làm tuần tự theo 6 bước:

```text
[1. Đọc Hợp đồng Spec] ➔ [2. Viết DTO Record] ➔ [3. Khai báo Repository]
                                                         │
[6. Test Postman]      ◄─ [5. Viết Controller]   ◄─ [4. Viết Service Logic]
```

### Chi tiết từng bước:
1. **Đọc Hợp đồng (Spec)**: Mở file [docs/FRONTEND_BACKEND_INTEGRATION_MAP.md](file:///c:/Users/Admin/Desktop/J2EE/Workflow-Pipeline-Engine/docs/FRONTEND_BACKEND_INTEGRATION_MAP.md) tìm đúng API của mình (xem URL, method, Request JSON, Response JSON và mã lỗi trả về).
2. **Tạo DTO (dùng Java `record`)**:
   * Trong `dto/request/`: Tạo record nhận dữ liệu từ React (ví dụ: `CreateProjectRequest`).
   * Trong `dto/response/`: Tạo record trả dữ liệu về (ví dụ: `ProjectSummaryResponse`).
3. **Khai báo Repository**:
   * Trong `repository/`: Tạo interface kế thừa `JpaRepository<Entity, Long>`. Không viết code triển khai, Spring Data JPA tự sinh SQL.
4. **Viết Service (Logic nghiệp vụ)**:
   * Trong `service/`: Viết hàm xử lý. Kiểm tra phân quyền, if/else điều kiện.
   * Gắn `@Transactional` trên đầu method để tự động Rollback nếu xảy ra lỗi.
   * Nếu có lỗi: Ném ngoại lệ `throw new ResourceNotFoundException("...")` hoặc `throw new IllegalArgumentException("...")`. Tuyệt đối không tự bắt `try-catch` nuốt lỗi.
5. **Viết Controller**:
   * Trong `controller/`: Mở endpoint `@PostMapping`, `@GetMapping`...
   * Dùng `@Valid` để validate DTO đầu vào.
   * Gọi Service và trả về `ResponseEntity.status(HttpStatus.CREATED).body(result)`.
6. **Kiểm thử bằng Postman**:
   * Tạo collection Postman gọi thử API, kiểm tra xem dữ liệu trong DBeaver có nhảy đúng không.

### ⚠️ 2 Lưu ý Kỹ thuật Bắt buộc:
* **Không dùng `@Data` trên Entity JPA**: Chỉ dùng `@Getter`, `@Setter`, `@NoArgsConstructor`, `@AllArgsConstructor`, `@Builder` để tránh lỗi sập đệ quy vô tận (`StackOverflowError`).
* **Không trả thẳng Entity ra ngoài Controller**: Bắt buộc phải ánh xạ qua DTO (`Record`) để bảo mật mật khẩu và tránh lỗi vòng lặp JSON của Jackson.

---

## PHẦN 5: BẢNG BẮT BỆNH VÀ CÁCH SỬA CÁC LỖI THƯỜNG GẶP (FAQ & TROUBLESHOOTING)

Nếu chạy bị lỗi, hãy tra ngay bảng này trước khi hỏi:

| Hiện tượng lỗi | Nguyên nhân | Cách khắc phục ngay lập tức |
| :--- | :--- | :--- |
| **Gõ `docker compose` báo lỗi:**<br>`docker: command not found` hoặc `cannot connect to Docker daemon` | Chưa mở phần mềm Docker Desktop. | Mở phần mềm Docker Desktop lên, chờ góc dưới bên trái hiện icon xanh lá cây rồi mới gõ lại lệnh. |
| **Gõ `docker compose` báo lỗi:**<br>`Bind for 0.0.0.0:5432 failed: port is already allocated` | Cổng 5432 đã bị một phần mềm PostgreSQL cũ cài trên Windows chiếm dụng trước đó. | Bấm `Windows + R`, gõ `services.msc`, tìm dịch vụ nào có chữ `postgresql`, chuột phải chọn **Stop** (Dừng lại) là xong. |
| **Chạy Spring Boot báo lỗi:**<br>`class file has wrong version 61.0, should be 52.0` | Máy hoặc IDE đang dùng Java 8 hoặc Java 11 cũ để chạy dự án. | Vào Project Structure trong IntelliJ, đổi SDK của Project sang **Java 17**. |
| **Code không thấy hàm `get...()`, `set...()`** | Chưa bật Annotation Processing trong IntelliJ. | Vào **Settings** ➔ **Build, Execution, Deployment** ➔ **Compiler** ➔ **Annotation Processors** ➔ Tích chọn **Enable annotation processing**. |
| **DBeaver báo lỗi:**<br>`FATAL: database "..." does not exist` | Gõ sai tên ô Database (ví dụ gõ nhầm `postgres` hoặc `wpe-db`). | Sửa lại ô Database chính xác từng chữ: **`wpe_db`** (chữ thường, có dấu gạch dưới). |
| **DBeaver đòi tải Driver** | Lần đầu kết nối DBeaver chưa có sẵn driver PostgreSQL. | Cứ bấm nút **Download** màu xanh, DBeaver sẽ tự tải trong 3 giây. |

---

## PHẦN 6: QUY TẮC GIT VÀ PHÂN NHÁNH (TRÁNH XUNG ĐỘT CODE)

Để 8 người làm việc cùng nhau mà không bị đè code (conflict) hoặc làm sập branch chính:

### 1. Quy tắc phân nhánh (Branching Strategy):
* **Tuyệt đối KHÔNG push trực tiếp lên nhánh `main`**.
* Nhánh `main` là nhánh code sạch, luôn chạy được.
* Mỗi khi làm một tính năng hoặc sửa lỗi, hãy tạo một nhánh mới từ `main`:
  ```bash
  # Cập nhật code mới nhất từ remote
  git checkout main
  git pull origin main

  # Tạo nhánh mới cho tính năng của bạn (ví dụ: auth)
  git checkout -b feat/auth-service
  ```
* Quy ước đặt tên nhánh:
  * `feat/<tên-tính-năng>`: Thêm tính năng mới (ví dụ: `feat/kanban-fsm`, `feat/dag-engine`)
  * `fix/<tên-lỗi>`: Sửa lỗi (ví dụ: `fix/null-pointer-user`)
  * `docs/<nội-dung>`: Cập nhật tài liệu (ví dụ: `docs/api-specs`)

### 2. Quy tắc ghi chú Commit (Conventional Commits):
* Viết commit rõ ràng, có tiền tố:
  * `feat: implement login with JWT token`
  * `fix: correct status transition validation for review gate`
  * `docs: update team development guide with test accounts`
  * `refactor: clean up node repository query methods`

---

### 3. 🛡️ Cẩm nang "Giải mã" các File Cấu hình (.gitignore, .env, pom.xml, package.json...) & Quy tắc chống làm rác Repo

Nhiều bạn mới làm quen với Git thường thắc mắc: *"Tại sao trong project có nhiều file lạ như `.gitignore`, `.env`, `pom.xml`, `package.json`? Có xóa hay commit bừa lên được không?"*  
Dưới đây là cẩm nang giải thích tường tận mục đích của từng loại file để cả nhóm cùng nắm rõ:

#### A. File `.gitignore` — "Tấm khiên bảo vệ Repo"
* **Hiểu lầm thường gặp**: Tưởng `.gitignore` là file chứa API key bên trong.
* **Bản chất thực sự**: `.gitignore` là một **"Danh sách cấm"** thông báo cho Git:
  > *"Khi tôi gõ lệnh `git add .` hay đẩy code lên GitHub, hãy **ngó lơ (ignore)** toàn bộ các file/thư mục này, tuyệt đối không đưa chúng lên kho lưu trữ!"*
* **4 Nhóm file BẮT BUỘC phải nằm trong `.gitignore`**:
  1. **Bí mật & API Keys (`.env`, `credentials.json`)**: Chứa mật khẩu Database, Gemini API key, JWT Secret. Nếu lỡ push lên GitHub public, bot của hacker chỉ mất 30 giây để quét ra key và vét sạch tài nguyên hoặc tài khoản thẻ ngân hàng của bạn.
  2. **Thư mục Build & Thư viện tải về (`target/`, `bin/`, `dist/`, `node_modules/`)**: 
     - Đây là thứ **máy tính tự biên dịch ra** từ source code khi chạy `mvn compile` hoặc `npm install`.
     - Chúng cực kỳ nặng (hàng trăm MB đến hàng GB, hàng trăm nghìn file nhỏ). Nếu đẩy lên Git sẽ làm repo phình to khủng khiếp, mạng yếu kéo về rất lâu và liên tục gây xung đột (conflict) không thể merge code.
     - *(Ví dụ bài học: Thư mục `bin/` từng bị Eclipse tự copy nhân đôi toàn bộ dự án làm rác code và lỗi IDE).*
  3. **File cấu hình riêng của IDE & Hệ điều hành (`.vscode/`, `.idea/`, `.settings/`, `.classpath`, `.DS_Store`, `Thumbs.db`)**: 
     - Trong nhóm, có bạn dùng VS Code, có bạn dùng IntelliJ, người dùng Windows, người dùng macOS. Nếu bạn đẩy cấu hình riêng của máy bạn lên, nó sẽ ghi đè và phá hỏng môi trường của đồng đội.
  4. **File Logs & File tạm (`*.log`, `npm-debug.log`)**: File nhật ký thay đổi liên tục từng giây, không ai cần lưu lịch sử chạy ứng dụng của máy cá nhân lên Git.

#### B. Cặp bài trùng: `.env` và `.env.example`
* **`.env` (Không bao giờ commit)**: Chứa thông số cấu hình thật trên máy bạn (mật khẩu Postgres của bạn, secret key của bạn). Luôn nằm trong `.gitignore`.
* **`.env.example` (Bắt buộc commit)**: File mẫu KHÔNG chứa mật khẩu thật, chỉ liệt kê các tên biến môi trường (ví dụ: `DB_PASSWORD=your_password_here`) để đồng đội khi clone dự án về biết đường copy thành `.env` rồi điền thông tin của họ.

#### C. `pom.xml` (Backend Maven) vs `package.json` (Frontend Vite/React)
* **`pom.xml`**: "Bản thiết kế" của Backend. Khai báo phiên bản Java 17, Spring Boot 3.2.4 và các thư viện cần dùng (Lombok, MapStruct, PostgreSQL Driver, JJWT, Flyway...). **Tuyệt đối không tự ý đổi version hay thêm thư viện lạ** nếu chưa thống nhất với cả nhóm.
* **`package.json`**: "Bản thiết kế" của Frontend. Khai báo danh sách thư viện React, Tailwind CSS, Lucide icons, Zustand...
* **`package-lock.json`**: File "đóng băng" chính xác phiên bản băm (hash) của mọi thư viện con để đảm bảo mọi thành viên khi gõ `npm install` đều cài đúng 100% phiên bản giống nhau. **Không được xóa file lock này**.

#### D. `tsconfig.json` (TypeScript Config)
* Quy định luật kiểm tra kiểu dữ liệu nghiêm ngặt của TypeScript phía Frontend, ngăn ngừa lỗi `undefined` hoặc sai kiểu dữ liệu ngay từ lúc gõ code trước khi chạy trên trình duyệt.

> 🌟 **Quy tắc vàng của Lập trình viên chuyên nghiệp**:  
> *"Chỉ commit lên Git những gì con người trực tiếp viết ra (Source Code). Bất cứ thứ gì do máy móc tự sinh ra hoặc là thông tin bí mật cá nhân -> Đều phải đưa vào `.gitignore`!"*

---

## PHẦN 7: CHECKLIST TRƯỚC KHI TẠO PULL REQUEST (PR)

Trước khi gõ lệnh `git push` và mở Pull Request vào `main`, mỗi thành viên phải tự kiểm tra 7 điều:
- [ ] 1. Ứng dụng biên dịch thành công không có lỗi (`mvn test-compile`).
- [ ] 2. Không sửa vào các file `V1`, `V2` cũ của Flyway. Nếu có thay đổi bảng, đã tạo file `V3...` tương ứng.
- [ ] 3. DTO đã dùng Java `record` và có `@Valid` kiểm tra dữ liệu đầu vào.
- [ ] 4. Đã test thành công trên Swagger UI hoặc Postman cả trường hợp thành công (`200/201`) và trường hợp lỗi (`400/404/409/422`).
- [ ] 5. Đã kéo code `main` mới nhất về merge/rebase để giải quyết conflict trước khi tạo PR.
- [ ] 6. Luôn chạy `git status` trước khi push: Đảm bảo KHÔNG commit nhầm file mật khẩu (`.env`), file rác IDE (`.settings/`, `.classpath`, `.vscode/`), hoặc thư mục build (`target/`, `bin/`, `node_modules/`).
- [ ] 7. Không tự ý sửa đổi phiên bản thư viện trong `pom.xml`, `package.json` hoặc xóa `package-lock.json` khi chưa thống nhất với cả nhóm.
