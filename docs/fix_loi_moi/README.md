# Fix lỗi mới (đợt test 13/11/2026)

> Nguồn: [test sơ.md](test%20sơ.md) (24 lỗi ghi khi bấm thử). Mỗi lỗi đã được lần trong code để tìm nguyên nhân. Mỗi task có sẵn **nguyên nhân, file cần sửa, cách sửa đã chốt và cách kiểm**, nên đưa thẳng cho Claude làm.
>
> Đợt này **chỉ fix lỗi**: không có Bước 0, bước 🧠, câu hỏi bảo vệ hay vòng hiểu.

## 1. Chia người

| Người | Phạm vi | Task |
| :--- | :--- | :--- |
| **A** | Admin phần nền: đăng nhập, quyền ADMIN, API admin, nhật ký hệ thống | FA1 → FA2 → FA3 |
| **D** | Làm lại giao diện admin cùng A: Overview admin, chi tiết workspace, template trong admin | FD3 → FD1 → FD2 |
| **B** | Luồng chính: tạo dự án → vẽ đồ thị → giao task → task chạy → artifact → xong | FB1 → FB2 → FB3 → FB4 → FB5 → FB6 → FB7 → FB8 |
| **C** | Các lỗi lặt vặt còn lại: profile, Overview dự án, link khách, thông báo lời mời, lưu trữ/xóa dự án, nhật ký dự án | FC1 → FC4 → FC5 → FC2 → FC3 |

B nhận nhiều task nhất vì đó là luồng chính của app. FB7 (giao diện artifact) là task độc lập: C xong sớm thì nhận giúp B.

**File task:**
- A: [FA1 Đăng nhập + chặn /admin](FA1-dang-nhap-va-chan-admin.md) · [FA2 API admin](FA2-api-admin-nguoi-dung-workspace.md) · [FA3 Nhật ký hệ thống](FA3-nhat-ky-he-thong-admin.md)
- D: [FD3 Template trong admin](FD3-template-trong-admin.md) · [FD1 Overview admin](FD1-overview-admin-lam-lai.md) · [FD2 Chi tiết workspace](FD2-chi-tiet-workspace-admin.md)
- B: [FB1 Clone template mẫu](FB1-tao-du-an-tu-template-mau.md) · [FB2 Vị trí phase](FB2-vi-tri-phase-moi.md) · [FB3 Subtask/ghost](FB3-subtask-ghost-node-goi-api.md) · [FB4 Thành viên thật](FB4-giao-task-thanh-vien-that.md) · [FB5 Task về LOCKED](FB5-trang-thai-task-ve-locked.md) · [FB6 Artifact thật](FB6-artifact-du-lieu-that.md) · [FB7 Giao diện artifact](FB7-giao-dien-artifact.md) · [FB8 Chạy trọn luồng](FB8-kiem-tron-luong-tao-den-xong.md)
- C: [FC1 Profile](FC1-profile-hien-nguoi-khac.md) · [FC4 Lưu trữ/xóa](FC4-luu-tru-va-xoa-du-an.md) · [FC5 Nhật ký dự án](FC5-nhat-ky-hoat-dong-du-an.md) · [FC2 Overview + link khách](FC2-overview-du-an-va-link-khach.md) · [FC3 Thông báo lời mời](FC3-thong-bao-loi-moi.md)

## 2. Bảng lỗi → nguyên nhân → task

Số `L..` đánh theo thứ tự dòng trong `test sơ.md`.

