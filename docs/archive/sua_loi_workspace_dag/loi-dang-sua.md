# Sửa lỗi Workspace DAG

Lỗi phát hiện khi test tay với backend thật (`VITE_USE_MOCK=false`). Gặp lỗi thì ghi lại (tái hiện, nguyên nhân, hướng sửa); chỉ sửa code khi được bảo. Cách sửa theo [README.md](README.md). Task sửa: [tasks/](tasks/README.md) (T1: G5, G9 · T2: G4, G6 · T3: G7, G8, G11 · T4: G10 · T5: G3 · T6: G8, G12).

| # | Lỗi | Khu vực | Trạng thái |
|---|---|---|---|
| G1 | Tạo dự án từ template mẫu (SDLC, Marketing, DevOps) bị lỗi, chỉ tạo được dự án trống | FE | Đã sửa, chờ test tay |
| G2 | Phase mới tạo nằm ngang, dính sát nhau, phải bấm Auto Layout mới xếp đúng | FE | Đã sửa, chờ test tay |
| G3 | Dây nối giữa các phase khó đọc: không có hướng, đè lên nhau, cắt qua thẻ | FE | Đã sửa (T5), chờ test tay |
| G4 | Artifacts là dữ liệu giả: nút trên Workflow hiện số 5 (bấm vào về 0), Settings → Project Resources hiện 5 link giả | FE | Đã sửa (T2), chờ test tay |
| G5 | Thanh bên hiện thành viên giả (AK, SC, ML, +1) và tên dự án giả "Marketing Campaign Q4" | FE | Đã sửa (T1), chờ test tay |
| G6 | Drawer Artifacts nền đen, khó nhìn, lệch tông với cả app | FE | Đã sửa (T2), chờ test tay |
| G7 | Subtask không được lưu lên server: gắn ghost vào subtask báo lỗi, gắn ghost vào task gốc thì subtask biến mất | FE + BE | Đã sửa (T3), chờ test tay |
| G8 | Node Properties cho chọn trạng thái tùy ý (LOCKED, DONE…), lưu chỉ trên trình duyệt | FE | Đã sửa (T3, T6), chờ test tay |
| G9 | Danh sách thành viên trong Node Properties và Kanban là người giả, thiếu chủ dự án thật | FE | Đã sửa (T1), chờ test tay |
| G10 | Kanban của phase: task chưa giao hiện "Alex Kim", task LOCKED hiện ở To Do, subtask tạm có mã WPE ngẫu nhiên | FE + BE | Đã sửa (T4), chờ test tay |
| G11 | Thành viên không phải chủ dự án vẫn sửa được các ô trong Node Properties (chỉ không lưu được) | FE | Đã sửa (T3), chờ test tay |
| G12 | Chủ dự án chưa mở khóa sớm được task trên giao diện; BE mở sớm xong thì sửa dây sẽ bị khóa lại, không lưu ai mở | FE + BE + DB | Đã sửa (T6), chờ test tay |
| G13 | My Tasks: bộ lọc phase viết cứng Phase 1/2A/2B/3, mọi task bị coi là "Phase 1", tên phase hiện "Phase 56" | FE | Đã sửa, chờ test tay |
| G14 | Header drawer phase ghi cứng "Marketing Q4 › Workflow › …" cho mọi dự án | FE | Đã sửa, chờ test tay |
| G21 | Hạn chót task chọn được ngày trước ngày tạo task; task trễ hạn không báo cho chủ dự án | FE + BE | Đã sửa, chờ test tay |
| G22 | Mời thành viên và đăng nhập nhận cả username lẫn email; username có thể trùng | FE + BE | Đã sửa, chờ test tay |
| G23 | Thông báo lời mời (và các thông báo khác) bằng tiếng Việt | FE + BE | Đã sửa, chờ test tay |
| G24 | System Audit Log bằng tiếng Việt | FE + BE | Đã sửa, chờ test tay |
| G25 | Mở link khách không xem được gì | FE + BE | Đã sửa, chờ test tay |
| G26 | Admin: ô tìm kiếm trên topbar thừa, chỉ tìm user, phím ⌘K không chạy | FE | Đã sửa, chờ test tay |
| G27 | Template: nút gạt "Public to All Users" không quyết định user có thấy template; template mới/bản Duplicate hiện ngay cho user | FE | Đã sửa, chờ test tay |
| G28 | Admin Overview: thẻ Overdue tasks thừa; hiện các trạng thái dự án không dùng (PLANNING, INACTIVE, COMPLETED) | FE | Đã sửa, chờ test tay |
| G29 | Màn dự án có 2 nút "All Pipelines" thừa (header và cuối thanh bên) | FE | Đã sửa, chờ test tay |
| G30 | Admin: nút "Promote to admin" / "Demote to user" ở User Management không cần | FE | Đã sửa, chờ test tay |
| G31 | Nút Start project có icon tên lửa; Settings có thêm nút "Start project in Workflow" trùng với màn Workflow | FE | Đã sửa, chờ test tay |
| G32 | Trang danh sách pipeline có emoji trên các ô số liệu và "(⌘K)" trong ô tìm, nhìn như AI làm | FE | Đã sửa, chờ test tay |
| G33 | Dự án DRAFT tạo từ template: task đã TODO, thẻ phase xanh/xám lộn xộn, phase rỗng ghi TODO, mở khóa sớm được khi chưa Start | FE + BE + DB | Đã sửa, chờ test tay |

---

## G1. Không tạo được dự án từ template mẫu

**Ngày phát hiện:** 14/11/2026

**Tái hiện**
1. Đăng nhập `alex.kim`, mở hộp tạo dự án.
2. Chọn một template mẫu (SDLC, Marketing hoặc DevOps), nhập tên, bấm tạo.
3. Báo lỗi, không tạo được. Tạo dự án trống hoặc từ template tự lưu thì được.

**Nguyên nhân (đã xác định)**
- FE: template mẫu có id là slug (`tpl-sdlc`, `tpl-marketing`, `tpl-devops`), template tự lưu có id số. `HttpWorkflowService.cloneTemplate` và `createProject` gọi `Number(templateId)` nên slug thành `NaN`, khi gửi JSON thành `null`. BE trả 400 "ID mẫu quy trình không được để trống".
- BE: không lỗi. `CloneTemplateRequest` và `CreateProjectRequest` nhận `templateId` kiểu `Object` (số hoặc slug). Gọi thử `POST /projects/clone-template` với từng slug đều tạo được, số phase/node khớp template (SDLC 4/7, Marketing 2/2, DevOps 2/2).
- DB: không liên quan.

**Cách sửa**
- FE: thêm hàm `toTemplateIdPayload()` trong `HttpWorkflowService.ts`: chuỗi toàn chữ số thì gửi số, còn lại gửi nguyên slug. Dùng ở cả `cloneTemplate` và `createProject`.
- BE, DB: không đổi.

**File đã sửa**
- `wpe-frontend/src/services/impl/HttpWorkflowService.ts`
- `wpe-frontend/src/services/impl/__tests__/HttpWorkflowService.test.ts` (3 test mới)

**Kiểm tra**
- Test tự động: 3 test mới fail trước khi sửa (2 ca slug ra `null`), qua sau khi sửa. `npm run typecheck` sạch; `vitest run` 63 file / 456 test qua.
- Test tay: chờ test lại trên giao diện (tạo từ cả 3 template mẫu và từ template tự lưu).

<!-- Mẫu cho mỗi lỗi:

## Gx. <Tên lỗi>

**Ngày phát hiện:** dd/mm/yyyy

**Tái hiện**
1. ...

**Nguyên nhân (đã xác định)**
- FE: ...
- BE: ...
- DB: ...

**Cách sửa**
- FE: ...
- BE: ...
- DB: ...

**File đã sửa**
- ...

**Kiểm tra**
- Test tự động: ...
- Test tay: ...
-->

---

## G2. Phase mới tạo nằm ngang, dính sát nhau

**Ngày phát hiện:** 14/11/2026

**Tái hiện**
1. Mở Macro Pipeline của một dự án, bấm (+) trên một phase để sinh phase con (hoặc Add Phase).
2. Tạo thêm 2–3 phase con từ cùng một phase.
3. Các phase mới xếp thành một hàng ngang, thẻ dính sát và đè nhau một phần. Bấm Auto Layout thì mới xếp đúng (con ở cột bên phải, xếp dọc).

**Nguyên nhân (đã xác định)**
- FE `graphMapper.toMacroPhase` / `toCreatedMacroPhase`: phase chưa có `uiMetadata` thì tự gán `x = 60 + orderIndex * 360`, `y = 80`, tức một hàng ngang. Thẻ phase trên canvas rộng 380px (`MACRO_CARD_W`) nên bước 360px làm các thẻ đè nhau.
- Vì phase luôn có x, y giả, nhánh dùng bố cục tự động (`computeMacroGraphLayout`) trong `MacroWorkflow` không bao giờ chạy.
- FE `HttpWorkflowService.createPhase` và `CreatePhaseBody` không gửi `uiMetadata`, nên phase mới không được lưu vị trí. Hàm đặt vị trí thông minh `computeSmartMacroPhasePosition` chỉ chế độ mock dùng.
- BE: không lỗi. `CreatePhaseRequest` đã nhận và lưu `uiMetadata`, `PhaseResponse` trả lại.
- DB: không đổi (cột `work_phase.ui_metadata` đã có).

**Cách sửa**
- FE `types/workflow.types.ts`: `MacroPhase.x`, `y` thành tùy chọn. Không có thì canvas dùng bố cục tự động (nhánh đã có sẵn trong `MacroWorkflow`).
- FE `mappers/graphMapper.ts`: bỏ vị trí giả xếp ngang; chỉ dùng `uiMetadata.x/y` khi có đủ cả hai. `toCreatedMacroPhase` lấy vị trí từ response của BE.
- FE `utils/macroLayout.ts`: thêm `computeNewPhasePosition(phases, parentPhaseId)`: lấy vị trí đang hiển thị của các phase (phase chưa lưu vị trí thì theo bố cục tự động) rồi gọi `computeSmartMacroPhasePosition`. Phase con ở cột bên phải cha, xếp dưới phase thấp nhất của cột, không đè phase nào.
- FE `store/useWorkflowStore.ts` `createPhase`: tính vị trí bằng hàm trên (dùng cho cả nút Add Phase lẫn (+) sinh phase con) rồi truyền xuống service.
- FE `HttpWorkflowService.createPhase` + `http/graph.ts`: gửi `uiMetadata { x, y, w, h }` trong `POST /phases`.
- BE, DB: không đổi.

**File đã sửa**
- `wpe-frontend/src/types/workflow.types.ts`
- `wpe-frontend/src/mappers/graphMapper.ts`
- `wpe-frontend/src/utils/macroLayout.ts`
- `wpe-frontend/src/store/useWorkflowStore.ts`
- `wpe-frontend/src/services/impl/HttpWorkflowService.ts`, `wpe-frontend/src/services/impl/http/graph.ts`
- Test: `mappers/__tests__/graphMapper.test.ts` (cập nhật theo hành vi mới), `utils/__tests__/macroLayout.test.ts` (mới, 4 test), `services/impl/__tests__/HttpWorkflowService.test.ts` (thêm 1 test), `services/mock/__tests__/mockProjectGraphStore.test.ts` (chỉ sửa kiểu)

