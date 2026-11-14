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
       "password": "example-StrongPass123!",
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
       "token": "example-access-token-jwt",
       "refreshToken": "example-refresh-token",
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
       "token": "example-access-token-jwt",
       "refreshToken": "example-refresh-token",
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
   - `POST /api/auth/refresh`: Body `{ "refreshToken": "example-refresh-token" }`.
   - `POST /api/auth/logout`: Header `Authorization: Bearer <jwt>`, Body `{ "refreshToken": "rt_..." }`.
4. **Xử lý Backend & Bảng CSDL Tác động**:
   - Bảng tác động: `REFRESH_TOKEN`.
   - Khi Refresh: Tra cứu `token_hash`. Kiểm tra `revoked == FALSE` và chưa hết hạn. Đánh dấu token cũ `revoked = TRUE`, tạo token mới. Nếu phát hiện token đã bị thu hồi từ trước mà vẫn gửi lại -> lập tức thu hồi toàn bộ token của người dùng đó (Phát hiện tấn công).
   - Khi Logout: Đánh dấu `REFRESH_TOKEN.revoked = TRUE`.
5. **Response DTO & UI Mutation**:
   - `POST /api/auth/refresh`: `200 OK` trả về cặp token mới, cùng dạng với response login (`{ token, refreshToken, user }`). Refresh token cũ bị thu hồi ngay, FE phải thay bằng token mới.
   - `POST /api/auth/logout`: `200 OK` `{ "success": true }`. Luôn 200 kể cả khi token không tồn tại hoặc thiếu body (idempotent).
   - **UI Mutation**: Xóa sạch storage, reset toàn bộ Zustand Store về initial state, chuyển hướng về trang đăng nhập.

### 1.4 Chốt hợp đồng sau A3 (mã lỗi, thời hạn, filter)
- **Đường dẫn**: mọi endpoint ở cả `/api/v1/auth/*` và `/api/auth/*`. `register` → 201, `login`/`refresh`/`logout` → 200. `user.id` luôn là **chuỗi**.
- **Body lỗi** (chung toàn hệ thống): `{ "timestamp", "status", "error": "<MÃ>", "message", "path" }`. FE xử lý theo trường `error`.

| Mã `error` | HTTP | Khi nào |
| :--- | :--- | :--- |
| `BAD_CREDENTIALS` | 401 | Sai mật khẩu **hoặc** không có user (cùng một thông báo, không lộ user có tồn tại). |
| `ACCOUNT_LOCKED` | 403 | `is_locked = true` (login, chỉ báo khi mật khẩu đúng; hoặc lúc refresh — khi đó mọi refresh token của user bị thu hồi). |
| `USERNAME_TAKEN` / `EMAIL_TAKEN` | 409 | Register trùng username / email. |
| `VALIDATION_FAILED` | 400 | Body register/login sai định dạng (kèm `validationErrors[]`). |
| `INVALID_REFRESH_TOKEN` | 401 | Refresh token không có, không tồn tại hoặc hết hạn. |
| `REFRESH_TOKEN_REUSED` | 401 | Gửi lại refresh token đã bị thu hồi (đã xoay hoặc đã logout) → backend thu hồi **mọi** refresh token của user. FE phải đăng xuất. |
| `TOKEN_EXPIRED` | 401 | API nghiệp vụ dùng `requireCurrentUserId()` mà request **có** `Authorization` nhưng access token sai/hết hạn/`tv` lệch/user khóa. FE gọi refresh một lần (single-flight) rồi thử lại. |

- **Access token**: JWT HS256, sống 15 phút (`jwt.access-token-expiration-ms`). Claims: `sub` = userId (chuỗi), `username`, `role` (`USER`/`ADMIN`), `tv` = `token_version`, `iat`, `exp`. Gửi qua header `Authorization: Bearer <token>`.
- **Refresh token**: `rt_` + 32 byte ngẫu nhiên base64url (tổng 46 ký tự), sống 7 ngày, dùng **một lần** (mỗi lần refresh nhận token mới). DB chỉ lưu SHA-256 hex. `rememberMe` không đổi thời hạn; FE tự chọn `localStorage` (nhớ) hay `sessionStorage`.
- **Hai request refresh song song bằng cùng một token**: request đến sau bị coi là dùng lại → `REFRESH_TOKEN_REUSED` và mọi phiên bị thu hồi. FE **bắt buộc** single-flight (A4).
- **JwtAuthFilter (trước X1)**: token sai **không** bị chặn ở filter (vẫn `permitAll`), chỉ không đặt principal. Request không có `Authorization` vẫn dùng `X-Debug-User-Id`/user mặc định cho tới X1; có `Authorization` sai thì không rơi về user debug.
- **Secret**: `jwt.secret` đọc biến môi trường `JWT_SECRET` (>= 32 byte); giá trị mặc định trong `application.yml` chỉ cho máy dev.

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
       "newPassword": "example-NewStrongPass456!"
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
   - Bảng tác động (chỉ đọc): `PROJECT`, `WORK_PHASE`, `NODE`, `NODE_DEPENDENCY`, `PHASE_DEPENDENCY`.
   - Quyền: owner hoặc thành viên của dự án. Dự án `ARCHIVED` vẫn đọc được.
   - Truy vấn danh sách `WORK_PHASE` sắp xếp theo `order_index`.
   - Truy vấn toàn bộ `NODE` và các liên kết phụ thuộc `NODE_DEPENDENCY` trong dự án.
   - Truy vấn toàn bộ cạnh `PHASE_DEPENDENCY` của dự án; `parentPhaseIds` gộp từ bảng này và cột cũ `WORK_PHASE.parent_phase_id`.
   - `status`, `progressPct`, `totalTasks`, `doneTasks` của mỗi Phase được tính từ các `NODE` thuộc Phase đó (`PhaseProgressCalculator`), không lưu trong DB.
   - Số câu SQL cố định, không phụ thuộc số Phase/Node (không N+1): 5 câu khi người gọi là owner, 6 câu khi là thành viên (thêm 1 câu kiểm tra `PROJECT_MEMBER`).
