# D1 — Workspace: danh sách dự án, tạo dự án, đổi trạng thái (Cụm 3.1, 3.2)

Người làm: D
Người review: A
Trạng thái: chờ kiểm
Cần có trước: T0
Cần trước bước frontend: A2
Mở khóa: D2, D3
Nhánh git: d1-workspace
Ước lượng: 1–1,5 ngày

> ⚡ **Chế độ sprint:** Claude làm hết các bước, kể cả 🧠; bỏ qua Bước 0 và mục "Dành cho Claude". Luồng làm: [SPRINT_2_NGAY.md](../SPRINT_2_NGAY.md) mục 2–3.
> - **Claude tự chạy bằng dòng lệnh:** `GET /projects?tab=mine` và `tab=shared` với alex, sarah; `PATCH` dự án DRAFT sang ACTIVE → 409.
> - **Dời về buổi kiểm chung (mục 7):** tạo dự án mới từ template → trạng thái DRAFT (bảng 7.2 dòng 7).
> - **Không làm trong sprint:** bước 6 (phần frontend).

## Vì sao cần task này
Đọc code thấy các vấn đề sau:
- Dự án mới đang được tạo với trạng thái `PLANNING`. SSOT mục 3.2 ghi `DRAFT`, và vòng đời trong `workflow-engine.md` mục 5.1 không có `PLANNING`.
- `GET /projects` chưa hỗ trợ tham số `tab` và `sort`. Các số `nodeCount`, `activeNodes`, `doneNodes` cũng cần kiểm lại.
- **Lỗ hổng (đã vá một nửa, cập nhật 11/11/2026):** `TemplateCloneService.cloneTemplate` nay tìm template trước (theo id rồi theo slug). Nhưng nếu **không** có template trùng id, code vẫn rơi sang `projectRepository.findById(numericId)` và clone dự án đó **mà không kiểm quyền**. Ai cũng clone được toàn bộ đồ thị dự án của người khác chỉ bằng cách đoán id. `POST /projects` có `templateId` nay cũng đi qua hàm clone này.
- `PATCH /projects/{id}/status` cho đổi sang trạng thái nào cũng được.

## Kiến thức phải nắm
Truy vấn có điều kiện (theo tab), sắp xếp, đếm theo nhóm (`GROUP BY status`), máy trạng thái của dự án, lỗ hổng IDOR (Insecure Direct Object Reference).

## Bước 0 — Tự đọc, không dùng AI
Đọc: integration map 3.1, 3.2; `docs/specs/workflow-engine.md` mục 5.1; `BE/controller/ProjectController.java`, `BE/service/ProjectService.java`, Bước 1–2 trong `BE/service/TemplateCloneService.java`, `BE/repository/ProjectRepository.java`, `BE-test/service/ProjectServiceTest.java`; `FE/components/workspace/WorkspaceView.tsx`, `CreatePipelineModal.tsx`, `FE/store/slices/workspaceSlice.ts`, `FE/mappers/projectMapper.ts`.
Trả lời:
1. IDOR là gì? Chỉ ra dòng code clone gây ra IDOR.
2. Tab `mine`, `shared`, `archived` lọc theo điều kiện gì?
3. Những lần chuyển trạng thái dự án nào là hợp lệ? Vẽ nháp rồi so với đặc tả bên dưới.

## Được đọc
> Viết tắt: `BE/` = `wpe-backend/src/main/java/com/pipeline/wpe/`, `BE-test/` = `wpe-backend/src/test/java/com/pipeline/wpe/`, `FE/` = `wpe-frontend/src/`.
- `wpe-backend/src/**`, `FE/**`, `docs/**`

## Được ghi
- `BE/controller/ProjectController.java`, `BE/service/ProjectService.java`
- `BE/service/TemplateCloneService.java` (Bước 1–2 và trạng thái dự án mới)
- `BE/repository/ProjectRepository.java`, `BE/repository/NodeRepository.java` (chỉ thêm method), `BE/dto/project/**`
- `BE-test/service/ProjectServiceTest.java`, `BE-test/service/TemplateCloneServiceTest.java`, `BE-test/controller/ProjectControllerTest.java`
- `FE/components/workspace/WorkspaceView.tsx`, `CreatePipelineModal.tsx`, `ProjectCard.tsx`, `FE/store/slices/workspaceSlice.ts`, `FE/mappers/projectMapper.ts`, `FE/services/impl/http/workspace.ts`, `FE/types/workspace.types.ts`, test FE
- `docs/specs/workflow-engine.md` (5.1), `docs/FRONTEND_BACKEND_INTEGRATION_MAP.md` (3.1–3.2), `docs/tasks/D-du-an/D1-workspace-du-an.md`