**Kiểm tra**
- Test tự động: `npm run typecheck` sạch; `vitest run` 64 file / 461 test qua.
- Test tay: chờ test lại. Lưu ý phase đã tạo trước khi sửa vẫn giữ vị trí cũ đã lưu; kiểm bằng phase tạo mới hoặc dự án mới.

---

## G3. Dây nối giữa các phase khó đọc

**Ngày phát hiện:** 14/11/2026

**Tái hiện**
1. Mở Macro Pipeline, nối một phase tới nhiều phase, rồi nối chéo giữa các phase ở cột sau (vd. PHASE 3 → PHASE 6, PHASE 4 → PHASE 6, PHASE 5 → PHASE 7).
2. Các dây đều là nét đứt xám giống nhau, không có mũi tên, chồng lên nhau ở gần nút (+) và nút (›). Không nhìn ra dây nào đi từ đâu tới đâu. Dây nối tới phase nằm bên trái hoặc cùng cột thì cắt ngang qua thẻ.

**Nguyên nhân (đã xác định)**
- FE `components/workflow/WorkflowEdge.tsx`: mỗi dây là một đường cong Bézier từ cạnh phải thẻ nguồn tới cạnh trái thẻ đích, `stroke="#94a3b8"`, nét đứt, **không có `marker-end`** (không có mũi tên). Mọi dây cùng màu, cùng kiểu.
- Độ cong `dx = max((x2 - x1) * 0.5, 40)`: khi phase đích nằm bên trái hoặc cùng cột với phase nguồn thì `x2 - x1` âm, dây chỉ cong 40px rồi đi thẳng qua thẻ.
- Tất cả dây ra từ một phase cùng xuất phát ở một điểm (giữa cạnh phải), dây vào cùng một điểm (giữa cạnh trái), nên dây chồng lên nhau ở hai đầu.
- Không có cách làm nổi dây của phase đang chọn (`MacroWorkflow` không truyền `selectedPhaseId` cho `WorkflowEdge`).
- BE, DB: không liên quan.

**Ghi chú về ý nghĩa dây nối phase** (đã đọc BE `WorkflowGraphService`): dây giữa các phase chỉ dùng để vẽ sơ đồ và chặn chu trình (`addPhaseEdge` báo 422 nếu tạo vòng). Dây **không khóa/mở** phase hay task. Trạng thái phase tính từ task bên trong (`PhaseProgressCalculator`). Mở khóa task chỉ theo phụ thuộc giữa các **task** (AND/OR join, ghost node khi khác phase).

**Hướng sửa (đề xuất)**
- FE `WorkflowEdge.tsx`:
  1. Thêm mũi tên ở đầu đích (`<marker>` trong `<defs>` của SVG, `marker-end` trên path).
  2. Dây đi ngược (đích bên trái hoặc cùng cột) thì vòng ra ngoài thẻ (đi xuống dưới/lên trên thẻ rồi vào cạnh trái đích) thay vì cắt qua.
- FE `MacroWorkflow.tsx`: truyền phase đang chọn (hoặc đang rê chuột) cho `WorkflowEdge`; dây ra/vào phase đó đậm màu, các dây khác mờ đi.
- (Tùy chọn) Dàn điểm xuất phát/kết thúc của nhiều dây trên cùng một cạnh thẻ để không chồng ở hai đầu.
- BE, DB: không đổi.

**File liên quan**
- `wpe-frontend/src/components/workflow/WorkflowEdge.tsx`
- `wpe-frontend/src/components/workflow/MacroWorkflow.tsx`

---

## G4. Nút Artifacts hiện số 5 dù dự án chưa có artifact

**Ngày phát hiện:** 14/11/2026

**Tái hiện**
1. Tạo dự án mới (chưa thêm artifact nào), mở tab Workflow.
2. Nút "Artifacts" góc phải hiện số **5**.
3. Bấm vào thì danh sách rỗng và số về **0**. Đóng lại, chuyển dự án khác: số có thể hiện lại số cũ của dự án trước.
4. Vào Settings → "Project Resources & Deliverables": hiện 5 link giả (Figma Design System, API Documentation, Marketing Assets Drive, Competitor Analysis, Launch Checklist), có nút Remove như thật.

**Nguyên nhân (đã xác định)**
- FE `store/slices/artifactsSlice.ts`: giá trị khởi tạo `items: getInitialItems('1')`. Hàm này đọc `localStorage` key `wpe_artifacts_1`, không có thì trả `INITIAL_PROJECT_ARTIFACTS`, tức **5 artifact giả** trong `types/artifact.types.ts`.
- `WorkflowArtifactsIsland` đếm `state.artifacts.items.length`, mà màn Workflow **không gọi tải artifact khi mở**. Chỉ khi mở drawer, `WorkflowArtifactsDrawer` mới gọi `GET /projects/{id}/artifacts?inRepo=true` và ghi đè danh sách (dự án mới thì `[]`, nên về 0).
- `loadArtifacts` trong slice: API trả mảng rỗng **hoặc lỗi** thì rơi về `getInitialItems(projectId)`, lại ra dữ liệu giả hoặc dữ liệu cũ trong `localStorage`.
- Settings dùng `hooks/useProjectArtifacts.ts` → gọi `loadArtifacts(projectId)` khi mở; dự án chưa có artifact nên API trả `[]` → rơi về 5 artifact giả (bước 4).
- `addArtifact` / `removeArtifact`: cập nhật state + `localStorage` trước với id ngẫu nhiên, gọi API kiểu "bắn rồi quên" (`.catch(() => {})`), nên API lỗi thì người dùng không biết và danh sách hiện sai so với BE.
- `items` dùng chung cho mọi dự án (không gắn `projectId`), nên chuyển dự án thì thấy số của dự án trước tới khi tải lại.
- BE: không lỗi. Kiểm DB: dự án 19 có `0` dòng trong bảng `artifacts`.
- DB: không liên quan.

**Hướng sửa (đề xuất)**
- FE `artifactsSlice.ts`:
  - Khởi tạo `items: []`, thêm `projectId` đang tải và `isLoading`. Bỏ `INITIAL_PROJECT_ARTIFACTS` và `localStorage` khỏi chế độ API (dữ liệu giả chỉ nằm trong `MockWorkflowService`).
  - `loadArtifacts(projectId)`: gọi service; mảng rỗng là kết quả hợp lệ (hiện 0). Lỗi thì lưu `error` để UI báo, không rơi về dữ liệu giả.
  - `addArtifact` / `removeArtifact`: `await` API, dùng dữ liệu BE trả về (id thật), lỗi thì báo người dùng.
- FE `MacroWorkflow.tsx` (hoặc `ProjectWorkspaceView`): gọi `loadArtifacts(projectId)` khi mở dự án, để số trên nút đúng ngay từ đầu.
- FE `WorkflowArtifactsDrawer.tsx`: bỏ đoạn tự gọi API và `setState` trực tiếp, dùng `loadArtifacts` của slice.
- BE, DB: không đổi.

**File liên quan**
- `wpe-frontend/src/store/slices/artifactsSlice.ts`
- `wpe-frontend/src/components/workspace/WorkflowArtifactsIsland.tsx`, `WorkflowArtifactsDrawer.tsx`
- `wpe-frontend/src/hooks/useProjectArtifacts.ts`, `components/settings/ProjectResourcesSection.tsx` (cùng dùng slice này)
- `wpe-frontend/src/types/artifact.types.ts` (`INITIAL_PROJECT_ARTIFACTS`)

---

## G5. Thanh bên hiện thành viên giả và tên dự án giả

**Ngày phát hiện:** 14/11/2026

**Tái hiện**
1. Tạo dự án mới, chưa mời ai. Mở tab Workflow.
2. Mục "TEAM COLLABORATORS" hiện **4** người: AK, SC, ML, +1.
3. Mở thẳng URL `/project/{id}/workflow` (hoặc F5): ô dự án ở đầu thanh bên hiện "**Marketing Campaign Q4 · ACTIVE**" thay vì tên và trạng thái thật (vd. "b · DRAFT").

**Nguyên nhân (đã xác định)** (trùng phân tích FN2 trong `docs/fix_loi_moi`, code chưa sửa)
- FE `views/ProjectWorkspaceView.tsx` dòng 36: `teamList = settings.members` nếu có, không thì `kanban.members`, không nữa thì **`DEV_PERSONAS`**: 4 người giả của chế độ dev (Alex Kim, Sarah Chen, Marcus Liu, Jamie Doe). Hai danh sách thật chỉ được tải khi vào tab Settings/My Tasks, nên ở tab Workflow luôn ra người giả.
- Dòng 42: `projectName = … currentProject?.name || 'Marketing Campaign Q4'`; status rơi về `'ACTIVE'`. `currentProject` lấy từ `workspace.projects`, danh sách này chỉ được tải ở màn All Pipelines; mở thẳng URL thì rỗng nên ra tên giả.
- Dòng 38/46: `activePersona` luôn có giá trị (`DEV_PERSONAS[0]`), nên vai trò hiện tại có thể lấy từ người giả thay vì vai trò thật.
- `views/MyTasksView.tsx` dòng 110: cũng rơi về `'Marketing Campaign Q4'`.
- BE: không lỗi. Kiểm DB: dự án 19 chỉ có 1 dòng `project_member` (user 9, OWNER). `GET /projects/{id}/members` và `GET /projects/{id}` đã có.
- DB: không liên quan.

**Hướng sửa (đề xuất)**
- FE `ProjectWorkspaceView.tsx`: khi vào dự án, tải thông tin dự án (`GET /projects/{id}`) và danh sách thành viên thật (`GET /projects/{id}/members`) một lần, dùng cho tên, trạng thái, vai trò và "Team Collaborators". Bỏ hẳn fallback `DEV_PERSONAS` và `'Marketing Campaign Q4'` / `'ACTIVE'` ở chế độ API; đang tải thì hiện khung chờ, lỗi thì hiện lỗi.
- FE: `DEV_PERSONAS` / `activePersona` chỉ dùng khi bật chế độ dev (mock), không xen vào vai trò thật.
- FE `MyTasksView.tsx`: bỏ tên giả, dùng cùng nguồn dữ liệu dự án.
- BE, DB: không đổi.

**File liên quan**
- `wpe-frontend/src/views/ProjectWorkspaceView.tsx`
- `wpe-frontend/src/components/layout/CurvedCobaltSidebar.tsx` (chỉ hiển thị, nhận `teamMembers`)
- `wpe-frontend/src/views/MyTasksView.tsx`
- Nơi định nghĩa `DEV_PERSONAS`

---

## G6. Drawer Artifacts nền đen, khó nhìn

**Ngày phát hiện:** 14/11/2026

