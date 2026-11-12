# Ôn tập mảng D — Dự án, Thành viên, Template, Khách & AI

> Tài liệu học 1 lần cho người làm vai D, viết ngày 12/11/2026, trước hạn nộp 15/11.
> Đọc theo thứ tự từ trên xuống. Mỗi phần gồm: **làm gì**, **vì sao**, **file chính**, **trước/sau khi sửa**, **câu hỏi bảo vệ + đáp án ngắn**.
> Mẹo học: đọc phần "Vì sao" xong thì gập tài liệu lại, tự trả lời câu hỏi bảo vệ thành tiếng, rồi mới xem đáp án.

---

## 0. Bức tranh chung (10 phút)

**WPE (Workflow Pipeline Engine)** quản lý dự án dạng **đồ thị công việc (DAG)**: task cha xong thì task con mới mở.

| Thành phần | Công nghệ | Vai trò |
| :--- | :--- | :--- |
| Frontend | React + Vite + TypeScript + Zustand | Giao diện. `container.ts` chọn bản Mock hoặc Http (`VITE_USE_MOCK`) |
| Backend | Spring Boot (Java 17) | API REST `/api/v1/...`, kiểm quyền, máy trạng thái |
| CSDL | PostgreSQL + **Flyway** (đang ở V11) | Lưu dữ liệu, đổi cấu trúc theo phiên bản |
| Hàng đợi | RabbitMQ | Gửi sự kiện bất đồng bộ (task xong → mở task con, thông báo, lời mời) |
| Đẩy realtime | **SSE** | Server đẩy sự kiện xuống trình duyệt, không cần F5 |
| AI | Microservice Python (repo riêng) | Java gọi qua HTTP khi `AI_MODE=http`, mặc định dùng dữ liệu giả |
| CI | GitHub Actions | Chạy test backend + frontend mỗi PR |

**Vòng đời một dự án:** tạo/clone → **DRAFT** (D1, D3) → mời người, phân vai (D2) → vẽ quy trình, **xuất bản** → **ACTIVE** (B) → làm task, nộp, duyệt (C) → khách/giáo viên xem và góp ý qua link (D5) → AI chẩn đoán (microservice).

**Mảng D làm:** dự án (D1), thành viên & lời mời (D2), template (D3 backend, D4 giao diện), khách & góp ý (D5), sơ đồ OOAD (D7, D8), use case tổng quát (X3). Thêm theo quyết định nhóm: vai trò **Quản lý (MANAGER)**, **lịch sử thành viên**, **lời mời quá hạn tự đóng**, **template riêng của user**, **cổng nối AI**.

---

## 1. Ba khái niệm hay bị hỏi

### Flyway
Mỗi thay đổi cấu trúc DB là 1 file `V<số>__mo_ta.sql`. Backend khởi động thì Flyway xem DB đang ở bản nào (bảng `flyway_schema_history`) rồi chạy các file mới hơn theo thứ tự. **Quy tắc:** không sửa file đã chạy (muốn đổi thì viết file mới), không trùng số. Mảng D đã dùng **V8** (unique lời mời), **V10** (lịch sử thành viên), **V11** (phạm vi template).

### SSE (Server-Sent Events)
Trình duyệt mở 1 kết nối HTTP và giữ nguyên; server **đẩy** sự kiện xuống (ví dụ `TASK_UNLOCKED`, `NOTIFICATION_RECEIVED`). Một chiều server → client, đơn giản hơn WebSocket, đủ cho thông báo. C2 làm nhiều tab cùng nhận được và có heartbeat `PING` để giữ kết nối.

### JWT và refresh token
| | Access token (JWT) | Refresh token |
| :--- | :--- | :--- |
| Dùng để | Gửi kèm **mọi** request (`Authorization: Bearer …`) | **Chỉ** để xin access token mới (`/auth/refresh`) |
| Sống | **15 phút** | **7 ngày** |
| Server kiểm | Chữ ký, **không tra DB** → nhanh | **Tra DB** (chỉ lưu mã băm SHA-256) |
| Thu hồi | Không được (chờ hết hạn) | **Được** (đăng xuất, khóa tài khoản) |
Cần cả hai: token ngắn để an toàn, token dài để không phải đăng nhập lại liên tục. Mỗi lần refresh, refresh token cũ bị thay (xoay vòng) → ai dùng lại token cũ là lộ.