## Đặc tả đã chốt
- Tạo dự án và clone dự án: `status = DRAFT`.
- Clone **chỉ** đọc từ bảng `pipeline_template` (bỏ nhánh tìm theo id dự án). Nhân bản một dự án có sẵn: ngoài phạm vi, không làm.
- `GET /api/v1/projects?tab=all|mine|shared|archived&sort=ts|done|nodes`:
  - `all`: mọi dự án mình là thành viên (chưa bị xóa), trừ ARCHIVED;
  - `mine`: dự án mình là owner;
  - `shared`: dự án mình là thành viên nhưng không phải owner;
  - `archived`: dự án ARCHIVED mà mình là thành viên.
  - `sort`: `ts` = `updatedAt` giảm dần; `done` = `doneNodes` giảm dần; `nodes` = `nodeCount` giảm dần.
  - Mặc định `tab=all`, `sort=ts`.
- Số liệu: `nodeCount` = tổng node; `activeNodes` = TODO + IN_PROGRESS + REVIEW; `doneNodes` = DONE. Tính bằng 1 truy vấn `GROUP BY` (không N+1).
- `PATCH /projects/{id}/status` (chỉ OWNER) cho phép:
  - `ACTIVE ↔ PAUSED`;
  - `ACTIVE`, `PAUSED`, `INACTIVE` → `ARCHIVED`;
  - `ARCHIVED → ACTIVE` (khôi phục);
  - `ACTIVE → COMPLETED`.
  - `DRAFT` hoặc `PLANNING` → `ACTIVE` **chỉ đi qua xuất bản** (B4) → 409 `USE_PUBLISH`.
  - Trường hợp khác → 409 `INVALID_PROJECT_STATUS`.
- FE (sau A2): Workspace và `CreatePipelineModal` chạy API thật; gửi `tab`, `sort` dạng query.

## Việc cần làm
1. 🧠 Bước 0.
2. 🧠 Viết trước ít nhất 12 test case dạng bảng.
3. 🧠 Viết test chứng minh lỗ hổng IDOR **trước khi sửa** (test đỏ), rồi sửa cho test xanh.
4. 🤝 Code phần còn lại, kèm test.
5. 🧠 Tự viết hàm kiểm chuyển trạng thái dự án (bảng các cặp được phép) kèm test.
6. 🤝 Phần FE (cần A2 đã merge).

## Tiêu chí xong
- [ ] Test pass, có test IDOR.
- [ ] `GET /projects?tab=mine`: alex thấy "Core Banking Pipeline", sarah thấy rỗng. `tab=shared`: sarah thấy "Core Banking Pipeline".
- [ ] `PATCH` một dự án DRAFT sang ACTIVE → 409 `USE_PUBLISH`.
- [ ] FE chạy thật: tạo dự án mới thì thấy ngay trong danh sách.

## Câu hỏi bảo vệ (người review hỏi, trả lời không nhìn code)
1. IDOR là gì, phòng bằng cách nào? Cho thêm một ví dụ IDOR khác có thể có trong dự án.
2. Vì sao DRAFT → ACTIVE bắt buộc phải qua xuất bản?
3. Đếm bằng `GROUP BY` trong SQL khác đếm trong Java ở đâu?

## Cấm
- Sửa file ngoài mục "Được ghi". File dùng chung thì báo nhóm trước (README mục 6).
- Đọc, in, commit `.env*`, khóa, mật khẩu thật, API key. Dùng `git add -f`.
- Sửa migration đã có (V1–V4, và migration người khác đã merge).
- Tự ghi trạng thái `xong`. Chỉ người review ghi sau khi kiểm.

## Dành cho Claude (đọc trước khi làm)
Người dán file này là **người làm** task. Mục tiêu kép: task chạy đúng **và** người làm hiểu hết những gì đã làm.
1. Chưa sửa code vội. Yêu cầu người làm tóm tắt mục tiêu task và đọc câu trả lời Bước 0 của họ. Sai hoặc thiếu thì giải thích, rồi hỏi lại.
2. Bước 🧠: không viết hộ. Chỉ gợi ý, đặt câu hỏi dẫn dắt, chỉ chỗ sai.
3. Bước 🤝: làm từng phần nhỏ. Mỗi phần nói rõ sửa file nào, vì sao, chạy kiểm thế nào. Yêu cầu người làm tự chạy lệnh và đọc kết quả.
4. Chỉ sửa file trong "Được ghi". Cần đụng file khác, nhất là file dùng chung, thì dừng lại và nói lý do để người làm hỏi nhóm.
5. "Đặc tả đã chốt" là quyết định của nhóm, không tự đổi. Thấy đặc tả sai thì báo ra, không tự làm theo ý mình.
6. Không đọc hay in `.env*`, khóa, mật khẩu, API key.
7. Làm xong: hỏi người làm 3 câu trong "Câu hỏi bảo vệ", nhắc họ điền ghi chép bằng lời của họ, chỉ đổi trạng thái thành `chờ kiểm`.