| # | Lỗi | Nguyên nhân (tóm tắt) | Task |
| :--- | :--- | :--- | :--- |
| L1 | Không đăng nhập được tài khoản có sẵn | Hash BCrypt trong seed `V2` **không khớp** `Password123!` (đã có test chứng minh, đang `@Disabled`) | FA1 |
| L2 | Tạo tài khoản mới, vào thì thấy profile người khác | `container.ts` luôn dùng `MockProfileApi` (hồ sơ giả cố định), store hồ sơ không xóa khi đổi user | FC1 |
| L3 | Không đăng nhập bằng gmail được | `AuthService.login` chỉ `findByUsername` | FA1 |
| L4 | Tạo dự án chỉ được với template mặc định | Template mẫu có id dạng slug `tpl-sdlc`; FE gửi `Number("tpl-sdlc")` = `NaN` → `null` → backend báo không tìm thấy | FB1 |
| L5 | Tạo phase mới nằm ngang thay vì xuống dưới | Ở chế độ API, `createPhase` không tính vị trí, không gửi `uiMetadata`; hàm `computeSmartMacroPhasePosition` chỉ mock dùng | FB2 |
| L6 | Overview đang mock | `getOverviewData` lấy toàn bộ từ mock, chỉ ghép thêm góp ý và link khách | FC2 |
| L7 | Không sinh được link khách | Overview mock có `project.id = '1'` → gọi `POST /projects/1/guest-token` cho **dự án khác** → 403 | FC2 |
| L8 | Settings → template mẫu không tạo được dự án | Cùng nguyên nhân L4 (template tự lưu không có slug nên chạy được) | FB1 |
| L9 | Project resources vẫn mock | `artifactsSlice` khởi tạo bằng 5 artifact giả, API trả rỗng thì rơi về mock/localStorage | FB6 |
| L10 | Thêm người vào dự án không có thông báo, không chỗ chấp nhận | Backend đã lưu bảng `notification`, nhưng **chưa có API đọc thông báo**; FE dùng `MockNotificationApi` | FC3 |
| L11 | Giao diện artifact tối, không thấy gì | Style drawer/island artifact | FB7 |
| L12 | Artifact F5 hiện số 5, bấm vào thì đúng lại | Cùng nguyên nhân L9: số đầu tiên là độ dài mảng mock (5 mục) | FB6 |
| L13 | Thành viên trong task đang mock, không thấy meomeo, không giao được | `getProjectMembers` vẫn mock; `usePhaseKanban` gán người theo tên cứng `Sarah/Marcus/Jamie`; lưu người phụ trách chỉ sửa store | FB4 |
| L14 | Sang tab khác quay lại, task về LOCKED | `usePhaseKanban` đổi LOCKED thành TODO để hiển thị; kéo task "không có trong API" chỉ sửa store; đọc lại từ server thì về LOCKED | FB5 |
| L15 | Thêm ghost node thì không thêm subtask được, tạo cái kia thì subtask mất | Subtask và node gộp chỉ thêm vào store (`updateTree`), không gọi API; thêm ghost gọi `resetPhaseTree` đọc lại server nên xóa mất subtask | FB3 |
| L16 | System log (dự án) đang mock | `getProjectAuditLogs` vẫn mock, backend chưa có API | FC5 |
| L17 | Xóa dự án phải gõ tên, mà vẫn không xóa được | Modal bắt gõ đúng tên; `deleteProject` vẫn mock, backend **không có** `DELETE /projects/{id}` | FC4 |
| L18 | Không chuyển dự án sang lưu trữ được | `ProjectService.ALLOWED_TRANSITIONS` không có DRAFT, PLANNING, COMPLETED → ARCHIVED (dự án mới luôn là DRAFT) | FC4 |
| L19 | Admin đang mock hết | `container.ts` luôn dùng `MockAdminService`; backend **không có** API admin | FA2, FD1 |
| L20 | Overview admin thừa thông tin | Tab Analytics hiện số liệu giả không tính được từ DB | FD1 |
| L21 | Quản lý workspace: nút "Xem chi tiết" mở DAG của người ta | `onInspectPipeline` mở đồ thị dự án (admin không được xem nội dung task) | FD2 |
| L22 | System log admin không biết hiện gì | `getSecurityAuditLogs` mock; không có bảng nhật ký | FA3 |
| L23 | Template của meo hiện trong admin, đăng xuất vào lại thì mất | Route `/admin` **không kiểm quyền**, user thường vào được; catalog trả cả template PRIVATE của người đang đăng nhập | FA1, FD3 |
| L24 | Vào admin không lưu được template vì không có role ADMIN | Tài khoản `admin` không đăng nhập được (L1) nên phải dùng tài khoản thường → backend trả 403 | FA1, FD3 |

## 3. Thứ tự và phụ thuộc

- **FA1 làm đầu tiên**, merge sớm: không có nó thì không ai đăng nhập được tài khoản mẫu để kiểm.
- FA2 trước FD2 (cùng sửa `WorkspacesTab.tsx`: A làm phần gọi service, D làm phần giao diện).
- FA3 trước khi FD3 thêm ghi nhật ký cho template (chỉ phần tùy chọn trong FD3).
- FC5 trước FC2 (Overview dùng lại API hoạt động gần đây của FC5).
- FB4 kiểm "meomeo trong danh sách thành viên" cần meomeo chấp nhận lời mời: chưa có FC3 thì chấp nhận bằng Swagger.
- Còn lại chạy song song được.

## 4. Luật để 4 người không đụng nhau

