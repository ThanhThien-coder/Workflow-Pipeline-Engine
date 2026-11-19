# S02 — Frontend: một kết nối realtime cho cả tab, tự làm mới đúng phần vừa đổi

Người làm: Người 1 (gói Realtime và tốc độ)
Người review: Thiện
Trạng thái: xong
Cần có trước: S01
Mở khóa: S03
Nhánh git: s02-realtime-frontend
Ước lượng: 1 ngày

## Vì sao cần task này (lỗi gốc #26, một phần #4)
- Mỗi tab đang mở **2–3 kết nối SSE riêng**:
  - `FE/components/common/NotificationBell.tsx`: chuông thông báo, luôn mở;
  - `FE/hooks/usePhaseKanban.ts`: khi đang mở một phase;
  - `FE/views/MyTasksView.tsx`: khi ở My Tasks.

  Mỗi chỗ gọi `workflowService.connectRealtime(...)` và tạo `EventSource` mới. Khi truy cập qua `http://` (HTTP/1.1), trình duyệt chỉ cho 6 kết nối tới một tên miền. Các kết nối SSE chiếm chỗ nên request API phải xếp hàng.
- Chỉ màn chi tiết phase và My Tasks tự cập nhật. Màn phase (Macro) khi chưa mở phase nào, Overview, Settings, Artifacts đều đứng yên cho tới khi F5.
- Khi nhận sự kiện, `usePhaseKanban` gọi cả `resetPhaseTree` lẫn `loadPhases` (tải lại toàn bộ). Nó tải lại cả khi chính mình vừa gây ra thay đổi.

## Đang làm gì (tóm tắt cho người đọc)
1. Gom realtime về **một "hub"**: một `EventSource` cho cả tab. Các màn đăng ký nghe qua hub.
2. Thêm một bộ nghe cấp dự án (`useProjectRealtime`) gắn ở trang dự án. Nhận sự kiện của S01 thì tải lại **đúng phần** vừa đổi (đồ thị, thành viên, artifact, Overview…), mỗi phần 1 lần (gộp trong ~400ms).
3. **Bỏ qua sự kiện do chính mình gây ra** (`actorUserId` = mình), vì giao diện mình đã tự cập nhật rồi.

## Kiến thức phải nắm
`EventSource` (mỗi tên sự kiện cần `addEventListener` riêng), mẫu publish/subscribe, đếm số người đăng ký để mở/đóng kết nối, debounce.

## Bước 0 — Tự đọc (20 phút)
Đọc `FE/services/impl/HttpWorkflowService.ts` hàm `connectRealtime`, rồi 3 chỗ đang gọi nó (kể trên). Trả lời:
1. Khi token hết hạn hoặc mất mạng, `connectRealtime` xử lý thế nào (thời gian chờ thử lại)?
2. Mở trang dự án, vào một phase rồi sang My Tasks: lúc đó có bao nhiêu `EventSource` đang mở?

## Được đọc
- `wpe-frontend/src/**`, `docs/FRONTEND_BACKEND_INTEGRATION_MAP.md` (mục SSE do S01 cập nhật)

## Được ghi
> `FE/` = `wpe-frontend/src/`
- `FE/services/realtime/realtimeHub.ts` (MỚI), `FE/hooks/useProjectRealtime.ts` (MỚI)
- `FE/services/impl/HttpWorkflowService.ts` (chỉ phần `connectRealtime`: chuyển sang dùng hub, giữ nguyên chữ ký)
- `FE/hooks/usePhaseKanban.ts` (chỉ bỏ khối `useEffect` SSE tự tải lại)
- `FE/views/MyTasksView.tsx`, `FE/components/common/NotificationBell.tsx` (chỉ nếu cần đổi cách đăng ký)
- `FE/views/ProjectWorkspaceView.tsx` (chỉ gắn `useProjectRealtime(projectId)`)
- Test mới/sửa trong `FE/**/__tests__/**` liên quan
- File task này

## Đặc tả đã chốt
- **`realtimeHub.ts`**:
  - `subscribe(handler: (eventName: string, data: unknown) => void): () => void`.
  - Mở đúng **một** `EventSource` khi có người đăng ký đầu tiên. Đóng khi không còn ai, chờ ~2 giây trước khi đóng để đổi trang không phải nối lại.
  - Giữ nguyên logic hiện có của `connectRealtime`: lấy token tươi bằng `ensureFreshAccessToken` (token null thì không mở và không thử lại), thử lại với thời gian chờ tăng dần 3s→30s, reset khi nhận `INIT`.
  - Đăng ký listener cho mọi sự kiện: `INIT`, `TASK_UNLOCKED`, `TASK_STATUS_CHANGED`, `TASK_OVERDUE`, `TASK_SUBMITTED`, `TASK_REJECTED`, `NOTIFICATION_RECEIVED`, `PROJECT_TASKS_CHANGED`, `PROJECT_CHANGED`.
  - Các sự kiện `TASK_*` vẫn đổi dữ liệu qua `mapBackendTaskToKanban` như hiện tại.
