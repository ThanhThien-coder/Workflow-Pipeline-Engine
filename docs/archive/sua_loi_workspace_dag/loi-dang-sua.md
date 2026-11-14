# Sửa lỗi Workspace DAG

Lỗi phát hiện khi test tay với backend thật (`VITE_USE_MOCK=false`). Gặp lỗi thì ghi lại (tái hiện, nguyên nhân, hướng sửa); chỉ sửa code khi được bảo. Cách sửa theo [README.md](README.md). Task sửa: [tasks/](tasks/README.md) (T1: G5, G9 · T2: G4, G6 · T3: G7, G8, G11 · T4: G10 · T5: G3 · T6: G8, G12).

| # | Lỗi | Khu vực | Trạng thái |
|---|---|---|---|
| G1 | Tạo dự án từ template mẫu (SDLC, Marketing, DevOps) bị lỗi, chỉ tạo được dự án trống | FE | Đã sửa, chờ test tay |
| G2 | Phase mới tạo nằm ngang, dính sát nhau, phải bấm Auto Layout mới xếp đúng | FE | Đã sửa, chờ test tay |
| G3 | Dây nối giữa các phase khó đọc: không có hướng, đè lên nhau, cắt qua thẻ | FE | Chưa sửa |
| G4 | Artifacts là dữ liệu giả: nút trên Workflow hiện số 5 (bấm vào về 0), Settings → Project Resources hiện 5 link giả | FE | Chưa sửa |
| G5 | Thanh bên hiện thành viên giả (AK, SC, ML, +1) và tên dự án giả "Marketing Campaign Q4" | FE | Đã sửa (T1), chờ test tay |
| G6 | Drawer Artifacts nền đen, khó nhìn, lệch tông với cả app | FE | Chưa sửa |
| G7 | Subtask không được lưu lên server: gắn ghost vào subtask báo lỗi, gắn ghost vào task gốc thì subtask biến mất | FE + BE | Đã sửa (T3), chờ test tay |
| G8 | Node Properties cho chọn trạng thái tùy ý (LOCKED, DONE…), lưu chỉ trên trình duyệt | FE | Phần lưu + bỏ ô trạng thái đã sửa (T3); thiết kế lại ở T6 |
| G9 | Danh sách thành viên trong Node Properties và Kanban là người giả, thiếu chủ dự án thật | FE | Đã sửa (T1), chờ test tay |
| G10 | Kanban của phase: task chưa giao hiện "Alex Kim", task LOCKED hiện ở To Do, subtask tạm có mã WPE ngẫu nhiên | FE | Chưa sửa |
| G11 | Thành viên không phải chủ dự án vẫn sửa được các ô trong Node Properties (chỉ không lưu được) | FE | Đã sửa (T3), chờ test tay |
| G12 | Chủ dự án chưa mở khóa sớm được task trên giao diện; BE mở sớm xong thì sửa dây sẽ bị khóa lại, không lưu ai mở | FE + BE + DB | Chưa sửa |

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