5. **Response DTO & UI Mutation**:
   - **Status Code**: `200 OK`
   - **Response Body**:
     ```json
     {
       "phases": [
         { "id": "p1", "name": "FOUNDATION", "sub": "Core Infra", "accent": "emerald", "orderIndex": 0, "parentPhaseIds": [], "status": "COMPLETED", "progressPct": 100, "totalTasks": 1, "doneTasks": 1, "uiMetadata": { "x": 60, "y": 80, "w": 250, "h": 220 } },
         { "id": "p2", "name": "AUTH", "sub": "Identity Gateway", "accent": "blue", "orderIndex": 1, "parentPhaseIds": ["p1"], "status": "TODO", "progressPct": 0, "totalTasks": 1, "doneTasks": 0, "uiMetadata": {} }
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

### 4.2 Thêm/Sửa/Xóa Phase, Nối/Gỡ cạnh Phase & Lưu vị trí trên canvas (`POST/PUT/DELETE /api/projects/{id}/phases`, `POST /api/projects/{id}/phases/connect`, `POST /api/projects/{id}/phases/disconnect`)
1. **Mục tiêu Nghiệp vụ**: Tạo mới giai đoạn (Macro Phase), cập nhật tên, màu sắc, thứ tự `order_index`, vị trí thẻ trên canvas (`uiMetadata`), xóa Phase, nối hoặc gỡ quan hệ phụ thuộc giữa 2 Phase.
2. **Luồng Mã Nguồn**:
   - `src/components/workflow/CreatePhaseModal.tsx` / `MacroWorkflow.tsx` -> `useWorkflowStore` (`createPhase`, `spawnChildPhase`, `deletePhase`, `connectPhases`, `updatePhasePosition`) -> `container.workflowService`.
   - Backend: `WorkflowGraphController` -> `WorkflowGraphService` (`createPhase`, `updatePhase`, `deletePhase`, `connectPhases`, `disconnectPhases`).
   - **Chưa nối**: `HttpWorkflowService` chưa cài `updatePhasePosition` và đang tự tính `x` theo `orderIndex`. Backend đã lưu và trả `uiMetadata`; frontend cần gọi `PUT` kèm `uiMetadata` và đọc lại trường này thì vị trí mới giữ được sau F5.
3. **Request DTO**:
   - **POST**: `/api/projects/{id}/phases`, Body: `{ "name": "CORE ENGINE", "sub": "State Machine", "accent": "blue", "parentPhaseId": 1, "orderIndex": 1, "uiMetadata": { "x": 280, "y": 140, "w": 250, "h": 220 } }`. Chỉ `name` bắt buộc.
   - **PUT**: `/api/projects/{id}/phases/{phaseId}`, Body cùng dạng với POST. `name` bắt buộc; trường nào không gửi thì giữ giá trị cũ (không gửi `uiMetadata` thì vị trí không đổi). Gửi `parentPhaseId` là **thêm** một Phase cha, không ghi đè cha cũ.
   - **DELETE**: `/api/projects/{id}/phases/{phaseId}`.
   - **POST connect**: `/api/projects/{id}/phases/connect?sourcePhaseId={cha}&targetPhaseId={con}` (tham số trên URL, không có body).
   - **POST disconnect**: `/api/projects/{id}/phases/disconnect?sourcePhaseId={cha}&targetPhaseId={con}`.
4. **Xử lý Backend & Bảng CSDL Tác động**:
   - Bảng tác động: `WORK_PHASE`, `PHASE_DEPENDENCY`, `NODE`.
   - Quyền: chỉ owner của dự án. Dự án `ARCHIVED` là chỉ đọc: cả 5 thao tác ghi trả `409 PROJECT_ARCHIVED`.
   - Khi tạo: chèn vào `WORK_PHASE` (kèm `ui_metadata`, mặc định `{}`); có `parentPhaseId` thì chèn thêm một cạnh vào `PHASE_DEPENDENCY`. `orderIndex` không gửi thì lấy `MAX(order_index) + 1`.
   - Khi xóa: chuyển các Node thuộc Phase về dạng standalone (`phase_id = NULL`), không xóa Node. Các cạnh `PHASE_DEPENDENCY` của Phase tự xóa theo `ON DELETE CASCADE`.
   - Khi nối: thêm một cạnh vào `PHASE_DEPENDENCY` và giữ các Phase cha đã có. Cạnh đã tồn tại thì bỏ qua (idempotent). Nếu Phase con đã đi tới được Phase cha (nối sẽ khép vòng) thì trả `422 CYCLE_DETECTED`.
   - Khi gỡ: xóa cạnh trong `PHASE_DEPENDENCY`; nếu cạnh còn nằm ở cột cũ `WORK_PHASE.parent_phase_id` thì đặt cột đó về `NULL`.
5. **Response DTO & UI Mutation**:
   - **Status Code**: POST tạo `201 Created` và PUT `200 OK` trả `PhaseResponse` (cùng dạng một phần tử `phases` ở mục 4.1, có `uiMetadata`); DELETE và disconnect `204 No Content`; connect `200 OK` không có body.
   - **Mã lỗi**: `400` Phase không thuộc dự án hoặc tự nối chính nó; `403 ACCESS_DENIED` không phải owner; `404` không tìm thấy Phase; `409 PROJECT_ARCHIVED`; `422 CYCLE_DETECTED`.
   - **UI Mutation**: Cập nhật `macroPhases` và `workflowEdges` trong Zustand store, vẽ lại các đường nối Bézier curve.

---

### 4.3 Thêm/Sửa/Xóa Node & Nối/Gỡ cạnh `NODE_DEPENDENCY` (`POST /api/projects/{id}/nodes`, `PUT/DELETE /api/nodes/{id}`, `POST/DELETE /api/projects/{id}/dependencies`)
1. **Mục tiêu Nghiệp vụ**: Khởi tạo nút công việc (`NODE`) mới, thiết lập mã Code, chính sách hội tụ (`join_policy`: `ALL_COMPLETED` hoặc `ANY_COMPLETED`), sửa hoặc xóa node, nối và gỡ mũi tên phụ thuộc.
2. **Luồng Mã Nguồn**:
   - `src/components/mindmap/AddNodeToolbar.tsx` -> `useWorkflowStore.updateTree` -> `container.workflowService`.
   - Backend: `WorkflowGraphController` -> `WorkflowGraphService` (`createNode`, `updateNode`, `deleteNode`, `createDependency`, `deleteDependency`).
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
   - Sửa Node: `PUT /api/nodes/{id}`, Body: `{ "title": "OAuth2 Integration", "description": "...", "phaseId": 2, "joinPolicy": "ANY_COMPLETED", "assignedUserId": 3, "dueDate": "2026-10-25T17:00:00Z", "estimatedHours": 8, "version": 0 }`. `title` và `version` bắt buộc; trường khác không gửi thì giữ nguyên. Không có `status`: trạng thái chỉ đổi qua State Machine (Cụm 5).
   - Xóa Node: `DELETE /api/nodes/{id}`.
   - Nối cạnh: `POST /api/projects/{id}/dependencies`, Body: `{ "parentNodeId": 1, "childNodeId": 3 }`.
   - Gỡ cạnh: `DELETE /api/projects/{id}/dependencies?parentNodeId={cha}&childNodeId={con}`.
4. **Xử lý Backend & Bảng CSDL Tác động**:
   - Bảng tác động: `NODE`, `NODE_DEPENDENCY`.
   - Quyền: mọi thao tác ghi chỉ dành cho **owner** của dự án (UC10). Thành viên và Viewer chỉ đọc được đồ thị. Dự án `ARCHIVED` trả `409 PROJECT_ARCHIVED`.
   - Tạo Node: `status = 'LOCKED'` nếu nằm trong Phase, `'TODO'` nếu standalone. Khởi tạo `version = 0`. Thiếu `code` thì tự sinh `WPE-xxx`; trùng mã trả `409 DUPLICATE_NODE_CODE`.
   - Sửa Node: `version` gửi lên khác `version` trên máy chủ trả `409 OPTIMISTIC_LOCK_CONFLICT`. `assignedUserId` phải là owner hoặc thành viên đang hoạt động của dự án. Dời `dueDate` sang tương lai thì `is_overdue = false`. Đổi `joinPolicy` thì trạng thái node được tính lại (chỉ khi node có cha).
   - Xóa Node: chỉ khi node `LOCKED` hoặc `TODO`, ngược lại `409 NODE_IN_USE`. Các cạnh của node bị xóa theo; các node con được tính lại trạng thái.
   - Nối cạnh, theo thứ tự: chặn tự nối (`400`); cạnh đã có thì trả về luôn (lũy đẳng, vẫn `201`); chặn chu trình dài bất kỳ bằng `KahnDagService.wouldCreateCycle` (`422 CYCLE_DETECTED`, `cycleNodes` là mã các node trên vòng); node con đang `IN_PROGRESS` trở lên thì `409 NODE_IN_USE`; lưu cạnh.
   - Tính lại trạng thái node con sau khi nối hoặc gỡ cạnh, theo `joinPolicy` (`ALL_COMPLETED`: mọi cha `DONE`; `ANY_COMPLETED`: ít nhất một cha `DONE`; không còn cha thì coi như thỏa):
     - con `TODO` mà điều kiện không còn thỏa -> `LOCKED`;
     - con `LOCKED` mà điều kiện thỏa -> `TODO`, gửi SSE `TASK_UNLOCKED` cho người phụ trách;
     - con `IN_PROGRESS` trở lên: giữ nguyên.
5. **Response DTO & UI Mutation**:
   - **Status Code**: tạo Node, nối cạnh `201 Created`; sửa Node `200 OK` (trả node kèm `version` mới); xóa Node, gỡ cạnh `204 No Content`.
   - **Mã lỗi**: `400 BAD_REQUEST` (tự nối, Phase hoặc node không thuộc dự án, thiếu `version`; người phụ trách không phải thành viên thì `message` bắt đầu bằng `ASSIGNEE_NOT_MEMBER:`); `403 ACCESS_DENIED`; `404`; `409 PROJECT_ARCHIVED` / `NODE_IN_USE` / `DUPLICATE_NODE_CODE` / `OPTIMISTIC_LOCK_CONFLICT`; `422 CYCLE_DETECTED`.
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
       "metadata": {
         "position": { "x": 280, "y": 140 },
         "width": 220,
         "height": 90,
         "color": "emerald"
       }
     }
     ```
   - Tọa độ nằm trong khóa `metadata` (bắt buộc). URL `PATCH /api/projects/{projectId}/nodes/{id}/metadata` cũng được chấp nhận.
