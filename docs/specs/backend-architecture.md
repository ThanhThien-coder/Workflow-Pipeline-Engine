# Backend Architecture & Directory Guide (SSOT — Spring Boot 3 Layered Architecture)

> **Dự án**: Workflow-Pipeline-Engine  
> **Tài liệu**: Hướng dẫn Kiến trúc Phân tầng Backend & Cẩm nang Vận hành Codebase dành cho Thành viên Nhóm  
> **Ngôn ngữ & Framework**: Java 17, Spring Boot 3.2.4, Spring Data JPA (Hibernate 6), Spring Security, PostgreSQL 15+

---

## 1. Mục đích của Tài liệu

Tài liệu này được biên soạn nhằm:
1. **Chuẩn hóa nhận thức kỹ thuật**: Giúp tất cả thành viên trong nhóm (kể cả những bạn chưa từng làm việc với mô hình MVC hoặc Spring Boot) hiểu rõ **tại sao hệ thống lại chia thành các thư mục này** và **giá trị cốt lõi** của từng tầng.
2. **Loại bỏ nhầm lẫn vai trò**: Định nghĩa ranh giới rõ ràng "cái gì được viết ở đâu" để tránh tình trạng viết truy vấn SQL trong Controller, xử lý nghiệp vụ trong Repository hay nhét logic hiển thị vào Entity.
3. **Minh họa vòng đời của 1 Request (Request Lifecycle)**: Giúp lập trình viên hình dung luồng dữ liệu di chuyển từ màn hình React Client vào sâu trong Cơ sở dữ liệu và ngược lại.

---

## 2. Bức tranh Tổng quan: Kiến trúc Phân tầng Độc lập (Layered Architecture)

Thay vì viết tất cả code vào một file dài nghìn dòng, chúng ta áp dụng nguyên tắc **Separation of Concerns (Phân tách Trách nhiệm)**: Mỗi tầng chỉ làm đúng 1 nhiệm vụ duy nhất và giao tiếp với tầng liền kề.

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 FRONTEND REACT 18 (CLIENT)                             │
│                  Gửi HTTP Request (POST /api/nodes/12/status, JSON Body)               │
└─────────────────────────────────────────┬──────────────────────────────────────────────┘
                                          │ (1) Gửi Request JSON qua Internet
                                          ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 1. TẦNG BẢO MẬT (security/)                                                            │
│    - JwtAuthFilter: Chặn lại, kiểm tra Bearer Token, kiểm tra tài khoản có bị khóa ko  │
└─────────────────────────────────────────┬──────────────────────────────────────────────┘
                                          │ (2) Token hợp lệ, chuyển tiếp vào
                                          ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 2. TẦNG GIAO TIẾP NGOÀI (controller/)                                                  │
│    - @RestController: Tiếp nhận URL & Method, validate format đầu vào (@Valid DTO)     │
│    - Tuyệt đối KHÔNG viết logic tính toán ở đây, chỉ điều hướng sang Service           │
└─────────────────────────────────────────┬──────────────────────────────────────────────┘
                                          │ (3) Gọi hàm nghiệp vụ (truyền Request DTO)
                                          ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 3. TẦNG TRÁI TIM LOGIC (service/)                                                      │
│    - Thực thi toàn bộ quy tắc nghiệp vụ: Kiểm tra phân quyền, State Machine,           │
│      kiểm tra điều kiện mở khóa AND/OR, phát hiện chu trình Kahn DAG...                │
│    - Quản lý giao dịch (@Transactional): Lỗi là tự động Rollback, không sót rác        │
└───────────────────────────────────┬────────────────────────────────────────────────────┘
                                    │ (4) Lấy / Lưu dữ liệu qua Interface
                                    ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 4. TẦNG TRUY XUẤT DỮ LIỆU (repository/)                                                │
│    - Kế thừa JpaRepository: Không cần viết câu lệnh SQL thủ công                        │
│    - Spring Data JPA tự động sinh SQL tối ưu bên dưới                                  │
└───────────────────────────────────┬────────────────────────────────────────────────────┘
                                    │ (5) Ánh xạ Entity thành các bảng SQL
                                    ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 5. TẦNG ĐỐI TƯỢNG CƠ SỞ DỮ LIỆU (entity/) ───► POSTGRESQL DATABASE (12 BẢNG 3NF)       │
│    - Java Class ánh xạ 1-1 với bảng trong DB (User, Project, Node, WorkPhase...)       │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Bản đồ & Ý nghĩa Chi tiết của Từng Thư mục trong `wpe-backend`

Toàn bộ mã nguồn Backend được đặt tại package gốc: `com.pipeline.wpe`