- Mỗi task chỉ sửa file trong mục **"Được sửa"** của task đó. Cần đụng file khác thì dừng lại hỏi người chủ.
- `HttpWorkflowService.ts`: mỗi task chỉ sửa đúng các phương thức ghi trong task, và chỉ xóa đúng dòng của mình trong `METHODS_STILL_MOCKED`.
- `container.ts`: FA2 sửa dòng `adminService`; FC1 sửa dòng `profileService`; FC3 sửa dòng `notificationService`.
- `App.tsx`: chỉ FA1 sửa (chặn route `/admin`).
- `ProjectService.java`: chỉ FC4 sửa đợt này.
- **Số migration đề xuất:** `V12` cho FA1 (sửa hash seed), `V13` cho FA3 (bảng nhật ký admin). Báo nhóm và thêm 2 dòng này vào `docs/tasks/README.md` mục 6.2 **trước** khi tạo file. Không sửa migration cũ.

## 5. Lệnh dán cho Claude

Mở Claude Code trong repo rồi dán (đổi tên file):

```text
Làm task docs/fix_loi_moi/<file>.md. Đây là task fix lỗi, không cần giải thích hay hỏi bài.
- Đọc mục "Nguyên nhân" và "Cách sửa", mở đúng các file đó trong code để xác nhận trước khi sửa.
- Viết test tái hiện lỗi (nếu task có ghi), chạy thấy fail rồi mới sửa cho pass.
- Chỉ sửa file trong mục "Được sửa". Cần sửa file khác thì dừng lại hỏi tôi.
- Chạy test backend (./mvnw test hoặc mvn test) và frontend (npm run typecheck && npm test) liên quan.
- Ghi kết quả thật vào mục "Kết quả" cuối file task, đổi "Trạng thái" thành "chờ kiểm".
- Bước nào cần bấm trên trình duyệt thì liệt kê lại cho tôi kiểm.
Không commit, push khi tôi chưa bảo.
```

## 6. Kiểm chung sau khi merge hết

Làm lại đúng danh sách trong `test sơ.md`, đánh dấu từng dòng L1–L24 đạt hay không, ghi vào cuối file này.

| # | Đạt? | Ghi chú |
| :--- | :--- | :--- |
| L1–L24 | | |

## 7. Task mới phát hiện khi kiểm tay (14/11), chờ nhóm xem rồi chia người

Nguồn: kiểm tay bản gộp FC1–FC5 trên app thật (backend + DB + trình duyệt). Các lỗi này nằm ngoài file mà task C được sửa nên tách thành task mới. **Chưa chia người**, cột "Đề xuất" chỉ để nhóm tham khảo.

| # | Lỗi | Nguyên nhân (tóm tắt) | Task | Đề xuất |
| :--- | :--- | :--- | :--- | :--- |
| L25 | Mở link khách báo "Link unavailable"; trang khách còn số giả | `HttpGuestService.getLinkInfo` (và 6 phương thức khác) vẫn gọi mock; backend chưa có API thông tin link; `velocity`/`recentActivity` của `/guest/{token}/overview` là mảng cứng | [FN1](FN1-trang-khach-dung-api-that.md) | C |
| L26 | Mở thẳng URL dự án hoặc F5: thanh bên ghi "Marketing Campaign Q4", thành viên giả | `ProjectWorkspaceView` rơi về chuỗi cứng và `DEV_PERSONAS` khi danh sách workspace chưa tải | [FN2](FN2-thanh-ben-du-an-ten-va-thanh-vien-gia.md) | C |
| L27 | Workflow: "Failed to load phase tasks", gọi `/projects/1/my-tasks` | `MindmapDrawer` gọi `usePhaseKanban(phase)` không truyền `projectId`, hook mặc định `'1'` | [FN3](FN3-kanban-phase-dinh-du-an-1.md) | B (chung file FB4) |
| L28 | Đăng xuất: console báo lỗi tải hồ sơ (người dùng không thấy) | `GlobalProfileMenu` vẫn gọi `loadProfile()` khi `currentUserId` về rỗng | [FN4](FN4-profile-loi-console-khi-dang-xuat.md) | C |

Ghi chú:
- FN1 bước 6 (đánh giá của khách) cần bảng mới, tức **migration mới**: nhóm quyết có làm đợt này không, nếu làm thì đặt số migration như mục 4.
- Kết quả kiểm tay FC1–FC5: 9/11 bước đạt; 2 bước còn lại của FC2 chính là L25 và L26.