**Tái hiện**
1. Mở tab Workflow, bấm nút "Artifacts" góc phải.
2. Drawer mở ra nền đen/xám đậm, lệch hẳn với phần còn lại của app (nền trắng, chữ slate, nhấn indigo/purple), nhìn khó chịu.

**Nguyên nhân (đã xác định)** (trùng FB7 trong `docs/fix_loi_moi`, code chưa sửa)
- FE `components/workspace/WorkflowArtifactsDrawer.tsx` dùng tông tối: `bg-slate-900` (dòng 52), `bg-slate-900/95` (dòng 323, nền drawer), `bg-slate-800` (dòng 340, 362, 374), `bg-slate-800/80` (dòng 421), `bg-slate-800/40` (dòng 436).
- Nút mở (`WorkflowArtifactsIsland.tsx`) đã là tông sáng, nên mở ra thấy lệch tông rõ.
- BE, DB: không liên quan.

**Hướng sửa (đề xuất)**
- FE `WorkflowArtifactsDrawer.tsx`: đổi sang tông sáng như các panel khác (`ProjectResourcesSection.tsx`, `MindmapDrawer.tsx`): nền trắng, viền `slate-200`, tiêu đề `slate-900`, chữ phụ `slate-500`, nút chính indigo/purple. Độ tương phản chữ/nền tối thiểu 4.5:1.
- Mỗi artifact một dòng: biểu tượng theo loại, tên, task gắn kèm (mã task), người nộp, thời gian, nút mở tab mới, sao chép, xóa (chỉ người có quyền).
- Có trạng thái rỗng, đang tải, lỗi (đi cùng G4).
- Chỉ đổi giao diện; phần dữ liệu sửa ở G4.

**File liên quan**
- `wpe-frontend/src/components/workspace/WorkflowArtifactsDrawer.tsx`

---

## G7. Subtask không được lưu lên server (ghost node báo lỗi, subtask biến mất)

**Ngày phát hiện:** 14/11/2026

**Tái hiện**
1. Mở một phase (Click to inspect), thêm task gốc bằng "+ Add Root Task" (task này lưu lên server, có mã WPE thật).
2. Bấm (+) trên task để thêm vài subtask ("Subtask 1", "Subtask 2"…).
3. Mở "Attach Ghost Prerequisite", chọn Target Task là một subtask → lỗi đỏ: `Node đích "task-1794653171707-bslc" chưa được lưu lên máy chủ. Tải lại đồ thị rồi thử lại.`
4. Chọn Target Task là task gốc → gắn được, nhưng **các subtask vừa tạo biến mất**.

**Nguyên nhân (đã xác định)** (trùng FB3 trong `docs/fix_loi_moi`, code chưa sửa)
- FE `components/mindmap/MindmapTree.tsx` `handleAddChild` (dòng ~128) và `addTrack` (dòng ~181): tạo node bằng `createNewBranchNode` (`utils/spanningTreeLayout.ts` dòng 883), id tạm `task-<thời gian>-<ngẫu nhiên>`, mã `WPE-<số ngẫu nhiên>`, rồi chỉ gọi `onUpdateNodes` → store `updateTree`. **Không gọi API**, nên subtask chỉ nằm trong bộ nhớ trình duyệt (và `localStorage` của chế độ mock).
- Gắn ghost: `graph.ts` `toBackendId` thấy id không phải số nên báo `NODE_NOT_SAVED` (bước 3).
- Gắn ghost thành công thì store `attachGhostNode` gọi `resetPhaseTree` → đọc lại cây từ server. Subtask không có trên server nên mất (bước 4).
- Các thao tác khác cũng chỉ sửa store, không gọi API: gộp node (`MindmapDrawer.tsx` ~185–216), lưu thuộc tính node trong `NodePropertiesModal` (~434–448).
- BE: đã có `POST /projects/{id}/nodes`, `POST/DELETE /projects/{id}/dependencies`, `PUT/DELETE /nodes/{id}`. Bảng `node` **không có cột cha** và không có khái niệm "track"; quan hệ cha → con chỉ lưu được bằng `node_dependency`.
- DB: chưa cần đổi nếu quan hệ cha–con = dependency. Nếu nhóm muốn tách "subtask" khỏi "phụ thuộc" thì phải thêm cột (migration V15).

**Hướng sửa (đề xuất)**
- FE (chế độ API): thêm subtask = `POST /nodes` (cùng phase) rồi `POST /dependencies` (cha → con), xong mới vẽ (dùng id và mã WPE thật do BE trả). Lỗi thì báo, không vẽ node tạm.
- FE: đổi tên, sửa thuộc tính node → `PUT /nodes/{id}`; xóa → `DELETE /nodes/{id}`; gộp node → chuỗi API tương ứng. Mọi thao tác ghi đều qua API ở chế độ API, giống "+ Add Root Task" và kéo-nối hiện tại.
- FE: `createNewBranchNode` với id tạm chỉ giữ cho chế độ mock.
- **Đã chốt (14/11/2026):** subtask lưu như một task bình thường: `POST /nodes` (cùng phase) + `POST /dependencies` (task cha → subtask). Không thêm cột, không cần migration, BE giữ nguyên.

**Giải thích luồng ghost node** (cho người test)
- Ghost node = một task ở **phase khác** mà task trong phase này phải chờ. Ví dụ: task "Deploy" ở phase CI/CD chỉ mở khi task "Tạo hạ tầng" ở phase IaC xong.
- Gắn ghost = tạo một dây phụ thuộc giữa 2 task (lưu ở `node_dependency`). Trên cây của phase đích, task nguồn hiện thành một node mờ (ghost) bên phải task đích.
- Vì là dây giữa 2 task thật trên server, cả task nguồn lẫn task đích phải được lưu rồi, nên subtask tạm (G7) không gắn được.

**File liên quan**
- `wpe-frontend/src/components/mindmap/MindmapTree.tsx`, `components/mindmap/MicroGraphTree.tsx`
- `wpe-frontend/src/components/workflow/MindmapDrawer.tsx`
- `wpe-frontend/src/store/useWorkflowStore.ts` (`updateTree`, `attachGhostNode`, `resetPhaseTree`)
- `wpe-frontend/src/utils/spanningTreeLayout.ts` (`createNewBranchNode`)
- `wpe-frontend/src/services/impl/http/graph.ts`, `services/impl/HttpWorkflowService.ts`
- BE: không đổi (dùng API sẵn có)

---

## G8. Node Properties cho chỉnh trạng thái tùy ý

**Ngày phát hiện:** 14/11/2026

**Tái hiện**
1. Trong cây của phase, mở Node Properties của một task (vd. "Subtask 1", WPE-152).
2. Ô Status cho chọn thẳng TODO / IN_PROGRESS / REVIEW / DONE / LOCKED, Save Changes là đổi, không kiểm tra gì.

**Nguyên nhân (đã xác định)**
- FE `components/mindmap/NodePropertiesModal.tsx` dòng ~143–163: dropdown Status liệt kê mọi trạng thái, không theo luồng trạng thái của task (LOCKED → TODO → IN_PROGRESS → REVIEW → DONE, mở khóa theo phụ thuộc, nộp artifact khi sang REVIEW…). Dòng ~43–47 còn tự đặt tiến độ theo trạng thái chọn.
- `MindmapDrawer.tsx` dòng ~434–448 `onSave` chỉ gọi `updateTree` (sửa store), **không gọi API**, nên mọi thay đổi (tên, người làm, deadline, join logic, mô tả, trạng thái) mất khi tải lại cây. (Cùng gốc với G7.)
- BE: chuyển trạng thái task có luồng riêng (Kanban, `PATCH /nodes/{id}/status` có kiểm tra); sửa thông tin node dùng `PUT /nodes/{id}`.
- DB: không liên quan.

**Hướng sửa (đề xuất)**
- FE `NodePropertiesModal.tsx`: bỏ dropdown Status (hoặc chỉ hiển thị, không cho sửa). Trạng thái đổi qua Kanban / nút hành động theo đúng luồng BE.
- FE `MindmapDrawer.tsx` `onSave`: gọi `PUT /nodes/{id}` cho tên, người làm, deadline, join logic, mô tả; xong thì đọc lại cây. Lỗi thì báo.
- Xóa node trong modal → `DELETE /nodes/{id}` (BE chỉ cho xóa khi LOCKED/TODO).
- BE, DB: không đổi (kiểm lại `UpdateNodeRequest` nhận đủ các trường trên).

**File liên quan**
- `wpe-frontend/src/components/mindmap/NodePropertiesModal.tsx`
- `wpe-frontend/src/components/workflow/MindmapDrawer.tsx`

---

## G9. Danh sách thành viên là người giả, thiếu chủ dự án

**Ngày phát hiện:** 14/11/2026

**Tái hiện**
1. Dự án chỉ có 1 người (chủ dự án, user "a"). Mở Node Properties → ô Assignee.
2. Danh sách có 4–5 người (Alex Kim, Sarah Chen, Marcus Liu, Jamie Doe, Unassigned), **không có "a"**.

**Nguyên nhân (đã xác định)**
- FE `services/impl/HttpWorkflowService.ts` dòng 56–57: `getProjectMembers` vẫn nằm trong `METHODS_STILL_MOCKED`, tức ở chế độ API vẫn trả **thành viên giả** của mock.
- FE `NodePropertiesModal.tsx` dòng 34–37: không có `members` thì dùng cứng `['Alex Kim', 'Sarah Chen', 'Marcus Liu', 'Jamie Doe']`.
- `hooks/usePhaseKanban.ts` dòng 53–56: lấy thành viên từ `getProjectMembers` (giả) rồi tải task theo từng người giả.
- Ô Assignee lưu **tên** (`node.assignee`), còn task ở BE dùng `assignedUserId`; hook Kanban đổi tên → id bằng so chữ cứng ("Sarah" → 2, "Marcus" → 3…, dòng ~121–126, ~153–165).
- BE: đã có `GET /projects/{id}/members` trả thành viên thật (kèm OWNER). DB dự án 19: chỉ 1 dòng `project_member` (user 9, OWNER).
- DB: không liên quan.

**Hướng sửa (đề xuất)**
- FE `HttpWorkflowService.getProjectMembers`: gọi `GET /projects/{id}/members`, bỏ khỏi `METHODS_STILL_MOCKED`.
- FE `NodePropertiesModal.tsx`: bỏ danh sách cứng; Assignee chọn theo **id** thành viên thật (hiện tên), có "Chưa giao".
- FE `usePhaseKanban.ts`: bỏ đoạn đổi tên → id bằng so chữ; dùng `assignedUserId` thật.
- Nên dùng chung một nguồn thành viên dự án với G5 (thanh bên).
- BE, DB: không đổi.

**File liên quan**
- `wpe-frontend/src/services/impl/HttpWorkflowService.ts` (`METHODS_STILL_MOCKED`, `getProjectMembers`)
- `wpe-frontend/src/components/mindmap/NodePropertiesModal.tsx`
- `wpe-frontend/src/hooks/usePhaseKanban.ts`

---

