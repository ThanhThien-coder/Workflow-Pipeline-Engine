# B5 — Nối canvas Macro/Mindmap với API đồ thị thật (FE Cụm 4)

Người làm: B
Người review: C
Trạng thái: xong
Cần có trước: A2, B3
Cần trước bước frontend: không
Mở khóa: B6
Nhánh git: b5-graph-ui
Ước lượng: 2 ngày

> **Cập nhật 11/11/2026 (sau khi pull):** `HttpWorkflowService.ts` đã gọi API thật cho `getMacroPhases`, `getPhaseEdges`, `getPhaseGraph`, `createPhase`, `connectPhases`, `disconnectPhases`, `deletePhase`, nhưng **vẫn rơi về mock khi lỗi** (`return super.…`), và phần chuyển dữ liệu nằm lẫn trong từng hàm. Sau khi A2 tách file, task này dọn lại phần đồ thị.

> ⚡ **Chế độ sprint:** task này **để lại sau hạn nộp**, làm theo chế độ thường (xem [SPRINT_2_NGAY.md](../SPRINT_2_NGAY.md) mục 6).
>
> **Ghi chú 12/11/2026:** người B quyết định làm sớm B5 theo **chế độ sprint** (Claude viết cả `graphMapper` và test, kể cả phần 🧠). Phần "tự viết mapper" chuyển sang giai đoạn Học lại (SPRINT_2_NGAY.md mục 8): người B đọc lại và tự giải thích được `graphMapper.ts` thì mới đổi `Đã học lại: rồi`.

## Vì sao cần task này
- Lời gọi đồ thị đang có fallback ngầm: backend lỗi thì canvas hiện dữ liệu giả mà không ai biết.
- Phần đổi dữ liệu từ mô hình phẳng của backend (phases, nodes, dependencies) sang mô hình Root/Branch/Ghost (`GraphNodeMap`) của FE đang viết lặp lại trong 3 hàm, chưa có test.
- `addRootTask`, `attachGhostNode`, `updatePhasePosition` vẫn chạy mock; vị trí phase sẽ lưu được sau B2.
- **Canvas chưa khóa theo vai trò (thêm ngày 12/11/2026, sau B3).** Từ B3, backend chỉ cho **owner** sửa đồ thị; Collaborator và Viewer gọi API ghi sẽ nhận 403. Nhưng `FE/components/workflow/**`, `FE/components/mindmap/**` không kiểm tra vai trò ở đâu cả: người không phải owner vẫn kéo thả, thêm node, nối cạnh được, thao tác xong mới nhận lỗi. Backend chặn là lớp bảo vệ thật; task này thêm lớp giao diện để người dùng không bấm được ngay từ đầu.

## Kiến thức phải nắm
Mẫu Mapper/Adapter, chuẩn hóa dữ liệu (normalize), optimistic UI và cách chờ server, debounce khi kéo thả.

## Bước 0 — Tự đọc, không dùng AI
Đọc: `FE/types/workflow.types.ts`; phần phase/graph trong `FE/services/MockWorkflowService.ts`; `FE/services/workflow/WorkflowService.ts` và `IWorkflowGraphService.ts`; `FE/components/workflow/MacroWorkflow.tsx`, `FE/components/mindmap/MindmapTree.tsx`; `FE/lib/graph/treeLayout.ts`, `phaseLayout.ts`; `FE/mappers/projectMapper.ts` (xem cách một mapper đang được viết).
Trả lời:
1. Root, Branch, Ghost node trên FE tương ứng với gì ở backend? (gợi ý: Ghost là cạnh phụ thuộc nối sang phase khác)
2. Kéo một node làm phát sinh khoảng 60 sự kiện mỗi giây. Gọi API mỗi lần thì sao?
3. `FE/services/workflow/WorkflowService.ts` và `IWorkflowService` khác vai trò nhau thế nào?

## Được đọc
> Viết tắt: `BE/` = `wpe-backend/src/main/java/com/pipeline/wpe/`, `BE-test/` = `wpe-backend/src/test/java/com/pipeline/wpe/`, `FE/` = `wpe-frontend/src/`.
- `FE/**`, `docs/**`