## Ghi chép của người làm
> Viết bằng lời của bạn. Người review đọc phần này trước khi đọc code.

### Trả lời Bước 0

### Đã làm gì (file nào, vì sao)

### Kết quả test (dán output thật, không chép tay)
> Phần backend chờ kiểm. Bước frontend (Việc cần làm 6) chưa làm, chờ A2.

Chạy `mvn -B test` ngày 11/11/2026 (sprint, Claude chạy):
```
[INFO] Tests run: 119, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```
Test IDOR `TemplateCloneServiceTest#shouldNotCloneOtherUsersProject_whenIdMatchesProjectButNoTemplate` chạy với code cũ thì đỏ:
```
[ERROR] Tests run: 1, Failures: 1, Errors: 0, Skipped: 0
Expecting actual throwable to be an instance of: ...ResourceNotFoundException
```
Chạy thật trên backend local (header `X-Debug-User-Id`):
- alex `?tab=mine` → có "Core Banking Pipeline" (nodeCount 4, activeNodes 2, doneNodes 1); sarah `?tab=mine` → `[]`; sarah `?tab=shared` → "Core Banking Pipeline".
- `?tab=xyz` → 400.
- alex tạo dự án mới → `DRAFT`. Clone `tpl-sdlc` → `DRAFT`, 7 node.
- sarah gọi `POST /projects/clone-template` với `templateId` = id dự án riêng của alex → 404 `RESOURCE_NOT_FOUND` (trước khi sửa thì clone được).
- PATCH dự án DRAFT → ACTIVE: 409 `USE_PUBLISH`; DRAFT → ARCHIVED: 409 `INVALID_PROJECT_STATUS`; ACTIVE → PAUSED → ACTIVE: 200; sarah (không phải owner) PATCH: 403.

### Điều chưa chắc / cần nhóm quyết
- `ProjectSummaryResponse` được **thêm** 3 field `nodeCount`, `activeNodes`, `doneNodes` theo integration map; field cũ (`totalNodes`, `completedNodes`, `inProgressNodes`) giữ nguyên để FE không vỡ. Nhóm quyết khi nào bỏ field cũ.
- Đặc tả ghi PATCH status "chỉ OWNER", code vẫn giữ quyền của ADMIN như trước. Cần A (A6) quyết có bỏ ADMIN không.
- Đã xóa nhánh clone từ bảng `project` (Bước 4–6 cũ), vì sau khi chặn IDOR nhánh đó không còn đường vào. Clone giờ chỉ dùng `graph_data` của template.

## Nhật ký sprint (chế độ làm nhanh — xem `docs/tasks/SPRINT_2_NGAY.md`)
Đã học lại: chưa

- **Làm gì:** (Claude giao Antigravity viết code, Claude kiểm) Dự án mới/clone về DRAFT; vá IDOR clone (chỉ đọc `pipeline_template`); `GET /projects?tab=&sort=` đếm node bằng 1 truy vấn GROUP BY; PATCH status kiểm bảng chuyển trạng thái (409 `USE_PUBLISH` / `INVALID_PROJECT_STATUS`).
- **File chính đã sửa:** `ProjectService.java` (`getMyProjects`, `ALLOWED_TRANSITIONS`, `countNodesByProjectIds`), `TemplateCloneService.java` (Bước 1), `NodeRepository.java` (`countByProjectIdsGroupByStatus`), `ProjectSummaryResponse.java` (`withNodeStats`), `ProjectController.java`; test: `ProjectServiceTest`, `TemplateCloneServiceTest`, `ProjectControllerTest`.
- **Vì sao làm vậy** (tự viết):
- **Cần học lại:** IDOR (vì sao `projectRepository.findById` trong clone là lỗ hổng); truy vấn `GROUP BY` trả `List<Object[]>` và cách gom trong `countNodesByProjectIds`; bảng `ALLOWED_TRANSITIONS` (tự vẽ lại sơ đồ state dự án); 3 câu hỏi bảo vệ.