```text
src/main/java/com/pipeline/wpe/
├── config/                     # Cấu hình hệ thống (CORS, Beans, Swagger)
├── security/                   # Kiểm soát an ninh, bộ lọc JWT Token
├── common/                     # Enum trạng thái, Hằng số, Base Entity dùng chung
├── exception/                  # Bộ gom lỗi tập trung (@RestControllerAdvice)
├── entity/                     # 12 Entity ánh xạ trực tiếp 12 bảng PostgreSQL
├── repository/                 # Các Interface truy xuất dữ liệu (Spring Data JPA)
├── dto/                        # Hộp đóng gói dữ liệu trao đổi với Frontend
│   ├── request/                # Dữ liệu Frontend gửi lên (Java Record)
│   └── response/               # Dữ liệu Backend trả về cho Frontend (Java Record)
├── mapper/                     # Bộ chuyển đổi tự động giữa Entity và DTO (MapStruct)
├── service/                    # Xử lý toàn bộ logic nghiệp vụ (Business Rules)
│   ├── engine/                 # [ĐẶC THÙ] Thuật toán đồ thị Kahn & Máy trạng thái FSM
│   └── ai/                     # [ĐẶC THÙ] Client kết nối Google Gemini API
└── controller/                 # Tiếp nhận HTTP Request và trả JSON
```

---