## Được ghi
- `FE/services/impl/http/graph.ts`
- `FE/services/impl/HttpWorkflowService.ts` (chỉ các phương thức đồ thị và danh sách `METHODS_STILL_MOCKED`)
- `FE/mappers/graphMapper.ts` (mới) và test
- `FE/components/workflow/**`, `FE/components/mindmap/**`
- `FE/hooks/usePhaseConnectDrag.ts`, `FE/hooks/useEdgeRenderer.ts`
- `FE/types/workflow.types.ts`
- `FE/store/useWorkflowStore.ts` (chỉ phần phase/đồ thị)
- `docs/tasks/B-do-thi/B5-canvas-goi-api-that.md`

## Đặc tả đã chốt
- Backend trả mô hình phẳng (B2). Gom phần chuyển đổi đang nằm trong `HttpWorkflowService` về `FE/mappers/graphMapper.ts` với 3 hàm: `toMacroPhases(graph)`, `toPhaseEdges(graph)`, `toPhaseTree(graph, phaseId)`. Ghost = dependency có `parent.phaseId !== child.phaseId`, gắn vào node con. Hành vi hiển thị phải giữ nguyên như hiện tại.
- Bỏ mọi `return super.…` trong phần đồ thị: lỗi thì ném `ApiError` (A2).
- `addRootTask` gọi `POST /projects/{id}/nodes`; `attachGhostNode` gọi `POST /projects/{id}/dependencies`.
- Lưu tọa độ node: gọi `PATCH /nodes/{id}/metadata` khi thả chuột, debounce 300ms. Phase lưu tọa độ qua `PUT /phases/{id}` với `uiMetadata` (`updatePhasePosition`, cần B2).
- Lời gọi API đặt trong `FE/services/impl/http/graph.ts` (khung do A2 tạo). Phương thức nào đã gọi thật thì xóa khỏi `METHODS_STILL_MOCKED`.
- Nối tạo vòng (422) → mở `KahnCycleModal` với danh sách mã. 403 và 409 → toast theo `ApiError.code`.
- `resetPhaseTree` chưa có trong SSOT → giữ mock, ghi lý do.
- **Khóa canvas theo vai trò** (thêm ngày 12/11/2026):
  - Vai trò lấy từ store: `useWorkflowStore((s) => s.settings.settings?.myRole)` (chỉ đọc, không sửa `settingsSlice`). Quy ước giống `GeneralSettingsSection`: `isOwner = myRole === 'OWNER'`.
  - Không phải owner thì canvas ở chế độ **chỉ xem**: không kéo được phase và node; ẩn hoặc vô hiệu hóa (`disabled`) các nút tạo, sửa, xóa phase và node, nối và gỡ cạnh; không mở được thao tác kéo để nối (`usePhaseConnectDrag`). Nút bị vô hiệu hóa có `title` "Chỉ chủ dự án được sửa đồ thị".
  - Vẫn cho xem: pan, zoom, chọn phase, mở chi tiết node.
  - Không phải owner thì **không gọi** API ghi nào của đồ thị (kể cả `PATCH metadata`, `PUT /phases/{id}`).
  - Vẫn giữ xử lý 403 → toast ở dòng trên, phòng khi vai trò đổi giữa phiên hoặc store chưa kịp cập nhật.
  - Dự án `ARCHIVED`: owner cũng ở chế độ chỉ xem (backend trả 409 `PROJECT_ARCHIVED` từ B2, B3).
  - Phải kiểm `myRole` đã được nạp khi vào thẳng màn canvas (không qua Settings). Nếu chưa nạp thì ghi vào "Điều chưa chắc" và báo nhóm, vì nạp settings nằm ngoài "Được ghi" của task này.

## Việc cần làm
1. 🧠 Bước 0.
2. 🧠 **Tự viết** `graphMapper` và test (đây là phần cốt lõi). Claude chỉ review.
3. 🤝 Viết `graph.ts`, nối các component.
4. 🧠 Chạy thật trên dữ liệu seed: tạo phase, nối 2 phase, thêm node, nối node thành vòng.
5. 🤝 Khóa canvas theo vai trò (đặc tả ở trên), có test component cho vai trò VIEWER và OWNER.
6. 🤝 Thêm test component nếu có thay đổi lớn.