## G10. Kanban của phase hiện sai người làm và sai cột

**Ngày phát hiện:** 14/11/2026

**Tái hiện**
1. Trong phase có task chưa giao ai (c, d, Subtask 1…). Mở drawer phase → tab Kanban.
2. Mọi task đều hiện "AK Alex Kim" dù chưa giao.
3. Task đang LOCKED (chưa đủ điều kiện mở) vẫn nằm ở cột **To Do**.
4. Có 2 thẻ "Subtask 1": một WPE-152, một WPE-944; mã của subtask tạm đổi mỗi lần mở.

**Nguyên nhân (đã xác định)**
- FE `components/kanban/TaskCard.tsx` dòng 30–41: người hiển thị = `member || actor || DEFAULT_MEMBERS[...]`, chữ viết tắt mặc định `'AK'`. Task chưa giao thì không có `member`, nên hiện `actor` (người đang xem, mà danh sách thành viên đang giả nên ra Alex Kim) hoặc người mặc định.
- FE `hooks/usePhaseKanban.ts` dòng ~119 và ~153: `status === 'LOCKED' ? 'TODO' : status`: cố ý dồn LOCKED vào To Do.
- `usePhaseKanban.ts` dòng ~140–165: ngoài task từ API còn trộn thêm node trong cây cục bộ (subtask tạm của G7) với mã `WPE-<random>` sinh lại mỗi lần tính.
- BE: không lỗi (task chưa giao có `assignedUserId = null`, trạng thái LOCKED đúng).
- DB: không liên quan.

**Hướng sửa (đề xuất)**
- FE `TaskCard.tsx`: chưa giao thì hiện "Chưa giao" (avatar trống), không lấy `actor` hay người mặc định.
- FE `usePhaseKanban.ts`: giữ LOCKED đúng nghĩa: thêm cột/nhóm "Locked" (hoặc hiện ở To Do nhưng có nhãn khóa và không kéo được). Cần chốt cách hiển thị.
- FE `usePhaseKanban.ts`: chỉ lấy task từ API (theo phase), bỏ trộn node cục bộ và mã ngẫu nhiên (sau khi G7 sửa thì subtask đã có trên server).
- Tải task theo phase/dự án thay vì gọi `getMyTasks` cho từng thành viên.
- BE, DB: không đổi.

**File liên quan**
- `wpe-frontend/src/components/kanban/TaskCard.tsx`
- `wpe-frontend/src/hooks/usePhaseKanban.ts`
- `wpe-frontend/src/components/kanban/PhaseKanbanBoard.tsx`

**Giải thích Join Logic** (cho người test)
- Join Logic quyết định khi nào một task **có nhiều task đứng trước** được mở khóa (LOCKED → TODO):
  - **ALL COMPLETED (AND-Join):** phải xong **hết** các task đứng trước. Vd. "Deploy" chờ cả "Code BE" và "Code FE" xong.
  - **ANY COMPLETED (OR-Join):** chỉ cần **một** task đứng trước xong. Vd. "Thông báo" mở khi "Gửi email" hoặc "Gửi SMS" xong.
- Task không có task đứng trước thì Join Logic không có tác dụng.

---

## G11. Thành viên không phải chủ dự án vẫn sửa được các ô trong Node Properties

**Ngày phát hiện:** 14/11/2026

**Tái hiện**
1. Mời một thành viên (COLLABORATOR/VIEWER) vào dự án, đăng nhập bằng tài khoản đó.
2. Mở cây của phase, mở Node Properties của một task.
3. Gõ được tên, đổi được Assignee, Status, Deadline, Join Logic, Description. Chỉ ở dưới mới thấy "Chỉ chủ dự án được sửa đồ thị" và không có nút lưu, nên sửa xong mất hết. Gây hiểu nhầm.

**Nguyên nhân (đã xác định)**
- FE `components/mindmap/NodePropertiesModal.tsx`: có prop `readOnly` (`MindmapDrawer.tsx` truyền `readOnly={!canEdit}`), nhưng chỉ dùng để ẩn nút lưu và hiện dòng chữ ở chân (dòng ~220–243). Các ô nhập **không có `disabled`/`readOnly`** (Status chỉ khóa khi là track, dòng 145).
- BE: đúng (chỉ OWNER được sửa đồ thị).
- DB: không liên quan.

**Hướng sửa (đề xuất)**
- FE `NodePropertiesModal.tsx`: khi `readOnly` thì mọi ô nhập `disabled` (input, select, textarea, date), giao diện xám/không con trỏ sửa; tiêu đề đổi thành "Chi tiết task" cho rõ là chỉ xem; ẩn nút Delete Node.
- Hiện dòng "Chỉ chủ dự án được sửa đồ thị" ở đầu hộp thay vì chân hộp.
- Rà các chỗ sửa đồ thị khác (nút +, kéo nối, Add Root Task, Add Ghost Node) cũng phải khóa với người không có quyền.
- BE, DB: không đổi.

**File liên quan**
- `wpe-frontend/src/components/mindmap/NodePropertiesModal.tsx`
- `wpe-frontend/src/components/workflow/MindmapDrawer.tsx`

---

## G12. Chưa mở khóa sớm được task; mở sớm xong bị khóa lại

**Ngày phát hiện:** 14/11/2026 (khi bàn thiết kế lại hộp chi tiết task)

**Yêu cầu (đã chốt)**
Chủ dự án được **mở khóa sớm** một task đang LOCKED dù các task đứng trước chưa xong. Trước khi mở phải hiện lưu ý: "Task này còn chờ: WPE-006 c, WPE-007 d (chưa xong). Vẫn mở?" — xác nhận thì mở.

**Nguyên nhân / hiện trạng (đã xác định)**
- BE đã có `POST /api/v1/nodes/{taskId}/force-unlock` (`NodeController` dòng 85, `StateMachineService.forceUnlock` ~dòng 343): chỉ OWNER, chỉ khi LOCKED, chuyển sang TODO, báo cho người được giao.
- FE: **không chỗ nào gọi** API này (không có nút).
- BE: `WorkflowGraphService.recomputeNodeStatus` (dòng 626) chạy mỗi khi thêm/xóa dây hoặc đổi join policy: task **TODO** mà điều kiện chưa thỏa thì **đưa về LOCKED**. Task vừa mở sớm sẽ bị khóa lại ngay khi sửa dây liên quan, vì BE không lưu dấu "đã mở sớm".
- BE: mở sớm chỉ ghi `log.info` trên server, không lưu ai mở / lúc nào; nhật ký hoạt động dự án (`ProjectActivityService`, dựng từ dữ liệu có sẵn) không thấy được việc này.
- DB: bảng `node` chưa có cột lưu việc mở sớm.

**Hướng sửa (đề xuất)**
- DB: migration `V15__node_force_unlock.sql`: thêm `node.force_unlocked_by BIGINT NULL REFERENCES users(id)` (kiểm đúng tên bảng user) và `node.force_unlocked_at TIMESTAMPTZ NULL`.
- BE: `forceUnlock` ghi 2 cột trên. `recomputeNodeStatus` **không** khóa lại node có `force_unlocked_at != null`. Trả `forceUnlocked` (+ người, thời điểm) trong DTO node của đồ thị và Kanban. `ProjectActivityService` thêm mục "X mở khóa sớm WPE-…".
- FE: nút "Mở khóa sớm" trong hộp chi tiết task (chỉ chủ dự án, chỉ khi LOCKED) với hộp xác nhận liệt kê task đứng trước chưa xong; thẻ/nhãn "Mở sớm" trên cây và Kanban.

**File liên quan**
- BE: `controller/NodeController.java`, `service/engine/StateMachineService.java`, `service/WorkflowGraphService.java`, `service/ProjectActivityService.java`, `entity/NodeEntity.java`, DTO node (graph + kanban), mapper node
- DB: `wpe-backend/src/main/resources/db/migration/V15__node_force_unlock.sql`
- FE: `services/impl/http/graph.ts` hoặc nơi gọi API task, `components/mindmap/NodePropertiesModal.tsx`, `components/kanban/TaskCard.tsx`

---

## G13. Bộ lọc phase ở My Tasks là lọc giả

**Ngày phát hiện:** 14/11/2026 (khi làm T4)

**Tái hiện**
1. Dự án có nhiều phase thật (id kiểu 56, 57), có task được giao cho mình ở các phase khác nhau. Mở tab My Tasks.
2. Thanh lọc chỉ có All / Phase 1 / Phase 2A / Phase 2B / Phase 3. Bấm "Phase 1" ra hết task, các nút còn lại trống. Thẻ task ghi "Phase 56" thay vì tên phase.

**Nguyên nhân (đã xác định)**
- FE `components/kanban/KanbanToolbar.tsx` dòng 4: danh sách nút lọc viết cứng theo 4 phase của dữ liệu mock.
- FE `HttpWorkflowService.mapBackendTaskToKanban`: `phaseMap = { '1': 'P1', '2': 'P2A', '3': 'P2B', '4': 'P3' }`, id khác đều thành `'P1'`; `phaseLabel = "Phase <id>"`.
- FE `types/kanban.types.ts`: `PhaseId = 'P1' | 'P2A' | 'P2B' | 'P3'` (kiểu của dữ liệu mock).
- BE: không lỗi (task trả `phaseId` thật). DB: không liên quan.

**Cách sửa**
- `PhaseId` thành id thật (`string`); mapper giữ nguyên `phaseId` của backend.
- `kanbanSlice.loadTasks`: tải thêm danh sách phase của dự án (`getMacroPhases`) để gắn tên phase thật (`PHASE 4 · Cụm công việc 4`) cho task.
- `KanbanToolbar`: nút lọc sinh từ các phase có trong danh sách task (id + tên thật), không viết cứng.

**Đã sửa (14/11/2026)**: commit G13 (sau `4ca6126`). `PhaseId` = id thật (dữ liệu mock giữ kiểu riêng `MockPhaseId`); mapper giữ `phaseId` thật, bỏ bảng ép P1–P3; `loadTasks` tải thêm `getMacroPhases` để gắn "TÊN · phụ đề" (không tải được thì vẫn hiện task); thanh lọc sinh từ phase có task. 3 test mới; `vitest run` 76 file / 514 test qua.

**File liên quan**
- `wpe-frontend/src/types/kanban.types.ts`, `services/impl/HttpWorkflowService.ts`, `store/slices/kanbanSlice.ts`, `components/kanban/KanbanToolbar.tsx`, `views/MyTasksView.tsx`

---

## G14. Header drawer phase ghi cứng "Marketing Q4"

**Ngày phát hiện:** 14/11/2026 (khi làm T3)

**Tái hiện**
1. Mở bất kỳ dự án nào, bấm "Click to inspect" một phase.
2. Dòng nhỏ đầu drawer: "Marketing Q4 › Workflow › PHASE 4", dự án nào cũng là "Marketing Q4".

**Nguyên nhân (đã xác định)**
- FE `components/workflow/MindmapDrawer.tsx` dòng 266–267: chuỗi "Marketing Q4" viết cứng (cùng loại G5).
- BE, DB: không liên quan.