4. **Xử lý Backend & Bảng CSDL Tác động**:
   - Bảng tác động: `NODE`.
   - Quyền: chỉ owner của dự án. Dự án `ARCHIVED` trả `409 PROJECT_ARCHIVED`.
   - Cập nhật trường JSONB bằng câu `UPDATE` trực tiếp: `UPDATE NODE SET ui_metadata = :metadata WHERE id = :id` (`NodeRepository.updateUiMetadata`). Không đi qua `save()` nên **không làm tăng `version`**: kéo thả node không gây `409` cho người đang thao tác task trên Kanban. `updated_at` cũng không đổi.
5. **Response DTO & UI Mutation**:
   - **Status Code**: `200 OK`, trả node với `uiMetadata` mới và `version` giữ nguyên.
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
   - Kiểm tra quyền: Chỉ `OWNER` mới có quyền publish (người khác → 403 `ACCESS_DENIED`).
   - **Kiểm tra trạng thái dự án (cập nhật 12/11/2026, task B4)**: chỉ xuất bản được từ `DRAFT` hoặc `PLANNING`. Dự án `ARCHIVED` → 409 `PROJECT_ARCHIVED`. Các trạng thái còn lại (`ACTIVE`, `PAUSED`, `COMPLETED`, `INACTIVE`) → 409 `INVALID_PROJECT_STATUS`. Bước này chạy trước thuật toán Kahn; trạng thái dự án và node không đổi.
   - **Thuật toán Kahn**:
     1. Khởi tạo danh sách In-degree của tất cả các Node trong dự án.
     2. Đưa toàn bộ các Node có `in-degree == 0` vào hàng đợi `Queue`.
     3. Trong khi `Queue` không rỗng: lấy node $u$ ra, tăng biến đếm `visitedCount += 1`. Với mỗi node con $v$ của $u$, giảm `in-degree(v) -= 1`. Nếu `in-degree(v) == 0`, đưa $v$ vào `Queue`.
     4. Nếu `visitedCount < totalNodes`: Tồn tại ít nhất một chu trình! Trả về mã lỗi HTTP 422 Unprocessable Entity. `cycleNodes` lấy từ `KahnDagService.validateProjectDag(...).cycleNodeCodes` (task B1): chỉ gồm node **nằm trên** chu trình (hoặc nằm giữa 2 chu trình), **không** gồm node chỉ đứng sau chu trình.
     5. Nếu `visitedCount == totalNodes`: Không có chu trình. Cập nhật `PROJECT.status = 'ACTIVE'`. Mở khóa các Node có `in-degree == 0` từ `LOCKED` sang `TODO`. `unlockedTaskCount` = số node vừa đổi `LOCKED` → `TODO` trong lần xuất bản này (node gốc đã `TODO` từ trước, ví dụ task không thuộc Phase, không được tính).
   - **Sự kiện sau khi commit (task B4)**: với mỗi node vừa mở khóa **có người phụ trách**, backend gửi SSE `TASK_UNLOCKED` (payload `KanbanTaskResponse`, cùng dạng với mục 5) qua `SseEmitterService.sendToUser` và một thông báo `TASK_READY` qua `WorkflowEventPublisher.publishNotification`. Cả hai chỉ gửi **sau khi transaction commit** (`TransactionSynchronization.afterCommit`); nếu xuất bản bị rollback thì không gửi gì. Gửi lỗi (mất kết nối SSE, RabbitMQ hỏng) chỉ ghi log, không làm request trả lỗi.
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
   - **Thất bại do trạng thái dự án (409 Conflict)** (task B4): `error` là `INVALID_PROJECT_STATUS` (dự án không ở `DRAFT`/`PLANNING`, kể cả đã `ACTIVE`) hoặc `PROJECT_ARCHIVED` (dự án đã lưu trữ).
     ```json
     {
       "timestamp": "2026-11-12T02:30:38Z",
       "status": 409,
       "error": "INVALID_PROJECT_STATUS",
       "message": "Chỉ xuất bản được dự án đang ở trạng thái DRAFT hoặc PLANNING. Trạng thái hiện tại: ACTIVE.",
       "path": "/api/v1/projects/4/publish"
     }
     ```

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
   - Lưu `emitter` vào `ConcurrentHashMap<Long, Set<SseEmitter>>` trong `SseEmitterService` (C2, 12/11/2026): **mỗi tab một emitter**, một user mở nhiều tab thì tab nào cũng nhận sự kiện. Tập emitter là `CopyOnWriteArraySet`.
   - Đăng ký hook dọn dẹp `onCompletion`, `onTimeout`, `onError`: chỉ gỡ **đúng emitter của tab đó**; tab cuối cùng đóng thì user không còn kết nối.
   - Gửi sự kiện khởi tạo ban đầu `INIT`: `data: "Connected successfully"`.
   - Heartbeat: cứ 25 giây gửi `PING` tới mọi emitter (`@Scheduled(fixedRate = 25000)`); emitter gửi lỗi thì bị gỡ.
   - **Danh mục sự kiện chuẩn** (FE và BE dùng chung, chi tiết ở `docs/specs/workflow-engine.md` mục 3.5):

     | Sự kiện | Payload | Gửi khi |
     | :--- | :--- | :--- |
     | `INIT` | chuỗi | Vừa mở kết nối |
     | `PING` | chuỗi `keep-alive` | Mỗi 25 giây |
     | `TASK_UNLOCKED` | `KanbanTaskResponse` | Task LOCKED → TODO (tự mở khóa, force unlock, xuất bản dự án) |
     | `TASK_STATUS_CHANGED` | `KanbanTaskResponse` | Đổi trạng thái task (người phụ trách; Owner nếu người đổi không phải Owner) |
     | `TASK_SUBMITTED` | `KanbanTaskResponse` | Nộp bài (gửi Owner) |
     | `TASK_REJECTED` | `KanbanTaskResponse` | Owner từ chối bài (gửi người phụ trách) |
     | `NOTIFICATION_RECEIVED` | `NotificationResponse` `{ id (chuỗi), title, message, linkUrl, isRead, createdAt }` | Có thông báo mới, kể cả lời mời |
     | `TASK_OVERDUE` | `KanbanTaskResponse` | Bộ quét trễ hạn (15 phút) đánh dấu task trễ hạn |

     FE hiện mới nghe `INIT`, `TASK_UNLOCKED`, `TASK_STATUS_CHANGED`, `NOTIFICATION_RECEIVED`; `TASK_SUBMITTED`, `TASK_REJECTED`, `TASK_OVERDUE` và `PING` chưa có listener (FE nối ở C6, chuông ở C3).
   - Lời mời (C2): `InvitationCreatedEvent` / `InvitationAcceptedEvent` đi routing key `wpe.invitation.created` / `wpe.invitation.accepted` vào queue riêng `wpe.invitation.queue`. `InvitationEventConsumer` đẩy `NOTIFICATION_RECEIVED` cho người được mời **đúng 1 lần** bằng bản ghi `ProjectInvitationService` đã lưu, không lưu thêm.
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

