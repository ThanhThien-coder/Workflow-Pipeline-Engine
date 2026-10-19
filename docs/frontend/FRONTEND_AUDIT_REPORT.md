# WORKFLOW PIPELINE ENGINE — BÁO CÁO KIỂM THỬ FRONTEND & CẨM NANG CHUẨN BỊ TÍCH HỢP BACKEND
> **Thời gian thực hiện**: 18/10/2026  
> **Người thực hiện**: AI Senior Frontend Architect  
> **Phạm vi kiểm tra**: Toàn bộ mã nguồn `wpe-frontend` (22 màn hình, 7 Zustand slices, 6 Service Contracts, 88 Unit Tests)  
> **Mục tiêu**: Rà soát các thành phần mockup/testing tạm thời ("test sơ cho dễ"), phát hiện toàn bộ các lỗi tiềm ẩn (FSM, routing, data binding) và vạch lộ trình dọn dẹp trước khi ghép nối Spring Boot Backend.

---

## I. TỔNG QUAN KẾT QUẢ KIỂM THỬ HIỆN TẠI

1. **Bộ kiểm thử tự động (Unit & Integration Tests)**:
   - **16 file test suites** với **88 unit tests** đạt tỷ lệ thành công **100% (88 passed, 0 failed)**.
   - Biên dịch TypeScript (`tsc -b`): **0 lỗi type error**.