**Cách sửa**
- Lấy tên dự án thật từ slice `project` (T1) cho dòng breadcrumb.

**Đã sửa (14/11/2026)**: commit `4ca6126`. Breadcrumb = tên dự án thật › Workflow › tên phase (chưa tải tên dự án thì bỏ phần đó). Typecheck + toàn bộ test FE qua.

**File liên quan**
- `wpe-frontend/src/components/workflow/MindmapDrawer.tsx`

---

## G15. My Tasks không có cột "Đang khóa"

**Ngày phát hiện:** 15/11/2026

**Tái hiện**
1. Giao cho mình một task đang chờ task trước (LOCKED). Mở tab My Tasks.
2. Task đó không xuất hiện ở đâu, bảng chỉ có 4 cột To Do / In Progress / In Review / Done.

**Nguyên nhân (đã xác định)**
- BE `StateMachineService.getMyTasks` dùng `findByProjectIdAndAssignedUserIdAndStatusNotOrderByDueDateAsc(..., LOCKED)`: cố ý bỏ task LOCKED.
- FE `components/kanban/KanbanBoard.tsx`: chỉ có 4 cột (Kanban theo phase đã có cột LOCKED từ T4).
- DB: không liên quan.

**Cách sửa**
- BE: my-tasks trả cả task LOCKED của người đó.
- FE: bảng My Tasks thêm cột "Đang khóa" giống Kanban theo phase (không kéo vào / ra, thẻ có nhãn "🔒 Chờ task trước").


**Đã sửa (15/11/2026), chờ test tay**: BE `my-tasks` trả cả task LOCKED (`findByProjectIdAndAssignedUserIdOrderByDueDateAsc`); FE `KanbanBoard` có 5 cột, cột "Đang khóa" không nhận thả. Test: BE `testGetMyTasks_includesLocked`, FE `KanbanBoard.locked.test.tsx`. API thật: dự án đã publish, task chờ task trước nằm trong my-tasks với trạng thái LOCKED.

---

## G16. Thanh lọc phase cạnh ô tìm kiếm bị tràn khi nhiều phase

**Ngày phát hiện:** 15/11/2026

**Tái hiện**
1. Dự án có nhiều phase có task của mình. Mở My Tasks.
2. Mỗi phase một nút "PHASE n · tên" nằm ngang cạnh ô tìm kiếm, nhiều phase thì xuống dòng lộn xộn, đẩy ô tổng số sang dòng khác.

**Nguyên nhân (đã xác định)**
- FE `components/kanban/KanbanToolbar.tsx`: mỗi phase là một nút trong khối `flex-wrap`, không giới hạn số lượng.

**Cách sửa**
- Đổi thành một ô chọn (dropdown) "Phase: Tất cả / PHASE 1 · … / …", kèm số task mỗi phase; chiều rộng cố định, không tràn dù bao nhiêu phase.


**Đã sửa (15/11/2026), chờ test tay**: `KanbanToolbar` lọc bằng một ô chọn rộng cố định ("Tất cả phase (n)" + từng phase kèm số task). Test `KanbanToolbar.test.tsx` (gồm 12 phase vẫn một ô chọn).

---

## G17. Nộp minh chứng xong không hiện trong Artifacts, chưa lọc trùng

**Ngày phát hiện:** 15/11/2026

**Tái hiện**
1. Người được giao nộp task để duyệt, kèm link minh chứng.
2. Mở Artifacts của dự án: không thấy link vừa nộp (chỉ thấy trong chi tiết task).

**Nguyên nhân (đã xác định)**
- BE `StateMachineService.submitTaskArtifact` tạo `ArtifactEntity` không đặt `isInRepository` nên mặc định `false`; kho Artifacts chỉ lấy `isInRepository = true`.
- BE `ArtifactService.createArtifact` và `submitTaskArtifact`: không kiểm trùng, thêm cùng tên + cùng link nhiều lần là ra nhiều dòng.
- FE: sau khi nộp không tải lại danh sách Artifacts.
- DB: minh chứng nộp trước đây đang nằm ngoài kho.

**Cách sửa**
- BE: minh chứng nộp kèm task vào kho (`isInRepository = true`).
- Lọc trùng: hai artifact "trùng hoàn toàn" = cùng dự án, cùng tên, cùng link (đã bỏ khoảng trắng đầu cuối). Trùng thì không thêm dòng mới vào kho; cùng link mà khác tên thì vẫn thêm.
  - Thêm vào kho mà đã có bản trùng: trả lại bản có sẵn.
  - Nộp minh chứng mà đã có bản trùng của chính task: dùng lại bản đó. Bản trùng nằm ở chỗ khác trong kho: vẫn gắn minh chứng cho task nhưng không đưa thêm vào kho.
- DB: migration V16 đưa minh chứng cũ vào kho, mỗi nhóm trùng chỉ giữ một bản trong kho.
- FE: nộp xong tải lại danh sách Artifacts.


**Đã sửa (15/11/2026), chờ test tay**: BE nộp minh chứng → `isInRepository = true`, lọc trùng (cùng dự án + tên + link) ở `submitTaskArtifact` và `createArtifact`; migration V16 đưa minh chứng cũ vào kho (mỗi nhóm trùng một bản). FE nộp xong tải lại Artifacts; sửa kèm: thẻ My Tasks không còn mất tên phase sau khi nộp / đổi trạng thái. API thật: nộp PR → có trong kho; thêm lại y hệt (kể cả khoảng trắng) → trả id cũ; cùng link khác tên → tạo mới.

---

## G18. Chủ dự án không có chỗ xem các task chờ duyệt

**Ngày phát hiện:** 15/11/2026 (đề xuất của người dùng)

**Hiện trạng**
- My Tasks chỉ hiện task giao cho chính mình. Task người khác nộp để duyệt chỉ thấy khi mở Kanban từng phase; không có gì báo khi có bài mới nộp.

**Cách làm**
- BE: `GET /projects/{projectId}/review-tasks` trả mọi task REVIEW của dự án; chỉ chủ dự án / quản lý gọi được (khác thì 403). Nộp bài thì đẩy SSE cho cả quản lý (trước chỉ chủ dự án).
- FE: cạnh thẻ người dùng ở My Tasks có nút "Chờ duyệt" (chỉ chủ dự án / quản lý thấy) kèm số đếm, tối đa "9+". Bấm mở popup danh sách task chờ duyệt; bấm một task thì mở hộp chi tiết như cũ (Approve / Request Changes). Duyệt xong task rời danh sách, số đếm giảm. Có SSE nộp bài / đổi trạng thái thì tải lại số đếm.

**Đã sửa (15/11/2026), chờ test tay**: BE `GET /projects/{id}/review-tasks` (chủ dự án / quản lý, khác → 403); SSE nộp bài và đổi trạng thái gửi cho cả quản lý. FE `ReviewQueueButton` (huy hiệu tối đa "9+", danh sách, bấm mở `TaskDetailModal`), slice `reviewTasks` / `loadReviewTasks` / `reviewTask`. API thật: nộp → hàng chờ có task; duyệt → hàng chờ rỗng; người ngoài → 403.

---

## G19. Auto Layout dồn các phase lên đầu, không căn giữa

**Ngày phát hiện:** 15/11/2026

**Tái hiện**
1. Sơ đồ A → Phase 2/3/4 → Phase 5 → Phase 6. Bấm Auto Layout.
2. Cột chỉ có 1 thẻ (A, Phase 5, Phase 6) nằm sát hàng trên cùng, không thẳng hàng với giữa cột 3 thẻ; dây vượt cột phải vòng lên trên thẻ.

**Nguyên nhân (đã xác định)**
- FE `utils/phaseColumnLayout.ts` `autoLayoutColumns`: mọi cột bắt đầu từ cùng `TOP`, xếp từ trên xuống.

**Cách sửa**
- Mỗi cột đẩy xuống nửa phần chênh lệch so với cột cao nhất, nên cột ít thẻ nằm giữa theo chiều dọc.

**Đã sửa (15/11/2026), chờ test tay**: 2 test mới (sơ đồ như ảnh: A, P5, P6 cùng hàng giữa với P3, dây không cắt thẻ; hai cột bằng nhau không lệch). Lưu ý: vị trí cũ đã lưu không tự đổi, cần bấm Auto Layout lại.

---

## G20. Chữ trên giao diện nửa Việt nửa Anh

**Ngày phát hiện:** 15/11/2026

**Hiện trạng**
- Giao diện chung bằng tiếng Anh, nhưng các phần làm trong đợt sửa này (Chi tiết task, cột Đang khóa, Chờ duyệt, lọc phase, Artifacts, toast…) lại bằng tiếng Việt.

**Cách sửa**
- Đổi sang tiếng Anh mọi chuỗi hiển thị mà nhánh này thêm vào, cùng vài chỗ có sẵn nằm ngay cạnh (mục "Phân công" trong TaskDetailModal, câu "chỉ xem" của đồ thị `GRAPH_READ_ONLY_MESSAGE`, toast nối dây trong MindmapDrawer).
- Không đổi: comment, dữ liệu mock, log console, thông báo lỗi do backend trả về, chuỗi tiếng Việt có sẵn của người khác ở chỗ không liên quan.

**Đã sửa (15/11/2026), chờ test tay**: test cập nhật theo chữ mới (test B5 dùng hằng `GRAPH_READ_ONLY_MESSAGE` thay vì viết cứng). `vitest run` 83 file / 554 test qua, typecheck sạch.

---

## G21. Hạn chót task không ràng buộc, trễ hạn không báo chủ dự án

**Ngày phát hiện:** 16/11/2026

**Hiện trạng**
- Node Properties và Chi tiết task cho chọn hạn chót bất kỳ, kể cả trước ngày tạo task. BE cũng không kiểm.
- Quét trễ hạn (`TaskOverdueScanner`) chỉ xét task IN_PROGRESS, chỉ báo người làm, nội dung tiếng Việt.

**Cách sửa** (người dùng chọn: cho phép trùng ngày tạo)
- Hạn chót ≥ ngày tạo task (so theo ngày). BE từ chối nếu sớm hơn; FE đặt `min` cho ô ngày và báo lỗi.
- Task chưa DONE mà quá hạn: báo cho người làm và chủ dự án (nếu khác người làm), nội dung tiếng Anh.

**Đã sửa (16/11/2026), chờ test tay**: BE `DueDateRules` (so ngày giờ VN) ở tạo task, sửa task (`PUT /nodes/{id}`), đổi người làm/hạn chót; lỗi 400 `DUE_DATE_BEFORE_CREATED`. Response task thêm trường `createdAt` (chỉ thêm, không đổi trường cũ). `TaskOverdueScanner` quét mọi task khác DONE, báo người làm + chủ dự án, mỗi task một lần. FE: ô ngày có `min` = ngày tạo, báo lỗi đỏ và khóa nút lưu; hạn chót gửi lên là 23:59:59 giờ máy (trước đây Node Properties gửi 00:00 UTC nên quá hạn từ 7h sáng). Sửa kèm: link trong thông báo `/projects/{id}/tasks` không mở được trang nào → `/project/{id}/my-tasks`. API thật: hạn 2020-01-01 cho task tạo 25/10 → 400.