### 10.1 Quản lý người dùng, phân quyền & chuyển giao tài khoản (`GET/POST/PATCH/DELETE /api/v1/admin/users/*`)
1. **Mục tiêu Nghiệp vụ**: Quản trị viên hệ thống (Super Admin) quản lý danh sách người dùng toàn sàn với cơ chế che dữ liệu nhạy cảm (Data Masking email dạng `a***@pipeline.engine`). Hỗ trợ tra cứu, tạm khóa tài khoản vi phạm, mở khóa, chuyển đổi vai trò `USER ↔ ADMIN`, xóa tài khoản trắng chưa phát sinh dữ liệu, và kiểm tra danh sách dự án do người dùng sở hữu.
   - **Quy tắc phân quyền & kiểm soát an toàn**:
     - **Không khóa / xóa tài khoản Quản trị viên**: Thao tác khóa tài khoản có vai trò `ADMIN` bị từ chối với HTTP 403 `CANNOT_SUSPEND_ADMIN`. Thao tác xóa tài khoản `ADMIN` bị từ chối với HTTP 403 `CANNOT_DELETE_ADMIN` (bắt buộc hạ quyền về USER trước khi xóa).
     - **Không tự thao tác trên chính mình**: Quản trị viên không được phép tự hạ quyền của chính mình (HTTP 403 `CANNOT_DEMOTE_SELF`) và không được phép tự xóa tài khoản của chính mình (HTTP 403 `CANNOT_DELETE_SELF`).
     - **Bảo vệ Quản trị viên hoạt động cuối cùng**: Khi thực hiện hạ quyền `ADMIN -> USER`, hệ thống kích hoạt khóa hàng `PESSIMISTIC_WRITE` qua `userRepository.lockActiveAdmins()`. Nếu người dùng này là quản trị viên đang hoạt động duy nhất còn lại trong hệ thống, yêu cầu bị từ chối với HTTP 409 `LAST_ADMIN`.
     - **Điều kiện nâng quyền Quản trị viên**: Tài khoản đang bị khóa (`is_locked = TRUE`) không được phép nâng quyền lên `ADMIN`, hệ thống từ chối với HTTP 409 `USER_LOCKED` (yêu cầu mở khóa tài khoản trước).
     - **Thu hồi phiên làm việc tức thì khi hạ quyền**: Khi hạ quyền từ `ADMIN` xuống `USER`, hệ thống tự động tăng `token_version += 1` và thu hồi toàn bộ refresh token qua `RefreshTokenService.revokeAllForUser(userId)` nhằm vô hiệu hóa ngay lập tức các phiên đăng nhập quản trị đang mở.
     - **Chỉ xóa tài khoản trắng (Empty Account)**: Hệ thống đếm đủ 6 loại dữ liệu nghiệp vụ liên kết trước khi cho phép xóa vĩnh viễn:
       1. Số dự án đang sở hữu (`projectRepository.countByOwnerId`)
       2. Số template quy trình đã tạo (`pipelineTemplateRepository.countByCreatedBy`)
       3. Số tài nguyên minh chứng đã tải lên (`artifactRepository.countByUploadedBy`)
       4. Số lời mời tham gia gửi đi hoặc nhận về (`projectInvitationRepository.countByInviterIdOrInviteeId`)
       5. Số lần tham gia vào các dự án (`projectMemberRepository.countByUserId`)
       6. Số tác vụ được phân công thực hiện (`nodeRepository.countByAssignedUserId`)
       Nếu tổng số liên kết lớn hơn 0, hệ thống từ chối xóa với HTTP 409 `USER_HAS_DATA` kèm thông điệp chi tiết số lượng dữ liệu đang gắn, yêu cầu quản trị viên chuyển sang thao tác khóa tài khoản thay vì xóa.
     - **Các chức năng KHÔNG cung cấp tại Admin Portal (theo đề xuất đã duyệt)**:
       - *Không có thêm tài khoản từ Admin*: Không có thêm tài khoản từ admin: người dùng tự đăng ký (UC1), nhóm đã quyết 14/11. Nếu admin tạo tài khoản kèm mật khẩu tạm thì admin biết mật khẩu đó và có thể đăng nhập xem trộm dữ liệu task của người dùng, vi phạm nguyên tắc bảo mật.
       - *Không có đặt lại mật khẩu bằng mật khẩu tạm*: Admin biết mật khẩu tạm sẽ đăng nhập được vào tài khoản người khác và xem trộm nội dung công việc bên trong workspace, vi phạm đặc tả kiến trúc (system-overview dòng 79).
       - *Không sửa email trong Admin*: Email thuộc quyền riêng tư của người dùng, người dùng tự đổi trong Hồ sơ cá nhân. Ngoài ra, giao diện Admin hiển thị email đã che (`a***@domain.com`), nếu cho gửi cập nhật sẽ vô tình ghi đè email bị che lên email thật trong DB.
2. **Luồng Mã Nguồn**:
   - `src/features/admin/tabs/UserManagementTab.tsx`, `ConfirmActionModal.tsx`, `BanConfirmModal.tsx`, `OwnedProjectsDrawer.tsx` -> `useAdminPortal` (`filteredUsers`, `handleSuspendUser`, `handleUnbanUser`, `handleChangeRole`, `handleDeleteUser`, `loadOwnedProjects`) -> `container.adminService` (`getUsers`, `suspendUser`, `unbanUser`, `changeUserRole`, `deleteUser`, `getOwnedProjects`) -> `HttpAdminService` -> `AdminController` (`AdminUserService`, `AdminProjectOwnerService`).
3. **Request DTO**:
   - Lấy danh sách người dùng:
     - **Method & URL**: `GET /api/v1/admin/users?query=&status=ACTIVE|SUSPENDED`
     - **Headers**: `Authorization: Bearer <jwt>` (Role: ADMIN)
     - **Query Params**:
       - `query`: Chuỗi tìm kiếm theo họ tên (`fullName`) hoặc tên tài khoản (`username`), không phân biệt hoa thường. **Tuyệt đối KHÔNG tìm kiếm theo email** (tránh làm lộ hoặc suy đoán email người dùng).
       - `status`: `ACTIVE` (người dùng không bị khóa) hoặc `SUSPENDED` (người dùng đang bị khóa).
   - Tạm khóa tài khoản:
     - **Method & URL**: `POST /api/v1/admin/users/{id}/suspend`
     - **Headers**: `Authorization: Bearer <jwt>` (Role: ADMIN)
     - **Body JSON**:
       ```json
       {
         "reason": "TERMS_VIOLATION",
 
         "note": "Vi phạm chính sách nội dung cộng đồng"
       }
       ```
   - Mở khóa tài khoản:
     - **Method & URL**: `POST /api/v1/admin/users/{id}/unban`
     - **Headers**: `Authorization: Bearer <jwt>` (Role: ADMIN)
   - Đổi vai trò (Nâng / Hạ quyền):
     - **Method & URL**: `PATCH /api/v1/admin/users/{id}/role`
     - **Headers**: `Authorization: Bearer <jwt>` (Role: ADMIN)
     - **Body JSON**: `{ "role": "ADMIN" }` hoặc `{ "role": "USER" }`
   - Xóa tài khoản trắng:
     - **Method & URL**: `DELETE /api/v1/admin/users/{id}`
     - **Headers**: `Authorization: Bearer <jwt>` (Role: ADMIN)
   - Xem danh sách dự án người dùng đang sở hữu:
     - **Method & URL**: `GET /api/v1/admin/users/{id}/owned-projects`
     - **Headers**: `Authorization: Bearer <jwt>` (Role: ADMIN)
4. **Xử lý Backend & Bảng CSDL Tác động**:
   - Bảng tác động: `USERS`, `REFRESH_TOKEN`, `PROJECT`, `PROJECT_MEMBER`, `PIPELINE_TEMPLATE`, `ARTIFACTS`, `PROJECT_INVITATION`, `NODE`, `ADMIN_AUDIT_LOG`.
   - `GET /api/v1/admin/users`: Nạp danh sách `UserEntity`, lọc theo `query` (username, fullName) và `status`, đếm số dự án sở hữu (`countByOwnerId`), số dự án tham gia không phải OWNER (`countByUserIdAndRemovedAtIsNullAndRoleNot`), che email qua `EmailMasker.mask(email)`.
   - `POST /api/v1/admin/users/{id}/suspend`: Kiểm tra `systemRole != ADMIN` -> đặt `is_locked = TRUE`, tăng `token_version += 1`, thu hồi toàn bộ refresh token, ghi audit log `USER_SUSPENDED`.
   - `POST /api/v1/admin/users/{id}/unban`: Đặt `is_locked = FALSE`, ghi audit log `USER_UNBANNED`.
   - `PATCH /api/v1/admin/users/{id}/role`:
     - Nâng lên `ADMIN`: kiểm tra `is_locked == FALSE` (nếu true ném `ConflictException("USER_LOCKED")`). Cập nhật `system_role = 'ADMIN'`, ghi audit log `USER_ROLE_CHANGED` ("USER -> ADMIN").
     - Hạ xuống `USER`: kiểm tra `userId != actorUserId` (`CANNOT_DEMOTE_SELF`), khóa hàng các active admin bằng `PESSIMISTIC_WRITE` và kiểm tra không phải admin cuối cùng (`LAST_ADMIN`), cập nhật `system_role = 'USER'`, tăng `token_version += 1`, thu hồi refresh token, ghi audit log `USER_ROLE_CHANGED` ("ADMIN -> USER").
   - `DELETE /api/v1/admin/users/{id}`: Kiểm tra `userId != actorUserId` (`CANNOT_DELETE_SELF`), `systemRole != ADMIN` (`CANNOT_DELETE_ADMIN`), kiểm tra tổng 6 loại liên kết bằng 0 (`USER_HAS_DATA`), ghi audit log `USER_DELETED`, xóa bản ghi khỏi bảng `USERS`.
   - `GET /api/v1/admin/users/{id}/owned-projects`: Trả về danh sách dự án do user sở hữu kèm số lượng thành viên và danh sách ứng viên chuyển chủ hợp lệ (`candidates`).