2. **Giao diện trực quan (Visual & Navigation)**:
   - Đã chụp và kiểm định toàn bộ **22 màn hình** tại [ALL_SCREENS.html](file:///c:/STUDY/OOAD/Workflow-Pipeline-Engine/docs/frontend/ALL_SCREENS.html).
   - Thiết kế chuẩn CSS Tailwind, layout responsive, font chữ và hiệu ứng chuyển động mượt mà.

---

## II. DANH MỤC CÁC THÀNH PHẦN "TEST SƠ CHO DỄ" CẦN DỌN DẸP TRƯỚC KHI GHÉP BACKEND

| STT | Thành phần Mockup / Test | Vị trí file | Mục đích ban đầu khi làm UI | Hướng dọn dẹp / Chuẩn hóa khi ghép Backend |
| :---: | :--- | :--- | :--- | :--- |
| **1** | **`DevToolbar` & `devSlice`** | `src/components/dev/DevToolbar.tsx`<br>`src/store/slices/devSlice.ts` | Thanh công cụ nổi giúp dev nhanh chóng chuyển vai trò (👑 Alex Kim, 🛠 Sarah Chen...), chỉnh độ trễ mạng (latency slider), giả lập lỗi 500 và chu trình đồ thị Kahn lặp. | • Chỉ render khi `VITE_USE_MOCK === 'true'`.<br>• Gỡ bỏ việc inject cờ `simulateCycle` trong `settingsSlice.publishProject`. Khi ghép backend thật, việc phát hiện chu trình do giải thuật Kahn ở Spring Boot xử lý 100%. |
| **2** | **`UserSwitcher` ("Switch View - Dev Simulation")** | `src/components/kanban/UserSwitcher.tsx`<br>`src/views/MyTasksView.tsx` | Nút dropdown ở header My Tasks cho phép dev đổi tài khoản thực thi để xem Kanban của từng người. | • Màn hình **My Tasks** bản chất là xem việc của người đang đăng nhập (`auth.currentUser.id`).<br>• Cần loại bỏ `UserSwitcher` giả lập này khỏi header, thay bằng thông tin cá nhân của người đăng nhập.<br>• Nếu là Quản lý/Owner muốn xem task của thành viên khác, chuyển thành bộ lọc `AssigneeFilter` nghiệp vụ. |
| **3** | **Tham số `simulateCycle` trong Service Contract** | `IWorkflowService.ts`<br>`MockWorkflowService.settings.ts` | `publishPipeline(projectId, simulateCycle?: boolean)`: Tham số tùy chọn để ép Mock Service trả về chu trình lặp giả lập. | • Gỡ bỏ tham số `simulateCycle` khỏi interface `IWorkflowService.publishPipeline(projectId: string)`.<br>• Backend Spring Boot sẽ tự kiểm tra và trả về mã HTTP `422 Unprocessable Entity` kèm danh sách `cycleNodes`. |
| **4** | **Nút bấm / Hành động Demo Toast tạm** | `src/features/admin/AdminPortalView.tsx`<br>`src/components/auth/AuthView.tsx` | • `AdminPortalView`: Nút Logout hiện toast demo; nút Export Audit Log hiện toast demo.<br>• `AuthView`: Quên mật khẩu hiện toast demo. | • Thay thế `handleLogout` trong AdminPortal thành gọi action `logout()` thật và redirect về `/auth`.<br>• Nối API `POST /api/auth/forgot-password` và `GET /api/admin/audit-logs/export`. |
| **5** | **Mock Service Container cứng** | `src/services/container.ts` | `container.ts` đang gán cứng các instance `new Mock*Service()`. Chưa có kiểm tra biến môi trường `VITE_USE_MOCK`. | • Thêm kiểm tra: nếu `import.meta.env.VITE_USE_MOCK === 'false'` thì nạp các class `Http*Service` từ thư mục `src/services/impl/`. |

---

## III. BẢNG TỔNG HỢP CÁC LỖI & ĐIỂM BẤT HỢP LÝ CẦN KHẮC PHỤC

### 🚨 1. Lỗi Nghiêm Trọng: Owner Không Thể Duyệt Nghiệm Thu Task Của Thành Viên Khác (FSM Logic Bug)
* **Vị trí**: [`src/domain/taskTransitions.ts#L7`](file:///c:/STUDY/OOAD/Workflow-Pipeline-Engine/wpe-frontend/src/domain/taskTransitions.ts#L7)
* **Chi tiết lỗi**:
  ```typescript
  export function evaluateTransition(task, to, actor) {
    const from = task.status
    const isOwner = actor.projectRole === 'OWNER'
    if (from === to) return { kind: 'deny', message: '' }
    
    // ❌ LỖI Ở ĐÂY: Chặn trước khi xét quyền Owner duyệt nghiệm thu
    if (task.assignedUserId !== actor.id) {
      return { kind: 'deny', message: 'Bạn chỉ thao tác được trên task của mình.' }
    }
    
    if (to === 'DONE') {
      if (!isOwner) return { kind: 'deny', message: 'Chỉ Owner mới có quyền duyệt...' }
      return from === 'REVIEW' ? { kind: 'allow' } : ...
    }
  ```
* **Hậu quả thực tế**:
  Khi thành viên Sarah Chen (`assignedUserId = '2'`) làm xong task và nộp chờ duyệt (`REVIEW`), Chủ dự án Alex Kim (`actor.id = '1'`) mở modal task lên và bấm **"Approve Task"** hoặc **"Reject Task"**, hệ thống ngay lập tức chặn lại và báo lỗi: *"Bạn chỉ thao tác được trên task của mình."*! Vì task được gán cho Sarah Chen nên `task.assignedUserId !== actor.id`. Do đó Chủ dự án không bao giờ có thể duyệt task cho cấp dưới!
* **Cách khắc phục**:
  Chỉ áp dụng điều kiện `task.assignedUserId === actor.id` cho các thao tác cá nhân (`TODO -> IN_PROGRESS`, `IN_PROGRESS -> TODO`, `IN_PROGRESS -> REVIEW`). Khi chuyển sang `DONE` hoặc trả về `IN_PROGRESS` (từ chối nghiệm thu), cho phép tài khoản có vai trò `OWNER` thao tác trên task của bất kỳ thành viên nào.

---

### 🚨 2. Lỗi Hardcode Mã Dự Án (`projectId = '1'`) Tại Các Phân Hệ
* **Vị trí**:
  - [`src/views/MyTasksView.tsx`](file:///c:/STUDY/OOAD/Workflow-Pipeline-Engine/wpe-frontend/src/views/MyTasksView.tsx): Gọi cứng `loadMembers('1')`, `loadTasks('1')`, `setUserId('1', ...)`.
  - [`src/components/views/SettingsView.tsx`](file:///c:/STUDY/OOAD/Workflow-Pipeline-Engine/wpe-frontend/src/components/views/SettingsView.tsx): Gọi cứng `loadSettings('1')`.
  - [`src/components/workflow/MacroWorkflow.tsx`](file:///c:/STUDY/OOAD/Workflow-Pipeline-Engine/wpe-frontend/src/components/workflow/MacroWorkflow.tsx) & [`src/store/useWorkflowStore.ts`](file:///c:/STUDY/OOAD/Workflow-Pipeline-Engine/wpe-frontend/src/store/useWorkflowStore.ts): `loadPhases()` không truyền mã dự án `projectId`.
  - [`src/views/ProjectWorkspaceView.tsx`](file:///c:/STUDY/OOAD/Workflow-Pipeline-Engine/wpe-frontend/src/views/ProjectWorkspaceView.tsx): URL có dạng `/project/:id/:tab` (ví dụ `/project/2/workflow` hoặc `/project/3/settings`), component này nhận `projectId` từ URL nhưng chỉ truyền cho `OverviewView`, còn `WorkflowView`, `MyTasksView`, `SettingsView` thì không truyền `projectId`.
* **Hậu quả thực tế**:
  Khi người dùng chọn Dự án 2 ("Product Redesign") hoặc Dự án 3 ("Backend Migration") từ trang Workspaces, giao diện vẫn luôn luôn hiển thị và sửa đổi dữ liệu của Dự án 1!
* **Cách khắc phục**:
  1. `ProjectWorkspaceView` truyền `projectId` xuống tất cả các View: `<WorkflowView projectId={projectId} />`, `<MyTasksView projectId={projectId} />`, `<SettingsView projectId={projectId} />`.
  2. Bổ sung tham số `projectId` vào các hàm nạp dữ liệu trong Store: `loadPhases(projectId)`, `loadTasks(projectId)`, `loadSettings(projectId)`.

---

### ⚠️ 3. Khởi Tạo Trạng Thái Phiên Đăng Nhập Đồng Bộ (Synchronous Auth State Initialization)
* **Vị trí**: [`src/store/slices/authSlice.ts`](file:///c:/STUDY/OOAD/Workflow-Pipeline-Engine/wpe-frontend/src/store/slices/authSlice.ts)
* **Hiện tượng vừa fix**: Trước đó, `isAuthenticated` khởi tạo là `false` và đợi `useEffect(() => hydrate())` chạy. Điều này tạo ra race condition với Route Guard trong `App.tsx` khiến người dùng khi truy cập thẳng link dự án bị văng về `/workspaces`.
* **Khuyến nghị cho Backend**: Đã cấu trúc lại để nạp token từ `localStorage`/`sessionStorage` đồng bộ ngay khi slice khởi tạo. Cần bổ sung kiểm tra thời hạn token (`expiresAt` / JWT expiry decode) để tự động chuyển về màn hình đăng nhập khi token hết hạn.

---

### ⚠️ 4. Thiếu Tầng Triển Khai HTTP Client (`src/services/impl/`)
* **Vị trí**: Thư mục `src/services/impl/` (chưa tồn tại).
* **Chi tiết**: Toàn bộ hệ thống hiện đang chạy trên các file Mock (`src/services/mock/*`). Để kết nối với máy chủ Spring Boot chạy trên port `8080`, cần xây dựng các class triển khai HTTP theo đúng hợp đồng trong `FRONTEND_BACKEND_INTEGRATION_MAP.md`:
  - `HttpWorkflowService.ts` (kế thừa `IWorkflowService`)
  - `HttpAdminService.ts` (kế thừa `IAdminService`)
  - `HttpGuestService.ts` (kế thừa `IGuestService`)
  - `HttpProfileService.ts` (kế thừa `IProfileService`)
  - `HttpNotificationService.ts` (kế thừa `INotificationService`)
  - Cấu hình Axios Client chung với baseURL `http://localhost:8080/api` và Interceptor tự động đính kèm `Authorization: Bearer <jwt>`.

---

## IV. KẾ HOẠCH HÀNH ĐỘNG 4 BƯỚC ĐỂ GHÉP NỐI BACKEND THÀNH CÔNG

```text
[BƯỚC 1: SỬA LỖI LOGIC NỘI TẠI & LOẠI BỎ HARDCODE] [ĐÃ XONG 100%]
 ├── [x] Sửa evaluateTransition: Cho phép Owner duyệt/từ chối task của người khác.
 ├── [x] Dynamic hóa projectId: Truyền projectId từ route vào Workflow, MyTasks, Settings.
 └── [x] Đồng bộ hóa MyTasks: Tự động dùng auth.currentUser.id làm người thực thi mặc định.

[BƯỚC 2: TÁCH BẠCH DEV TEST TOOLS KHỎI PRODUCTION BUILD] [ĐÃ XONG 100%]
 ├── [x] Loại bỏ UserSwitcher (Dev Simulation) khỏi header MyTasks.
 ├── [x] Gỡ tham số simulateCycle khỏi Service Contract.
 └── [x] Đảm bảo DevToolbar chỉ kích hoạt khi VITE_USE_MOCK=true && DEV mode.

[BƯỚC 3: DỰNG TẦNG HTTP SERVICE CLIENT (src/services/impl/)]
 ├── Khởi tạo Axios Instance với Base URL và JWT Interceptor.
 ├── Viết các class HttpWorkflowService, HttpAdminService, HttpGuestService...
 └── Cập nhật container.ts: switch tự động giữa Mock và HttpService theo VITE_USE_MOCK.

[BƯỚC 4: KIỂM THỬ TÍCH HỢP END-TO-END (E2E)]
 ├── Chạy backend Spring Boot (port 8080) và database PostgreSQL.
 ├── Đăng ký tài khoản thật -> Đăng nhập -> Tạo Workspace -> Tạo DAG -> Kích hoạt Pipeline -> Duyệt Kanban.
 └── Xác nhận 100% test cases khớp với FRONTEND_BACKEND_INTEGRATION_MAP.md.
```