---

## G22. Mời thành viên / đăng nhập bằng username

**Ngày phát hiện:** 16/11/2026

**Hiện trạng**
- Ô mời thành viên ghi "Username or email", ô đăng nhập ghi "Email or username". Nhập tên không tìm thấy người. Người dùng muốn chỉ dùng email (username có thể trùng).

**Cách sửa**
- FE: hai ô chỉ nhận email, kiểm định dạng email.
- BE: mời và đăng nhập chỉ tìm theo email (không phân biệt hoa thường). Tên trường trong request giữ nguyên để không đổi contract.

**Đã sửa (16/11/2026), chờ test tay**: API thật: đăng nhập `alex.kim` → 401, `alex.kim@pipeline.engine` → 200; mời `sarah.chen` → 400 `INVALID_EMAIL`, email không có tài khoản → 404.
**Còn lại (chưa sửa)**: đăng ký tự lấy username = phần trước @ của email, nên `an@a.com` và `an@b.com` trùng username → người thứ hai bị `USERNAME_TAKEN`.

---

## G23. Thông báo lời mời tiếng Việt

**Ngày phát hiện:** 16/11/2026

**Hiện trạng**
- Thông báo lời mời ("Lời mời tham gia dự án…"), hộp chấp nhận lời mời, lỗi khi mời đều tiếng Việt; các thông báo khác của BE (nộp bài, từ chối, mở khóa…) cũng vậy.

**Cách sửa**
- Đổi sang tiếng Anh: tiêu đề/nội dung mọi thông báo BE tạo, lỗi trả về từ luồng mời thành viên, chữ trên hộp mời và hộp chấp nhận lời mời.

**Đã sửa (16/11/2026), chờ test tay**: `ProjectInvitationService`, `StateMachineService`, `WorkflowGraphService`, `FeedbackQueueService`, `ProjectInviteAcceptModal`, `InviteMemberModal`. FE nhận diện loại thông báo theo cả từ khóa tiếng Anh. Thông báo cũ đã lưu trong DB vẫn tiếng Việt.

---

## G24. System Audit Log tiếng Việt

**Ngày phát hiện:** 16/11/2026

**Hiện trạng**
- Settings → System Audit Log: nhãn, bộ lọc, cột, thời gian tương đối ("phút", "giờ") và nội dung chi tiết (BE `ProjectActivityService`) đều tiếng Việt. Nhật ký admin (đăng nhập, đăng xuất…) cũng ghi tiếng Việt.

**Cách sửa**
- FE: đổi chữ sang tiếng Anh, dùng `relativeEn`.
- BE: chi tiết hoạt động dự án và nhật ký admin ghi tiếng Anh. Bản ghi admin cũ đã lưu trong DB giữ nguyên.

**Đã sửa (16/11/2026), chờ test tay**: `SystemAuditLogSection` (thêm nhãn cho `TASK_FORCE_UNLOCKED`), `AuditLogsTab` của admin, `ProjectActivityService`, chi tiết audit trong `AuthService`. API thật: nhật ký dự án 1 ra "Created project …", "… joined the project as COLLABORATOR".

---

## G25. Mở link khách không xem được gì

**Ngày phát hiện:** 16/11/2026

**Tái hiện**
1. Chủ dự án "b" (DRAFT) tạo link khách, mở link.
2. Trang khách không hiện dữ liệu dự án.

**Nguyên nhân (đã xác định)**
- FE `HttpGuestService.getLinkInfo` vẫn gọi mock: token thật (64 ký tự hex) không có tiền tố `gst_` nên luôn bị coi là link sai.
- BE `GuestGatewayService.validateAndGetActiveGuestLink` chỉ cho xem dự án ACTIVE; dự án mới là DRAFT/PLANNING nên bị 403.

**Cách sửa** (người dùng chọn: khách xem mọi trạng thái trừ ARCHIVED)
- BE: chỉ chặn dự án ARCHIVED.
- FE: `getLinkInfo` gọi API thật (lấy tên dự án từ overview), không còn dùng mock khi chạy với backend.

**Đã sửa (16/11/2026), chờ test tay**: `HttpGuestService` bỏ hẳn mock: phiên khách lưu ở trình duyệt; AI summary / AI report / đánh giá chưa có API nên ẩn (cờ `features`), không hiện số giả. BE overview: velocity 7 ngày và hoạt động gần đây lấy từ task thật (trước là số viết cứng), nhãn tiếng Anh, lỗi trả lý do cụ thể. API thật: link dự án "b" (DRAFT) → 200. Chưa có: tên chủ dự án trên trang khách (backend chưa trả), danh sách góp ý khách đã gửi (chỉ hiện trong phiên đang mở).

---

## G26. Admin: ô tìm kiếm trên topbar thừa

**Ngày phát hiện:** 20/11/2026

**Hiện trạng**
- Topbar admin có ô "Search projects, pipelines, users..." kèm `⌘K`. Bấm Enter chỉ chuyển sang tab Users và điền chữ vào ô tìm user (`AdminPortalView.handleGlobalSearch`), không tìm project/pipeline. Phím `⌘K` không có code xử lý.
- Tab Users, Workspaces, Templates đều đã có ô tìm riêng, nên ô này bị trùng.

**Cách sửa**
- FE: bỏ ô tìm trong `AdminTopbar`, bỏ prop `onGlobalSearch` và `handleGlobalSearch` trong `AdminPortalView`. BE không đổi.


**Đã sửa (20/11/2026), chờ test tay**: `AdminTopbar`, `AdminPortalView`. Tìm user vẫn dùng ô tìm trong tab Users.
---

## G27. Template: nút "Public to All Users" không điều khiển việc user thấy template

**Ngày phát hiện:** 20/11/2026

**Tái hiện**
1. Admin mở Template Studio, tắt nút gạt "Public to All Users", bấm "Save & Publish Template".
2. Đăng nhập user: template vẫn hiện trong danh sách.
3. Ở Template Library bấm Duplicate: báo "duplicated as a draft" nhưng user thấy bản copy ngay.

**Nguyên nhân (đã xác định)**
- BE: user thấy template hay không chỉ phụ thuộc `isHidden` (và `visibility`, template admin tạo luôn PUBLIC) — `PipelineTemplateService.getTemplates`. Nút gạt chỉ đổi `isSystemStandard`, cờ này chỉ để hiện nhãn "System template" bên admin.
- FE: chữ "Public to All Users", "Save & Publish" và câu báo sau khi lưu dựa theo `isSystemStandard` nên gây hiểu sai. Template mới / bản Duplicate tạo ra với `isHidden = false`.

**Cách sửa** (người dùng chọn: dùng Draft / Published, nút Publish / Unpublish)
- FE: bỏ nút gạt ở `StudioTopbar`; nút lưu đổi thành "Save Template"; câu báo sau khi lưu dựa theo `isHidden`.
- FE: Template Library đổi Hide/Show thành Unpublish/Publish, nhãn "Hidden" thành "Draft", câu báo tương ứng.
- FE: template mới và bản Duplicate tự để Draft (gọi API ẩn có sẵn ngay sau khi tạo).
- BE không đổi.


**Đã sửa (20/11/2026), chờ test tay**: `StudioTopbar` (bỏ nút gạt, nút "Save Template"), `TemplateStudioView` (câu báo theo `isHidden`), `useTemplateStudio` (tạo mới xong gọi `setTemplateHidden(id, true)`), `TemplateCard` (Publish/Unpublish, nhãn Draft), `TemplateCatalogView` (bản Duplicate để Draft, câu báo mới). Sửa test theo chữ mới. Template cũ đang hiện vẫn giữ nguyên (Published).

**Bổ sung (20/11/2026, người dùng yêu cầu)**: bỏ nhãn "System template" trên thẻ template ở Template Library (`TemplateCard`). Cờ `isSystemStandard` ở BE giữ nguyên. Đã sửa, chờ test tay.

**Bổ sung (20/11/2026, người dùng yêu cầu)**: bỏ nhãn "v2 Engine" cạnh tiêu đề "System Pipeline Templates" (`TemplateCatalogView`). Đã sửa, chờ test tay.
---

## G28. Admin Overview: thẻ Overdue tasks và trạng thái dự án không dùng

**Ngày phát hiện:** 20/11/2026

**Hiện trạng**
- Overview admin có thẻ "Overdue tasks" (không cần).
- "Project status distribution" và bộ lọc tab Workspaces có PLANNING, INACTIVE (BE không có luồng nào chuyển dự án vào hai trạng thái này) và COMPLETED (nhóm dự định bỏ).

**Cách sửa** (chỉ phần admin, không đụng màn Workflow và BE)
- FE: bỏ thẻ Overdue tasks, lưới KPI còn 3 cột.
- FE: biểu đồ trạng thái và bộ lọc Workspaces chỉ còn DRAFT, ACTIVE, PAUSED, ARCHIVED.


**Đã sửa (20/11/2026), chờ test tay**: `AnalyticsTab` (bỏ thẻ Overdue, lưới 3 cột), `WorkspacesTab` (bộ lọc bỏ Planning, Completed, Inactive). Dự án COMPLETED cũ (nếu có) không hiện trong biểu đồ admin.

**Bổ sung (20/11/2026, người dùng yêu cầu)**: biểu đồ trạng thái ở Overview admin bỏ luôn PAUSED, chỉ còn DRAFT, ACTIVE, ARCHIVED. Bộ lọc tab Workspaces vẫn giữ Paused (màn Workflow còn nút Pause). Dự án đang PAUSED không hiện trong biểu đồ admin. Đã sửa, chờ test tay.
---

## G29. Màn dự án có 2 nút "All Pipelines" thừa

**Ngày phát hiện:** 20/11/2026

**Hiện trạng**
- Màn dự án có 4 chỗ quay về danh sách pipeline: logo, thẻ dự án ở thanh bên, nút "All Pipelines" cuối thanh bên, chữ "All Pipelines" trên header.

**Cách sửa**
- FE: bỏ nút "All Pipelines" cuối `CurvedCobaltSidebar` và trên header `ProjectWorkspaceView`. Vẫn quay về được qua logo và thẻ dự án. Tab lọc "All Pipelines" ở trang danh sách pipeline giữ nguyên.

**Đã sửa (20/11/2026), chờ test tay**: `CurvedCobaltSidebar`, `ProjectWorkspaceView`.

**Kiểm tra (20/11/2026)**: `npm run typecheck` qua; `vitest run` 976/977 qua. Test lỗi duy nhất `MacroWorkflow.states.test.tsx` (tự fit đúng 1 lần) đã lỗi sẵn trên main `48b0123`, không liên quan G26–G29.

---

## G30. Admin: nút "Promote to admin" không cần

**Ngày phát hiện:** 20/11/2026

**Hiện trạng**
- User Management có nút "Promote to admin" ở dòng user thường, admin nâng user lên admin bằng một cú bấm. Người dùng thấy không cần.