5. **Response DTO & UI Mutation**:
   - **GET /users**: `200 OK`. Body: `AdminUserResponse[]` (`id`, `name`, `username`, `maskedEmail`, `role`, `status`, `ownedProjectCount`, `joinedProjectCount`, `createdAt`).
   - **POST /suspend**, **POST /unban**, **PATCH /role**: `200 OK`. Body: `AdminUserResponse`.
   - **DELETE /users/{id}**: `204 No Content`.
   - **GET /owned-projects**: `200 OK`. Body: `OwnedProjectResponse[]` (`projectId`, `name`, `status`, `memberCount`, `candidates: [{ userId, name, username }]`).
   - **UI Mutation**: Cập nhật badge trạng thái (Active / Suspended) và vai trò (USER / ADMIN) ngay trên hàng của bảng người dùng; mở drawer danh sách dự án sở hữu `OwnedProjectsDrawer`; hiển thị modal cảnh báo xác nhận `ConfirmActionModal` / `BanConfirmModal`; hiển thị Toast thông báo kết quả hoặc Toast đỏ với mã lỗi rõ ràng khi vi phạm quy tắc.

---

### 10.2 Quản trị Không gian Làm việc & Chuyển Chủ Dự án (`GET/POST /api/v1/admin/workspaces/*`, `/projects/*/transfer-owner`)
1. **Mục tiêu Nghiệp vụ**: Quản trị viên rà soát toàn bộ các Không gian Làm việc (Workspace / Project) trên hệ thống ở mức **Metadata Quản trị**. Hỗ trợ xem danh sách, xem chi tiết trong ngăn kéo (Drawer), chuyển trạng thái lưu trữ (`ARCHIVED`) cho dự án không hoạt động, và chuyển quyền sở hữu dự án (`transfer-owner`) khi chủ cũ bị khóa hoặc rời nhóm mà dự án cần người tiếp quản.
   - **Nguyên tắc Quản trị Metadata**: Quản trị viên chỉ xem các thông số tổng hợp (tên, mô tả, trạng thái, chủ sở hữu, cơ cấu vai trò thành viên, tiến độ %, task quá hạn, hạn link khách). **Tuyệt đối KHÔNG trả nội dung task, tiêu đề task, mô tả task, file artifact hay đồ thị DAG Canvas**.
   - **Quy tắc Chuyển quyền Sở hữu (Transfer Owner)**:
      - Luật `PROJECT_CLOSED` (Nhóm đã quyết 14/11): Nếu dự án đã ở trạng thái lưu trữ (`ARCHIVED`) hoặc hoàn thành (`COMPLETED`) -> hệ thống từ chối chuyển chủ với HTTP 409 `PROJECT_CLOSED` ("Dự án đã lưu trữ hoặc đã hoàn thành, không chuyển chủ được."). Kiểm tra ngay sau khi tìm thấy dự án, trước mọi kiểm tra khác về chủ mới. Giao diện (OwnedProjectsDrawer, WorkspaceDetailDrawer) không hiện select/nút chuyển chủ mà thay bằng thông báo này.
     - Chủ mới phải là thành viên đang hoạt động trong dự án (`removed_at IS NULL`) và tài khoản không bị khóa (`is_locked = FALSE`), nếu không thỏa mãn từ chối với HTTP 409 `NEW_OWNER_NOT_ACTIVE_MEMBER`.
     - Nếu chỉ định chủ mới trùng với chủ sở hữu hiện tại -> từ chối với HTTP 409 `ALREADY_OWNER`.
     - Sau khi chuyển chủ thành công: `project.owner_id` đổi sang ID chủ mới, vai trò của chủ mới trong bảng `project_member` chuyển thành `OWNER`, vai trò của chủ cũ tự động chuyển thành `COLLABORATOR`.
     - Dự án chỉ có 1 người (không có thành viên nào khác thỏa mãn điều kiện, danh sách ứng viên `candidates` rỗng): hệ thống không cho phép chuyển quyền sở hữu, chỉ cho phép lưu trữ (`ARCHIVED`).
     - Lưu trữ dự án: Chuyển `project.status = 'ARCHIVED'`. Nếu dự án đã ở trạng thái ARCHIVED từ trước -> từ chối với HTTP 409 `ALREADY_ARCHIVED`.
2. **Luồng Mã Nguồn**:
   - `src/features/admin/tabs/WorkspacesTab.tsx`, `WorkspaceDetailDrawer.tsx` -> `useAdminPortal` (`workspaces`, `workspaceDetail`, `loadWorkspaceDetail`, `handleArchiveWorkspace`, `handleTransferOwner`) -> `container.adminService` (`getWorkspaces`, `getWorkspaceDetail`, `archiveWorkspace`, `transferProjectOwner`) -> `HttpAdminService` -> `AdminController` (`AdminWorkspaceService`, `AdminProjectOwnerService`).
3. **Request DTO**:
   - Danh sách Workspaces:
     - **Method & URL**: `GET /api/v1/admin/workspaces?query=&status=`
     - **Headers**: `Authorization: Bearer <jwt>` (Role: ADMIN)
     - **Query Params**: `query` (lọc theo tên dự án hoặc họ tên/username của chủ sở hữu; KHÔNG lọc email), `status` (DRAFT, PLANNING, ACTIVE, PAUSED, COMPLETED, ARCHIVED).
   - Chi tiết Workspace (Metadata Drawer):
     - **Method & URL**: `GET /api/v1/admin/workspaces/{id}`
     - **Headers**: `Authorization: Bearer <jwt>` (Role: ADMIN)
   - Lưu trữ Workspace:
     - **Method & URL**: `POST /api/v1/admin/workspaces/{id}/archive`
     - **Headers**: `Authorization: Bearer <jwt>` (Role: ADMIN)
   - Chuyển quyền sở hữu dự án:
     - **Method & URL**: `POST /api/v1/admin/projects/{projectId}/transfer-owner`
     - **Headers**: `Authorization: Bearer <jwt>` (Role: ADMIN)
     - **Body JSON**: `{ "newOwnerId": 456 }`
4. **Xử lý Backend & Bảng CSDL Tác động**:
   - Bảng tác động: `PROJECT`, `PROJECT_MEMBER`, `WORK_PHASE`, `NODE`, `GUEST_LINK`, `PROJECT_INVITATION`, `USERS`, `ADMIN_AUDIT_LOG`.
   - `GET /api/v1/admin/workspaces`: Tập hợp metadata dự án từ các bảng, tính toán số thành viên active, số phase, số node, số node DONE, tỷ lệ phần trăm hoàn thành `%`, che email của owner dạng `EmailMasker.mask(owner.getEmail())`.
   - `GET /api/v1/admin/workspaces/{id}`: Tập hợp chi tiết: thông tin owner (id, name, maskedEmail), phân bố thành viên `membersByRole` đủ 4 role (OWNER, MANAGER, COLLABORATOR, VIEWER), số lời mời đang chờ `pendingInvitationCount`, số phase, tổng số node, phân bố `nodesByStatus` đủ 5 trạng thái (LOCKED, TODO, IN_PROGRESS, REVIEW, DONE), tiến độ hoàn thành %, số task quá hạn `overdueCount` (`dueDate < NOW()` và `status != DONE`), trạng thái link khách `guestLinkActive` / `guestLinkExpiresAt`, thời điểm hoạt động cuối cùng `lastActivityAt` (lấy max `updated_at` của nodes hoặc của project), và danh sách `ownerCandidates` hợp lệ.
   - `POST /api/v1/admin/workspaces/{id}/archive`: Kiểm tra `project.status != ARCHIVED`, cập nhật `PROJECT.status = 'ARCHIVED'`, `updated_at = NOW()`, ghi audit log `WORKSPACE_ARCHIVED`.
   - `POST /api/v1/admin/projects/{projectId}/transfer-owner`: Kiểm tra chủ mới hợp lệ -> Trong cùng 1 transaction: cập nhật `PROJECT.owner_id = newOwnerId`, cập nhật chủ mới `role = OWNER`, cập nhật chủ cũ `role = COLLABORATOR`, ghi audit log `PROJECT_OWNER_TRANSFERRED`.