---

## 2. D1 — Workspace, tạo dự án (PR #14, giao diện #45)

**Làm gì**
1. **Vá lỗ hổng IDOR khi clone:** trước đây `TemplateCloneService` không thấy template trùng id thì **clone luôn dự án có id đó** mà không kiểm quyền → ai cũng copy được đồ thị dự án người khác bằng cách đoán id. Giờ chỉ clone từ bảng `pipeline_template`, không thấy thì 404.
2. Dự án mới và dự án clone ở trạng thái **DRAFT** (trước là PLANNING).
3. `GET /projects?tab=all|mine|shared|archived&sort=ts|done|nodes`; đếm node bằng **1 truy vấn `GROUP BY`** (`NodeRepository.countByProjectIdsGroupByStatus`) thay vì 3 truy vấn cho mỗi dự án.
4. `PATCH /projects/{id}/status` chỉ cho các cặp hợp lệ (`ALLOWED_TRANSITIONS` trong `ProjectService`): ACTIVE↔PAUSED, ACTIVE/PAUSED/INACTIVE→ARCHIVED, ARCHIVED→ACTIVE, ACTIVE→COMPLETED. DRAFT→ACTIVE trả **409 `USE_PUBLISH`**; cặp khác trả 409 `INVALID_PROJECT_STATUS`.
5. Giao diện (#45): workspace tải song song `tab=all` và `tab=archived` (vì backend `all` không gồm dự án lưu trữ), lưu trữ/khôi phục gọi API thật.

**Bằng chứng:** test IDOR chạy với code cũ thì **đỏ**, code mới thì xanh; chạy thật: sarah clone dự án riêng của alex → 404.

**Câu hỏi bảo vệ**
1. *IDOR là gì, phòng thế nào, ví dụ khác?* — **I**nsecure **D**irect **O**bject **R**eference: dùng id từ người dùng để truy cập đối tượng mà **không kiểm người đó có quyền với đối tượng đó**. Phòng: mọi API nhận id phải kiểm quyền ở **service** (ví dụ `verifyProjectMemberOrOwner`). Ví dụ khác: `PATCH /projects/1/feedbacks/{feedbackId}/resolve` với `feedbackId` của dự án khác — code chặn bằng cách so `feedback.projectId == projectId`.
2. *Vì sao DRAFT → ACTIVE phải qua xuất bản?* — Xuất bản (B4) chạy **thuật toán Kahn** kiểm đồ thị không có chu trình, rồi mở khóa các task gốc (LOCKED→TODO). Cho đổi thẳng sang ACTIVE thì có thể chạy một đồ thị bị vòng lặp, task không bao giờ mở được.
3. *GROUP BY trong SQL khác đếm trong Java?* — `GROUP BY` để DB đếm và chỉ trả mỗi (dự án, trạng thái) 1 dòng; đếm trong Java phải tải **mọi node** về rồi đếm, tốn bộ nhớ và mạng, và nếu đếm theo từng dự án thì thành **N+1 truy vấn**.

---

## 3. D2 — Thành viên và lời mời (PR #18, giao diện #45)

**Lỗi tái hiện được trước khi sửa (cả 2 đều trả 500):**
- Từ chối lời mời **lần 2** → vi phạm unique `(project_id, invitee_id, status)` vì đã có 1 bản ghi REJECTED.
- Người **từng bị xóa** chấp nhận lời mời mới → chèn trùng `uq_project_member`.

**Làm gì**
1. **V8:** bỏ unique cũ, thay bằng **partial unique index** `(project_id, invitee_id) WHERE status = 'PENDING'`.
2. **Chỉ OWNER** gửi lời mời; không mời với vai trò OWNER.
3. API thành viên `ProjectMemberController`: xem danh sách; **đổi vai trò** (đổi sang OWNER = **chuyển quyền sở hữu**, đổi `project.owner_id` trong **1 transaction**, owner cũ thành Cộng sự); **xóa mềm** (`removed_at`), gỡ người đó khỏi các task chưa DONE, trả `unassignedTaskCount`.
4. Giao diện (#45): chọn "Chuyển quyền sở hữu" có xác nhận, khối "Lịch sử thành viên".

**Câu hỏi bảo vệ**
1. *Partial index là gì, vì sao sửa được lỗi từ chối 2 lần?* — Index chỉ áp lên **một phần** bảng thỏa điều kiện `WHERE`. Unique chỉ còn kiểm các dòng PENDING, nên có bao nhiêu dòng REJECTED/ACCEPTED/EXPIRED cũng được, nhưng vẫn **không thể có 2 lời mời đang chờ** cho cùng người.
2. *Vì sao chuyển quyền thay vì nhiều OWNER?* — Giữ **1 người chịu trách nhiệm cuối** (xóa dự án, chuyển quyền, link khách); và code của cả 4 mảng đang kiểm `project.getOwnerId()` ở **26 chỗ** — chuyển quyền giữ nguyên mọi chỗ đó đúng. Để owner đỡ việc thì nhóm thêm vai trò **Quản lý** (mục 6).
3. *Accept đúng lúc owner Revoke?* — Lời mời có cột `@Version` (optimistic lock). Hai transaction đọc cùng version; bên commit trước thắng, bên sau ghi thì version đã đổi → `OptimisticLockingFailureException` → **409 `OPTIMISTIC_LOCK_CONFLICT`**. Nếu không trùng lúc mà Revoke đã xong trước thì Accept nhận 409 `INVITATION_NOT_PENDING`.

---

## 4. D3 — Template backend (PR #17)

**Làm gì:** chỉ **ADMIN** được tạo/sửa/xóa template (kiểm `system_role` trong **service**, không phải controller); bỏ `orElse(1L)` (không đăng nhập thì không tạo được, và template không bị ghi là admin tạo); **không xóa được template hệ thống** (409 `SYSTEM_TEMPLATE_LOCKED`); test khứ hồi template → clone đếm đúng phase/node/cạnh.

**Còn hở (để X1):** tham số `?currentUserId=` vẫn cho mạo danh admin.

**Câu hỏi bảo vệ**
1. *JSONB khác bảng chuẩn hóa ở đâu, vì sao chọn JSONB?* — Template là **một tài liệu đọc/ghi nguyên khối** (đồ thị phase + node + cạnh), hiếm khi truy vấn từng phần, định dạng còn thay đổi → JSONB gọn, linh hoạt. Đổi lại DB không tự kiểm khóa ngoại bên trong JSON, nên phải kiểm bằng code (Kahn). Khi clone, JSON được **bung ra bảng chuẩn hóa** (`work_phase`, `node`, `node_dependency`) để chạy thật.
2. *FE đã kiểm chu trình, sao BE vẫn kiểm?* — FE có thể bị **bỏ qua** (gọi API bằng curl, Postman), có thể có lỗi, có thể có client khác. **Không bao giờ tin dữ liệu từ client**; BE là chốt chặn cuối.
3. *`schemaVersion` để làm gì?* — Đánh số định dạng `graph_data`. Sau này đổi định dạng thì đọc `schemaVersion` để **chuyển dữ liệu cũ sang mới** (viết hàm nâng cấp hoặc migration), không làm hỏng template cũ.

---

## 5. D4 — Template giao diện (PR #44)

**Làm gì:** `HttpTemplateService` gọi qua `apiRequest` của A2 → lỗi thành `ApiError` có `status`, `code`, `cycleNodes`. Studio khi lưu: vẫn **kiểm chu trình trên máy trước**; backend trả **422** → tô đỏ node trong `cycleNodes`; **403** → "Chỉ quản trị viên được chỉnh sửa template"; **mất mạng** → giữ Studio và bản nháp.

**Câu hỏi bảo vệ**
1. *Vì sao Http phải giữ đúng interface `ITemplateService` như bản mock?* — Component chỉ biết interface; đổi Mock ↔ Http mà component không phải sửa. Bản Http thay được bản Mock ở mọi chỗ (nguyên tắc **Liskov**).
2. *Nguyên tắc SOLID nào, chỉ vào code?* — **Dependency Inversion**: component phụ thuộc **trừu tượng** `ITemplateService`; `FE/services/container.ts` chọn cài đặt cụ thể: `isMock ? new MockTemplateService() : new HttpTemplateService()`.
3. *Lưu lỗi giữa chừng có mất form không?* — Không: khi lỗi, `save` ném lỗi, `TemplateStudioView` **không gọi `onClose`**, bản nháp vẫn nằm trong state; mất mạng thì báo "thử lưu lại".

---

## 6. Vai trò Quản lý — MANAGER (PR #33, #41, #48)

**Quyết định nhóm:** vẫn **1 owner**, owner ủy quyền việc lặp lại cho manager.
| Việc | Owner | Manager | Cộng sự | Người xem |
| :--- | :---: | :---: | :---: | :---: |
| Duyệt / trả lại task | ✅ | ✅ | | |
| Đổi người làm, hạn chót | ✅ | ✅ | | |
| Đánh dấu góp ý đã xử lý | ✅ | ✅ | | |
| Xem góp ý | ✅ | ✅ | ✅ | ✅ |
| Mời, đổi vai, xóa thành viên, chuyển quyền, link khách, sửa đồ thị, force-unlock | ✅ | | | |

**Code:** `ProjectRole.MANAGER` (cột role là VARCHAR nên **không cần migration**); `ProjectAuthorizationService.isOwnerOrManager`, `verifyProjectOwnerOrManager`; `StateMachineService` đổi điều kiện duyệt thành "owner hoặc manager"; endpoint riêng **`PATCH /nodes/{id}/assignment`** (`NodeAssignmentService`) chỉ đổi người làm + hạn chót, để manager **không sửa được thiết kế đồ thị**. Giao diện: luật `evaluateTransition` (#41), nút duyệt và khối "Phân công" trong modal task (#48).

**Có thể bị hỏi:** *Sao không cho manager dùng luôn `PUT /nodes/{id}`?* — Endpoint đó sửa cả tên, phase, mô tả (thiết kế quy trình, việc của owner); tách endpoint giữ đúng nguyên tắc **quyền tối thiểu**.

---

## 7. Lịch sử thành viên và lời mời quá hạn (PR #34)

**Lịch sử thành viên (V10):** bỏ unique `(project_id, user_id)`, thay bằng unique **chỉ cho dòng còn hiệu lực** (`WHERE removed_at IS NULL`). Mỗi lần vào dự án là **1 dòng mới**; bị xóa thì dòng đó giữ `removed_at`. `GET /projects/{id}/members/history`. **Không lưu** lịch sử đổi vai trong 1 lần ở dự án (cần bảng nhật ký nếu muốn).

**Lời mời quá hạn:**
- `InvitationExpiryJob` (`@Scheduled`, mỗi **1 giờ**) chạy 1 câu `UPDATE` chuyển PENDING quá `expires_at` sang EXPIRED.
- **Sửa lỗi cũ:** trước đây chấp nhận lời mời quá hạn thì code đặt EXPIRED rồi ném exception **trong cùng transaction** → **rollback**, lời mời vẫn PENDING. Giờ dùng `@Transactional(noRollbackFor = ConflictException.class)` → lưu được EXPIRED, trả **409 `INVITATION_EXPIRED`**.
- Gửi lời mời mới khi lời mời PENDING cũ đã quá hạn (job chưa chạy) → đóng lời mời cũ (`saveAndFlush`) rồi tạo mới.
- Giao diện tô xám lời mời quá hạn, khóa nút.

**Có thể bị hỏi:**
- *Job chạy mỗi giờ có tốn tài nguyên?* — Không: 1 luồng ngủ chờ, mỗi giờ chạy 1 câu SQL vài mili giây.
- *Vì sao phải `saveAndFlush`?* — Hibernate chèn bản ghi mới **trước** khi cập nhật bản ghi cũ; không flush thì lời mời mới đụng partial unique (vẫn thấy lời mời cũ đang PENDING).
- *Vì sao EXPIRED mà không phải REJECTED?* — REJECTED là người được mời **chủ động** từ chối; EXPIRED là **không ai trả lời** — owner cần phân biệt để biết có nên mời lại.

---

## 8. Template riêng của user (PR #36)

**Làm gì (V11):** cột `visibility` (PUBLIC/PRIVATE, mặc định PUBLIC) và `source_project_id`. Owner dự án bấm **"Lưu thành template"** → `POST /projects/{id}/save-as-template` chép phase, cạnh phase (cả bảng `phase_dependency`), node, cạnh node thành `graph_data` — **không chép** trạng thái, người làm, hạn chót. Template PRIVATE **chỉ người tạo** thấy/clone/xóa; người khác nhận **404**. Sửa thêm: clone dựng lại **mọi** cạnh phase (trước chỉ cạnh đầu tiên).

**Có thể bị hỏi:** *Vì sao trả 404 chứ không phải 403 cho template riêng của người khác?* — 403 nghĩa là "có, nhưng bạn không được xem" → **lộ là template tồn tại**; 404 không tiết lộ gì.

---

## 9. D5 — Cổng khách và góp ý (PR #16, giao diện #47)

**Làm gì:** token khách hợp lệ khi **đủ 4 điều kiện**: tồn tại, chưa thu hồi, chưa hết hạn, **dự án đang ACTIVE** (thiếu → 403 `REVOKED_GUEST`). Chỉ **owner** tạo/thu hồi/xem link. Tối đa **10 góp ý/giờ** (429 `COOLDOWN_ACTIVE` + `retryAfterSeconds`), nội dung ≤ 2000 ký tự. Giao diện (#47): Overview lấy góp ý và link thật, trang khách báo lỗi 403/429 rõ ràng.

**Câu hỏi bảo vệ**
1. *Token 64 ký tự hex bao nhiêu bit, vì sao đủ an toàn?* — Mỗi ký tự hex = 4 bit → **256 bit** (sinh từ 32 byte `SecureRandom`). Đoán trúng cần ~2²⁵⁵ lần thử — không thể brute-force.
2. *Khách không đăng nhập mà vẫn an toàn nhờ gì?* — Token không đoán được; có hạn dùng; owner thu hồi được; chỉ khi dự án ACTIVE; chỉ **đọc** và chỉ thấy tài nguyên công khai (`is_public_for_guest`); góp ý **một chiều**; giới hạn 10/giờ và độ dài.
3. *Rate limit theo token khác theo IP?* — Theo token: kẻ có token đổi IP liên tục vẫn bị chặn; nhưng nhiều giáo viên **dùng chung 1 link** thì chặn chung cả nhóm. Theo IP: kẻ tấn công đổi IP/proxy là lọt; nhiều người sau cùng 1 mạng (NAT trường học) bị chặn oan.

---

## 10. AI (PR #29 hoàn tác, #30 cổng nối)

AI là **microservice Python riêng** (thầy yêu cầu microservice), do bạn khác làm. Mình đã lỡ làm CPM trong Java (#21) rồi **hoàn tác** (#29). Phía Java chỉ còn **cổng nối**:
- `AI_MODE=mock` (mặc định): `AiServiceClientImpl` trả dữ liệu giả.
- `AI_MODE=http`: `HttpAiServiceClient` gửi `POST {AI_SERVICE_URL}/api/ai/diagnose` kèm task, cạnh, góp ý; lỗi/quá giờ thì quay về dữ liệu giả (`source: MOCK_FALLBACK`).
- Hợp đồng: `docs/specs/ai-service-contract.md`.

**Có thể bị hỏi:** *Mẫu thiết kế nào?* — **Strategy**: `AiDiagnosticService` chỉ phụ thuộc interface `AiServiceClient`; 2 cài đặt hoán đổi bằng cấu hình (`@ConditionalOnProperty`). Đây cũng là **Dependency Inversion**.

---

## 11. D7, D8 — Sơ đồ OOAD (PR #19, #20, cập nhật #43)

Thư mục `docs/ooad/D-du-an/`. **Bạn tự xuất PNG**: mở `.puml` bằng extension PlantUML (VS Code), "Export Current Diagram" → `docs/ooad/png/D-<tên>.png`.

| Sơ đồ | File |
| :--- | :--- |
| Use case (2 sơ đồ) | `uc-du-an.puml` |
| Đặc tả UC8, UC22, UC21 | `dac-ta-uc.md` |
| Activity mời thành viên | `activity-moi-thanh-vien.puml` |
| BCE | `bce-du-an.puml` |
| Sequence (3) | `seq-moi-thanh-vien.puml`, `seq-gop-y-khach.puml`, `seq-chan-doan-ai.puml` |
| Communication | `comm-moi-thanh-vien.puml` |
| Class thiết kế | `class-du-an.puml` |
| State lời mời, góp ý | `state-loi-moi.puml` |
| Ma trận nhất quán | `nhat-quan.md` |
| Use case tổng quát (X3) | `docs/ooad/he-thong/uc-tong-quat.puml` |

**Ký hiệu cần thuộc**
- **include** (`A ..> B : <<include>>`): A **luôn** gọi B. Mũi tên từ UC gốc → UC được include. Ví dụ: Quản lý template → Kiểm tra chu trình.
- **extend** (`A ..> B : <<extend>>`): A **có thể** thêm vào B **khi có điều kiện**. Mũi tên từ UC mở rộng → UC gốc. Ví dụ: Tạo dự án từ template → Tạo dự án `[người dùng chọn template]`; Chuyển quyền sở hữu → Đổi vai trò `[vai trò mới là OWNER]`.
- **Tổng quát hóa** (tam giác rỗng, con → cha): Chấp nhận / Từ chối lời mời → Phản hồi lời mời; Chủ dự án, Quản lý, Cộng sự… → Thành viên dự án.
- Sequence: lời gọi **đồng bộ** mũi tên đặc + message trả về nét đứt; RabbitMQ là **bất đồng bộ** (mũi tên hở). `alt` phải ghi điều kiện.
- **Realization** (nét đứt + tam giác rỗng): lớp cài đặt interface (`HttpAiServiceClient ..|> AiServiceClient`). **Generalization** (nét liền + tam giác rỗng): kế thừa lớp.

**Câu hỏi bảo vệ D7**
1. *Include/extend nào, điều kiện extend?* — xem 3 ví dụ ở trên.
2. *Lời mời hết hạn trong lúc đang mở popup?* — Bấm Chấp nhận → Hệ thống kiểm `expiresAt` → quá hạn → **lưu EXPIRED** → báo **409 `INVITATION_EXPIRED`** → popup tô xám. Nếu job đã chạy trước đó thì lời mời đã EXPIRED → 409 `INVITATION_NOT_PENDING`.
3. *"Khách gửi góp ý" đi qua lớp nào trong BCE?* — Khách → **Trang khách** (boundary) → **Cổng khách** (control, kiểm token) → **Điều khiển góp ý** (control, kiểm giới hạn) → entity **Link khách**, **Dự án**, **Góp ý** (và Node nếu góp ý gắn task).

**Câu hỏi bảo vệ D8**
1. *Vẽ lại sequence "Mời thành viên → chấp nhận" trong 10 phút* — luyện bằng cách che file `seq-moi-thanh-vien.puml` rồi vẽ: Chủ dự án → `ProjectInvitationController.createInvitation` → `ProjectInvitationService.sendInvitation` (kiểm owner → tìm người → kiểm đã là thành viên → kiểm lời mời PENDING → `save`) → `NotificationRepository.save` → `WorkflowEventPublisher.publishInvitationCreated` ⇢ RabbitMQ (bất đồng bộ) → Người được mời → `acceptInvitation` (kiểm người nhận, PENDING, hạn) → `save(ACCEPTED)` → `save(new ProjectMemberEntity)` → `publishInvitationAccepted`.
2. *Dependency Inversion và Strategy ở đâu?* — `AiDiagnosticService` ⇢ interface `AiServiceClient` ⇠ `AiServiceClientImpl`, `HttpAiServiceClient` (realization). Frontend: `container.ts` + các interface `I…Service`.
3. *`ProjectMemberEntity` là lớp kết hợp giữa?* — Giữa **`ProjectEntity`** và **`UserEntity`**: Dự án `1` — `*` Thành viên, Người dùng `1` — `*` Thành viên (từ V10, 1 người có thể có nhiều dòng theo các lần vào).

---

## 12. Việc bạn phải tự làm (không ai làm thay)

- [ ] Đọc hết tài liệu này, tự trả lời câu hỏi bảo vệ thành tiếng (khoảng 3–4 giờ).
- [ ] Xuất PNG các sơ đồ D7, D8, X3 (khoảng 20 phút).
- [ ] T0, T1 rút gọn: mở hệ thống chạy thử, đọc `docs/ooad/CAM_NANG_VE_SO_DO.md` mục 3; ghi `Trạng thái: xong` vào `docs/tasks/ghi-chep/T0-D.md`, `T1-D.md`.
- [ ] Merge các PR còn mở theo thứ tự trong báo cáo (hoặc bảo Claude merge).
- [ ] Nhắc A chốt các task D đã merge sang "xong"; nhóm xác nhận số V10, V11; gửi bạn làm AI file `docs/specs/ai-service-contract.md`.
- [ ] Buổi kiểm chung trên trình duyệt (SPRINT mục 7): admin tạo template → alex tạo dự án từ template; mời/chuyển quyền; link khách; manager duyệt task.