## Tiêu chí xong
- [x] `npm run typecheck && npm test` pass.
- [x] `graphMapper` có ít nhất 8 test: phase nhiều cha, ghost khác phase, node độc lập, đồ thị rỗng… (có 20)
- [ ] Chạy thật: tạo phase, nối 2 phase, thêm node, nối node thành vòng thì hiện modal chu trình. F5 vẫn giữ vị trí đã kéo thả. (**Phần API đã chạy thật**, xem "Kết quả test" mục 3; phần nhìn modal và kéo thả trên trình duyệt dời về buổi kiểm chung.)
- [ ] Chạy thật với sarah (COLLABORATOR) và một tài khoản VIEWER trên dự án mẫu: không kéo được phase, node; các nút sửa đồ thị bị ẩn hoặc vô hiệu hóa; tab Network không có request ghi đồ thị nào. Đăng nhập alex (owner) thì thao tác bình thường. (**Dự đoán sẽ chưa đạt ở chế độ API thật**, xem "Điều chưa chắc" 1.)
- [x] Có test component: vai trò VIEWER thì nút thêm node, thêm phase bị vô hiệu hóa; OWNER thì bấm được.

## Câu hỏi bảo vệ (người review hỏi, trả lời không nhìn code)
1. Mapper ở đây là mẫu thiết kế gì? Vì sao không để component tự đổi dữ liệu?
2. Debounce khác throttle ở đâu? Chỗ này vì sao dùng debounce?
3. `PATCH metadata` lỗi mạng thì UI nên làm gì?

## Cấm
- Sửa file ngoài mục "Được ghi". File dùng chung thì báo nhóm trước (README mục 6).
- Đọc, in, commit `.env*`, khóa, mật khẩu thật, API key. Dùng `git add -f`.
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
> Làm ngày 12/11/2026 ở chế độ sprint, nhánh `b5-graph-ui` tách từ main `00671af`. Phần này do Claude ghi. `FE/` = `wpe-frontend/src/`.

**1. Mapper (mẫu Adapter): `FE/mappers/graphMapper.ts` (mới)**
- 3 hàm thuần theo đặc tả: `toMacroPhases(graph)`, `toPhaseEdges(graph)`, `toPhaseTree(graph, phaseId)`, cộng `toCreatedMacroPhase` (cho `POST /phases`) và 2 hàm đặt id `rootIdOf`, `ghostIdOf`.
- Ghost = dependency có `parent.phaseId !== child.phaseId`, gắn vào node con (`targetTaskId`).
- **Hiển thị giữ nguyên:** trước khi xóa code cũ, đã chạy một test tạm so đầu ra của code cũ trong `HttpWorkflowService` với mapper trên cùng một đồ thị (4 phase, phase nhiều cha, ghost, node độc lập, cạnh trỏ tới node không tồn tại): kết quả bằng nhau hoàn toàn (`toEqual`). Test tạm đã xóa.
- Thêm duy nhất 1 điểm: phase có `uiMetadata.x/y` (đã kéo thả) thì dùng vị trí đó. Trước B5 không phase nào có giá trị này nên hiển thị cũ không đổi; đây là điều kiện để F5 giữ vị trí.
- Kiểu dữ liệu backend (`BackendGraphResponse`, `BackendPhaseDto`…) đặt ở `FE/types/workflow.types.ts`.

**2. Lời gọi API: `FE/services/impl/http/graph.ts` (mới)**
- Mỗi endpoint Cụm 4 một hàm: `fetchGraph`, `createPhase`, `updatePhase` (PUT), `connectPhases`, `disconnectPhases`, `deletePhase`, `createNode`, `createDependency`, `publishProject`. Lỗi luôn là `ApiError`.
- `createKeyedDebounce(300)`: debounce theo từng phase. Kéo 3 lần trong 300ms chỉ gửi 1 PUT với vị trí cuối; Auto Layout đổi 5 phase vẫn gửi đủ 5 PUT.
- `toBackendId`: id node mới tạo cục bộ (`task-1731…`) không phải số thì báo lỗi `NODE_NOT_SAVED` rõ ràng thay vì để backend trả 400 khó hiểu.

