# WORKFLOW PIPELINE ENGINE (WPE) — CẨM NANG TÍCH HỢP FRONTEND - BACKEND
## HƯỚNG DẪN KỸ THUẬT TOÀN DIỆN CHO ĐỘI NGŨ PHÁT TRIỂN SPRING BOOT & REACT

> **Phiên bản**: 1.0.0 — Production Ready  
> **Tài liệu**: Frontend & Backend Integration Contract Map (Single Source of Truth)  
> **Mục tiêu**: Chuẩn hóa 100% hợp đồng giao tiếp giữa giao diện Frontend (React 18 / TypeScript / Zustand) và máy chủ Backend (Spring Boot 3 / Spring Data JPA / PostgreSQL 15+). Đội ngũ Backend và Frontend triển khai độc lập, nối API thật trực tiếp mà không cần họp bàn lại.

---

## MỤC LỤC TỔNG QUAN

- [CHƯƠNG I: CƠ CHẾ CHUYỂN ĐỔI "CẮM - RÚT" (PLUG & PLAY DI ENGINE)](#chương-i-cơ-chế-chuyển-đổi-cắm---rút-plug--play-di-engine)
  - [1.1 Sơ đồ Luồng Dữ liệu Phân tầng](#11-sơ-đồ-luồng-dữ-liệu-phân-tầng)
  - [1.2 Danh mục Hợp đồng Dịch vụ (Service Contracts) & Controller Tương ứng](#12-danh-mục-hợp-đồng-dịch-vụ-service-contracts--controller-tương-ứng)
  - [1.3 Quy trình 3 Bước Chuyển đổi từ Mock sang API thật](#13-quy-trình-3-bước-chuyển-đổi-từ-mock-sang-api-thật)
- [CHƯƠNG II: BẢN ĐỒ TÍCH HỢP CHI TIẾT TỪNG PHÂN HỆ (10 CỤM NGHIỆP VỤ)](#chương-ii-bản-đồ-tích-hợp-chi-tiết-từng-phân-hệ-10-cụm-nghiệp-vụ)
  - [Cụm 1: Auth Gateway (Xác thực & Quản lý Phiên)](#cụm-1-auth-gateway-xác-thực--quản-lý-phiên)
  - [Cụm 2: Hồ Sơ & Bảo Mật Cá Nhân (User Profile)](#cụm-2-hồ-sơ--bảo-mật-cá-nhân-user-profile)
  - [Cụm 3: Quản Trị Không Gian Làm Việc (Project Workspace)](#cụm-3-quản-trị-không-gian-làm-việc-project-workspace)
  - [Cụm 4: Đồ Thị Quy Trình & Thiết Kế DAG Canvas (Dual-View Workflow)](#cụm-4-đồ-thị-quy-trình--thiết-kế-dag-canvas-dual-view-workflow)
  - [Cụm 5: Thực Thi Công Việc Cá Nhân (My Tasks Kanban & FSM State Transition)](#cụm-5-thực-thi-công-việc-cá-nhân-my-tasks-kanban--fsm-state-transition)
  - [Cụm 6: Kho Tài Nguyên & Minh Chứng Dự Án (Artifacts Hub)](#cụm-6-kho-tài-nguyên--minh-chứng-dự-án-artifacts-hub)
  - [Cụm 7: Cổng Chia Sẻ Công Khai Cho Khách & Giáo Viên (Guest Share Gateway)](#cụm-7-cổng-chia-sẻ-công-khai-cho-khách--giáo-viên-guest-share-gateway)
  - [Cụm 8: Luồng Tiếp Thu Ý Kiến 1 Chiều (Feedback Queue)](#cụm-8-luồng-tiếp-thu-ý-kiến-1-chiều-feedback-queue)
  - [Cụm 9: Phân Hệ Chẩn Đoán AI Bấm Nút Chủ Động (On-Demand AI Diagnosis)](#cụm-9-phân-hệ-chẩn-đoán-ai-bấm-nút-chủ-động-on-demand-ai-diagnosis)
  - [Cụm 10: Quản Trị Hệ Thống & Template Studio (Admin Portal)](#cụm-10-quản-trị-hệ-thống--template-studio-admin-portal)
- [CHƯƠNG III: CHUẨN MỰC XỬ LÝ LỖI & MÃ PHẢN HỒI (HTTP ERROR CONTRACTS)](#chương-iii-chuẩn-mực-xử-lý-lỗi--mã-phản-hồi-http-error-contracts)
  - [3.1 Cấu trúc Chuẩn JSON Error Payload](#31-cấu-trúc-chuẩn-json-error-payload)
  - [3.2 Ma trận Ánh xạ Mã lỗi HTTP vào UI Frontend](#32-ma-trận-ánh-xạ-mã-lỗi-http-vào-ui-frontend)

---

# CHƯƠNG I: CƠ CHẾ CHUYỂN ĐỔI "CẮM - RÚT" (PLUG & PLAY DI ENGINE)

## 1.1 Sơ đồ Luồng Dữ liệu Phân tầng

Hệ thống Frontend tuân thủ nghiêm ngặt mô hình Phân tầng Độc lập (Clean Layered Architecture) và Dependency Injection (DI). Không có bất kỳ View hay Component nào được phép gọi trực tiếp `fetch()`, `axios` hay phụ thuộc vào file Mock dữ liệu.

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 FRONTEND CLIENT (REACT 18)                             │
│                                                                                        │
│  [UI View / Component]                                                                 │
│         │ (Gọi action / Dispatch event)                                                │
│         ▼                                                                              │
│  [Zustand Store / Custom Hook]  (useWorkflowStore, useProfileStore, useAdminPortal...) │
│         │ (Sử dụng Service thông qua DI)                                               │
│         ▼                                                                              │
│  [Service Container]            (src/services/container.ts)                           │
│         │ (Tham chiếu Contract Interface)                                              │
│         ▼                                                                              │
│  [Service Interface Contract]   (IWorkflowService, IProfileService, IGuestService...)  │
│         │                                                                              │
│         ├──────────────────────────────┬───────────────────────────────┐               │
│         │ (Chế độ Demo / Staging)       │ (Chế độ Production)           │               │
│         ▼                              ▼                               │               │
│  [Mock Service Impl]            [Real Http Service Impl]               │               │
│  (src/services/mock/*)          (src/services/impl/*)                  │               │
│                                        │                               │               │
└────────────────────────────────────────┼───────────────────────────────┼───────────────┘
                                         │ (JSON qua HTTPS / RESTful)    │
                                         ▼                               │
┌────────────────────────────────────────────────────────────────────────┼───────────────┐
│                                 BACKEND (SPRING BOOT 3)                │               │
│                                                                        ▼               │
│  [Spring Web Controller]        (@RestController: AuthController, NodeController...)   │
│         │                                                                              │
│         ▼                                                                              │
│  [Service & Domain Logic]       (DAG Engine, FSM Validator, Gemini AI Worker...)       │
│         │                                                                              │
│         ▼                                                                              │
│  [Spring Data JPA Repository]   (UserRepository, NodeRepository, PhaseRepository...)   │
│         │                                                                              │
│         ▼                                                                              │
│  [PostgreSQL 15+ (12 Tables)]   (3NF Normalized Relational Database + JSONB)           │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

## 1.2 Danh mục Hợp đồng Dịch vụ (Service Contracts) & Controller Tương ứng

| Service Interface (Frontend) | File Đường dẫn | Service Container Property | Spring Boot Controller Tương ứng | Trách nhiệm Nghiệp vụ |
| :--- | :--- | :--- | :--- | :--- |
| `IWorkflowService` | `src/services/contracts/IWorkflowService.ts` | `container.workflowService` | `AuthController`, `ProjectController`, `PhaseController`, `NodeController`, `ArtifactController` | Điều phối DAG, FSM Kanban, Hội đồng thành viên, Quản trị dự án |
| `IProfileService` | `src/services/contracts/IProfileService.ts` | `container.profileService` | `UserProfileController` | Thông tin tài khoản cá nhân, đổi mật khẩu, upload avatar, privacy |
| `IGuestService` | `src/services/contracts/IGuestService.ts` | `container.guestService` | `GuestGatewayController` | Cổng khách ngoài, xác thực token 64 ký tự, gửi nhận xét 1 chiều |
| `IAdminService` | `src/services/admin/IAdminService.ts` | `container.adminService` | `AdminPortalController` | Quản trị nền tảng, khóa tài khoản, lưu trữ workspace, KPI hệ thống |
| `ITemplateService` | `src/services/template/ITemplateService.ts` | `container.templateService` | `TemplateStudioController` | CRUD quy trình mẫu 2 tầng, thẩm định DAG chống chu trình lặp |
| `INotificationService`| `src/services/contracts/INotificationService.ts` | `container.notificationService`| `NotificationController` | Thông báo chuông đẩy thời gian thực, đánh dấu đã đọc |

## 1.3 Quy trình 3 Bước Chuyển đổi từ Mock sang API thật

Khi đội ngũ Backend dựng xong các RESTful endpoint, Frontend chuyển đổi sang kết nối máy chủ thật trong vòng **3 phút** mà không cần sửa bất kỳ file View, Component hay Store nào:

### Bước 1: Tạo các class triển khai HTTP trong thư mục `src/services/impl/`
Tạo các file kế thừa đúng Interface tương ứng, ví dụ `src/services/impl/HttpWorkflowService.ts`:

```typescript
import axios, { AxiosInstance } from 'axios';
import type { IWorkflowService } from '../contracts/IWorkflowService';
import type { AuthCredentialsDto, AuthResponseDto } from '../../types/auth.types';

const httpClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Gắn JWT Interceptor tự động
httpClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('wpe_auth_token') || sessionStorage.getItem('wpe_auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export class HttpWorkflowService implements IWorkflowService {
  async login(credentials: AuthCredentialsDto): Promise<AuthResponseDto> {
    const res = await httpClient.post<AuthResponseDto>('/auth/login', credentials);
    return res.data;
  }
  // Triển khai toàn bộ các phương thức theo IWorkflowService Contract...
}
```

### Bước 2: Hoàn tất các Service Implementations
Tạo tương tự cho:
- `src/services/impl/HttpProfileService.ts` (kế thừa `IProfileService`)
- `src/services/impl/HttpGuestService.ts` (kế thừa `IGuestService`)
- `src/services/impl/HttpAdminService.ts` (kế thừa `IAdminService`)
- `src/services/impl/HttpTemplateService.ts` (kế thừa `ITemplateService`)
- `src/services/impl/HttpNotificationService.ts` (kế thừa `INotificationService`)

### Bước 3: Đổi cấu hình tại `src/services/container.ts`
Chỉ cần thay đổi nguồn khởi tạo tại `container.ts` theo biến môi trường `VITE_USE_MOCK`:

```typescript
import { HttpWorkflowService } from './impl/HttpWorkflowService'
import { HttpGuestService } from './impl/HttpGuestService'
import { HttpProfileService } from './impl/HttpProfileService'
import { HttpAdminService } from './impl/HttpAdminService'
import { HttpTemplateService } from './impl/HttpTemplateService'
import { HttpNotificationService } from './impl/HttpNotificationService'

const useMock = import.meta.env.VITE_USE_MOCK === 'true'

export const container: ServiceContainer = {
  workflowService: useMock ? new MockWorkflowService() : new HttpWorkflowService(),
  guestService: useMock ? new MockGuestApi() : new HttpGuestService(),
  profileService: useMock ? new MockProfileApi() : new HttpProfileService(),
  adminService: useMock ? new MockAdminService() : new HttpAdminService(),
  templateService: useMock ? new MockTemplateService() : new HttpTemplateService(),
  notificationService: useMock ? new MockNotificationApi() : new HttpNotificationService(),
}
```
Toàn bộ hệ thống lập tức chuyển sang vận hành trên dữ liệu Backend thật.

---

# CHƯƠNG II: BẢN ĐỒ TÍCH HỢP CHI TIẾT TỪNG PHÂN HỆ (10 CỤM NGHIỆP VỤ)

---

## Cụm 1: Auth Gateway (Xác thực & Quản lý Phiên)

### 1.1 Đăng ký tài khoản mới (`POST /api/auth/register`)
1. **Mục tiêu Nghiệp vụ**: Khởi tạo tài khoản mới cho người dùng với mật khẩu băm BCrypt, gán quyền hệ thống mặc định (`system_role = 'USER'`), khởi tạo phiên bảo mật `token_version = 0`.
2. **Luồng Mã Nguồn**:
   - `src/components/auth/AuthView.tsx` -> `useWorkflowStore.auth.register` (`src/store/slices/authSlice.ts`) -> `container.workflowService.register(cmd)` -> `IWorkflowService.register(cmd: RegisterUserCommand): Promise<AuthResponseDto>`.
3. **Request DTO**:
   - **Method & URL**: `POST /api/auth/register`
   - **Headers**: `Content-Type: application/json`
   - **Body JSON**:
     ```json
     {
       "username": "minhdang2026",
       "email": "dang.dev@wpe.io",
       "password": "SecurePassword123!",
       "fullName": "Dang Minh"
     }
     ```
4. **Xử lý Backend & Bảng CSDL Tác động**:
   - Bảng tác động: `USERS`, `REFRESH_TOKEN`.
   - Kiểm tra Unique Constraint: `username` và `email` không được trùng lặp trong `USERS`.
   - Băm mật khẩu bằng BCrypt (cost = 12).
   - Chèn vào `USERS`: `system_role = 'USER'`, `is_locked = FALSE`, `token_version = 0`.
   - Tự động sinh Access Token (JWT 15 phút) và Refresh Token (7 ngày, băm SHA-256 lưu vào `REFRESH_TOKEN`).
5. **Response DTO & UI Mutation**:
   - **Status Code**: `201 Created`
   - **Response Body**:
     ```json
     {
       "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwidXNlcm5hbWUiOiJtaW5oZGFuZyIsImV4cCI6MTgwMDAwMDAwMH0...",
       "refreshToken": "rt_8f93bc10427845f9a0c7932156...",
       "user": {
         "id": "1",
         "username": "minhdang2026",
         "email": "dang.dev@wpe.io",
         "name": "Dang Minh",
         "role": "USER",
         "avatarUrl": null
       }
     }
     ```
   - **UI Mutation**: `authSlice` lưu token vào `localStorage`, cập nhật `currentUser`, chuyển hướng sang `/workspaces`.

---

### 1.2 Đăng nhập & Cấp phát JWT Rotation (`POST /api/auth/login`)
1. **Mục tiêu Nghiệp vụ**: Xác thực danh tính qua username/password, kiểm tra trạng thái khóa tài khoản, cấp phát cặp JWT Access Token và Refresh Token mới.
2. **Luồng Mã Nguồn**:
   - `src/components/auth/AuthView.tsx` -> `useWorkflowStore.auth.login` (`src/store/slices/authSlice.ts`) -> `container.workflowService.login(credentials)` -> `IWorkflowService.login(credentials: AuthCredentialsDto): Promise<AuthResponseDto>`.
3. **Request DTO**:
   - **Method & URL**: `POST /api/auth/login`
   - **Headers**: `Content-Type: application/json`
   - **Body JSON**:
     ```json
     {
       "username": "alex.kim",
       "password": "Password123!",
       "rememberMe": true
     }
     ```
4. **Xử lý Backend & Bảng CSDL Tác động**:
   - Bảng tác động: `USERS`, `REFRESH_TOKEN`.
   - Tìm kiếm `USERS` theo `username`. Kiểm tra `is_locked == FALSE`.
   - So khớp mật khẩu qua BCrypt. Đọc `token_version` đưa vào claims của JWT Access Token.
   - Chèn bản ghi phiên mới vào `REFRESH_TOKEN` (`revoked = FALSE`, `expires_at = NOW() + 7 days`).
5. **Response DTO & UI Mutation**:
   - **Status Code**: `200 OK` (hoặc `401 Unauthorized` nếu sai mật khẩu, `403 Forbidden` nếu `is_locked = TRUE`).
   - **Response Body**:
     ```json
     {
       "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
       "refreshToken": "rt_98234abcf0912384723...",
       "user": {
         "id": "1",
         "username": "alex.kim",
         "email": "alex.kim@pipeline.engine",
         "name": "Alex Kim",
         "role": "USER",
         "avatarUrl": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"
       }
     }
     ```
   - **UI Mutation**: Ghi nhận state đăng nhập, tải danh sách thông báo và dự án.

---

### 1.3 Refresh Token & Đăng xuất thu hồi phiên (`POST /api/auth/refresh`, `POST /api/auth/logout`)
1. **Mục tiêu Nghiệp vụ**: Cấp mới Access Token khi token cũ hết hạn (Token Rotation chống Replay Attack). Đăng xuất thu hồi phiên tức thời tại máy chủ.
2. **Luồng Mã Nguồn**:
   - `HttpInterceptor` / `src/store/slices/authSlice.ts` (`logout`) -> `container.workflowService.logout()` -> `IWorkflowService.logout(): Promise<void>`.
3. **Request DTO**:
   - `POST /api/auth/refresh`: Body `{ "refreshToken": "rt_98234abcf0912384723..." }`.
   - `POST /api/auth/logout`: Header `Authorization: Bearer <jwt>`, Body `{ "refreshToken": "rt_..." }`.
4. **Xử lý Backend & Bảng CSDL Tác động**:
   - Bảng tác động: `REFRESH_TOKEN`.
   - Khi Refresh: Tra cứu `token_hash`. Kiểm tra `revoked == FALSE` và chưa hết hạn. Đánh dấu token cũ `revoked = TRUE`, tạo token mới. Nếu phát hiện token đã bị thu hồi từ trước mà vẫn gửi lại -> lập tức thu hồi toàn bộ token của người dùng đó (Phát hiện tấn công).
   - Khi Logout: Đánh dấu `REFRESH_TOKEN.revoked = TRUE`.
5. **Response DTO & UI Mutation**:
   - `POST /api/auth/refresh`: `200 OK` trả về cặp token mới.
   - `POST /api/auth/logout`: `200 OK` `{ "success": true }`.
   - **UI Mutation**: Xóa sạch storage, reset toàn bộ Zustand Store về initial state, chuyển hướng về trang đăng nhập.

---

## Cụm 2: Hồ Sơ & Bảo Mật Cá Nhân (User Profile)

### 2.1 Lấy & Cập nhật Profile (`GET/PUT /api/users/me/profile`)
1. **Mục tiêu Nghiệp vụ**: Truy vấn và cập nhật hồ sơ cá nhân: Họ tên, Chức danh, Tiểu sử, Danh sách Kỹ năng và Liên kết ngoài.
2. **Luồng Mã Nguồn**:
   - `src/views/ProfileView.tsx` -> `useProfileStore` (`loadProfile`, `updateProfileData`) -> `container.profileService.getMyProfile()`, `updateProfile(cmd)` -> `IProfileService.getMyProfile()`, `updateProfile()`.
3. **Request DTO**:
   - **Method & URL**: `GET /api/users/me/profile`, `PUT /api/users/me/profile`
   - **Headers**: `Authorization: Bearer <jwt>`, `Content-Type: application/json`
   - **Body JSON (PUT)**:
     ```json
     {
       "displayName": "Alex Kim",
       "title": "Principal Architect",
       "email": "alex.kim@pipeline.engine",
       "bio": "Designing robust distributed pipelines and state machines.",
       "skills": ["TypeScript", "Spring Boot", "DAG", "PostgreSQL"],
       "links": {
         "github": "https://github.com/alexkim",
         "linkedin": "https://linkedin.com/in/alexkim",
         "website": "https://alexkim.dev"
       }
     }
     ```
4. **Xử lý Backend & Bảng CSDL Tác động**:
   - Bảng tác động: `USERS`.
   - Cập nhật `USERS.full_name`, `USERS.email` (nếu đổi email phải kiểm tra Unique Constraint).
   - Lưu trữ metadata hồ sơ (title, bio, skills, links) vào cột mở rộng của User.
5. **Response DTO & UI Mutation**:
   - **Status Code**: `200 OK`. Body: `ProfileDto`.
   - **UI Mutation**: Cập nhật `useProfileStore.profile`, hiển thị Toast xanh "Profile saved".

---

### 2.2 Đổi mật khẩu & Tăng `token_version` (`POST /api/users/me/password`)
1. **Mục tiêu Nghiệp vụ**: Thay đổi mật khẩu tài khoản và vô hiệu hóa tức thì toàn bộ phiên đăng nhập trên các thiết bị khác bằng cách tăng `token_version`.
2. **Luồng Mã Nguồn**:
   - `src/views/ProfileView.tsx` -> `useProfileStore.changePassword` -> `container.profileService.changePassword(cmd)` -> `IProfileService.changePassword(cmd: ChangePasswordCommand): Promise<void>`.
3. **Request DTO**:
   - **Method & URL**: `POST /api/users/me/password`
   - **Headers**: `Authorization: Bearer <jwt>`
   - **Body JSON**:
     ```json
     {
       "currentPassword": "OldPassword123!",
       "newPassword": "NewStrongPassword2026!"
     }
     ```
4. **Xử lý Backend & Bảng CSDL Tác động**:
   - Bảng tác động: `USERS`, `REFRESH_TOKEN`.
   - Kiểm tra `currentPassword` so với `USERS.password_hash`.
   - Cập nhật `USERS.password_hash = BCrypt(newPassword)`.
   - Tăng `USERS.token_version = USERS.token_version + 1`.
   - Cập nhật hàng loạt: `UPDATE REFRESH_TOKEN SET revoked = TRUE WHERE user_id = :userId`.
5. **Response DTO & UI Mutation**:
   - **Status Code**: `200 OK` `{ "success": true, "message": "Password updated successfully" }`.
   - **UI Mutation**: Reset form mật khẩu, hiển thị Toast xanh "Password updated".

---

### 2.3 Tải lên ảnh đại diện Multipart (`POST /api/users/me/avatar`)
1. **Mục tiêu Nghiệp vụ**: Tải lên ảnh đại diện cá nhân định dạng PNG/JPG/WebP dung lượng tối đa 2MB.
2. **Luồng Mã Nguồn**:
   - `src/views/ProfileView.tsx` -> `useProfileStore.uploadAvatar` -> `container.profileService.uploadAvatar(file)` -> `IProfileService.uploadAvatar(file: File): Promise<ProfileDto>`.
3. **Request DTO**:
   - **Method & URL**: `POST /api/users/me/avatar`
   - **Headers**: `Authorization: Bearer <jwt>`, `Content-Type: multipart/form-data`
   - **Form Data**: `file: [binary payload]` (max 2MB, MIME: image/png, image/jpeg, image/webp).
4. **Xử lý Backend & Bảng CSDL Tác động**:
   - Bảng tác động: `USERS`.
   - Kiểm tra kích thước và MIME type. Lưu file vào Cloud Storage / S3 / Static Resource Path.
   - Cập nhật URL ảnh mới vào `USERS`.
5. **Response DTO & UI Mutation**:
   - **Status Code**: `200 OK`. Body trả về `ProfileDto` đã có `avatarUrl` mới.
   - **UI Mutation**: Cập nhật ảnh đại diện trên Header, ProfileView và đồng bộ `authSlice.currentUser.avatarUrl`.

---

## Cụm 3: Quản Trị Không Gian Làm Việc (Project Workspace)

### 3.1 Danh sách Workspace của tôi (`GET /api/projects`)
1. **Mục tiêu Nghiệp vụ**: Lấy danh sách toàn bộ các dự án người dùng sở hữu hoặc tham gia, tính toán số liệu thống kê (`activeNodes`, `tasksDone`, `tasksTotal`).
2. **Luồng Mã Nguồn**:
   - `src/components/workspace/WorkspaceView.tsx` -> `useWorkflowStore.workspace.loadProjects` (`src/store/slices/workspaceSlice.ts`) -> `container.workflowService.getProjectsList()` -> `IWorkflowService.getProjectsList(): Promise<readonly ProjectSummaryDto[]>`.
3. **Request DTO**:
   - **Method & URL**: `GET /api/projects`
   - **Query Params**: `tab=all|mine|shared|archived`, `sort=ts|done|nodes`
   - **Headers**: `Authorization: Bearer <jwt>`
4. **Xử lý Backend & Bảng CSDL Tác động**:
   - Bảng tác động: `PROJECT`, `PROJECT_MEMBER`, `NODE`.
   - JOIN giữa `PROJECT` và `PROJECT_MEMBER` theo `user_id = currentUserId AND removed_at IS NULL`.
   - Truy vấn con (sub-query) tính số node theo từng trạng thái.
5. **Response DTO & UI Mutation**:
   - **Status Code**: `200 OK`
   - **Response Body**:
     ```json
     [
       {
         "id": "1",
         "name": "Core Banking Pipeline",
         "desc": "Next-gen banking ledger workflow",
         "role": "OWNER",
         "status": "ACTIVE",
         "nodeCount": 24,
         "activeNodes": 8,
         "doneNodes": 12,
         "updatedAt": "2026-10-12T14:30:00Z"
       }
     ]
     ```
   - **UI Mutation**: Ánh xạ qua `projectMapper`, cập nhật `workspace.projects`, render ProjectCard.

---

### 3.2 Khởi tạo dự án mới (Blank hoặc Clone từ Template) (`POST /api/projects`)
1. **Mục tiêu Nghiệp vụ**: Tạo dự án mới rỗng hoặc sao chép sâu (Deep Clone) toàn bộ Phases, Nodes, Dependencies từ mẫu chuẩn (`PIPELINE_TEMPLATE`).
2. **Luồng Mã Nguồn**:
   - `src/components/workspace/CreatePipelineModal.tsx` -> `useWorkflowStore.workspace.createProject` -> `container.workflowService.createProject(cmd)` -> `IWorkflowService.createProject(cmd: CreateProjectCommand): Promise<ProjectSummaryDto>`.
3. **Request DTO**:
   - **Method & URL**: `POST /api/projects`
   - **Headers**: `Authorization: Bearer <jwt>`, `Content-Type: application/json`
   - **Body JSON**:
     ```json
     {
       "name": "Payment Gateway V2",
       "description": "Microservice payment processing workflow",
       "templateId": "tpl-sdlc"
     }
     ```
4. **Xử lý Backend & Bảng CSDL Tác động**:
   - Bảng tác động: `PROJECT`, `PROJECT_MEMBER`, `PIPELINE_TEMPLATE`, `WORK_PHASE`, `NODE`, `NODE_DEPENDENCY`.
   - Chèn vào `PROJECT` (`owner_id = currentUserId`, `status = 'DRAFT'`).
   - Chèn vào `PROJECT_MEMBER` (`user_id = currentUserId`, `role = 'OWNER'`).
   - Nếu có `templateId`: Đọc `PIPELINE_TEMPLATE.graph_data`, tăng `clone_count += 1`. Clone toàn bộ phases, nodes, dependencies vào các bảng tương ứng với `project_id` mới.
5. **Response DTO & UI Mutation**:
   - **Status Code**: `201 Created`. Body: `ProjectSummaryDto`.
   - **UI Mutation**: Đóng modal, thêm project vào store, kích hoạt điều hướng vào dự án mới.

---

### 3.3 Quản lý Lời Mời Tham Gia Dự Án & Vai Trò (`POST /api/v1/projects/{projectId}/invitations`, `PATCH/DELETE /api/v1/projects/{projectId}/members/{userId}`)
1. **Mục tiêu Nghiệp vụ**: Chủ dự án tạo lời mời bất đồng bộ gửi tới người dùng theo email/username (thay thế hoàn toàn Direct Add cũ). Thành viên nhận thông báo và tự quyết định Chấp nhận/Từ chối. Đồng thời hỗ trợ thay đổi vai trò (OWNER / COLLABORATOR / VIEWER) và xóa mềm thành viên (`removed_at`).
2. **Luồng Mã Nguồn**:
   - `src/components/settings/InviteMemberModal.tsx` / `WorkspaceMembersSection.tsx` / `KickMemberModal.tsx` -> `useWorkflowStore.settings` (`inviteMember`, `changeRole`, `kickMember`) -> `container.workflowService` (`inviteProjectMember`, `changeMemberRole`, `removeProjectMember`).
3. **Request DTO**:
   - Gửi Lời Mời: `POST /api/v1/projects/{projectId}/invitations`
     - **Headers**: `Authorization: Bearer <jwt>`, `Content-Type: application/json`
     - **Body**: `{ "inviteeEmailOrUsername": "sarah.chen@pipeline.engine", "role": "COLLABORATOR" }`
   - Đổi Role: `PATCH /api/v1/projects/{projectId}/members/{userId}`, Body: `{ "role": "OWNER" }`.
   - Xóa: `DELETE /api/v1/projects/{projectId}/members/{userId}`.
4. **Xử lý Backend & Bảng CSDL Tác động**:
   - Bảng tác động: `PROJECT_INVITATION`, `PROJECT_MEMBER`, `USERS`, `NOTIFICATION`, `NODE`.
   - Kiểm tra RBAC: Caller bắt buộc có vai trò `OWNER` trong dự án.
   - Khi Tạo Lời Mời:
     - Tìm kiếm user trong bảng `USERS`. Kiểm tra nếu đã là thành viên trong `PROJECT_MEMBER` -> Ném `400 Bad Request`.
     - Kiểm tra nếu đã có lời mời `PENDING` -> Ném `409 Conflict`.
     - Chèn vào `PROJECT_INVITATION` (`status = 'PENDING'`, `expires_at = NOW() + 7 days`, `version = 0`).
     - Bắn `InvitationCreatedEvent` vào RabbitMQ. Background Consumer tạo `NOTIFICATION` cho invitee với `link_url = /workspace?action=open-invite-modal&invitationId={id}` và stream qua SSE.
   - Khi Xóa: Cập nhật `PROJECT_MEMBER.removed_at = NOW()`. Gỡ người thực hiện: `UPDATE NODE SET assigned_user_id = NULL WHERE project_id = :id AND assigned_user_id = :userId`. Trả về `unassignedTaskCount`.
5. **Response DTO & UI Mutation**:
   - **Status Code**: `201 Created` / `200 OK`.
   - **Response Body**:
     ```json
     {
       "id": 101,
       "projectId": 1,
       "projectName": "FinTech Core Migration",
       "inviterId": 1,
       "inviterName": "Alex Kim",
       "inviteeId": 2,
       "inviteeEmail": "sarah.chen@pipeline.engine",
       "role": "COLLABORATOR",
       "status": "PENDING",
       "createdAt": "2026-10-21T10:00:00Z",
       "expiresAt": "2026-10-28T10:00:00Z",
       "version": 0
     }
     ```
   - **UI Mutation**: Đóng modal mời, hiển thị lời mời trong danh sách "Pending Invitations", cập nhật Audit Log `MEMBER_INVITED`, hiển thị Toast xanh.

---

### 3.4 Phản Hồi & Thu Hồi Lời Mời (`GET/POST /api/v1/invitations/*`, `DELETE /api/v1/projects/{projectId}/invitations/{id}`)
1. **Mục tiêu Nghiệp vụ**:
   - Người được mời xem chi tiết lời mời qua Popup Modal khi click vào thông báo Topbar (`action=open-invite-modal`).
   - Người được mời bấm Chấp nhận (`POST /api/v1/invitations/{id}/accept`) hoặc Từ chối (`POST /api/v1/invitations/{id}/reject`).
   - Chủ dự án thu hồi lời mời đang chờ (`DELETE /api/v1/projects/{projectId}/invitations/{id}`).
2. **Luồng Mã Nguồn**:
   - `src/components/common/NotificationBell.tsx` (Bắt `action=open-invite-modal&invitationId={id}`) -> Mở `ProjectInviteAcceptModal.tsx` -> Gọi `container.workflowService.getInvitation(id)`, `acceptInvitation(id)`, `rejectInvitation(id)`.
3. **Request DTOs**:
   - Lấy chi tiết: `GET /api/v1/invitations/{id}` (Headers: `Authorization: Bearer <jwt>`)
   - Chấp nhận: `POST /api/v1/invitations/{id}/accept` (Headers: `Authorization: Bearer <jwt>`)
   - Từ chối: `POST /api/v1/invitations/{id}/reject` (Headers: `Authorization: Bearer <jwt>`)
   - Chủ dự án thu hồi: `DELETE /api/v1/projects/{projectId}/invitations/{id}` (Headers: `Authorization: Bearer <jwt>`)
4. **Xử lý Backend & Bảng CSDL Tác động**:
   - Bảng tác động: `PROJECT_INVITATION`, `PROJECT_MEMBER`, `NOTIFICATION`.
   - **Khi Chấp nhận (`accept`)**:
     - Kiểm tra `invitation.invitee_id == currentUserId`. Nếu không khớp -> `403 Forbidden`.
     - Kiểm tra `invitation.status == 'PENDING'` và `invitation.expires_at > NOW()`. Nếu đã quá hạn -> Cập nhật `status = 'EXPIRED'`, trả về `400 Bad Request`.
     - Giao dịch nguyên tử (`@Transactional`):
       + Cập nhật `PROJECT_INVITATION`: `status = 'ACCEPTED'`, `responded_at = NOW()`.
       + Chèn vào `PROJECT_MEMBER`: `project_id`, `user_id = currentUserId`, `role = invitation.role`, `joined_at = NOW()`.
       + Bắn `InvitationAcceptedEvent` vào RabbitMQ để thông báo cho Chủ dự án.
   - **Khi Từ chối (`reject`)**:
     - Kiểm tra xác thực. Cập nhật `PROJECT_INVITATION`: `status = 'REJECTED'`, `responded_at = NOW()`.
   - **Khi Chủ dự án Thu hồi (`revoke`)**:
     - Thẩm định quyền: Caller bắt buộc là `OWNER` của `project_id`.
     - Cập nhật `PROJECT_INVITATION`: `status = 'REVOKED'`.
   - **Optimistic Locking**: Mọi thay đổi trạng thái đều tăng `version += 1`. Nếu có xung đột đồng thời giữa Accept và Revoke, JPA ném `OptimisticLockException` (`409 Conflict`).
5. **Response DTO & UI Mutation**:
   - `GET /api/v1/invitations/{id}`: Trả về `InvitationDetailResponse` (tên dự án, tên người mời, vai trò gán, ngày hết hạn).
   - `POST /api/v1/invitations/{id}/accept`: Trả về `200 OK` `{ "success": true, "projectId": 1, "status": "ACCEPTED" }`. Frontend chuyển hướng hoặc kích hoạt nạp lại Workspace của dự án.
   - `POST /api/v1/invitations/{id}/reject`: Trả về `200 OK` `{ "success": true, "status": "REJECTED" }`. Đóng modal.
   - `DELETE /api/v1/projects/{projectId}/invitations/{id}`: Trả về `204 No Content`. Gỡ bỏ lời mời khỏi danh sách Pending.

---

## Cụm 4: Đồ Thị Quy Trình & Thiết Kế DAG Canvas (Dual-View Workflow)

### 4.1 Lấy cấu trúc Macro Phases & Nodes của dự án (`GET /api/projects/{id}/graph`)
1. **Mục tiêu Nghiệp vụ**: Lấy toàn bộ cấu trúc đồ thị 2 tầng: Tầng Macro (`WORK_PHASE` và các cạnh phụ thuộc giữa các Phase) và Tầng Micro (`NODE` thuộc từng Phase kèm cạnh `NODE_DEPENDENCY`).
2. **Luồng Mã Nguồn**:
   - `src/components/workflow/MacroWorkflow.tsx` -> `useWorkflowStore.loadPhases` -> `container.workflowService.getMacroPhases()`, `getPhaseEdges()`, `getPhaseGraph(phaseId)` -> `IWorkflowService`.
3. **Request DTO**:
   - **Method & URL**: `GET /api/projects/{id}/graph`
   - **Headers**: `Authorization: Bearer <jwt>`
4. **Xử lý Backend & Bảng CSDL Tác động**:
   - Bảng tác động: `WORK_PHASE`, `NODE`, `NODE_DEPENDENCY`.
   - Truy vấn danh sách `WORK_PHASE` sắp xếp theo `order_index`.
   - Truy vấn toàn bộ `NODE` và các liên kết phụ thuộc `NODE_DEPENDENCY` trong dự án.
5. **Response DTO & UI Mutation**:
   - **Status Code**: `200 OK`
   - **Response Body**:
     ```json
     {
       "phases": [
         { "id": "p1", "name": "FOUNDATION", "sub": "Core Infra", "accent": "emerald", "parentPhaseIds": [] },
         { "id": "p2", "name": "AUTH", "sub": "Identity Gateway", "accent": "blue", "parentPhaseIds": ["p1"] }
       ],
       "phaseEdges": [["p1", "p2"]],
       "nodes": [
         { "id": "n1", "phaseId": "p1", "code": "WPE-001", "title": "DB Schema", "status": "DONE", "joinPolicy": "ALL_COMPLETED" },
         { "id": "n2", "phaseId": "p2", "code": "WPE-002", "title": "JWT Auth", "status": "TODO", "joinPolicy": "ALL_COMPLETED" }
       ],
       "dependencies": [
         { "parentNodeId": "n1", "childNodeId": "n2" }
       ]
     }
     ```
   - **UI Mutation**: Dựng đồ thị canvas MacroWorkflow và chuẩn bị cây MindmapTree.

---

### 4.2 Thêm/Sửa/Xóa Phase & Lưu thứ tự hiển thị `order_index` (`POST/PUT/DELETE /api/projects/{id}/phases`)
1. **Mục tiêu Nghiệp vụ**: Tạo mới giai đoạn (Macro Phase), cập nhật tên, màu sắc, thứ tự `order_index` hoặc xóa Phase.
2. **Luồng Mã Nguồn**:
   - `src/components/workflow/CreatePhaseModal.tsx` / `MacroWorkflow.tsx` -> `useWorkflowStore` (`createPhase`, `spawnChildPhase`, `deletePhase`, `connectPhases`) -> `container.workflowService`.
3. **Request DTO**:
   - **POST**: `/api/projects/{id}/phases`, Body: `{ "name": "CORE ENGINE", "sub": "State Machine", "accent": "blue", "parentPhaseId": "p1", "orderIndex": 1 }`.
   - **DELETE**: `/api/projects/{id}/phases/{phaseId}`.
4. **Xử lý Backend & Bảng CSDL Tác động**:
   - Bảng tác động: `WORK_PHASE`, `NODE`.
   - Khi tạo: Chèn vào `WORK_PHASE`.
   - Khi xóa: Chuyển các Node thuộc Phase về dạng standalone hoặc xóa cascade theo cấu hình dự án.
5. **Response DTO & UI Mutation**:
   - **Status Code**: `201 Created` / `200 OK` / `204 No Content`.
   - **UI Mutation**: Cập nhật `macroPhases` và `workflowEdges` trong Zustand store, vẽ lại các đường nối Bézier curve.

---

### 4.3 Thêm Node & Nối cạnh quan hệ `NODE_DEPENDENCY` (`POST /api/projects/{id}/nodes`, `POST /api/projects/{id}/dependencies`)
1. **Mục tiêu Nghiệp vụ**: Khởi tạo nút công việc (`NODE`) mới, thiết lập mã Code, chính sách hội tụ (`join_policy`: `ALL_COMPLETED` hoặc `ANY_COMPLETED`), và nối mũi tên phụ thuộc.
2. **Luồng Mã Nguồn**:
   - `src/components/mindmap/AddNodeToolbar.tsx` -> `useWorkflowStore.updateTree` -> `container.workflowService`.
3. **Request DTO**:
   - Tạo Node: `POST /api/projects/{id}/nodes`, Body:
     ```json
     {
       "phaseId": "p2",
       "code": "WPE-003",
       "title": "OAuth2 Integration",
       "joinPolicy": "ALL_COMPLETED",
       "assignedUserId": "2",
       "dueDate": "2026-10-25T17:00:00Z"
     }
     ```
   - Nối cạnh: `POST /api/projects/{id}/dependencies`, Body: `{ "parentNodeId": "n1", "childNodeId": "n3" }`.
4. **Xử lý Backend & Bảng CSDL Tác động**:
   - Bảng tác động: `NODE`, `NODE_DEPENDENCY`.
   - Node mới được gán `status = 'LOCKED'` (nếu có parent nodes) hoặc `'TODO'` (nếu là root node). Khởi tạo `version = 0`.
   - Kiểm tra `parent_node_id != child_node_id` và Unique pair trên `NODE_DEPENDENCY`.
5. **Response DTO & UI Mutation**:
   - **Status Code**: `201 Created`.
   - **UI Mutation**: Nạp Node mới vào nhánh cây `trees[phaseId]`.

---

### 4.4 Lưu tọa độ vẽ Canvas vào JSONB `NODE.ui_metadata` (`PATCH /api/nodes/{id}/metadata`)
1. **Mục tiêu Nghiệp vụ**: Lưu vị trí tọa độ trực quan (`x, y, w, h, color`) của Node trên Canvas vào cột JSONB.
2. **Luồng Mã Nguồn**:
   - `src/components/mindmap/MindmapTree.tsx` (drag end) -> `useWorkflowStore.updateTree` -> `container.workflowService`.
3. **Request DTO**:
   - **Method & URL**: `PATCH /api/nodes/{id}/metadata`
   - **Headers**: `Authorization: Bearer <jwt>`, `Content-Type: application/json`
   - **Body JSON**:
     ```json
     {
       "position": { "x": 280, "y": 140 },
       "width": 220,
       "height": 90,
       "color": "emerald"
     }
     ```
4. **Xử lý Backend & Bảng CSDL Tác động**:
   - Bảng tác động: `NODE`.
   - Cập nhật trường JSONB: `UPDATE NODE SET ui_metadata = :metadata WHERE id = :id`.
5. **Response DTO & UI Mutation**:
   - **Status Code**: `200 OK`.
   - **UI Mutation**: Giữ nguyên vị trí thả của thẻ Node trên giao diện.

---

### 4.5 Kích hoạt dự án từ DRAFT sang ACTIVE (Chạy thuật toán Kahn chặn chu trình) (`POST /api/projects/{id}/publish`)
1. **Mục tiêu Nghiệp vụ**: Xuất bản quy trình từ bản thảo sang vận hành chính thức. Backend bắt buộc chạy Thuật toán Kahn (Topological Sorting) để phát hiện chu trình lặp (Cycle Detection). Nếu phát hiện vòng lặp kín, chặn đứng việc xuất bản và trả về danh sách các Node vi phạm.
2. **Luồng Mã Nguồn**:
   - `src/components/settings/GeneralSettingsSection.tsx` -> `useWorkflowStore.settings.publishPipeline` -> `container.workflowService.publishPipeline(projectId)` -> `IWorkflowService.publishPipeline(projectId: string): Promise<PublishPipelineResult>`.
3. **Request DTO**:
   - **Method & URL**: `POST /api/projects/{id}/publish`
   - **Headers**: `Authorization: Bearer <jwt>`
4. **Xử lý Backend & Bảng CSDL Tác động**:
   - Bảng tác động: `PROJECT`, `NODE`, `NODE_DEPENDENCY`.
   - Kiểm tra quyền: Chỉ `OWNER` mới có quyền publish.
   - **Thuật toán Kahn**:
     1. Khởi tạo danh sách In-degree của tất cả các Node trong dự án.
     2. Đưa toàn bộ các Node có `in-degree == 0` vào hàng đợi `Queue`.
     3. Trong khi `Queue` không rỗng: lấy node $u$ ra, tăng biến đếm `visitedCount += 1`. Với mỗi node con $v$ của $u$, giảm `in-degree(v) -= 1`. Nếu `in-degree(v) == 0`, đưa $v$ vào `Queue`.
     4. Nếu `visitedCount < totalNodes`: Tồn tại ít nhất một chu trình! Thu thập các Node còn `in-degree > 0` đưa vào `cycleNodes`. Trả về mã lỗi HTTP 422 Unprocessable Entity.
     5. Nếu `visitedCount == totalNodes`: Không có chu trình. Cập nhật `PROJECT.status = 'ACTIVE'`. Mở khóa các Node có `in-degree == 0` từ `LOCKED` sang `TODO`.
5. **Response DTO & UI Mutation**:
   - **Thành công (200 OK)**:
     ```json
     {
       "success": true,
       "status": "ACTIVE",
       "publishedAt": "2026-10-12T15:00:00Z",
       "unlockedTaskCount": 3
     }
     ```
     *UI Mutation*: Cập nhật trạng thái `settings.settings.status = 'ACTIVE'`, hiển thị Toast xanh "Dự án đã xuất bản thành công".
   - **Thất bại khi có chu trình (422 Unprocessable Entity)**:
     ```json
     {
       "timestamp": "2026-10-12T15:00:01Z",
       "status": 422,
       "error": "CYCLE_DETECTED",
       "message": "Phát hiện chu trình lặp phụ thuộc trong đồ thị quy trình. Không thể xuất bản.",
       "cycleNodes": ["WPE-002", "WPE-005"]
     }
     ```
     *UI Mutation*: Mở modal `KahnCycleModal.tsx`, hiển thị danh sách các mã Node vi phạm với hiệu ứng viền đỏ cảnh báo.

---

## Cụm 5: Thực Thi Công Việc Cá Nhân (My Tasks Kanban & FSM State Transition)

### 5.1 Lấy danh sách My Tasks cá nhân hóa theo `assigned_user_id` (`GET /api/projects/{id}/my-tasks`)
1. **Mục tiêu Nghiệp vụ**: Hiển thị bảng Kanban cá nhân hóa với 4 cột (`TODO`, `IN_PROGRESS`, `REVIEW`, `DONE`) cho người dùng hiện tại theo mô hình Direct Push (`assignedUserId === currentUserId`). Tuyệt đối loại bỏ các task `LOCKED`.
2. **Luồng Mã Nguồn**:
   - `src/components/kanban/PhaseKanbanBoard.tsx` / `usePhaseKanban.ts` -> `container.workflowService.getMyTasks(projectId, userId)` -> `IWorkflowService.getMyTasks`.
3. **Request DTO**:
   - **Method & URL**: `GET /api/projects/{id}/my-tasks?userId={userId}`
   - **Headers**: `Authorization: Bearer <jwt>`
4. **Xử lý Backend & Bảng CSDL Tác động**:
   - Bảng tác động: `NODE`.
   - Truy vấn: `SELECT * FROM NODE WHERE project_id = :id AND assigned_user_id = :userId AND status != 'LOCKED' ORDER BY due_date ASC`.
5. **Response DTO & UI Mutation**:
   - **Status Code**: `200 OK`. Body: `KanbanTask[]`.
   - **UI Mutation**: Phân bổ các task vào 4 cột tương ứng trên bảng Kanban.

---

### 5.2 Bắt đầu task (`TODO` -> `IN_PROGRESS`) & Hủy làm (`IN_PROGRESS` -> `TODO`)
1. **Mục tiêu Nghiệp vụ**: Người thực hiện bấm bắt đầu làm task hoặc hủy nhận làm task đưa về trạng thái chờ.
2. **Luồng Mã Nguồn**:
   - `src/components/kanban/TaskCard.tsx` -> `usePhaseKanban.moveTask` / `kanbanSlice.moveTask` -> đánh giá qua `evaluateTransition` -> `container.workflowService.updateTaskStatus(taskId, newStatus)`.
3. **Request DTO**:
   - **Method & URL**: `PATCH /api/nodes/{taskId}/status`
   - **Headers**: `Authorization: Bearer <jwt>`, `Content-Type: application/json`
   - **Body JSON**:
     ```json
     {
       "status": "IN_PROGRESS",
       "version": 0
     }
     ```
4. **Xử lý Backend & Bảng CSDL Tác động**:
   - Bảng tác động: `NODE`.
   - Kiểm tra Optimistic Locking: `NODE.version == request.version`. Nếu không khớp, trả về HTTP 409 Conflict.
   - Cập nhật `NODE.status = 'IN_PROGRESS'`, tăng `NODE.version = version + 1`.
5. **Response DTO & UI Mutation**:
   - **Status Code**: `200 OK`. Body: `KanbanTask`.
   - **UI Mutation**: Card di chuyển sang cột In Progress, cập nhật số version mới, hiển thị toast.

---

### 5.3 Nộp task chờ nghiệm thu (`IN_PROGRESS` -> `REVIEW`) kèm link Artifact tùy chọn
1. **Mục tiêu Nghiệp vụ**: Thành viên nộp sản phẩm hoàn thành để Chủ dự án nghiệm thu. Việc đính kèm Artifact (PR GitHub, Figma, Docs...) là **tùy chọn (Optional)**.
2. **Luồng Mã Nguồn**:
   - `src/components/kanban/SubmitArtifactModal.tsx` -> `usePhaseKanban.submitTaskArtifact` / `kanbanSlice.submitTaskArtifact` -> `container.workflowService.submitTaskArtifact(dto)` -> `IWorkflowService.submitTaskArtifact`.
3. **Request DTO**:
   - **Method & URL**: `POST /api/nodes/{taskId}/submit`
   - **Headers**: `Authorization: Bearer <jwt>`, `Content-Type: application/json`
   - **Body JSON**:
     ```json
     {
       "taskId": "n2",
       "artifact": {
         "title": "Pull Request #42",
         "type": "PR",
         "url": "https://github.com/org/repo/pull/42",
         "isPublicForGuest": true
       },
       "version": 1
     }
     ```
4. **Xử lý Backend & Bảng CSDL Tác động**:
   - Bảng tác động: `NODE`, `ARTIFACTS`, `NOTIFICATION`.
   - Kiểm tra `NODE.status == 'IN_PROGRESS'` và `version`.
   - Cập nhật `NODE.status = 'REVIEW'`, `NODE.reject_reason = NULL`, tăng `version`.
   - Nếu có `artifact`: Chèn bản ghi mới vào bảng `ARTIFACTS`.
   - Tạo thông báo `NOTIFICATION` gửi cho Project Owner.
5. **Response DTO & UI Mutation**:
   - **Status Code**: `200 OK`. Body: `{ "task": KanbanTask, "artifact": ArtifactItem | null }`.
   - **UI Mutation**: Đóng modal, chuyển task sang cột In Review, hiển thị toast thông báo.

---

### 5.4 Nghiệm thu duyệt task (`REVIEW` -> `DONE`) - Chỉ OWNER, áp dụng JPA `@Version` (`version`)
1. **Mục tiêu Nghiệp vụ**: Cổng nghiệm thu nghiêm ngặt (Strict Review Gate). Duy nhất tài khoản có vai trò `OWNER` mới có quyền duyệt task hoàn thành. Khi duyệt thành công, task bị đóng băng (`draggable = false`).
2. **Luồng Mã Nguồn**:
   - `src/components/kanban/TaskDetailModal.tsx` -> `usePhaseKanban.moveTask(taskId, 'DONE')` -> `container.workflowService.updateTaskStatus(taskId, 'DONE')`.
3. **Request DTO**:
   - **Method & URL**: `PATCH /api/nodes/{taskId}/status`
   - **Headers**: `Authorization: Bearer <jwt>`, `Content-Type: application/json`
   - **Body JSON**:
     ```json
     {
       "status": "DONE",
       "version": 2
     }
     ```
4. **Xử lý Backend & Bảng CSDL Tác động**:
   - Bảng tác động: `NODE`, `PROJECT_MEMBER`.
   - Kiểm tra RBAC: Caller bắt buộc là `OWNER` của dự án.
   - Kiểm tra Optimistic Locking: Đối soát `@Version` (`NODE.version == request.version`). Nếu có người khác cập nhật trước -> trả về HTTP 409 Conflict.
   - Cập nhật `NODE.status = 'DONE'`, tăng `NODE.version`.
   - **Xử lý Bất đồng bộ (RabbitMQ)**: Service gọi `workflowEventPublisher.publishTaskCompleted(event)` bắn sự kiện vào exchange `wpe.workflow.exchange` (routing key `wpe.task.completed`). REST API lập tức trả về HTTP 200 OK cho Owner (< 20ms) mà không bị giữ kết nối.
5. **Response DTO & UI Mutation**:
   - **Status Code**: `200 OK`. Body: `KanbanTask`.
   - **UI Mutation**: Task chuyển sang cột Done, khóa kéo thả (`draggable = false`), hiển thị badge xanh "Approved".

---

### 5.5 Từ chối nghiệm thu (`REVIEW` -> `IN_PROGRESS`) bắt buộc nhập `reject_reason`
1. **Mục tiêu Nghiệp vụ**: Chủ dự án từ chối kết quả nộp và yêu cầu thành viên làm lại. **Bắt buộc nhập lý do vào `reject_reason`**.
2. **Luồng Mã Nguồn**:
   - `src/components/kanban/TaskDetailModal.tsx` -> `usePhaseKanban.moveTask(taskId, 'IN_PROGRESS', rejectReason)` -> `container.workflowService.updateTaskStatus(taskId, 'IN_PROGRESS', rejectReason)`.
3. **Request DTO**:
   - **Method & URL**: `PATCH /api/nodes/{taskId}/status`
   - **Headers**: `Authorization: Bearer <jwt>`, `Content-Type: application/json`
   - **Body JSON**:
     ```json
     {
       "status": "IN_PROGRESS",
       "rejectReason": "Thiếu unit test cho phần kiểm tra JWT rotation và refresh token.",
       "version": 2
     }
     ```
4. **Xử lý Backend & Bảng CSDL Tác động**:
   - Bảng tác động: `NODE`, `NOTIFICATION`.
   - Kiểm tra caller là `OWNER`.
   - Kiểm tra `rejectReason` không được rỗng (nếu rỗng -> trả về HTTP 400 Bad Request).
   - Cập nhật `NODE.status = 'IN_PROGRESS'`, `NODE.reject_reason = :rejectReason`, tăng `version`.
   - Bắn `NotificationEvent` vào RabbitMQ (`wpe.notification.rejected`) gửi cho `assigned_user_id` kèm lý do yêu cầu sửa.
5. **Response DTO & UI Mutation**:
   - **Status Code**: `200 OK`. Body: `KanbanTask`.
   - **UI Mutation**: Task chuyển về cột In Progress, hiển thị banner đỏ kèm nội dung `reject_reason`.

---

### 5.6 Engine tự mở khóa downstream nodes (AND/OR Join) qua RabbitMQ Worker
1. **Mục tiêu Nghiệp vụ**: Khi task cha hoàn thành (`DONE`), Execution Engine tự động kiểm tra đồ thị `NODE_DEPENDENCY`, xét duyệt điều kiện hội tụ (AND-join / OR-join). Nếu thỏa mãn, tự động chuyển con từ `LOCKED` sang `TODO` và đẩy thông báo.
2. **Luồng Mã Nguồn**:
   - Tiến trình xử lý ngầm (Event-Driven via RabbitMQ): `WorkflowEventConsumer.handleTaskCompleted` lắng nghe hàng đợi `wpe.task.completed.queue` ngay sau khi giao dịch của 5.4 bắn event.
3. **Logic Xử lý Tại Backend & Bảng CSDL Tác động**:
   - Bảng tác động: `NODE_DEPENDENCY`, `NODE`, `NOTIFICATION`.
   - Tìm danh sách các task con: `SELECT child_node_id FROM NODE_DEPENDENCY WHERE parent_node_id = :doneTaskId`.
   - Với mỗi task con:
     - Lấy danh sách tất cả các task cha và đọc `join_policy`:
       - `ALL_COMPLETED` (AND-join): Tất cả task cha phải có `status = 'DONE'`.
       - `ANY_COMPLETED` (OR-join): Có ít nhất một task cha có `status = 'DONE'`.
     - Nếu thỏa mãn:
       - Cập nhật `UPDATE NODE SET status = 'TODO', updated_at = NOW() WHERE id = :childId`.
       - Bắn `NotificationEvent` vào RabbitMQ gửi cho `assigned_user_id`: "Tác vụ [Title] đã sẵn sàng để thực hiện!".
       - Đẩy sự kiện Real-time `TASK_UNLOCKED` qua `SseEmitterService` xuống trực tiếp phiên làm việc của `assigned_user_id`.
4. **Response DTO & UI Mutation**:
   - Dữ liệu đẩy thời gian thực qua `SseEmitter`: Frontend lắng nghe qua `EventSource` bắt sự kiện `TASK_UNLOCKED`, tự động đưa thẻ task vào cột TODO và nảy Toast thông báo xanh mà **không cần reload (F5) trang**.

---

### 5.7 Đăng ký kênh Real-time Stream Server-Sent Events (`GET /api/v1/realtime/subscribe?userId={userId}`)
1. **Mục tiêu Nghiệp vụ**: Thiết lập đường ống truyền dữ liệu thời gian thực 1 chiều từ Spring Boot xuống trình duyệt Client. Khi có sự kiện mở khóa task, đổi trạng thái Kanban, hoặc có thông báo chuông, Server lập tức phát tín hiệu xuống Client đang mở.
2. **Luồng Mã Nguồn**:
   - `src/components/common/NotificationBell.tsx` / `PhaseKanbanBoard.tsx` -> Khởi tạo `new EventSource('/api/v1/realtime/subscribe?userId=' + currentUser.id)` -> Lắng nghe các event: `TASK_UNLOCKED`, `TASK_STATUS_CHANGED`, `NOTIFICATION_RECEIVED`.
3. **Request DTO**:
   - **Method & URL**: `GET /api/v1/realtime/subscribe?userId={userId}`
   - **Headers**: `Accept: text/event-stream`
4. **Xử lý Backend**:
   - Khởi tạo đối tượng `SseEmitter` với thời gian sống (timeout 30 phút).
   - Lưu trữ `emitter` vào `ConcurrentHashMap<Long, SseEmitter>` trong `SseEmitterService`.
   - Đăng ký hook dọn dẹp `onCompletion`, `onTimeout`, `onError` để gỡ bỏ khi tab trình duyệt đóng.
   - Gửi sự kiện khởi tạo ban đầu: `data: "Connected successfully"`.
5. **Response Stream & UI Mutation**:
   - **Status Code**: `200 OK` (Content-Type: `text/event-stream`).
   - **Cấu trúc sự kiện đẩy xuống**:
     ```text
     event: TASK_UNLOCKED
     data: {"id":"4","code":"WPE-004","title":"Kahn Algorithm DAG","status":"TODO","version":0}
     ```
   - **UI Mutation**: Frontend tự động cập nhật State trong Zustand Store (`useWorkflowStore`), vẽ lại card trên cột TODO và phát âm thanh/hiệu ứng chuông thông báo.
   - **Hợp đồng Deep-Link Chuông Thông Báo (Notification Bell Deep-Link Contract)**:
     - Mọi bản ghi `NOTIFICATION` sinh ra từ lời mời tham gia dự án mang trường `link_url = /workspace?action=open-invite-modal&invitationId={id}`.
     - Khi người dùng click vào dòng thông báo trên `NotificationBell.tsx`, bộ định tuyến UI (UI Router / Event Handler) **bắt buộc chặn điều hướng trang mặc định (Prevent Full-page Reload)**, trích xuất `invitationId` từ query params và kích hoạt mở trực tiếp `ProjectInviteAcceptModal.tsx` để người dùng xác nhận Accept / Decline.

---

## Cụm 6: Kho Tài Nguyên & Minh Chứng Dự Án (Artifacts Hub)

### 6.1 Lấy danh sách link kho chung & link theo task (`GET /api/projects/{id}/artifacts`)
1. **Mục tiêu Nghiệp vụ**: Liệt kê toàn bộ liên kết tài nguyên ngoài (Figma, GitHub PR, Swagger, Docs) của dự án hoặc theo từng task. Tuyệt đối không lưu file vật lý trên server.
2. **Luồng Mã Nguồn**:
   - `src/components/settings/ProjectResourcesSection.tsx` -> `useWorkflowStore.settings.load` -> `container.workflowService.getProjectSettings(projectId)`.
3. **Request DTO**:
   - **Method & URL**: `GET /api/projects/{id}/artifacts`
   - **Query Params**: `nodeId={optional}`
   - **Headers**: `Authorization: Bearer <jwt>`
4. **Xử lý Backend & Bảng CSDL Tác động**:
   - Bảng tác động: `ARTIFACTS`, `USERS`.
   - Truy vấn `ARTIFACTS` theo `project_id`. JOIN `USERS` để lấy thông tin người upload.
5. **Response DTO & UI Mutation**:
   - **Status Code**: `200 OK`. Body: `ArtifactItem[]`.
   - **UI Mutation**: Hiển thị bảng danh mục tài nguyên kèm icon phân loại (Figma, GitHub, Swagger...).

---

### 6.2 Thêm mới link tài nguyên ngoài độc lập (`POST /api/projects/{id}/artifacts`)
1. **Mục tiêu Nghiệp vụ**: Thêm liên kết tài nguyên ngoài cấp dự án độc lập với việc nộp task.
2. **Luồng Mã Nguồn**:
   - `src/components/settings/ProjectResourcesSection.tsx` -> Modal Thêm liên kết -> API tạo Artifact.
3. **Request DTO**:
   - **Method & URL**: `POST /api/projects/{id}/artifacts`
   - **Headers**: `Authorization: Bearer <jwt>`, `Content-Type: application/json`
   - **Body JSON**:
     ```json
     {
       "name": "Figma Master Design",
       "type": "FIGMA",
       "url": "https://www.figma.com/design/sample-project-id",
       "isPublicForGuest": true
     }
     ```
4. **Xử lý Backend & Bảng CSDL Tác động**:
   - Bảng tác động: `ARTIFACTS`.
   - Kiểm tra định dạng URL (Regex URL). Chèn vào `ARTIFACTS` (`uploaded_by = currentUserId`).
5. **Response DTO & UI Mutation**:
   - **Status Code**: `201 Created`. Body: `ArtifactItem`.
   - **UI Mutation**: Nạp liên kết vào danh sách, hiển thị Toast xanh.

---

## Cụm 7: Cổng Chia Sẻ Công Khai Cho Khách & Giáo Viên (Guest Share Gateway)

### 7.1 Sinh & Thu hồi Token chia sẻ 64 ký tự (`POST/DELETE /api/projects/{id}/guest-token`)
1. **Mục tiêu Nghiệp vụ**: Chủ dự án sinh chuỗi token ngẫu nhiên bảo mật 64 ký tự cho khách ngoài xem tiến độ (Read-only); hoặc thu hồi liên kết khi cần đóng quyền truy cập.
2. **Luồng Mã Nguồn**:
   - `src/components/overview/OverviewHeader.tsx` -> `useWorkflowStore.overview` (`generateGuest`, `revokeGuest`) -> `container.workflowService` (`generateGuestToken`, `toggleGuestAccess`).
3. **Request DTO**:
   - Sinh token: `POST /api/projects/{id}/guest-token`, Body: `{ "expiryDays": 30 }`.
   - Thu hồi: `DELETE /api/projects/{id}/guest-token`.
4. **Xử lý Backend & Bảng CSDL Tác động**:
   - Bảng tác động: `GUEST_LINK`.
   - Kiểm tra caller là `OWNER`.
   - Khi sinh: Sinh chuỗi hex 64 ký tự ngẫu nhiên bằng `SecureRandom`. Chèn/cập nhật `GUEST_LINK` (`token`, `is_revoked = FALSE`, `expires_at = NOW() + 30 days`).
   - Khi thu hồi: Cập nhật `GUEST_LINK.is_revoked = TRUE`.
5. **Response DTO & UI Mutation**:
   - **Status Code**: `200 OK`. Body: `GuestAccessState` (`{ "enabled": true, "token": "...", "shareUrl": "...", "expiresAt": "..." }`).
   - **UI Mutation**: Hiển thị liên kết chia sẻ và nút Copy Link trên thanh công cụ Overview.

---

### 7.2 Khách truy cập Read-only qua link Token (`GET /api/guest/{token}/overview`)
1. **Mục tiêu Nghiệp vụ**: Giáo viên hoặc khách ngoài truy cập trực tiếp qua Token để xem tiến độ, số liệu KPI và báo cáo AI mà không cần đăng nhập.
2. **Luồng Mã Nguồn**:
   - `src/views/GuestView.tsx` -> `container.guestService.getOverview(token)` -> `IGuestService.getOverview(token: string): Promise<GuestOverviewDto>`.
3. **Request DTO**:
   - **Method & URL**: `GET /api/guest/{token}/overview`
   - Không yêu cầu Header Authorization.
4. **Xử lý Backend & Bảng CSDL Tác động**:
   - Bảng tác động: `GUEST_LINK`, `PROJECT`, `NODE`, `ARTIFACTS`.
   - Kiểm tra `token`: tồn tại, `is_revoked == FALSE`, `expires_at > NOW()`. Nếu không thỏa mãn -> trả về HTTP 403 Forbidden.
   - Nạp dữ liệu dự án và các Artifacts có cờ `is_public_for_guest = TRUE`.
5. **Response DTO & UI Mutation**:
   - **Status Code**: `200 OK`. Body: `GuestOverviewDto`.
   - **UI Mutation**: Render giao diện khách ngoài chỉ đọc (Read-only view), ẩn toàn bộ các nút chỉnh sửa cấu trúc.

---

## Cụm 8: Luồng Tiếp Thu Ý Kiến 1 Chiều (Feedback Queue)

### 8.1 Khách gửi nhận xét 1 chiều vào task/project (`POST /api/guest/{token}/feedback`)
1. **Mục tiêu Nghiệp vụ**: Khách/Giáo viên để lại nhận xét đóng góp vào dự án hoặc vào một task cụ thể. **Quy tắc tiếp thu 1 chiều**: Nhóm thực thi chỉ ghi nhận và giải quyết, tuyệt đối không có cơ chế tranh luận ngược lại.
2. **Luồng Mã Nguồn**:
   - `src/views/GuestView.tsx` -> `container.guestService.submitFeedback(token, cmd)` -> `IGuestService.submitFeedback`.
3. **Request DTO**:
   - **Method & URL**: `POST /api/guest/{token}/feedback`
   - **Body JSON**:
     ```json
     {
       "reviewerName": "TS. Nguyen Van A",
       "reviewerRole": "TEACHER",
       "content": "Cần bổ sung thêm sơ đồ Sequence Diagram cho module JWT Rotation.",
       "nodeId": "n2"
     }
     ```
4. **Xử lý Backend & Bảng CSDL Tác động**:
   - Bảng tác động: `PROJECT_FEEDBACK`, `GUEST_LINK`, `NOTIFICATION`.
   - Xác thực token hợp lệ trong `GUEST_LINK`.
   - Chèn vào `PROJECT_FEEDBACK` (`status = 'OPEN'`).
   - Gửi thông báo `NOTIFICATION` cho Project Owner.
5. **Response DTO & UI Mutation**:
   - **Status Code**: `201 Created`. Body: `GuestFeedbackDto`.
   - **UI Mutation**: Hiển thị thông báo cảm ơn trên màn hình khách.

---

### 8.2 Nhóm xem danh sách feedback trên Overview (`GET /api/projects/{id}/feedbacks`)
1. **Mục tiêu Nghiệp vụ**: Hiển thị danh sách các góp ý từ Giáo viên/Khách ngoài trên thẻ Feedback Queue của màn hình Tổng quan.
2. **Luồng Mã Nguồn**:
   - `src/components/overview/FeedbackQueueCard.tsx` -> `useWorkflowStore.overview.load(projectId)` -> `container.workflowService.getOverviewData(projectId)`.
3. **Request DTO**:
   - **Method & URL**: `GET /api/projects/{id}/feedbacks`
   - **Headers**: `Authorization: Bearer <jwt>`
4. **Xử lý Backend & Bảng CSDL Tác động**:
   - Bảng tác động: `PROJECT_FEEDBACK`.
   - Truy vấn: `SELECT * FROM PROJECT_FEEDBACK WHERE project_id = :id ORDER BY created_at DESC`.
5. **Response DTO & UI Mutation**:
   - **Status Code**: `200 OK`. Body: `FeedbackItem[]`.
   - **UI Mutation**: Hiển thị các thẻ góp ý, phân loại nhãn TEACHER / GUEST.

---

### 8.3 Nhóm đánh dấu giải quyết `OPEN` -> `RESOLVED` (tuyệt đối không trả lời lời lại) (`PATCH /api/projects/{id}/feedbacks/{id}/resolve`)
1. **Mục tiêu Nghiệp vụ**: Thành viên dự án tiếp thu ý kiến, hoàn thiện công việc và bấm "Đánh dấu Đã xử lý" để đóng góp ý. Không có ô nhập tin nhắn phản hồi lại.
2. **Luồng Mã Nguồn**:
   - `src/components/overview/FeedbackQueueCard.tsx` -> `useWorkflowStore.overview.resolveFeedback(feedbackId)` -> `container.workflowService.resolveFeedback(projectId, feedbackId)`.
3. **Request DTO**:
   - **Method & URL**: `PATCH /api/projects/{id}/feedbacks/{feedbackId}/resolve`
   - **Headers**: `Authorization: Bearer <jwt>`
4. **Xử lý Backend & Bảng CSDL Tác động**:
   - Bảng tác động: `PROJECT_FEEDBACK`.
   - Cập nhật: `UPDATE PROJECT_FEEDBACK SET status = 'RESOLVED' WHERE id = :feedbackId`.
5. **Response DTO & UI Mutation**:
   - **Status Code**: `200 OK` `{ "success": true, "feedbackId": "fb-1", "status": "RESOLVED" }`.
   - **UI Mutation**: Chuyển thẻ góp ý sang trạng thái Resolved, gạch ngang nội dung, hiển thị toast xanh.

---

## Cụm 9: Phân Hệ Chẩn Đoán AI Bấm Nút Chủ Động (On-Demand AI Diagnosis)

### 9.1 Lấy bản ghi phân tích đã lưu từ JSONB `PROJECT.latest_ai_analysis` (`GET /api/projects/{id}/ai-analysis`)
1. **Mục tiêu Nghiệp vụ**: Đọc dữ liệu phân tích AI đã được cache sẵn trong CSDL với độ trễ 1ms khi mở Overview. Tuyệt đối không gọi Gemini API khi tải trang (Page Load).
2. **Luồng Mã Nguồn**:
   - `src/components/overview/ProjectOverview.tsx` -> `useWorkflowStore.overview.load` -> `container.workflowService.getOverviewData(projectId)`.
3. **Request DTO**:
   - **Method & URL**: `GET /api/projects/{id}/ai-analysis`
   - **Headers**: `Authorization: Bearer <jwt>`
4. **Xử lý Backend & Bảng CSDL Tác động**:
   - Bảng tác động: `PROJECT`.
   - Đọc cột `PROJECT.latest_ai_analysis` (JSONB).
5. **Response DTO & UI Mutation**:
   - **Status Code**: `200 OK`. Body: `AiAnalysisResult` (chứa `bottlenecks`, `taskTraps`, `criticalPath`, `actionableAdvice`, `analyzedAt`).
   - **UI Mutation**: Render các widget phân tích AI thông minh trên Overview.

---

### 9.2 Bấm nút "AI Diagnosis" kích hoạt phân tích mới (có Cooldown 3-5 phút) (`POST /api/projects/{id}/ai-diagnostics`)
1. **Mục tiêu Nghiệp vụ**: Người dùng bấm nút chủ động yêu cầu AI phân tích lại đồ thị quy trình. Backend kiểm tra hạn mức Cooldown (3-5 phút) để tránh lãng phí Token và spam API.
2. **Luồng Mã Nguồn**:
   - `src/components/overview/OverviewHeader.tsx` (Nút "AI Diagnostics") -> Action kích hoạt chẩn đoán -> `container.workflowService`.
3. **Request DTO**:
   - **Method & URL**: `POST /api/projects/{id}/ai-diagnostics`
   - **Headers**: `Authorization: Bearer <jwt>`
4. **Xử lý Backend & Bảng CSDL Tác động**:
   - Bảng tác động: `PROJECT`, `NODE`, `NODE_DEPENDENCY`, `PROJECT_FEEDBACK`.
   - Kiểm tra Cooldown: Nếu `NOW() - latest_ai_analysis.analyzedAt < 3 phút` -> trả về HTTP 429 Too Many Requests kèm số giây còn lại.
   - Nếu đủ điều kiện: Thu thập dữ liệu toàn bộ Nodes, Dependencies, Feedback chưa giải quyết.
   - Gửi Request tới Google Gemini API (`gemini-1.5-flash`), yêu cầu trả về theo JSON Schema chuẩn (Bottlenecks, Task Traps, CPM Path, Actionable Advice).
   - Ghi đè kết quả vào `PROJECT.latest_ai_analysis`.
5. **Response DTO & UI Mutation**:
   - **Status Code**: `200 OK`. Body: `AiAnalysisResult`.
   - **UI Mutation**: Cập nhật thông số AI trên Overview, bắt đầu đồng hồ đếm ngược Cooldown trên nút bấm.

---

## Cụm 10: Quản Trị Hệ Thống & Template Studio (Admin Portal)

### 10.1 Quản lý người dùng, che email/IP, khóa/mở tài khoản (`GET/POST /api/admin/users/*`)
1. **Mục tiêu Nghiệp vụ**: Quản trị viên hệ thống (Super Admin) xem danh sách người dùng toàn sàn với cơ chế che dữ liệu nhạy cảm (Data Masking: `a***@domain.com`), tạm khóa tài khoản vi phạm và mở khóa.
2. **Luồng Mã Nguồn**:
   - `src/features/admin/tabs/AdminUsersTab.tsx` -> `useAdminPortal` (`suspendUser`, `unbanUser`) -> `container.adminService.getUsers()`, `suspendUser()`, `unbanUser()` -> `IAdminService`.
3. **Request DTO**:
   - Lấy danh sách: `GET /api/admin/users?query=&status=`, Headers: `Authorization: Bearer <jwt>` (Role: ADMIN).
   - Tạm khóa: `POST /api/admin/users/{id}/suspend`, Body: `{ "reason": "Vi phạm chính sách bảo mật", "durationDays": 7 }`.
   - Mở khóa: `POST /api/admin/users/{id}/unban`.
4. **Xử lý Backend & Bảng CSDL Tác động**:
   - Bảng tác động: `USERS`, `REFRESH_TOKEN`.
   - Kiểm tra quyền: Caller bắt buộc có `system_role == 'ADMIN'`. Không cho phép khóa tài khoản Super Admin.
   - Khi Suspend: Cập nhật `USERS.is_locked = TRUE`, tăng `USERS.token_version += 1` (thu hồi tức thì mọi phiên đăng nhập). Đánh dấu toàn bộ `REFRESH_TOKEN.revoked = TRUE`.
   - Khi Unban: Cập nhật `USERS.is_locked = FALSE`.
5. **Response DTO & UI Mutation**:
   - **Status Code**: `200 OK`. Body: `AdminUserDto`.
   - **UI Mutation**: Cập nhật badge trạng thái người dùng (Active / Suspended), hiển thị Toast thông báo.

---

### 10.2 Admin lưu trữ/dọn dẹp dự án không hoạt động (`POST /api/admin/workspaces/{id}/archive`)
1. **Mục tiêu Nghiệp vụ**: Quản trị viên rà soát các dự án không hoạt động và chuyển sang trạng thái lưu trữ (`ARCHIVED`). Tuyệt đối không đọc trộm nội dung Task bên trong dự án.
2. **Luồng Mã Nguồn**:
   - `src/features/admin/tabs/AdminWorkspacesTab.tsx` -> `useAdminPortal.archiveWorkspace` -> `container.adminService.archiveWorkspace(workspaceId)`.
3. **Request DTO**:
   - **Method & URL**: `POST /api/admin/workspaces/{workspaceId}/archive`
   - **Headers**: `Authorization: Bearer <jwt>` (Role: ADMIN)
4. **Xử lý Backend & Bảng CSDL Tác động**:
   - Bảng tác động: `PROJECT`.
   - Kiểm tra quyền ADMIN. Cập nhật `PROJECT.status = 'ARCHIVED'`, `updated_at = NOW()`.
5. **Response DTO & UI Mutation**:
   - **Status Code**: `200 OK`. Body: `WorkspaceOverviewDto`.
   - **UI Mutation**: Cập nhật trạng thái workspace thành ARCHIVED, cập nhật số liệu KPI hệ thống.

---

### 10.3 CRUD Template chuẩn hệ thống & Lưu đồ thị DAG 2 tầng (`GET/POST/PUT/DELETE /api/templates/*`)
1. **Mục tiêu Nghiệp vụ**: Quản trị viên thiết kế, lưu trữ, chỉnh sửa và nhân bản các mẫu quy trình công việc chuẩn 2 tầng (Macro Phases và Detail Nodes) với danh mục đa dạng (Software Engineering, Marketing, DevOps, General).
2. **Luồng Mã Nguồn**:
   - `src/features/admin/templates/TemplateStudioView.tsx` / `TemplateCatalogView.tsx` -> `useTemplateStudio` (`save`, `loadTemplate`, `validate`) -> `container.templateService` (`getTemplates`, `createTemplate`, `updateTemplate`, `deleteTemplate`, `validateGraph`) -> `ITemplateService`.
3. **Request DTO**:
   - **Method & URL**: `POST /api/templates`, `PUT /api/templates/{id}`
   - **Headers**: `Authorization: Bearer <jwt>`, `Content-Type: application/json`
   - **Body JSON**:
     ```json
     {
       "name": "Standard Software Development (SDLC)",
       "description": "Standard 4-phase agile software delivery workflow",
       "category": "Software Engineering",
       "isSystemStandard": true,
       "graphData": {
         "phases": [
           { "id": "ph-1", "name": "Foundation", "order": 0, "rootNodeId": "nd-1", "uiMetadata": { "position": { "x": 40, "y": 60 } } }
         ],
         "phaseEdges": [],
         "nodes": [
           { "id": "nd-1", "phaseId": "ph-1", "parentId": null, "trackId": null, "title": "System Architecture", "description": "", "level": 0, "joinPolicy": "ALL_COMPLETED", "uiMetadata": { "position": { "x": 0, "y": 0 } } }
         ],
         "edges": [],
         "metadata": { "version": "1.0" }
       }
     }
     ```
4. **Xử lý Backend & Bảng CSDL Tác động**:
   - Bảng tác động: `PIPELINE_TEMPLATE`.
   - Chạy Thuật toán Kahn trên `graphData` để thẩm định không có chu trình.
   - Lưu trữ toàn bộ đồ thị 2 tầng vào cột JSONB `PIPELINE_TEMPLATE.graph_data`.
5. **Response DTO & UI Mutation**:
   - **Status Code**: `201 Created` / `200 OK`. Body: `TemplateDetailDto`.
   - **UI Mutation**: Cập nhật Catalog, phát sự kiện `wpe_template_updated` làm mới danh mục, hiển thị Toast xanh.

---

# CHƯƠNG III: CHUẨN MỰC XỬ LÝ LỖI & MÃ PHẢN HỒI (HTTP ERROR CONTRACTS)

## 3.1 Cấu trúc Chuẩn JSON Error Payload

Toàn bộ các ngoại lệ tại Backend Spring Boot phải được xử lý qua `@RestControllerAdvice` (GlobalExceptionHandler) và trả về theo cấu trúc chuẩn RFC-7807 mở rộng:

```json
{
  "timestamp": "2026-10-12T15:30:00.123Z",
  "status": 409,
  "error": "OPTIMISTIC_LOCK_CONFLICT",
  "message": "Dữ liệu tác vụ đã bị thay đổi bởi một thành viên khác. Vui lòng làm mới trang.",
  "path": "/api/nodes/15/status",
  "validationErrors": [
    {
      "field": "version",
      "rejectedValue": 2,
      "reason": "Current version in database is 3"
    }
  ]
}
```

## 3.2 Ma trận Ánh xạ Mã lỗi HTTP vào UI Frontend

| HTTP Status | Mã Lỗi (Error Code) | Nguyên Nhân Kỹ Thuật | Phản Hồi Trên Giao Diện Frontend |
| :--- | :--- | :--- | :--- |
| **`400 Bad Request`** | `VALIDATION_FAILED` | Dữ liệu đầu vào không hợp lệ (ví dụ: `reject_reason` để trống khi từ chối nghiệm thu, tên dự án trống). | Hiển thị thông báo lỗi dưới chân input hoặc Toast đỏ (`tone: 'rose'`). |
| **`401 Unauthorized`** | `TOKEN_EXPIRED` / `BAD_CREDENTIALS` | JWT Access Token hết hạn, chữ ký không hợp lệ hoặc sai mật khẩu. | Kích hoạt tự động gọi `/api/auth/refresh`. Nếu thất bại, chuyển hướng về AuthModal/AuthView. |
| **`403 Forbidden`** | `ACCESS_DENIED` / `REVOKED_GUEST` | Không đủ quyền RBAC (ví dụ: Collaborator cố tình duyệt task sang DONE), hoặc Guest Link đã bị thu hồi. | Hiển thị Toast cảnh báo: "Bạn không có quyền thực hiện hành động này." |
| **`404 Not Found`** | `RESOURCE_NOT_FOUND` | Không tìm thấy Project, Node, Phase hoặc User với ID được yêu cầu. | Hiển thị Toast lỗi hoặc chuyển sang EmptyState placeholder. |
| **`409 Conflict`** | `OPTIMISTIC_LOCK_CONFLICT` | Vi phạm khóa lạc quan JPA `@Version` trên entity `NODE` (2 người cùng thao tác trên 1 task). | Hiển thị Toast vàng/đỏ: "Xung đột dữ liệu: Tác vụ đã được cập nhật bởi thành viên khác. Đang tải lại...", tự động nạp lại dữ liệu task. |
| **`422 Unprocessable`** | `CYCLE_DETECTED` | Thuật toán Kahn phát hiện chu trình lặp phụ thuộc khi xuất bản dự án hoặc lưu template. | Mở `KahnCycleModal.tsx`, hiển thị danh sách các mã node gây vòng lặp với viền đỏ nổi bật. |
| **`429 Too Many Requests`**| `COOLDOWN_ACTIVE` | Bấm nút chẩn đoán AI khi chưa hết thời gian giãn cách 3-5 phút. | Hiển thị Toast cảnh báo thời gian cooldown còn lại, khóa nút bấm tạm thời. |
| **`500 Internal Error`**| `INTERNAL_SERVER_ERROR`| Lỗi máy chủ không mong muốn hoặc sự cố cơ sở dữ liệu. | Hiển thị Toast đỏ: "Hệ thống gặp sự cố. Vui lòng thử lại sau giây lát." |

---

> **KẾT LUẬN & CAM KẾT CHẤT LƯỢNG**:
> Bản đồ tích hợp này là **Hợp đồng Bất biến (Immutable Contract)** giữa Frontend và Backend. Bất kỳ sự thay đổi nào về Endpoint, DTO Payload hay Mã lỗi đều phải được cập nhật đồng bộ vào tài liệu này trước khi chỉnh sửa mã nguồn.