**Cách sửa**
- FE: bỏ nút "Promote to admin" và hàm mở hộp xác nhận tương ứng trong `UserManagementTab`. Nút "Demote to user" (cho admin khác) giữ nguyên. API đổi quyền ở BE giữ nguyên.

**Đã sửa (20/11/2026), chờ test tay**: `UserManagementTab`, sửa test `UserManagementTab.test.tsx`.

**Bổ sung (20/11/2026, người dùng yêu cầu)**: bỏ luôn nút "Demote to user" (chỉ còn Demote mà không có Promote thì không đồng bộ). Bỏ prop `onChangeRole` ở `UserManagementTab`, `AdminPortalView` và hàm `handleChangeRole` ở `useAdminPortal`. Tooltip nút Suspend của admin đổi thành "Admins can't be suspended.". API đổi quyền ở BE và hàm `changeUserRole` trong service FE giữ nguyên. Đã sửa, chờ test tay.

---

## G31. Nút Start project: icon tên lửa và nút trùng ở Settings

**Ngày phát hiện:** 20/11/2026

**Hiện trạng**
- Màn Workflow: nút xanh "Start project" có icon tên lửa (người dùng muốn bỏ icon).
- Settings → General: có thêm nút xanh "Start project in Workflow →" (chỉ dẫn sang màn Workflow), trùng với nút ở Workflow.

**Cách sửa**
- FE: `ProjectStatusControl` bỏ icon của nút Start project (các nút Pause, Resume, Complete, Reopen giữ icon).
- FE: `GeneralSettingsSection` bỏ nút "Start project in Workflow →". Bắt đầu dự án chỉ ở tab Workflow. BE không đổi.

**Đã sửa (20/11/2026), chờ test tay**: `ProjectStatusControl`, `GeneralSettingsSection`, sửa test `settingsPublish.test.tsx`.

---

## G32. Trang danh sách pipeline có emoji và "(⌘K)"

**Ngày phát hiện:** 20/11/2026

**Hiện trạng**
- `/workspaces`: 3 ô số liệu dưới tiêu đề "Pipelines & Workspaces" có emoji (📂, ⚡, 🟢); ô tìm trên header ghi "Search projects... (⌘K)". Người dùng thấy nhìn như AI làm. Logo góc trên trái giữ nguyên.

**Cách sửa**
- FE: `WorkspaceView` bỏ emoji ở 3 ô số liệu, placeholder đổi thành "Search projects...". Phím tắt Ctrl/⌘+K vẫn hoạt động.

**Đã sửa (20/11/2026), chờ test tay**: `WorkspaceView`, sửa test `WorkspaceView.test.tsx`.

**Bổ sung (20/11/2026, người dùng yêu cầu)**: thanh bên màn dự án bỏ nhãn "SSOT" cạnh chữ "Pipeline Engine" (`CurvedCobaltSidebar`). Dòng "DAG & State Machine" giữ nguyên. Đã sửa, chờ test tay.

---

## G33. Trạng thái và màu thẻ phase sai khi dự án chưa Start

**Ngày phát hiện:** 20/11/2026

**Tái hiện**
1. Tạo dự án "c" (id 29) từ template, thêm vài phase bằng Add Phase, chưa bấm Start project (dự án DRAFT).
2. Màn Workflow: IaC Provisioning, CI/CD & Monitoring có thanh xanh và ghi TODO; các phase thêm sau thanh xám; "Cụm công việc 3" LOCKED, "Cụm công việc 4/5/6" TODO.
3. Sau khi Start, các phase thêm sau vẫn xám.

**Dữ liệu thật (DB dev, dự án 29, DRAFT)**
- WPE-001, WPE-002, WPE-003 (sinh lúc tạo từ template) là TODO; task tạo tay sau đó (WPE-005, 006, 008) là LOCKED.
- WPE-009 TODO vì đã bấm "Unlock early" (`force_unlocked_at` có giá trị) khi dự án còn DRAFT.
- Phase 5, 6, "New phase" không có task.
- Phase từ template có `accent_color = blue`, phase thêm bằng Add Phase có `slate`.

**Nguyên nhân (đã xác định)**
1. BE `TemplateCloneService` (dòng ~332): task không có tiền đề được tạo TODO ngay, dù dự án mới là DRAFT. Tạo task tay trong DRAFT thì `WorkflowGraphService.createNode` cho LOCKED. Hai đường không khớp nhau.
2. FE `PhaseCard`: màu thanh lấy theo `accent` của phase (template = blue, Add Phase = slate mặc định ở BE `WorkflowGraphService` dòng ~127), chỉ đổi khi COMPLETED (xanh lá) hoặc LOCKED (xám). Nên màu phụ thuộc phase sinh ra từ đâu chứ không theo trạng thái.
3. BE `PhaseProgressCalculator` và FE `domain/phaseProgress.ts`: phase không có task bị coi là TODO.
4. BE `StateMachineService.forceUnlock`: không kiểm trạng thái dự án, nên mở khóa sớm được cả khi DRAFT.
5. Ghi chú: cạnh nối giữa các phase (`phase_dependency`) chỉ để vẽ và chặn chu trình, không khóa task. Task chỉ khóa theo cạnh giữa các task (`node_dependency`). Tooltip ổ khóa "waiting for prerequisite phases" dễ hiểu nhầm.

**Hướng sửa đề xuất (chờ người dùng chốt)**
- BE: tạo dự án từ template thì mọi task là LOCKED. Start project (`publishPipeline`) đã có sẵn bước mở các task gốc sang TODO, giữ nguyên.
- FE: màu thẻ phase chỉ theo trạng thái: LOCKED / không có task = xám, TODO / IN_PROGRESS = xanh dương, COMPLETED = xanh lá. Bỏ dùng `accent`.
- BE + FE: phase không có task hiện "NO TASKS" (xám) thay cho TODO. Sửa cùng lúc `PhaseProgressCalculator` và `phaseProgress.ts`.
- BE: chỉ cho "Unlock early" khi dự án ACTIVE; FE ẩn nút khi dự án chưa Start.
- Dữ liệu cũ (dự án DRAFT đã có task TODO): cân nhắc migration Flyway đưa task của dự án DRAFT/PLANNING về LOCKED (trừ task đã mở sớm, tùy người dùng chọn).

**Người dùng đã chốt (20/11/2026)**
- Sau khi Start, phase mà mọi task đều chờ task đi trước thì giữ xám, có ổ khóa.
- Cạnh nối giữa các phase giữ như hiện nay (chỉ để vẽ, không khóa task).
- Migration dữ liệu cũ: chọn A1 (task TODO của dự án chưa Start về LOCKED, kể cả task đã mở sớm).

**Đã sửa (20/11/2026), chờ test tay**
- BE: `TemplateCloneService` tạo mọi task LOCKED (bỏ phần tính cạnh vào chỉ dùng để chọn TODO). `PhaseProgressCalculator` phase rỗng trả `NO_TASKS`. `StateMachineService.forceUnlock` báo 409 `PROJECT_NOT_STARTED` khi dự án DRAFT/PLANNING.
- DB: `V23__lock_tasks_of_unstarted_projects.sql` đưa task TODO của dự án DRAFT/PLANNING về LOCKED, xóa dấu mở sớm, tăng `version`.
- FE: `PhaseStatus` thêm `NO_TASKS`; `phaseProgress.ts` phase rỗng ra `NO_TASKS` (track rỗng vẫn TODO); `PhaseCard` màu chỉ theo trạng thái (xám: LOCKED/NO_TASKS, xanh dương: TODO/IN_PROGRESS, xanh lá: COMPLETED), nhãn "NO TASKS"; phase mới tạo là `NO_TASKS`, không khóa; `PhaseDetailView` ẩn "Unlock early" khi dự án chưa Start (`isProjectStarted` trong `domain/projectWork.ts`).
- Tài liệu: `FRONTEND_BACKEND_INTEGRATION_MAP.md` ghi các giá trị `status` của Phase.
- Kiểm tra: BE `./mvnw test` qua hết. FE typecheck qua; `vitest run` 980/981 qua (lỗi duy nhất `MacroWorkflow.states.test.tsx` có sẵn trên main). Migration chạy trên DB dev: dự án 29 còn 0 task TODO. API thật (alex.kim, dự án test 30 tạo từ SDLC): sau khi tạo 7/7 task LOCKED, 4 phase LOCKED; Unlock early → 409 `PROJECT_NOT_STARTED`; Start → mở 4 task gốc, 4 phase TODO; Unlock early WPE-002 sau khi Start → 200.

## G34. Rút trạng thái dự án từ 7 xuống 3

**Ngày ghi:** 21/11/2026 · **Nhánh:** `fix/rut-trang-thai-du-an` · **Trạng thái:** chờ kiểm

**Vấn đề**
- BE có 7 trạng thái dự án: `DRAFT, PLANNING, ACTIVE, PAUSED, COMPLETED, INACTIVE, ARCHIVED`. DB dev lúc đầu có 7 DRAFT, 6 ACTIVE, 1 PLANNING, 1 ARCHIVED.
- `PLANNING`: mọi chỗ kiểm đều là `DRAFT || PLANNING`, tức là y hệt DRAFT. FE `CreatePipelineModal` ghi "tạo từ template thì PLANNING" nhưng BE `TemplateCloneService` gán DRAFT.
- `COMPLETED`: thừa về nghiệp vụ, vì dự án thật luôn cập nhật tiếp, không dùng nữa thì Archive (khôi phục được). Về kỹ thuật cũng trùng PAUSED (cả hai chỉ khóa cộng tác viên, cả hai quay về ACTIVE). Còn lệch: FE cho "Mark completed" khi PAUSED, nhưng BE chặn `PAUSED → COMPLETED` (409).
- `INACTIVE`: không có đường chuyển vào, chỉ có trong DevToolbar. Code chết.
- `PAUSED`: chỉ chặn cộng tác viên đổi trạng thái task và nộp minh chứng (409 `PROJECT_NOT_ACTIVE`); Owner/Manager vẫn làm bình thường. `TaskOverdueScanner` không xét trạng thái dự án, nên dự án đang PAUSED vẫn bị đánh trễ hạn trong khi cộng tác viên không được nộp. App để theo dõi tiến độ và minh chứng, việc thật vẫn chạy bên ngoài, nên chặn nộp chỉ làm dữ liệu sai lệch.

**Người dùng đã chốt (21/11/2026)**
- Còn 3 trạng thái: `DRAFT`, `ACTIVE`, `ARCHIVED` (lúc đầu chốt 4, giữ PAUSED; sau đó chốt bỏ luôn PAUSED).
- Bỏ nút "Mark completed", "Pause", "Resume". KHÔNG làm gợi ý "tất cả task đã xong · Archive?": dự án 100% vẫn là ACTIVE, không hiện gì thêm.
- Trạng thái `COMPLETED` của **phase** (suy ra từ task) không liên quan, giữ nguyên.