**3. `FE/services/impl/HttpWorkflowService.ts` (chỉ phần đồ thị và `METHODS_STILL_MOCKED`)**
- `getMacroPhases`, `getPhaseEdges`, `getPhaseGraph`, `createPhase`, `connect/disconnect/deletePhase`, `publishPipeline` gọi qua `graph.ts` và mapper. Không còn `return super.…` hay `this.mock` nào trong phần đồ thị.
- `updatePhasePosition`: trước đây gọi **mock** (backend 403 vẫn "lưu thành công"). Giờ gọi `PUT /projects/{id}/phases/{phaseId}` với `{ name, uiMetadata: {x, y, w: 380, h: 180} }` (w/h đúng `MACRO_CARD_W/H`). PUT bắt buộc có `name` nên service nhớ tên phase từ lần đọc đồ thị gần nhất; chưa có thì tự đọc lại.
- Thêm `addRootTask` → `POST /projects/{id}/nodes`; `attachGhostNode` → `POST /projects/{id}/dependencies` (nguồn là cha, đích là con).
- Xóa `updatePhasePosition` khỏi `METHODS_STILL_MOCKED`.
- `resetPhaseTree`: **giữ không cài** vì chưa có trong SSOT. Nút "Reset Phase Tree" trên canvas gọi `store.resetPhaseTree`, chỉ đọc lại đồ thị (GET), không xóa gì.

**4. Store `FE/store/useWorkflowStore.ts` (chỉ phần phase/đồ thị)**
- `selectCanEditGraph(state)`: `myRole === 'OWNER'` và dự án không `ARCHIVED`. Chưa nạp vai trò thì không khóa (lý do ở "Điều chưa chắc" 1).
- Mọi action ghi đồ thị (`createPhase`, `connectPhases`, `disconnectPhases`, `deletePhase`, `updatePhasePosition`, và 3 action mới) gọi `ensureCanEditGraph` trước: không phải owner thì ném `ApiError` `GRAPH_READ_ONLY` và **không gửi request nào**. Đây là lớp chặn thứ hai, sau lớp giao diện.
- 3 action mới: `addRootTask`, `attachGhostNode` (gọi API rồi đọc lại cây), `connectNodes` (gọi API, thành công mới vẽ cạnh). Cờ `graphWritesUseApi` cho biết đang ở chế độ API thật; chế độ mock giữ nguyên cách cũ.

**5. Component (`FE/components/workflow/**`, `FE/components/mindmap/**`, `FE/hooks/usePhaseConnectDrag.ts`)**
- Khóa theo vai trò: nút Add Phase, Auto Layout, Attach Ghost, + Add Root Task, Add Ghost Node bị `disabled` với `title` "Chỉ chủ dự án được sửa đồ thị". Cổng nối (+) của thẻ phase bị vô hiệu hóa; `usePhaseConnectDrag` có tham số `enabled`. Thẻ phase không kéo được, nhưng bấm vẫn chọn phase. Ẩn nút xóa phase, xóa node, gỡ ghost, thêm con, chọn gộp, gỡ cạnh phase; nhấp đúp không sửa tên. `NodePropertiesModal` vẫn mở để xem, nhưng ẩn Lưu và Xóa.
- Vẫn xem được: pan, zoom, chọn phase, mở chi tiết node, đổi Graph/Kanban.
- Lỗi: `useGraphErrorHandler.ts` (mới). 422 thì mở `KahnCycleModal` với danh sách mã node; 403, 409 và lỗi khác thì toast theo `ApiError.code` (`ACCESS_DENIED`, `GRAPH_READ_ONLY`, `PROJECT_ARCHIVED`, `NETWORK_ERROR`).
- Chế độ API: "+ Add Root Task" mở `AddRootTaskModal` (nhập tên) rồi gọi store; kéo nối 2 node gọi `connectNodes` (kéo từ ghost thì cha thật là node ở phase khác). Chế độ mock giữ cách thêm và nối cục bộ như cũ.
- **Không sửa** `services/workflow/WorkflowService.ts`, `useConnectDrag.ts`, `settingsSlice.ts`, `KahnCycleModal.tsx` (ngoài "Được ghi"). Component gọi store thay vì sửa lớp `WorkflowService`.

### Kết quả test (dán output thật, không chép tay)

**1. Test đỏ trước khi sửa**

