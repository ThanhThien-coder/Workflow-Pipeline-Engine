# S01 — Backend phát đủ sự kiện realtime cho mọi thay đổi của dự án

Người làm: Người 1 (gói Realtime và tốc độ)
Người review: Thiện
Trạng thái: chưa làm
Cần có trước: không
Mở khóa: S02, S03
Nhánh git: s01-su-kien-realtime
Ước lượng: 0,5–1 ngày

## Vì sao cần task này (lỗi gốc #26)
Hiện realtime chỉ có một nửa:
- Backend chỉ phát `PROJECT_TASKS_CHANGED` khi **task** đổi: tạo, sửa, xóa task, nối dây, đổi trạng thái, nộp bài, phân công, xóa phase, publish.
- Các thay đổi sau **không phát gì**, nên người khác đang mở dự án không thấy cho tới khi F5:
  - tạo, đổi tên, kéo, nối hoặc gỡ phase;
  - thành viên vào, đổi vai trò, bị xóa (chỉ người bị đổi nhận thông báo);
  - đổi tên dự án, lưu trữ hoặc khôi phục dự án, xóa dự án;
  - thêm, xóa, ẩn artifact;
  - khách gửi góp ý, xử lý góp ý;
  - AI phân tích xong.
- Sự kiện cũng không cho biết **ai** gây ra. Vì vậy người vừa thao tác cũng nhận lại sự kiện của chính mình và tải lại thêm một lần nữa (một nguyên nhân gây lag ở lỗi #4).

## Đang làm gì (tóm tắt cho người đọc)
1. Thêm một sự kiện chung `PROJECT_CHANGED` có trường `resource` cho biết phần nào vừa đổi.
2. Thêm `actorUserId` (ai gây ra) vào cả sự kiện cũ `PROJECT_TASKS_CHANGED` và sự kiện mới.
3. Gọi phát sự kiện ở mọi chỗ còn thiếu.

Frontend dùng các sự kiện này ở S02.

## Kiến thức phải nắm
SSE (`SseEmitter`), gửi sau commit bằng `TransactionSynchronization.afterCompletion`, tách "báo đổi" khỏi "gửi dữ liệu" (client tự tải lại phần cần).

## Bước 0 — Tự đọc (15 phút, không cần AI)
Đọc `BE/service/event/ProjectRealtimeNotifier.java` và `BE/service/event/SseEmitterService.java`. Trả lời:
1. Sự kiện được gửi lúc nào so với lúc commit transaction? Vì sao không gửi ngay?
2. Ai nhận `PROJECT_TASKS_CHANGED`? Người vừa bị xóa khỏi dự án có nhận không?

## Được đọc
> Viết tắt: `BE/` = `wpe-backend/src/main/java/com/pipeline/wpe/`, `BE-test/` = `wpe-backend/src/test/java/com/pipeline/wpe/`, `FE/` = `wpe-frontend/src/`.
- `wpe-backend/src/**`, `docs/FRONTEND_BACKEND_INTEGRATION_MAP.md`, `docs/specs/**`

## Được ghi
- `BE/service/event/ProjectRealtimeNotifier.java`
- Gọi phát sự kiện (chỉ thêm dòng gọi notifier, không đổi logic): `BE/service/WorkflowGraphService.java`, `BE/service/ProjectMemberService.java`, `BE/service/ProjectInvitationService.java`, `BE/service/ProjectService.java`, `BE/service/ArtifactService.java`, `BE/service/FeedbackQueueService.java`, `BE/service/ai/AiDiagnosticService.java`, `BE/service/engine/StateMachineService.java`, `BE/service/NodeAssignmentService.java`
- Test trong `BE-test/**` cho các file trên (sửa test cũ chỉ để thêm mock `ProjectRealtimeNotifier` hoặc tham số mới)
- `docs/FRONTEND_BACKEND_INTEGRATION_MAP.md` (mục realtime/SSE)
- File task này

## Đặc tả đã chốt
- **Sự kiện mới** `PROJECT_CHANGED`, gửi tới chủ dự án và mọi thành viên đang hoạt động (giống người nhận `PROJECT_TASKS_CHANGED`). Payload JSON:
  ```json
  { "projectId": "12", "resource": "GRAPH", "reason": "PHASE_CREATED", "actorUserId": "5", "phaseId": "40", "taskId": null }
  ```
  - `resource` ∈ `GRAPH | MEMBERS | PROJECT | ARTIFACTS | FEEDBACK | AI`.
  - `actorUserId` là chuỗi; `null` nếu không có người thao tác (khách gửi góp ý, job chạy nền).
- **Sự kiện cũ** `PROJECT_TASKS_CHANGED`: giữ nguyên tên và các field cũ, **thêm** field `actorUserId` vào cuối record `ProjectTasksChangedPayload`. Thêm overload `notifyTasksChanged(projectId, phaseId, taskId, reason, actorUserId)`. Overload cũ (không có actor) gọi overload mới với `null`. Các chỗ đang gọi mà có `currentUserId` trong tay thì chuyển sang overload mới.
- Notifier thêm hàm `notifyProjectChanged(Long projectId, String resource, String reason, Long actorUserId, Long phaseId, Long taskId)`. Cách gửi giống `notifyTasksChanged`: chỉ gửi sau khi commit thành công, lỗi gửi chỉ ghi log.
- Chỗ cần phát (resource / reason):

  | Service.hàm | resource | reason |
  | :-- | :-- | :-- |
  | `WorkflowGraphService.createPhase` | GRAPH | PHASE_CREATED |
  | `WorkflowGraphService.updatePhase` | GRAPH | PHASE_UPDATED (đổi tên, kéo vị trí) |
  | `WorkflowGraphService.connectPhases` / `disconnectPhases` | GRAPH | PHASE_LINKED / PHASE_UNLINKED |
  | `ProjectMemberService.updateRole` | MEMBERS | ROLE_CHANGED |
  | `ProjectMemberService.removeMember` | MEMBERS | MEMBER_REMOVED |
  | `ProjectInvitationService.acceptInvitation` | MEMBERS | MEMBER_JOINED |
  | `ProjectService.updateProject` | PROJECT | PROJECT_UPDATED |
  | `ProjectService.updateProjectStatus` | PROJECT | STATUS_CHANGED |
  | `ProjectService.deleteProject` | PROJECT | PROJECT_DELETED (lấy danh sách người nhận **trước** khi xóa) |
  | `ArtifactService.createArtifact` / `deleteArtifact` / `toggleRepositoryVisibility` | ARTIFACTS | ARTIFACT_ADDED / ARTIFACT_REMOVED / ARTIFACT_UPDATED |
  | `StateMachineService.submitTaskArtifact` | ARTIFACTS (thêm, ngoài `PROJECT_TASKS_CHANGED` đang có) | ARTIFACT_ADDED |
  | `FeedbackQueueService.submitGuestFeedback` | FEEDBACK | FEEDBACK_CREATED (actor null) |
  | `FeedbackQueueService.resolveFeedback` | FEEDBACK | FEEDBACK_RESOLVED |
  | `AiDiagnosticService.triggerAiDiagnostics` (sau khi lưu kết quả) | AI | AI_ANALYZED |

  `deletePhase` đang phát `PROJECT_TASKS_CHANGED` thì giữ nguyên, chỉ thêm `actorUserId`.
- `updatePhase` được gọi mỗi lần thả thẻ phase (đã debounce 300ms phía FE). Phát mỗi lần là chấp nhận được; FE S02 sẽ gộp.

## Việc cần làm
1. 🧠 Trả lời Bước 0.
2. 🤝 Sửa `ProjectRealtimeNotifier`: thêm `actorUserId`, overload, `notifyProjectChanged`, test payload và việc chỉ gửi sau commit.
3. 🤝 Thêm lời gọi ở từng chỗ trong bảng. Service nào chưa inject `ProjectRealtimeNotifier` thì thêm vào constructor (Lombok `@RequiredArgsConstructor`), và thêm `@Mock` tương ứng trong test của service đó.
4. 🤝 Test: mỗi dòng trong bảng có ít nhất 1 test Mockito `verify(notifier).notifyProjectChanged(eq(projectId), eq("GRAPH"), eq("PHASE_CREATED"), eq(actorId), any(), any())` (hoặc tương đương).
5. Cập nhật `docs/FRONTEND_BACKEND_INTEGRATION_MAP.md`: danh sách sự kiện SSE, payload, resource, reason.

## Tiêu chí xong
- [ ] `./mvnw -q test` xanh; số test ≥ mốc trước khi làm + test mới; không xóa/skip test.
- [ ] Mọi dòng trong bảng có test verify.
- [ ] Payload `PROJECT_TASKS_CHANGED` có `actorUserId`; field cũ không đổi tên.
- [ ] Kiểm tay trên stack thử (README mục 4): mở 2 trình duyệt cùng dự án, một bên tạo phase. Bên kia mở DevTools → Network → `subscribe` → EventStream thấy `PROJECT_CHANGED` resource `GRAPH`. (Giao diện chưa tự cập nhật là đúng, việc đó thuộc S02.)

## Câu hỏi bảo vệ
1. Vì sao sự kiện chỉ báo "phần nào đổi" mà không gửi kèm dữ liệu mới?
2. Nếu transaction rollback thì có ai nhận sự kiện không? Vì sao?
3. `actorUserId` dùng để làm gì ở frontend?

## Cấm
- Đổi tên hoặc xóa sự kiện SSE đang có (`PROJECT_TASKS_CHANGED`, `TASK_*`, `NOTIFICATION_RECEIVED`), vì frontend đang nghe.
- Đổi logic nghiệp vụ của các service (chỉ thêm lời gọi phát sự kiện).
- Đọc, in `.env*`, khóa, mật khẩu. Tự ghi trạng thái `xong`.

## Dành cho Claude (đọc trước khi làm)
- Đọc `docs/tasks/S-sau-deploy/README.md` mục 3 và 5 (cách chạy test, luật chung) trước.
- Hỏi người làm câu trả lời Bước 0 trước khi sửa code; bước 🧠 chỉ gợi ý, không làm hộ.
- Làm từng service một, chạy test của service đó sau mỗi bước, cuối cùng chạy toàn bộ `./mvnw -q test`.
- Chỉ sửa file trong "Được ghi". Làm xong: điền "Ghi chép của người làm", đổi trạng thái thành `chờ kiểm`, hỏi người làm 3 câu bảo vệ.

## Ghi chép của người làm