### Đặc tả đã chốt
- Luồng chuyển (BE `ProjectService.ALLOWED_TRANSITIONS`):
  - `DRAFT → ARCHIVED`. `DRAFT → ACTIVE` chỉ qua Start project (publish), đổi trực tiếp vẫn trả 409 `USE_PUBLISH`.
  - `ACTIVE → ARCHIVED`
  - `ARCHIVED → ACTIVE | DRAFT` (giữ luật cũ: dự án chưa từng Start thì khôi phục về DRAFT).
- Gửi giá trị đã bỏ (`PLANNING`, `PAUSED`, `COMPLETED`, `INACTIVE`) vào `PATCH /projects/{id}/status` → 400 "Invalid project status" (tự có vì `ProjectStatus.valueOf` lỗi). Lọc admin theo trạng thái đã bỏ cũng 400 như giá trị lạ khác.
- Migration:
  - `V24__drop_unused_project_status.sql`: `PLANNING → DRAFT`, `COMPLETED → ACTIVE`, `INACTIVE → ARCHIVED`.
  - `V25__drop_paused_project_status.sql`: `PAUSED → ACTIVE`. Tách riêng vì V24 đã chạy trên DB dev trước khi chốt bỏ PAUSED; sửa V24 sẽ lệch checksum Flyway.
  - Không đụng task (task của dự án PLANNING đã về LOCKED ở V23). Không sửa migration cũ vì Flyway kiểm checksum.
- Luật quyền làm task: cộng tác viên chỉ làm task khi ACTIVE, DRAFT thì chỉ xem (409 `PROJECT_NOT_ACTIVE` giữ nguyên mã); Owner/Manager làm được mọi trạng thái trừ ARCHIVED.
- Admin chuyển chủ dự án (`AdminProjectOwnerService`): chỉ chặn ARCHIVED (bỏ điều kiện COMPLETED).
- FE `ProjectStatusControl`: DRAFT có nút Start project; ACTIVE và ARCHIVED không có nút. Lưu trữ / khôi phục vẫn ở Settings.
- FE tạo dự án (`CreatePipelineModal`): luôn ghi DRAFT, kể cả tạo từ template.

### Được đọc
- `wpe-backend/src/**`, `wpe-frontend/src/**`, `docs/specs/workflow-engine.md`, `docs/specs/database-schema.md`, `docs/FRONTEND_BACKEND_INTEGRATION_MAP.md`

### Được ghi
> `BE/` = `wpe-backend/src/main/java/com/pipeline/wpe/`, `FE/` = `wpe-frontend/src/`
- `wpe-backend/src/main/resources/db/migration/V24__drop_unused_project_status.sql`, `V25__drop_paused_project_status.sql` (MỚI)
- `BE/common/enums/ProjectStatus.java`, `BE/service/ProjectService.java`, `BE/service/WorkflowGraphService.java`, `BE/service/engine/StateMachineService.java`, `BE/service/GuestGatewayService.java` (chỉ chú thích), `BE/service/profile/UserProfileService.java`, `BE/service/admin/AdminProjectOwnerService.java`
- Test BE: `ProjectServiceTest`, `WorkflowGraphServiceTest`, `StateMachineServiceTest`, `GuestGatewayServiceTest`, `UserProfileServiceTest`, `AdminProjectOwnerServiceTest`, `AdminStatsServiceTest`
- `FE/types/workspace.types.ts`, `FE/types/settings.types.ts`, `FE/components/workflow/ProjectStatusControl.tsx`, `FE/components/workflow/MacroWorkflow.tsx` (chú thích), `FE/components/common/StatusBadge.tsx`, `FE/components/workspace/CreatePipelineModal.tsx`, `FE/components/settings/GeneralSettingsSection.tsx`, `FE/components/dev/DevToolbar.tsx`, `FE/store/slices/devSlice.ts`, `FE/domain/projectWork.ts`, `FE/features/admin/components/WorkspaceDetailDrawer.tsx`, `FE/features/admin/components/OwnedProjectsDrawer.tsx`, `FE/features/admin/tabs/WorkspacesTab.tsx`, `FE/services/impl/HttpWorkflowService.ts`, `FE/services/impl/http/overview.ts`, `FE/services/impl/http/projectSettings.ts`, `FE/services/admin/MockAdminService.ts`, `FE/services/mock/MockWorkflowService*.ts`
- Test FE có dùng trạng thái đã bỏ (`ProjectStatusControl.test.tsx`, `TaskDetailModal.test.tsx`, `projectWork.test.ts`, `taskTransitions.test.ts`, `AnalyticsTab.test.tsx`, `OwnedProjectsDrawer.test.tsx`, `WorkspaceDetailDrawer.test.tsx`, `projectSettings.test.ts`, `settingsPublish.test.tsx`, `workspaceSlice.test.ts`)
- `docs/specs/workflow-engine.md`, `docs/specs/database-schema.md`, `docs/FRONTEND_BACKEND_INTEGRATION_MAP.md`, mục G34 này

### Việc cần làm
1. Migration rồi enum BE, sau đó sửa từng chỗ BE dùng trạng thái đã bỏ. Sửa test BE theo luật mới, thêm test: gửi trạng thái đã bỏ → 400, Admin chuyển chủ dự án DRAFT/ACTIVE được.
2. FE: rút kiểu `ProjectStatus` còn 3 giá trị, để `typecheck` chỉ ra mọi chỗ còn dùng, sửa hết. Mặc định khi BE không trả status: `DRAFT` (thay `PLANNING`).
3. Sửa test FE theo luật mới.
4. Cập nhật tài liệu (spec, schema, integration map).
5. Kiểm: BE `./mvnw test`, FE `npm run typecheck` và `npx vitest run`, chạy app thật kiểm trên API.
6. Ghi kết quả vào mục này, đổi trạng thái thành "chờ kiểm". Commit nhỏ theo skill `commit-nho` khi người dùng bảo.

### Tiêu chí xong
- `grep -rn "PLANNING\|INACTIVE\|PAUSED" wpe-backend/src/main/java wpe-frontend/src` (trừ test) không còn kết quả. `ProjectStatus.COMPLETED` không còn ở BE; ở FE chỉ còn `COMPLETED` của phase.
- BE `./mvnw test` qua hết. FE `npm run typecheck` qua; `npx vitest run` không có lỗi mới ngoài lỗi có sẵn.
- DB dev sau khi chạy backend: `project.status` chỉ còn `DRAFT, ACTIVE, ARCHIVED`; Flyway ghi V24, V25 thành công.
- API thật (Owner): gửi `PAUSED`, `COMPLETED` → 400; ACTIVE → ARCHIVED → khôi phục ACTIVE được.
- Màn Workflow: dự án DRAFT chỉ có nút Start project; dự án ACTIVE không có nút trạng thái.

### Đã làm (21/11/2026), chờ kiểm
- DB: V24, V25.
- BE: enum `ProjectStatus` còn `DRAFT, ACTIVE, ARCHIVED`; `ProjectService.ALLOWED_TRANSITIONS` theo đặc tả; bỏ nhánh `PLANNING` ở `WorkflowGraphService` (tạo node, publish; câu báo publish đổi thành "Only projects in DRAFT status can be published...") và `StateMachineService.forceUnlock`; `AdminProjectOwnerService` chỉ chặn ARCHIVED (câu báo "This project is archived, so its owner can't be changed."); `UserProfileService` bỏ 4 nhãn.
- FE:
  - 2 kiểu `ProjectStatus` còn 3 giá trị.
  - `ProjectStatusControl` chỉ còn Start project; bỏ nhánh gọi `updateProjectStatus` (không còn nút nào khác dùng).
  - `CreatePipelineModal` luôn DRAFT; `isProjectStarted` chỉ xét DRAFT; `NOT_RUNNING_LABEL` chỉ còn DRAFT.
  - Badge/nhãn/bộ lọc bỏ 4 giá trị ở `StatusBadge`, `GeneralSettingsSection`, `DevToolbar`, admin (`WorkspacesTab` bỏ cả lựa chọn lọc "Paused", `WorkspaceDetailDrawer`, `OwnedProjectsDrawer`: câu "Archived projects can't be transferred."), `overview.ts`, mock, `devSlice`.
  - `HttpWorkflowService` mặc định DRAFT.
- Không đổi: tab Analytics của admin vẫn chỉ hiện DRAFT/ACTIVE/ARCHIVED (quyết định G28), nay khớp đúng 3 trạng thái.
- Test: sửa test BE/FE theo luật mới; thêm test BE gửi `COMPLETED`/`PAUSED`/`PLANNING`/`INACTIVE` → 400, Admin chuyển chủ dự án DRAFT/ACTIVE được; FE: dự án ACTIVE không có nút, Admin drawer dự án DRAFT vẫn hiện ô chọn chủ mới. Bỏ test publish từ chối PAUSED (ACTIVE đã có test riêng).
- Tài liệu: `specs/workflow-engine.md` (mục 5.1 viết lại kèm lý do bỏ từng trạng thái, luật đổi trạng thái, mục quyền làm task), `specs/database-schema.md`, `FRONTEND_BACKEND_INTEGRATION_MAP.md`.

**Kết quả kiểm (lần cuối, sau khi bỏ PAUSED)**
- `grep` theo tiêu chí: không còn `PLANNING`/`INACTIVE`/`PAUSED` trong code BE và FE (trừ test và chữ `paused` của một CSS animation); `COMPLETED` ở FE chỉ còn của phase.
- BE `./mvnw test`: 1113 test, 0 lỗi (ít hơn lần trước vì bỏ các ca PAUSED).
- FE `npm run typecheck` qua. `npx vitest run`: 975/976 qua. Lỗi còn lại không do G34:
  - `MacroWorkflow.states.test.tsx` (fit 2 lần): có sẵn trên main, đã ghi ở G33.
  - `TaskDetailModal.test.tsx` "chỉ gửi dueDate khi chỉ đổi hạn chót": test ghi cứng hạn chót `2026-11-20` cho task không có `createdAt`, nên mốc nhỏ nhất là hôm nay; từ 21/11 ngày đó thành quá khứ và nút Save bị khóa. Đã sửa (cùng PR): cho task trong test `createdAt` cố định `2026-11-01`, chạy qua cả giờ máy và giờ UTC.
- DB dev: Flyway áp dụng V24 rồi V25 thành công. V24 đổi dự án PLANNING duy nhất (id 2) sang DRAFT; V25 không đổi dòng nào (DB dev không có dự án PAUSED). Hiện có ACTIVE 7, ARCHIVED 1, DRAFT 8.
- API thật (alex.kim, dự án 30 "G33 kiem tra"): gửi `PAUSED` → 400 "Invalid project status: PAUSED"; `COMPLETED` → 400; ACTIVE → ARCHIVED 200; ARCHIVED → ACTIVE 200 (dự án 30 về lại ACTIVE như cũ).
- Giao diện: chưa mở trình duyệt kiểm (máy không có Playwright); nút theo trạng thái kiểm qua `ProjectStatusControl.test.tsx`. Cần người dùng xem tay màn Workflow.