Phần service: `npx vitest run src/services/impl/http/__tests__/graph.test.ts`, trước khi viết `graph.ts`:
```
× updatePhasePosition, addRootTask, attachGhostNode không còn nằm trong METHODS_STILL_MOCKED
× updatePhasePosition gọi PUT /projects/7/phases/20 kèm tên phase và uiMetadata {x, y, w, h}
× updatePhasePosition debounce 300ms: kéo 3 lần liên tiếp chỉ gửi 1 PUT với vị trí cuối
× updatePhasePosition: 2 phase khác nhau (Auto Layout) thì mỗi phase 1 PUT, không nuốt nhau
× updatePhasePosition chưa biết tên phase thì tự đọc đồ thị trước khi PUT (PUT bắt buộc có name)
× updatePhasePosition: backend trả 403 thì ném ApiError ACCESS_DENIED, không giả vờ lưu thành công
× addRootTask gọi POST /projects/7/nodes với phaseId dạng số và tiêu đề
× attachGhostNode gọi POST /projects/7/dependencies: node nguồn là cha, node đích là con
× attachGhostNode: nối tạo vòng (422) thì ném ApiError có cycleNodes để mở KahnCycleModal
× attachGhostNode: id node không phải số (node mới tạo cục bộ, chưa lưu) thì báo lỗi rõ, không gọi API
AssertionError: expected [ 'updatePhasePosition', …(18) ] to not include 'updatePhasePosition'
AssertionError: expected [] to deeply equal [ { method: 'PUT', …(2) } ]
AssertionError: promise resolved "undefined" instead of rejecting
TypeError: svc.addRootTask is not a function
TypeError: svc.attachGhostNode is not a function
Tests  10 failed (10)
```

Phần khóa vai trò: `npx vitest run src/components/workflow/__tests__/graphRoleLock.test.tsx`, chạy trên `useWorkflowStore.ts` **gốc của main** (lấy tạm từ git rồi trả lại) và component chưa sửa:
```
× VIEWER: tạo, nối, gỡ, xóa phase, lưu vị trí, thêm node, nối node đều bị chặn và KHÔNG gọi API
× COLLABORATOR (sarah) cũng chỉ xem
× dự án ARCHIVED: owner cũng chỉ xem
× VIEWER: nút Add Phase và Auto Layout bị vô hiệu hóa, có title giải thích
× VIEWER: thẻ phase không có nút xóa, cổng nối bị vô hiệu hóa
× VIEWER: trong cây node, nút + Add Root Task và Add Ghost Node bị vô hiệu hóa, node không có nút xóa
Tests  6 failed | 4 passed (10)
```
4 test pass sẵn là các trường hợp OWNER và "chưa nạp vai trò". Đó là hành vi đúng từ trước, không phải lỗi.

Test mapper (20 test) viết sau mapper. Đây là phần tái cấu trúc, không phải sửa lỗi, nên bằng chứng "giữ nguyên" là test tạm so code cũ với mapper (mục 1 ở trên).

**2. Sau khi sửa: `npm run typecheck` và `npm test`**
```
> wpe-demo@1.0.0 typecheck
> tsc -b

 ✓ src/services/impl/http/__tests__/graph.test.ts (10 tests) 1294ms
 ✓ src/components/workflow/__tests__/graphRoleLock.test.tsx (10 tests) 1568ms
 ✓ src/mappers/__tests__/graphMapper.test.ts (20 tests) 23ms
 Test Files  33 passed (33)
      Tests  248 passed (248)
```
Trước B5 là 30 file, 208 test, tất cả pass; B5 thêm 3 file, 40 test.