### 3.1 Thư mục `entity/` — Lớp Thực thể Dữ liệu
* **Nó là gì?**: Là các Class Java đại diện 1-1 cho các bảng trong PostgreSQL (theo đặc tả 12 bảng chuẩn 3NF tại [database-schema.md](file:///c:/Users/Admin/Desktop/J2EE/Workflow-Pipeline-Engine/docs/specs/database-schema.md)).
* **Tại sao cần có?**: Ngôn ngữ Java thao tác trên **Đối tượng (Object)** trong bộ nhớ, còn CSDL lưu trữ theo **Dòng & Cột (Relational Table)**. Entity là cầu nối để thư viện Hibernate tự động chuyển dòng dữ liệu thành Object Java.
* **Quy tắc vàng khi code**:
  * **TUYỆT ĐỐI KHÔNG DÙNG `@Data`** của Lombok trên Entity (vì `@Data` sinh `toString()` và `hashCode()` gây lỗi đệ quy vô tận `StackOverflowError` khi 2 bảng trỏ vào nhau).
  * **BẮT BUỘC DÙNG**: `@Getter`, `@Setter`, `@NoArgsConstructor`, `@AllArgsConstructor`, `@Builder`.
  * Các trường tọa độ Canvas (`ui_metadata`) hoặc log AI (`latest_ai_analysis`) dùng:
    `@JdbcTypeCode(SqlTypes.JSON) private Map<String, Object> metadata;`
  * Bảng `NodeEntity` có `@Version private Long version;` để kích hoạt khóa lạc quan (Optimistic Locking).

---

### 3.2 Thư mục `repository/` — Tầng Truy xuất CSDL (DAO Tự động)
* **Nó là gì?**: Là tầng DAO (Data Access Object) của mô hình truyền thống, nhưng ở Spring Boot ta **không cần viết code triển khai**.
* **Tại sao không cần viết code?**: Chỉ cần tạo interface kế thừa `JpaRepository<Entity, ID>`:
  ```java
  public interface NodeRepository extends JpaRepository<NodeEntity, Long> {
      // Spring Data JPA tự động sinh câu lệnh SQL ngầm dựa trên tên hàm:
      List<NodeEntity> findByProjectId(Long projectId);
      Optional<NodeEntity> findByProjectIdAndCode(Long projectId, String code);
  }
  ```
* **Giá trị đem lại**: Tiết kiệm hàng nghìn dòng code mở connection, viết chuỗi SQL, duyệt `ResultSet` mệt mỏi và dễ lỗi chính tả.

---

### 3.3 Thư mục `dto/` (`request/` & `response/`) — Đóng gói Dữ liệu Giao tiếp
* **Nó là gì?**: DTO (Data Transfer Object) là các hộp chứa dữ liệu dùng để gửi và nhận qua mạng HTTP.
* **Tại sao không trả trực tiếp `Entity` ra ngoài Frontend?**:
  1. **Bảo mật**: Entity chứa các thông tin nhạy cảm như `password_hash`, `token_version`. Nếu trả thẳng Entity ra ngoài, hacker có thể đọc được mã băm mật khẩu!
  2. **Tránh lỗi đệ quy JSON**: Khi Entity A trỏ sang Entity B và B trỏ ngược lại A, Jackson JSON Serializer sẽ rơi vào vòng lặp vô tận gây sập server.
  3. **Độc lập với CSDL**: CSDL có thể đổi tên cột, nhưng API contract với Frontend React phải giữ nguyên không đổi (tuân thủ [FRONTEND_BACKEND_INTEGRATION_MAP.md](file:///c:/Users/Admin/Desktop/J2EE/Workflow-Pipeline-Engine/docs/FRONTEND_BACKEND_INTEGRATION_MAP.md)).
* **Quy chuẩn**: Sử dụng **Java 17 `record`** để DTO có tính bất biến (Immutable), cú pháp cực kỳ gọn:
  ```java
  public record UpdateTaskStatusRequest(
      @NotBlank(message = "Status is required") String status,
      String rejectReason,
      @NotNull Long version
  ) {}
  ```

---

### 3.4 Thư mục `mapper/` — Chuyển đổi Tự động giữa Entity & DTO
* **Nó là gì?**: Sử dụng thư viện **MapStruct** để tự động copy dữ liệu từ `Entity` sang `DTO` và ngược lại.
* **Tại sao cần có?**: Thay vì phải viết thủ công 20 dòng:
  `dto.setTitle(entity.getTitle()); dto.setStatus(entity.getStatus());...`
  MapStruct sẽ tự động sinh code lúc biên dịch (compile-time) với hiệu năng tương đương code tay mà không tốn công sức lập trình viên.

---

### 3.5 Thư mục `service/` — Trái tim Xử lý Nghiệp vụ
* **Nó là gì?**: Nơi chứa toàn bộ trí thông minh và logic tính toán của dự án.
* **Nhiệm vụ cụ thể**:
  * Kiểm tra xem người đang thao tác có quyền không? (Ví dụ: Chỉ `OWNER` mới có quyền duyệt task `REVIEW` sang `DONE`).
  * Kiểm tra hợp lệ dữ liệu: Nếu từ chối bài (`REVIEW` ➔ `IN_PROGRESS`) thì bắt buộc phải có nội dung `reject_reason`.
  * Quản lý giao dịch bằng `@Transactional`: Đảm bảo tính toàn vẹn, nếu có bất kỳ bước nào lỗi thì CSDL tự động rollback về ban đầu.
* **Thư mục con đặc thù**:
  * `service/engine/DagEngineService.java`: Chứa thuật toán **Kahn DAG** (duyệt bậc vào In-Degree để phát hiện chu trình lặp).
  * `service/engine/StateMachineService.java`: Quản lý 5 trạng thái của Task (`LOCKED`, `TODO`, `IN_PROGRESS`, `REVIEW`, `DONE`) và tự động mở khóa các downstream tasks theo chính sách AND-join / OR-join.
  * `service/ai/GeminiAiService.java`: Quản lý kết nối Google Gemini API để phân tích điểm nghẽn và tính toán đường găng CPM.

---

### 3.6 Thư mục `controller/` — Cổng Tiếp nhận Request từ Frontend
* **Nó là gì?**: Là điểm chạm đầu tiên tiếp nhận các HTTP Request (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`) từ React Client.
* **Quy tắc vàng khi viết Controller**:
  * **Controller chỉ được làm 3 việc**:
    1. Tiếp nhận Request & Validate format bằng `@Valid`.
    2. Chuyển DTO cho tầng Service xử lý: `var result = nodeService.updateStatus(id, request);`
    3. Trả về kết quả cho Frontend kèm đúng mã HTTP Status Code (`200 OK`, `201 Created`, v.v.).
  * **TUYỆT ĐỐI KHÔNG VIẾT LOGIC TÍNH TOÁN HAY TRUY VẤN DATABASE TRỰC TIẾP TRONG CONTROLLER!**

---

### 3.7 Thư mục `exception/` — Bắt Lỗi Tập trung Toàn Cục
* **Nó là gì?**: Sử dụng cơ chế `@RestControllerAdvice` (`GlobalExceptionHandler`).
* **Tại sao cần có?**:
  * Trong cách làm cũ: Mỗi Controller hoặc Service đều phải bọc trong khối `try-catch` lộn xộn.
  * Trong Spring Boot: Tầng Service nếu gặp lỗi chỉ cần quăng Exception (ví dụ: `throw new ResourceNotFoundException("Task not found");`). Lỗi này sẽ bay thẳng về `GlobalExceptionHandler`.
  * Tại đây, hệ thống tự động định dạng lỗi theo chuẩn RFC-7807 (JSON có timestamp, status, error code, message) và gửi trả về Frontend một cách nhất quán 100%.

---

### 3.8 Thư mục `security/` & `config/` — Bảo vệ và Cấu hình Hệ thống
* **`security/`**:
  * Chứa bộ lọc `JwtAuthFilter`. Mỗi khi React gửi request kèm `Authorization: Bearer <token>`, filter này sẽ bóc tách token, kiểm tra hạn dùng, kiểm tra `token_version` (để hỗ trợ tính năng đăng xuất tức thì trên mọi thiết bị khi đổi mật khẩu).
* **`config/`**:
  * Thay thế file `web.xml` ngày xưa bằng code Java thuần (`@Configuration`).
  * Ví dụ: Mở CORS để máy chủ Frontend `localhost:5173` gọi được sang Backend `localhost:8080`.

---

## 4. Minh họa Vòng đời của 1 Request Thực tế (Walkthrough Example)

Hãy xem chuyện gì xảy ra khi một Thành viên bấm nút **"Nộp bài nghiệm thu"** trên bảng Kanban:

```text
[Frontend React: Bấm Nộp bài kèm link Figma]
    │
    │  (1) Gửi POST /api/nodes/15/submit kèm JSON: { "artifact": { "url": "figma.com/..." }, "version": 1 }
    ▼
[JwtAuthFilter]
    │  - Bóc JWT Token từ Header: Xác nhận đây là user ID = 2 (Sarah).
    │  - Token hợp lệ -> Cho phép đi tiếp vào Controller.
    ▼
[NodeController]
    │  - Bắt đúng URL POST /api/nodes/15/submit.
    │  - Gọi nodeService.submitTask(15L, request, currentUser).
    ▼
[NodeService (Business Logic Core)]
    │  - Bước 1: Gọi nodeRepository.findById(15) -> Lấy NodeEntity từ DB.
    │  - Bước 2: Thẩm định quyền: Có đúng user ID = 2 phụ trách task này không? (Hợp lệ).
    │  - Bước 3: Thẩm định FSM: Trạng thái hiện tại có phải IN_PROGRESS không? (Hợp lệ).
    │  - Bước 4: Kiểm tra Khóa lạc quan: request.version() có khớp node.getVersion() không? (Hợp lệ).
    │  - Bước 5: Đổi trạng thái: node.setStatus("REVIEW"), node.setRejectReason(null).
    │  - Bước 6: Gọi artifactRepository.save(...) để lưu link Figma.
    │  - Bước 7: Gọi notificationRepository.save(...) để đẩy thông báo cho Project Owner.
    ▼
[NodeRepository & PostgreSQL]
    │  - Tự động sinh câu lệnh UPDATE nodes SET status = 'REVIEW', version = 2 WHERE id = 15.
    │  - Tự động sinh câu lệnh INSERT INTO artifacts ...
    ▼
[NodeMapper]
    │  - Chuyển NodeEntity vừa cập nhật thành KanbanTaskResponse DTO.
    ▼
[NodeController]
    │  - Trả về HTTP 200 OK kèm JSON KanbanTaskResponse cho React Client.
    ▼
[Frontend React: Card tự động nhảy từ cột "In Progress" sang cột "In Review", hiện Toast xanh!]
```

---

## 5. Bảng Tóm tắt Trách nhiệm cho Thành viên Nhóm

| Thư mục | Được phép làm gì? | Tuyệt đối KHÔNG được làm gì? |
| :--- | :--- | :--- |
| **`entity/`** | Khai báo trường, quan hệ khóa ngoại, annotation JPA. | Không viết logic tính toán, không dùng `@Data`. |
| **`repository/`** | Khai báo method query của Spring Data JPA. | Không tự mở Connection SQL, không viết code xử lý if/else. |
| **`dto/`** | Định nghĩa cấu trúc JSON vào/ra bằng Java `record`. | Không chứa logic CSDL, không phụ thuộc vào Entity JPA. |
| **`service/`** | Viết if/else logic nghiệp vụ, tính toán DAG, `@Transactional`. | Không nhận trực tiếp `HttpServletRequest`, không trả mã HTTP. |
| **`controller/`**| Bắt URL, `@Valid` DTO, gọi Service, trả `ResponseEntity`. | Không viết câu query SQL, không tính toán logic nghiệp vụ phức tạp. |
| **`exception/`** | Bắt ngoại lệ và format JSON trả về cho Client. | Không chứa logic can thiệp CSDL. |

---

> [!TIP]
> **Lời khuyên cho các thành viên mới**:
> Khi được giao làm 1 tính năng mới (ví dụ: Tạo dự án mới):
> 1. Vào **`entity/`** xem bảng tương ứng (`ProjectEntity`).
> 2. Vào **`dto/`** tạo Request DTO và Response DTO theo đặc tả [FRONTEND_BACKEND_INTEGRATION_MAP.md](file:///c:/Users/Admin/Desktop/J2EE/Workflow-Pipeline-Engine/docs/FRONTEND_BACKEND_INTEGRATION_MAP.md).
> 3. Vào **`repository/`** khai báo hàm tìm kiếm nếu cần (`ProjectRepository`).
> 4. Vào **`service/`** viết hàm xử lý nghiệp vụ (`ProjectService`).
> 5. Vào **`controller/`** mở endpoint `@PostMapping` nhận request (`ProjectController`).
> 6. Mở Postman test luồng và kiểm tra dữ liệu trong DBeaver/pgAdmin!