- **`HttpWorkflowService.connectRealtime(userId, onEvent)`** giữ chữ ký, bên trong gọi `realtimeHub.subscribe(onEvent)`. Nhờ vậy `NotificationBell`, `MyTasksView` gần như không phải đổi mà vẫn dùng chung 1 kết nối. Chế độ mock (`MockWorkflowService`) giữ nguyên.
- **`useProjectRealtime(projectId)`**, gắn 1 lần trong `ProjectWorkspaceView`:
  - Chỉ xử lý sự kiện có `projectId` trùng dự án đang mở.
  - Bỏ qua nếu `actorUserId` = id người đang đăng nhập (`auth.currentUser.id`).
  - Gộp theo `resource` trong ~400ms rồi gọi:

    | Sự kiện / resource | Làm gì |
    | :-- | :-- |
    | `PROJECT_TASKS_CHANGED`, `PROJECT_CHANGED` + `GRAPH` | `loadPhases(projectId)`. Đang ở My Tasks thì thêm `kanban.loadTasks(projectId)`; người xem là Owner/Manager thì thêm `kanban.loadReviewTasks(projectId)` |
    | `MEMBERS` | `project.loadProject(projectId)`, `kanban.loadMembers(projectId)`; nếu `settings.settings?.id === projectId` thì `settings.loadSettings(projectId)` |
    | `PROJECT` | `project.loadProject(projectId)` (+ settings như trên). reason `PROJECT_DELETED` → toast "This project was deleted." rồi `navigate('/workspaces')` |
    | `ARTIFACTS` | `artifacts.loadArtifacts(projectId)` |
    | `FEEDBACK`, `AI` | nếu Overview đã tải cho dự án này (`overview.projectId === projectId`) thì `overview.load(projectId)` |

  - `loadPhases` cùng dự án là tải nền (đã có từ TASK_69, không làm nháy màn hình). Kanban của phase tự tải lại khi cây task đổi, nên không cần gọi riêng.
- **`usePhaseKanban`**: xóa khối `useEffect` đang tự `connectRealtime` + `refreshAfterWrite` + `loadPhases`. Từ nay `useProjectRealtime` làm việc này.
- Chuông thông báo vẫn xử lý `NOTIFICATION_RECEIVED` như hiện tại (kể cả phần đổi vai trò / bị xóa của TASK_71).

## Việc cần làm
1. 🧠 Trả lời Bước 0.
2. 🤝 Viết `realtimeHub.ts` + test (dùng `EventSource` giả trong jsdom): 3 người đăng ký → chỉ 1 `EventSource`; hủy hết → đóng sau thời gian chờ; lỗi → thử lại với thời gian chờ tăng dần.
3. 🤝 Chuyển `connectRealtime` sang hub, chạy lại test cũ `HttpWorkflowService.realtime.test.ts` (sửa test nếu nó đếm `EventSource`, ghi lý do).
4. 🤝 Viết `useProjectRealtime` + test bảng ánh xạ trên (mỗi resource 1 test; sự kiện của chính mình bị bỏ qua; dự án khác bị bỏ qua; 3 sự kiện GRAPH liền nhau chỉ gọi `loadPhases` 1 lần).
5. 🤝 Gắn vào `ProjectWorkspaceView`, xóa khối SSE trong `usePhaseKanban`.

## Tiêu chí xong
- [ ] `npx tsc -b` sạch, `npx vitest run` xanh (chạy từ ổ `C:` viết hoa — README mục 3).
- [ ] Kiểm tay trên stack thử (README mục 4). DevTools → Network lọc `subscribe`: mở dự án, vào phase, sang My Tasks, quay lại → luôn chỉ **1** kết nối đang mở.
- [ ] Kiểm tay 2 trình duyệt (alex ở một bên, sarah ở bên kia) cùng mở một dự án. Alex làm từng việc dưới đây, sarah thấy cập nhật **không cần F5** trong ~1 giây:
  - tạo phase, đổi tên phase, xóa phase;
  - thêm task;
  - đổi vai trò sarah;
  - thêm artifact;
  - đổi tên dự án (sidebar đổi tên).
- [ ] Alex tự thao tác: Network không thấy alex tải lại đồ thị lần thứ hai do sự kiện của chính mình.

## Câu hỏi bảo vệ
1. Vì sao gom về 1 kết nối lại nhanh hơn trên HTTP/1.1?
2. Vì sao bỏ qua sự kiện do chính mình gây ra mà không sợ lệch dữ liệu?
3. Gộp sự kiện 400ms có tác dụng gì khi chủ dự án kéo thẻ phase liên tục?

## Cấm
- Đổi chữ ký `IWorkflowService.connectRealtime`. Sửa backend (thuộc S01).
- Sửa phần khác của `usePhaseKanban` ngoài khối SSE (S04 cũng sửa file này).
- Đọc, in `.env*`, khóa. Tự ghi trạng thái `xong`.

## Dành cho Claude (đọc trước khi làm)
- Đọc `docs/tasks/S-sau-deploy/README.md` mục 3 và 5 trước. Test frontend PHẢI chạy bằng PowerShell từ `C:\...` viết hoa.
- Đọc payload `PROJECT_CHANGED` do S01 làm trong `BE/service/event/ProjectRealtimeNotifier.java` (không đoán tên field).
- Hỏi người làm Bước 0 trước. Làm theo thứ tự Việc cần làm, chạy test sau mỗi bước.
- Làm xong: điền ghi chép, đổi trạng thái `chờ kiểm`, hỏi 3 câu bảo vệ.

## Ghi chép của người làm

Xong phần code (Sonnet làm, chưa kiểm tay): xem `.kb/tasks/TASK_76.report.md`. tsc sạch, vitest 905/905 xanh.