**3. Chạy thật `HttpWorkflowService` vào backend** (backend nhánh B5 ở cổng 8081). Dùng một test tạm (đã xóa), `VITE_API_BASE_URL=http://localhost:8081/api/v1`, chạy trên dự án thử id 5 do alex tạo qua `POST /projects`:
```
[LIVE] API_BASE_URL = http://localhost:8081/api/v1
[LIVE] phases ban đầu = []
[LIVE] tạo phase = 6 PHASE A | 7 PHASE B
[LIVE] nối phase: edges = [["6","7"]]
[LIVE] thêm node = [{"id":"15","title":"Thu thập yêu cầu","status":"LOCKED","parentId":"root_6"},{"id":"16","title":"Thiết kế API","status":"LOCKED","parentId":"root_7"},{"id":"17","title":"Thiết kế DB","status":"LOCKED","parentId":"root_7"}]
[LIVE] ghost A->B = {"id":"ghost_15_to_16","sourcePhaseId":"6","sourcePhaseTitle":"PHASE A","sourceTaskId":"15","sourceTaskTitle":"Thu thập yêu cầu","targetTaskId":"16","status":"LOCKED"}
[LIVE] cây PHASE B có ghost = [ 'ghost_15_to_16' ]
[LIVE] nối B->C (cùng phase) OK
[LIVE] nối C->A (tạo vòng A->B->C->A) = {"status":422,"code":"CYCLE_DETECTED","message":"Không thể nối: tạo chu trình lặp phụ thuộc giữa các công việc.","cycleNodes":["WPE-001","WPE-002","WPE-003"]}
[LIVE] sau F5 vị trí PHASE B = 777 333
 ✓ B5 chạy thật: tạo phase, nối phase, thêm node, nối node, nối thành vòng, lưu vị trí
```
Đối chiếu SQL (`docker exec wpe_postgres_local psql …`):
```
6|PHASE A|{}
7|PHASE B|{"h": 180, "w": 380, "x": 777, "y": 333}
15|WPE-001|6|LOCKED
16|WPE-002|7|LOCKED
17|WPE-003|7|LOCKED
15|16
16|17
```
→ vị trí đã lưu vào `work_phase.ui_metadata`. Chỉ có 2 cạnh: cạnh tạo vòng C→A **không** được lưu.

Mã lỗi mà toast dựa vào, gọi bằng curl:
```
sarah (X-Debug-User-Id: 3) PUT /projects/5/phases/7  → HTTP 403 {"error":"ACCESS_DENIED", ...}
sarah POST /projects/5/nodes                          → HTTP 403 {"error":"ACCESS_DENIED", ...}
dự án 5 đổi ARCHIVED bằng SQL, alex PUT phase         → HTTP 409 {"error":"PROJECT_ARCHIVED", ...}
```
**Đã dọn:** trả dự án 5 về `DRAFT` ngay sau bước ARCHIVED, rồi xóa hẳn dự án 5 (cùng phase, node, cạnh của nó). DB về đúng như trước: 2 dự án (`1|ACTIVE|Core Banking Pipeline`, `2|PLANNING|a`), 3 cạnh, 0 thông báo. Đã tắt backend cổng 8081.

**Chưa làm (cần trình duyệt, dời về buổi kiểm chung, chạy frontend với `VITE_USE_MOCK=false`):**
1. alex kéo thả thẻ phase rồi F5: thẻ đứng nguyên chỗ mới (API đã kiểm ở mục 3).
2. alex mở một phase, bấm "+ Add Root Task", nhập tên: node mới hiện ra.
3. alex kéo nối 2 node thành vòng: hiện `KahnCycleModal` với danh sách mã node.
4. sarah đăng nhập vào dự án mẫu: nút sửa bị vô hiệu hóa, tab Network không có request ghi. **Dự đoán chưa đạt**, xem "Điều chưa chắc" 1.
5. Đổi persona sang VIEWER bằng DevToolbar ở chế độ mock: canvas chỉ xem. Seed không có tài khoản VIEWER thật.

### Điều chưa chắc / cần nhóm quyết
1. **Vai trò ở chế độ API thật đang lấy từ mock, nên khóa canvas chưa có tác dụng với sarah.** `settings.settings.myRole` chỉ được nạp khi mở màn Settings (`SettingsView` gọi `loadSettings`). `getProjectSettings` vẫn nằm trong `METHODS_STILL_MOCKED`, nên luôn trả `myRole: 'OWNER'`, `status: 'DRAFT'`, `id: '1'` cho mọi user. Hệ quả: sarah thấy canvas sửa được, bấm thì backend trả 403 và hiện toast "Chỉ chủ dự án được sửa đồ thị". Backend vẫn chặn đúng, chỉ lớp giao diện chưa chặn trước. Sửa cần nạp vai trò thật (gọi `GET /projects/{id}` hoặc nối `getProjectSettings`, nằm ở `settingsSlice`/D1, D2), ngoài "Được ghi" của B5. **Báo nhóm.**
   - Khi chưa nạp vai trò (settings `null`, hoặc settings đang là của dự án khác), tôi chọn **không khóa** canvas. Nếu khóa thì alex vào thẳng canvas sẽ không sửa được gì cho tới khi mở Settings. Nhóm muốn ngược lại (chưa biết thì khóa) thì đổi 1 dòng trong `selectCanEditGraph`.