5. **Response DTO & UI Mutation**:
   - **GET /workspaces**: `200 OK`. Body: `AdminWorkspaceResponse[]` (`id`, `name`, `ownerId`, `ownerName`, `ownerMaskedEmail`, `status`, `memberCount`, `phaseCount`, `nodeCount`, `doneNodeCount`, `progressPercentage`, `createdAt`, `updatedAt`).
   - **GET /workspaces/{id}**: `200 OK`. Body: `AdminWorkspaceDetailResponse` (`id`, `name`, `description`, `status`, `createdAt`, `updatedAt`, `owner`, `membersByRole`, `pendingInvitationCount`, `phaseCount`, `nodeCount`, `nodesByStatus`, `progressPercentage`, `overdueCount`, `guestLinkActive`, `guestLinkExpiresAt`, `lastActivityAt`, `ownerCandidates`).
   - **POST /archive**: `200 OK`. Body: `AdminWorkspaceResponse`.
   - **POST /transfer-owner**: `200 OK`. Body: `OwnedProjectResponse`.
   - **UI Mutation**: Bảng WorkspacesTab hiển thị danh sách dự án với badge trạng thái; nút "Xem chi tiết" mở `WorkspaceDetailDrawer` bên phải màn hình hiển thị đầy đủ 4 nhóm thông tin (Tổng quan, Thành viên, Tiến độ, Chia sẻ khách) mà không điều hướng vào đồ thị DAG; nút "Lưu trữ" trong bảng hoặc Drawer cập nhật trạng thái workspace thành ARCHIVED; modal chuyển chủ cho phép chọn ứng viên từ dropdown và cập nhật giao diện ngay lập tức.

---

### 10.3 Thiết kế & Thư viện Quy trình Mẫu Hệ thống (Template Studio & Catalog) (`GET/POST/PUT/DELETE /api/v1/templates/*`)
1. **Mục tiêu Nghiệp vụ**: Quản trị viên thiết kế, thẩm định, lưu trữ và quản lý các mẫu quy trình công việc chuẩn 2 tầng (Macro Phases và Detail Nodes) cho toàn hệ thống.
   - **Bộ lọc Catalog Admin (Chỉ hiển thị PUBLIC)**: Danh mục Template trong giao diện Admin Portal chỉ hiển thị các template `PUBLIC` (`visibility == 'PUBLIC'`) do Admin tạo dùng chung toàn sàn. Tuyệt đối không hiển thị các template cá nhân `PRIVATE` do người dùng tự lưu từ dự án của họ.
   - **Thẩm định Đồ thị Kahn 2 tầng bắt buộc**: Mọi thao tác tạo mới hoặc cập nhật template đều bắt buộc chạy thuật toán Kahn thẩm định cấu trúc `graphData` không có chu trình. Nếu phát hiện chu trình, từ chối với HTTP 422 `CYCLE_DETECTED`.
   - **Quyền xóa Template Chuẩn Hệ thống (Nhóm đã quyết 14/11)**: Admin được xóa cả template mẫu của hệ thống (`is_system_standard == TRUE`), bỏ khóa `SYSTEM_TEMPLATE_LOCKED`. Khi xóa, người dùng không chọn được mẫu này khi tạo dự án nữa; các dự án đã tạo trước đó không bị ảnh hưởng. User thường cố xóa vẫn bị 403 Forbidden.
2. **Luồng Mã Nguồn**:
   - `src/features/admin/templates/TemplateCatalogView.tsx`, `TemplateStudioView.tsx` -> `useTemplateStudio` (`save`, `loadTemplate`, `validate`, `deleteTemplate`) -> `container.templateService` (`getTemplates`, `createTemplate`, `updateTemplate`, `deleteTemplate`, `validateGraph`) -> `ITemplateService` -> `PipelineTemplateController` -> `PipelineTemplateService` (`KahnDagService`).