2. **Lưu tọa độ node (`PATCH /nodes/{id}/metadata`, debounce 300ms) chưa làm vì chưa có chỗ gọi.** Node trong mindmap được tự xếp chỗ (`calculatePhaseGraphLayout`), không kéo thả được, nên không có sự kiện "thả chuột". Debounce 300ms đã làm cho vị trí **phase** (`PUT /phases`). Muốn lưu vị trí node thì phải thêm tính năng kéo node, việc này lớn hơn B5. Nhóm quyết.
3. **Mâu thuẫn trong đặc tả: "hiển thị giữ nguyên" và "nối node".** Mapper cũ (giữ nguyên theo đặc tả) treo mọi node dưới root, **không vẽ cạnh cùng phase**. Kéo nối B→C thì cạnh được lưu và hiện ngay, nhưng F5 xong cạnh đó không còn hiện (dữ liệu vẫn còn, chỉ không vẽ). Muốn vẽ thì `toPhaseTree` phải đưa cạnh cùng phase vào `parentIds`, tức đổi hiển thị. Tôi không tự đổi; nhóm quyết.
4. **Nhiều thao tác trên cây node vẫn chỉ sửa cục bộ ở chế độ API**, F5 là mất: nút + thêm con trên node, đổi tên bằng nhấp đúp, xóa node, lưu trong `NodePropertiesModal`, gộp node, gỡ ghost. Đặc tả B5 chỉ yêu cầu `addRootTask` và `attachGhostNode`. Backend đã có `PUT/DELETE /nodes/{id}`, `DELETE /dependencies` (B3). Nên mở task tiếp. Nối từ một node cục bộ như vậy sẽ báo `NODE_NOT_SAVED`.
5. **"+ Add Root Task" ở chế độ API đổi cách dùng:** mở hộp nhập tên (`AddRootTaskModal`), tạo node thường (`LOCKED`, không phải "track"), thay vì tạo track ngay trên cây rồi sửa tên tại chỗ. Ở chế độ mock vẫn như cũ.
6. **`KahnCycleModal` có chữ chưa khớp:** tiêu đề ghi "(HTTP 400)" và câu "Cannot publish pipeline", trong khi lỗi nối là 422 và không phải xuất bản. File nằm ở `components/settings/` (ngoài "Được ghi"), nên dùng nguyên.
7. **Nối 2 node cùng phase dùng `attachGhostNode` của contract** (cùng là `POST /dependencies`), vì `IWorkflowService` không có hàm nối node và contract nằm ngoài "Được ghi". Tên hàm không còn đúng nghĩa "ghost"; nên đổi tên khi được sửa contract.
8. **Ghost có cha là node độc lập (không thuộc phase) mang `refPhase = '1'`** (giữ đúng như code cũ). Bấm "mở phase nguồn" sẽ nhảy sang phase id 1, có thể là phase của dự án khác. Nên đổi thành rỗng; tôi giữ nguyên vì đặc tả yêu cầu hiển thị không đổi.
9. **Vị trí file test:** `services/impl/http/__tests__/graph.test.ts` và `components/workflow/__tests__/graphRoleLock.test.tsx` không ghi tên trong "Được ghi". Tôi coi đó là test của file được ghi (`graph.ts`, `components/workflow/**`). `HttpWorkflowService.test.ts` của A2 không bị sửa.
10. **Kéo thả lỗi mạng:** thẻ phase đã đứng ở chỗ mới trên màn hình trước khi PUT xong. PUT lỗi thì hiện toast nhưng thẻ không tự về chỗ cũ; F5 mới về vị trí đã lưu. Xem câu hỏi bảo vệ 3.

## Nhật ký sprint (chế độ làm nhanh — xem `docs/tasks/SPRINT_2_NGAY.md`)
Đã học lại: chưa

- **Làm gì:**
- **File chính đã sửa:**
- **Vì sao làm vậy** (tự viết):
- **Cần học lại:**

## Review của C (12/11/2026, chế độ sprint)
Đạt 2 tiêu chí review sprint: (1) test xanh: C chạy `npm run typecheck` pass và `npx vitest run` 248/248 pass (33 file) sau khi #32 merge; (2) PR #32 sửa 20 file trong "Được ghi". `services/impl/http/__tests__/graph.test.ts` là test của `graph.ts` (được ghi), mục "Được ghi" không ghi rõ "và test" như `graphMapper`; chấp nhận.