3. **Request DTO**:
   - Lấy danh mục Template:
     - **Method & URL**: `GET /api/v1/templates?visibility=PUBLIC&category=&search=&isSystemStandard=`
     - **Headers**: `Authorization: Bearer <jwt>`
   - Chi tiết Template:
     - **Method & URL**: `GET /api/v1/templates/{id}`
   - Tạo mới Template:
     - **Method & URL**: `POST /api/v1/templates`
     - **Headers**: `Authorization: Bearer <jwt>`, `Content-Type: application/json`
     - **Body JSON**:
       ```json
       {
         "name": "Standard Software Development (SDLC)",
         "description": "Quy trình chuẩn 4 giai đoạn phát triển phần mềm Agile",
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
   - Cập nhật Template:
     - **Method & URL**: `PUT /api/v1/templates/{id}`
   - Xóa Template:
     - **Method & URL**: `DELETE /api/v1/templates/{id}`
   - Thẩm định đồ thị DAG (Dry Run):
     - **Method & URL**: `POST /api/v1/templates/validate`
     - **Body JSON**: `{ "graphData": { ... } }`
4. **Xử lý Backend & Bảng CSDL Tác động**:
   - Bảng tác động: `PIPELINE_TEMPLATE`, `ADMIN_AUDIT_LOG`.
   - `GET /templates`: Nhận tham số `visibility=PUBLIC` để lọc chỉ template công khai dùng chung hệ thống.
   - `POST /templates`, `PUT /templates/{id}`: Thẩm định cấu trúc graphData qua `kahnDagService.validateTemplateGraph(graphData)`. Nếu vi phạm chu trình lặp thì ném `CycleDetectedException`. Sau khi lưu thành công, ghi audit log `TEMPLATE_CREATED` hoặc `TEMPLATE_UPDATED`.
   - `DELETE /templates/{id}`: Kiểm tra quyền quản trị (`requireCanManage`). Admin được phép xóa cả template hệ thống và template thường (không còn `SYSTEM_TEMPLATE_LOCKED`), xóa khỏi `PIPELINE_TEMPLATE`, ghi audit log `TEMPLATE_DELETED`.
5. **Response DTO & UI Mutation**:
   - **GET /templates**: `200 OK`. Body: `TemplateSummaryResponse[]`.
   - **GET /templates/{id}**: `200 OK`. Body: `TemplateDetailResponse`.
   - **POST /templates**: `201 Created`. Body: `TemplateDetailResponse`.
   - **PUT /templates/{id}**: `200 OK`. Body: `TemplateDetailResponse`.
   - **DELETE /templates/{id}**: `204 No Content`.
   - **POST /templates/validate**: `200 OK`. Body: `DagValidationResponse` (`{ "valid": true, "violations": [] }`).
   - **UI Mutation**: TemplateCatalogView chỉ hiển thị danh sách các template PUBLIC; khi bấm Xóa template hệ thống, hiển thị ConfirmDialog cảnh báo template mẫu hệ thống và cho phép xóa vĩnh viễn; khi lưu đồ thị có chu trình lặp, mở modal KahnCycleModal hiển thị danh sách node gây vòng lặp với viền đỏ nổi bật.

---

### 10.4 Tổng quan Chỉ số & Xu hướng Hệ thống (Admin Overview & Analytics) (`GET /api/v1/admin/stats*`)
1. **Mục tiêu Nghiệp vụ**: Quản trị viên theo dõi các chỉ số hoạt động then chốt (KPI) và xu hướng tăng trưởng của toàn bộ nền tảng qua thời gian.
   - **Nguyên tắc Số liệu Thực tế 100%**: Tất cả các chỉ số trên tab Overview đều được tính toán trực tiếp từ cơ sở dữ liệu thật (PostgreSQL). Loại bỏ hoàn toàn các số liệu giả định, số liệu không đo lường được từ DB (doanh thu, uptime ảo, phần trăm CPU/RAM, "AI score" giả lập).
   - **Quy tắc Tính toán Xu hướng**: Chỉ số tác vụ hoàn thành (`tasksDone`) trong biểu đồ xu hướng được tính toán dựa trên ngày cập nhật cuối cùng (`updated_at`) của các node có trạng thái `DONE`, do hệ thống không duy trì cột thời điểm hoàn thành riêng biệt.
2. **Luồng Mã Nguồn**:
   - `src/features/admin/tabs/AnalyticsTab.tsx` -> `useAdminPortal` (`stats`, `trends`, `trendRange`, `handleTrendRangeChange`) -> `container.adminService` (`getStats`, `getTrends`) -> `HttpAdminService` -> `AdminController` (`AdminStatsService`).
3. **Request DTO**:
   - Lấy tổng quan số liệu thống kê:
     - **Method & URL**: `GET /api/v1/admin/stats`
     - **Headers**: `Authorization: Bearer <jwt>` (Role: ADMIN)
   - Lấy chuỗi dữ liệu xu hướng theo ngày:
     - **Method & URL**: `GET /api/v1/admin/stats/trends?range=7D|30D`
     - **Headers**: `Authorization: Bearer <jwt>` (Role: ADMIN)
     - **Query Params**: `range` nhận giá trị `7D` (7 ngày gần nhất, mặc định) hoặc `30D` (30 ngày gần nhất).
4. **Xử lý Backend & Bảng CSDL Tác động**:
   - Bảng tác động: `USERS`, `PROJECT`, `NODE`, `PIPELINE_TEMPLATE`, `PROJECT_MEMBER`.
   - `GET /api/v1/admin/stats`:
     - `users`: đếm tổng số user, số user active (`is_locked = FALSE`), số user suspended (`is_locked = TRUE`), số user mới tạo trong 7 ngày gần nhất.
     - `projects`: đếm tổng số dự án, phân nhóm theo trạng thái `byStatus` (DRAFT, PLANNING, ACTIVE, PAUSED, COMPLETED, ARCHIVED), số dự án mới tạo trong 7 ngày gần nhất.
     - `tasks`: đếm tổng số node, phân nhóm theo trạng thái `byStatus` (LOCKED, TODO, IN_PROGRESS, REVIEW, DONE), số node trễ hạn `overdue` (`dueDate < NOW()` và `status != DONE`).
     - `templates`: đếm số template `PUBLIC`, số template `PRIVATE`, tổng lượt nhân bản `totalClones` (tổng cột `clone_count`).
     - `roles`: đếm số user theo vai trò hệ thống `systemRoles` (ADMIN, USER), đếm số thành viên active theo vai trò dự án `projectRoles` (OWNER, MANAGER, COLLABORATOR, VIEWER).
   - `GET /api/v1/admin/stats/trends`:
     - Nhóm dữ liệu theo ngày (theo múi giờ `Asia/Ho_Chi_Minh`): số người dùng đăng ký theo `created_at`, số dự án tạo mới theo `created_at`, và số tác vụ hoàn thành theo `updated_at` của các task `DONE`.
     - Tạo danh sách đầy đủ các ngày trong khoảng thời gian (7 hoặc 30 ngày), điền 0 cho những ngày không có phát sinh dữ liệu.
5. **Response DTO & UI Mutation**:
   - **GET /stats**: `200 OK`. Body: `AdminStatsResponse`:
     ```json
     {
       "users": { "total": 12, "active": 11, "suspended": 1, "newLast7Days": 3 },
       "projects": { "total": 8, "byStatus": { "DRAFT": 1, "PLANNING": 1, "ACTIVE": 4, "PAUSED": 0, "COMPLETED": 1, "ARCHIVED": 1 }, "newLast7Days": 2 },
       "tasks": { "total": 45, "byStatus": { "LOCKED": 10, "TODO": 15, "IN_PROGRESS": 8, "REVIEW": 4, "DONE": 8 }, "overdue": 3 },
       "templates": { "publicCount": 4, "privateCount": 2, "totalClones": 14 },
       "roles": { "systemRoles": { "ADMIN": 2, "USER": 10 }, "projectRoles": { "OWNER": 8, "MANAGER": 4, "COLLABORATOR": 12, "VIEWER": 2 } }
     }
     ```
   - **GET /stats/trends**: `200 OK`. Body: `AdminTrendPointResponse[]` (`[{ "date": "2026-11-01", "newUsers": 1, "newProjects": 0, "tasksDone": 3 }, ...]`).
   - **UI Mutation**: Tab Analytics (Overview) hiển thị 4 khối thẻ KPI chính (Người dùng, Dự án đang chạy, Tác vụ trễ hạn, Quy trình mẫu), đồ thị xu hướng theo thời gian (chuyển đổi 7D/30D), biểu đồ phân bố trạng thái dự án và vai trò; nếu API lỗi hiển thị thông báo lỗi rõ ràng thay vì nạp dữ liệu giả.

---

### 10.5 Nhật ký Vận hành & Giám sát An ninh (System & Security Audit Logs) (`GET /api/v1/admin/audit-logs`)
1. **Mục tiêu Nghiệp vụ**: Ghi nhận và truy vết toàn diện mọi hoạt động quản trị, thay đổi cấu hình, sự kiện xác thực tài khoản và các hành vi xâm nhập trái phép vào hệ thống nhằm phục vụ mục đích kiểm toán an ninh (tuân thủ khuyến nghị OWASP Logging Cheat Sheet).
   - **Phân nhóm Nhật ký theo 3 Cụm Hành động (AdminAuditAction)**:
     - Nhóm Xác thực (`LOGIN`): `LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGOUT`, `REGISTER`, `ACCOUNT_LOCKED_LOGIN`.
     - Nhóm Quản trị (`ADMIN`): `USER_SUSPENDED`, `USER_UNBANNED`, `ADMIN_ACCESS_DENIED`, `USER_ROLE_CHANGED`, `USER_DELETED`, `PROJECT_OWNER_TRANSFERRED`, `WORKSPACE_ARCHIVED`.
     - Nhóm Quy trình mẫu (`TEMPLATE`): `TEMPLATE_CREATED`, `TEMPLATE_UPDATED`, `TEMPLATE_DELETED`.
   - **Giám sát Truy cập Trái phép (Request 403 vào `/api/v1/admin/**`)**:
     - Mọi yêu cầu HTTP gửi tới các đường dẫn quản trị `/api/v1/admin/**` bị từ chối truy cập (HTTP 403 Forbidden) đều tự động được bắt tại `GlobalExceptionHandler` và ghi lại vào nhật ký với hành động `ADMIN_ACCESS_DENIED`, lưu chi tiết method, URI và lý do từ chối.
   - **Cơ chế Ghi Độc lập & Cách ly Tuyệt đối**:
     - Hoạt động ghi audit log được thực hiện trong một Transaction hoàn toàn độc lập với mức lan truyền `PROPAGATION_REQUIRES_NEW` qua `TransactionTemplate`.
     - Toàn bộ thao tác ghi log được bao bọc bởi khối `try-catch`, đảm bảo sự cố ghi log không bao giờ làm rollback hay phá hỏng giao dịch nghiệp vụ chính.
   - **Bảo vệ Tràn CSDL & Che Thông tin Nhạy cảm**:
     - Cắt chuỗi độ dài tối đa trước khi lưu xuống CSDL: `actorUsername` (100 ký tự), `action` (50 ký tự), `targetType` (30 ký tự), `targetId` (50 ký tự), `detail` (1000 ký tự), `ipAddress` (64 ký tự).
     - Địa chỉ IP client được trích xuất thông minh từ header `X-Forwarded-For` (hỗ trợ môi trường Reverse Proxy như Vercel/Nginx) hoặc `remoteAddr`, và luôn được che phần cuối (`maskIp`: ví dụ `192.168.1.***` hoặc `fe80:0:0:0:***`) khi trả về cho UI.
     - Tuyệt đối không ghi mật khẩu, JWT token hay nội dung chi tiết công việc vào log.
2. **Luồng Mã Nguồn**:
   - `src/features/admin/tabs/AuditLogsTab.tsx` -> `useAdminPortal` (`auditLogs`, `auditGroup`, `setAuditGroup`) -> `container.adminService.getSecurityAuditLogs(group)` -> `HttpAdminService` -> `AdminController.searchAuditLogs` -> `AdminAuditService` -> `AdminAuditLogRepository`.
3. **Request DTO**:
   - Tìm kiếm và Lọc Nhật ký:
     - **Method & URL**: `GET /api/v1/admin/audit-logs?group=LOGIN|ADMIN|TEMPLATE&action=&from=&to=&page=0&size=50`
     - **Headers**: `Authorization: Bearer <jwt>` (Role: ADMIN)
     - **Query Params**:
       - `group`: Nhóm hành động (`LOGIN`, `ADMIN`, `TEMPLATE`, hoặc `ALL` / bỏ trống).
       - `action`: Tên hành động cụ thể thuộc nhóm (ví dụ `USER_SUSPENDED`, `ADMIN_ACCESS_DENIED`).
       - `from`, `to`: Khoảng thời gian dạng chuẩn ISO-8601 (`Instant`).
       - `page`, `size`: Phân trang kết quả (mặc định trang 0, kích thước 50).
4. **Xử lý Backend & Bảng CSDL Tác động**:
   - Bảng tác động: `ADMIN_AUDIT_LOG` (được tạo bởi Flyway Migration `V13__admin_audit_log.sql`, có index trên `created_at DESC` và `action`).
   - Xây dựng JPA `Specification`: Lọc theo tập danh sách action của nhóm tương ứng (`actionsOfGroup(group)`), kiểm tra hợp lệ nhóm trước khi truy vấn, kết hợp bộ lọc thời gian và action cụ thể.
   - Sắp xếp kết quả theo `created_at DESC` và phân trang qua `PageRequest`.
   - Che địa chỉ IP qua `AdminAuditService.maskIp()` trước khi trả response về Frontend.
5. **Response DTO & UI Mutation**:
   - **Status Code**: `200 OK`. Body: `AdminAuditLogPageResponse`:
     ```json
     {
       "items": [
         {
           "id": "1",
           "timestamp": "2026-11-14T08:30:00Z",
           "actorUsername": "admin",
           "action": "USER_SUSPENDED",
           "targetType": "USER",
           "targetId": "15",
           "detail": "reason=TERMS_VIOLATION, note=Vi phạm quy định",
           "maskedIp": "192.168.1.***"
         }
       ],
       "page": 0,
       "size": 50,
       "totalElements": 1
     }
     ```
   - **UI Mutation**: AuditLogsTab hiển thị bảng nhật ký hệ thống gồm các cột Thời gian, Tác tử, Hành động, Đối tượng, Chi tiết, và IP; hỗ trợ bộ lọc nhanh theo nhóm hành động (Tất cả, Đăng nhập, Thao tác Quản trị, Quy trình mẫu); hiển thị badge trạng thái với màu sắc chuyên biệt (đỏ cho `ADMIN_ACCESS_DENIED`, cam cho `USER_SUSPENDED`, xanh cho `USER_UNBANNED` và các hành động tạo mới).

---

### 10.6 Xác thực Đăng nhập Quản trị & Cơ chế Bảo vệ Tuyến đường (`POST /api/v1/auth/login`, `adminGuard.ts`)
1. **Mục tiêu Nghiệp vụ**: Đảm bảo quy trình đăng nhập an toàn, cơ chế bảo vệ phân quyền trên giao diện Frontend, ngăn chặn người dùng thông thường hoặc khách vãng lai truy cập trái phép vào các trang quản trị `/admin`.
   - **Sửa Hash Mật khẩu Seed Mẫu (Migration V12)**:
     - Migration `V12__fix_seed_password_hash.sql` chuẩn hóa lại mã băm BCrypt của các tài khoản mặc định (`admin`, `alex.kim`, `sarah.chen`) để khớp chính xác với mật khẩu quy chuẩn `Password123!`, chỉ cập nhật khi hash còn ở giá trị seed cũ nhằm tránh ghi đè mật khẩu đã thay đổi của người dùng.
   - **Đăng nhập Linh hoạt bằng Email hoặc Username**:
     - Cho phép người dùng đăng nhập bằng `username` hoặc địa chỉ `email`. Khi đầu vào chứa ký tự `@`, hệ thống tự động tìm kiếm tài khoản không phân biệt hoa thường qua `userRepository.findByEmailIgnoreCase(identifier)`.
   - **Cơ chế Chặn Tuyến đường Quản trị (`adminGuard.ts`)**:
     - Tuyến đường `/admin` trên Frontend được bảo vệ nghiêm ngặt:
       - Nếu chưa xác thực (`isAuthenticated == FALSE`): Chuyển hướng về trang đăng nhập (`TO_SIGNIN`).
       - Nếu đã xác thực nhưng không có vai trò Admin (`systemRole !== 'ADMIN'`): Chuyển hướng về danh sách dự án `/workspaces` (`TO_WORKSPACES`) kèm thông báo cảnh báo "Chỉ quản trị viên mới vào được trang này".
       - Nếu có vai trò `systemRole == 'ADMIN'`: Cho phép truy cập vào Admin Portal (`ALLOW`).
   - **Điều hướng Tự động Sau Đăng nhập**:
     - Hàm định tuyến `homePathFor(systemRole)` tự động đưa tài khoản có quyền `ADMIN` vào thẳng `/admin` ngay sau khi đăng nhập thành công, trong khi tài khoản người dùng thông thường (`USER`) được đưa vào danh sách không gian làm việc `/workspaces`.
2. **Luồng Mã Nguồn**:
   - `src/features/auth/AuthModal.tsx` / `AuthView.tsx` -> `useWorkflowStore.auth.login` -> `container.workflowService.login` -> `HttpWorkflowService` -> `AuthController.login` -> `AuthService.login`.
   - Bảo vệ Route: `src/router/adminGuard.ts` (`resolveAdminAccess`, `homePathFor`) -> `src/App.tsx` / `AdminPortalView.tsx`.
3. **Request DTO**:
   - **Method & URL**: `POST /api/v1/auth/login`
   - **Headers**: `Content-Type: application/json`
   - **Body JSON**:
     ```json
     {
       "username": "admin@pipeline.engine",
       "password": "Password123!"
     }
     ```
4. **Xử lý Backend & Bảng CSDL Tác động**:
   - Bảng tác động: `USERS`, `REFRESH_TOKEN`, `ADMIN_AUDIT_LOG`.
   - Kiểm tra `identifier`: nếu có ký tự `@`, gọi `userRepository.findByEmailIgnoreCase()`, ngược lại gọi `userRepository.findByUsername()`.
   - So khớp mật khẩu với BCrypt `passwordEncoder.matches()`. Nếu user không tồn tại, thực hiện so khớp giả định với dummy BCrypt hash để phòng chống tấn công dò tìm tài khoản qua độ trễ thời gian (Timing Attack).
   - Kiểm tra cờ `is_locked`: Nếu tài khoản đang bị khóa, ghi audit log `ACCOUNT_LOCKED_LOGIN` và ném `ForbiddenException(ACCOUNT_LOCKED)`.
   - Nếu đăng nhập thành công: Nếu tài khoản có vai trò `SystemRole.ADMIN`, ghi audit log `LOGIN_SUCCESS`. Sinh cặp JWT Access Token và Refresh Token, lưu Refresh Token vào CSDL.
5. **Response DTO & UI Mutation**:
   - **Status Code**: `200 OK`. Body: `AuthResponse` (`accessToken`, `refreshToken`, `user: { id, username, email, fullName, systemRole, ... }`).
   - **UI Mutation**: Frontend lưu Access Token vào bộ nhớ, cập nhật `systemRole` vào Auth state; kiểm tra `homePathFor(user.systemRole)` và tự động chuyển hướng Admin vào `/admin`, kích hoạt nạp dữ liệu thống kê Overview; người dùng thường chuyển vào `/workspaces`.

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
