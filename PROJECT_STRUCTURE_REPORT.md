# Workflow Pipeline Engine — Project Structure & Base Readiness Report

**Ngày kiểm kê:** 27/09/2026  
**Phạm vi:** toàn bộ `frontend/src/`, cấu hình frontend trong `frontend/`, root command bridge, `PROJECT_CONTEXT.md`, `AUDIT_REPORT.md` và mã API service hiện tại.  
**Kết luận ngắn:** đây là một **frontend base/demo đã có Service Layer và DI**, chưa phải production-ready hoàn chỉnh. Build hiện tại đạt, nhưng còn thiếu test, runtime validation, auth/error UX, một số luồng nghiệp vụ và các màn hình được đặt placeholder.

> Báo cáo mô tả đúng trạng thái mã nguồn hiện tại. Các REST endpoint trong tài liệu là **hợp đồng mà frontend đang kỳ vọng**, không có nghĩa backend Spring Boot đã được triển khai trong workspace này.

---

## 1. Cây thư mục thực tế & kiểm kê tệp

### 1.1 Project tree

```text
Workflow_Pipeline/
├── AUDIT_REPORT.md                      # Kết quả audit kiến trúc trước đó
├── FRONTEND_ARCHITECTURE_AUDIT.md       # Tiêu chuẩn/scorecard refactor
├── PROJECT_CONTEXT.md                   # SSOT nghiệp vụ, DB và backend target
├── PROJECT_STRUCTURE_REPORT.md          # Tài liệu này
├── package.json                         # Root command bridge vào frontend/
├── PROJECT_STRUCTURE_REPORT.md          # Tài liệu này
└── frontend/
    ├── .env.example                     # Cấu hình chuyển Mock/API và base URL
    ├── index.html                       # HTML entry của Vite
    ├── package.json                     # Frontend scripts và dependencies
    ├── package-lock.json                # Khóa dependency frontend
    ├── tsconfig.json                    # TypeScript strict/bundler config
    ├── vite.config.ts                   # Vite + React plugin
    └── src/
        ├── main.tsx                     # Bootstrap React, providers và CSS
        ├── App.tsx                      # App shell, navigation, project context
        ├── styles.css                   # Global layout/component styles
        ├── aiDiagnostics.css            # Styles riêng cho AI Diagnostic panel
        ├── vite-env.d.ts                # Types cho VITE_USE_MOCK/API_BASE_URL
        ├── data/
        │   └── mockData.ts              # Users, 7 tasks, 4 work phases; chỉ Mock Service được import
        ├── types/
        │   ├── workflow.ts              # Task/Phase/User và status/join unions
        │   └── services.ts              # IWorkflowService, DTO và QuestState
        ├── services/
        │   ├── index.ts                 # Factory/provider chọn implementation
        │   ├── mockWorkflowService.ts   # Mock implementation + network-like delay
        │   └── apiWorkflowService.ts    # Fetch-based Spring Boot adapter
        ├── store/
        │   └── useWorkflowStore.ts      # Zustand application state/actions
        ├── components/
        │   ├── canvas/
        │   │   ├── NodePropertiesDrawer.tsx # Task properties/dependencies drawer
        │   │   ├── StageContainer.tsx       # Legacy/alternative stage renderer
        │   │   ├── TaskNodeCard.tsx          # Legacy/alternative task card
        │   │   └── ViewportControls.tsx      # Canvas zoom/fit controls
        │   └── quest-map/
        │       ├── QuestMapCanvas.tsx        # Quest React Flow graph + Dagre layout
        │       ├── FocusNodeCard.tsx         # Standalone focus-card variant
        │       └── GhostNodePill.tsx         # Standalone ghost/done node variant
        └── views/
            ├── CanvasView.tsx                # Canvas React Flow view and custom node types
            ├── QuestMapView.tsx              # Quest Map page wrapper/header
            └── OverviewView.tsx              # AI diagnostics mock presentation
```

### 1.2 Các thư mục được yêu cầu nhưng hiện chưa có

`frontend/src/components/layout/` **chưa tồn tại**. Topbar, sidebar, project header và workspace shell hiện nằm trực tiếp trong `App.tsx`. Đây là technical debt về tổ chức UI dùng chung, không phải thiếu Service Layer.

### 1.3 Dependency inventory

| Package | Version trong `package.json` | Vai trò thực tế |
|---|---:|---|
| `react` | `^18.3.1` | UI runtime |
| `react-dom` | `^18.3.1` | Mount React vào DOM |
| `@xyflow/react` | `^12.3.1` | Canvas/Quest Map graph, nodes, handles, edges, `ReactFlowProvider`, `NodeResizer` |
| `dagre` | `^0.8.5` | Tính layout tự động cho Quest Map |
| `zustand` | `^5.0.15` | Application state và action orchestration |
| `lucide-react` | `^0.468.0` | Icon set |
| `typescript` | `^5.5.4` | Type-check/build |
| `vite` | `^5.4.8` | Dev server và production bundling |
| `@vitejs/plugin-react` | `^4.3.1` | React transform cho Vite |
| `@types/dagre` | `^0.7.52` | Type declarations cho Dagre |
| `@types/react` | `^18.3.3` | React typings |
| `@types/react-dom` | `^18.3.0` | DOM typings |

`tailwindcss` **không có trong dependencies**. Một số class utility xuất hiện trong JSX nhưng hiện chưa có Tailwind build plugin/config; phần lớn styling thực tế nằm trong CSS thủ công (`styles.css`, `aiDiagnostics.css`).

Scripts hiện có:

```text
npm run dev      -> cd frontend && npm run dev
npm run build    -> cd frontend && npm run build
npm run preview  -> cd frontend && npm run preview
```

Các script trên có thể chạy từ root. Có thể làm việc trực tiếp trong `frontend/` với các lệnh Vite tương ứng. Không có script `test`, `lint` hoặc `typecheck` riêng; dependency lockfile nằm tại `frontend/package-lock.json`.

### 1.4 Quy ước chạy dự án sau khi tái cấu trúc

```powershell
# Từ root
npm install --prefix frontend
npm run dev
npm run build

# Hoặc từ frontend/
Set-Location frontend
npm install
npm run dev
```

Root chỉ giữ tài liệu dự án và một `package.json` command bridge; toàn bộ mã nguồn, asset, manifest, toolchain và build output frontend nằm trong `frontend/`.

---

## 2. Kiến trúc phân tầng & Dependency Injection

### 2.1 Presentation Layer — UI/Components

**Entry và shell**

- `main.tsx` mount `<React.StrictMode><ReactFlowProvider><App /></ReactFlowProvider></React.StrictMode>`.
- `App.tsx` chứa top strip, topbar, sidebar, navigation, project context và chọn view.
- Khi mount, `App` gọi `loadCanvas(2026)` và `loadQuestMap(2026, 1)`.
- `Tasks`, `Feedback`, `Settings` có nút navigation nhưng chưa có view thực sự.

**Views**

- `CanvasView.tsx` đọc `nodes`, `edges`, `onNodesChange`, `onEdgesChange` từ Zustand; render React Flow, group/task custom nodes, drawer và viewport controls.
- `QuestMapView.tsx` compose header/statistics hardcoded và `QuestMapCanvas`.
- `OverviewView.tsx` là presentation mock: stats/alerts hardcoded và AI diagnostics mô phỏng bằng `setTimeout(1200)`.

**Canvas/Quest components**

- Canvas group/task logic thực tế hiện nằm trong `CanvasView.tsx`; `StageContainer.tsx` và `TaskNodeCard.tsx` là các biến thể/legacy chưa được CanvasView sử dụng.
- `NodePropertiesDrawer.tsx` hiển thị task properties, status, join logic và dependencies.
- `QuestMapCanvas.tsx` định nghĩa graph quest, custom card, explicit handles, edges và Dagre layout.
- `FocusNodeCard.tsx`/`GhostNodePill.tsx` là các component độc lập; graph hiện tại dùng `QuestCard` nội bộ của `QuestMapCanvas`.

Presentation không import trực tiếp `mockData.ts` và không gọi `fetch`. Đây là điểm độc lập UI quan trọng.

### 2.2 Application State Layer — Zustand

`frontend/src/store/useWorkflowStore.ts` là nơi duy nhất phối hợp UI với service:

1. `loadCanvas(projectId)` gọi `workflowService.getCanvasGraph`.
2. `toFlowNodes()` chuyển `Phase[]` thành React Flow group/task nodes, với `parentId` và `extent: 'parent'`.
3. `normalizeEdges()` convert ID sang string và loại edge có endpoint không tồn tại.
4. `onNodesChange`/`onEdgesChange` dùng `applyNodeChanges`/`applyEdgeChanges`; thay đổi position/dimensions bật `isDirty`.
5. `saveLayout(projectId)` gửi position/dimension qua service khi người dùng bấm Save.
6. Quest actions (`submitArtifact`, `approveReview`, `completeDatabase`, `claimIntegration`) gọi service rồi cập nhật state.
7. `selectedTask`, `quest`, `isLoading`, `error`, `isDirty` là các state application-level.

Điểm cần lưu ý: service có `claimTask(nodeId)` nhưng store chưa expose action `claimTask`, và UI hiện chưa có nút Claim end-to-end.

### 2.3 Domain Layer — Types/Interfaces

`frontend/src/types/workflow.ts` chuẩn hóa:

```ts
TaskStatus = 'LOCKED' | 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE'
JoinLogic = 'ALL_COMPLETED' | 'ANY_COMPLETED'
PhaseStatus = 'COMPLETED' | 'IN_PROGRESS' | 'LOCKED'
```

`Task` hiện có `id`, `title`, `description`, `status`, `phase`, `assignee`, `dueDate`, `progress`, `joinLogic`, `dependencies`, `accent`.

`frontend/src/types/services.ts` khai báo:

- `IWorkflowService`
- `CanvasGraph`
- `GraphLayoutUpdate`
- `WorkflowNode = Task`
- `NodeDependency = Edge`
- `QuestState`
- `QuestStatus = 'done' | 'active' | 'review' | 'locked'`

Các type này phù hợp với phần domain frontend hiện tại, nhưng **chưa chứng minh đầy đủ mapping PostgreSQL**. `PROJECT_CONTEXT.md` còn yêu cầu `version`, `current_round`, artifacts, reviews, feedback, event và project/member semantics; các field đó chưa xuất hiện đầy đủ trong TypeScript DTO hiện tại.

### 2.4 Infrastructure/Service Layer — DI

`IWorkflowService` là abstraction mà Store biết đến:

```text
getCanvasGraph(projectId)
getPersonalQuestStream(projectId, userId)
claimTask(nodeId)
submitArtifact(nodeId, url)
saveGraphLayout(projectId, layout)
approveReview()
completeDatabase()
claimIntegration()
```

**MockWorkflowService**

- Import `phases`/`tasks` từ `data/mockData.ts`.
- Trả graph/quest bằng delay mô phỏng mạng.
- Mô phỏng các mutation task/quest.
- Là dependency duy nhất được phép biết mock data.

**ApiWorkflowService**

- Dùng `fetch` với `VITE_API_BASE_URL`, fallback `http://localhost:8080/api`.
- Đọc access token từ `localStorage`.
- Đang ánh xạ các REST calls tới cùng chữ ký `IWorkflowService`.
- Chưa có runtime schema validation, timeout, retry, phân loại lỗi 401/403/404 hay error-body parsing.
- Header Authorization hiện cần được xác minh/hoàn thiện trước khi bật API thật; adapter không nên được coi là production auth implementation.

**Factory/provider**

`frontend/src/services/index.ts`:

```ts
const useMock = import.meta.env.VITE_USE_MOCK !== 'false'
export const workflowService =
  useMock ? new MockWorkflowService() : new ApiWorkflowService()
```

Vì vậy chỉ cần đặt `VITE_USE_MOCK=false` để chọn API adapter; UI và Store không đổi import.

### 2.5 ASCII data flow

```text
┌────────────────────┐
│ UI Component/View  │
│ ReactFlow/Card     │
└─────────┬──────────┘
          │ user event / selector
          ▼
┌────────────────────┐
│ Zustand Action      │
│ useWorkflowStore   │
└─────────┬──────────┘
          │ depends on abstraction only
          ▼
┌────────────────────┐
│ IWorkflowService   │
└─────────┬──────────┘
          │ injected once by services/index.ts
     ┌────┴─────┐
     ▼          ▼
┌──────────┐ ┌──────────────┐
│ Mock     │ │ Real API     │
│ Service  │ │ Service      │
└────┬─────┘ └──────┬───────┘
     └──────┬───────┘
            ▼
┌────────────────────┐
│ Store state update  │
│ nodes/edges/quest   │
└─────────┬──────────┘
          ▼
┌────────────────────┐
│ React re-render     │
└────────────────────┘
```

---

## 3. Readiness assessment

### 3.1 Checklist

| Tiêu chí | Trạng thái | Bằng chứng / nhận xét |
|---|---|---|
| UI độc lập khỏi mock data | **ĐẠT** | `components/` và `views/` không import `data/mockData.ts`; chỉ `MockWorkflowService` import mock data. |
| UI không gọi fetch/axios trực tiếp | **ĐẠT** | Network adapter tập trung ở `services/apiWorkflowService.ts`. |
| Store chỉ đi qua service abstraction | **ĐẠT** | Store import `workflowService` từ `services/index.ts`, không import implementation cụ thể. |
| Chuyển Mock/API bằng env | **ĐẠT** | `VITE_USE_MOCK=false` chọn `ApiWorkflowService`. |
| TypeScript strict | **ĐẠT** | `tsconfig.json` bật `strict`, `noEmit`, `isolatedModules`; không phát hiện `any` trong `frontend/src/`. |
| Domain type khớp toàn bộ PostgreSQL/SSOT | **CHƯA ĐẠT** | Có status/join cơ bản, nhưng thiếu artifact round, review/reject reason, feedback, version, event và project/member DTO. |
| React Flow group nodes | **ĐẠT** | Canvas tạo phase group và task `parentId`/`extent: 'parent'`. |
| Explicit source/target handles | **ĐẠT** | Custom nodes có `id="target"`/`id="source"`; edges được normalize và match ID. |
| NodeResizer và dirty-save flow | **ĐẠT** | Group dùng `NodeResizer`; Store đánh dấu `isDirty`, Save mới gọi service. |
| Edge endpoint integrity | **ĐẠT** | `normalizeEdges()` convert string IDs và filter endpoint thiếu; runtime smoke test đã thấy Canvas 6 và Quest Map 4 edges. |
| Dagre auto-layout | **ĐẠT** | Quest Map gọi `dagre.layout()` trong `useMemo`. |
| Tailwind stack | **CHƯA ĐẠT / KHÔNG ÁP DỤNG** | `tailwindcss` không có trong package manifest/config; UI chủ yếu dùng CSS thủ công. |
| API response runtime validation | **CHƯA ĐẠT** | `fetch` cast trực tiếp sang DTO TypeScript. |
| Loading/error UX đầy đủ | **CHƯA ĐẠT** | Store có `isLoading/error`, nhưng nhiều mutation không catch/update error và view chưa hiển thị đầy đủ. |
| Claim lifecycle end-to-end | **CHƯA ĐẠT** | Service method có tồn tại, nhưng Store/UI chưa expose nút Claim thực sự. |
| Test/lint/lockfile reproducibility | **CHƯA ĐẠT** | Không có test/lint script, test files hoặc lockfile. |

### 3.2 Technical debt ưu tiên

**P0 — trước khi kết nối backend thật**

1. Hoàn thiện/xác minh Authorization header và auth refresh flow.
2. Viết runtime schema validation cho `CanvasGraph`, `QuestState`, `WorkflowNode` và error envelope.
3. Chốt API DTO với backend theo `PROJECT_CONTEXT.md`: artifact round, review/reject, feedback, version/locking, project/user context.
4. Chuẩn hóa error handling cho tất cả mutation; thêm loading/saving/error UX.

**P1 — trước khi gọi là production base**

1. Thêm unit/integration tests cho factory Mock/API, Store actions, edge normalization và Dagre.
2. Thêm lockfile và script `lint`, `test`, `typecheck`.
3. Tách `components/layout/` khỏi `App.tsx`.
4. Wire `claimTask` vào Store/UI.
5. Đưa Quest Map graph/stats và Overview data ra API/store thay vì hardcode.
6. Tách hoặc xóa các component legacy (`StageContainer`, `TaskNodeCard`, standalone focus/ghost variants) để tránh hai implementation song song.

**P2 — hoàn thiện sản phẩm**

- Implement Tasks/Kanban/Feedback/Settings/Auth.
- Bổ sung project selector, search, notifications, Add Node, review reject và artifact history.
- Loại bỏ hardcoded project ID `2026`, user ID `1`, project title/date và node/edge count.
- Thêm timeout/AbortController, retry policy và phân loại status code.

### 3.3 Build baseline

Lệnh hiện có:

```powershell
npm run build
```

Thực hiện trong phiên kiểm kê: TypeScript và Vite production build thành công. Đây chỉ là compile/bundle validation; chưa thay thế cho test runtime/API contract.

---

## 4. Hướng dẫn tích hợp Spring Boot cho người mới

### 4.1 Mental model tương đồng

| Spring Boot backend | Frontend hiện tại | Ý nghĩa |
|---|---|---|
| `@RestController` / Controller | API endpoint được gọi bởi `ApiWorkflowService` | Nhận HTTP request, xác thực input, trả HTTP response |
| `@Service` | `IWorkflowService` + implementation | Chứa nghiệp vụ; frontend dùng interface để không phụ thuộc Mock/HTTP cụ thể |
| Spring DI container | `services/index.ts` factory/provider | Chọn implementation tại composition root |
| Spring Data JPA Repository | Backend persistence layer | Truy xuất PostgreSQL, transaction và locking |
| Java DTO/`record` | TypeScript interfaces trong `types/` | Hợp đồng shape của request/response; TypeScript không tự validate runtime |
| `@Version`/compare-and-set | Store gọi mutation và nhận node mới | Backend mới là nơi đảm bảo optimistic locking; frontend không tự quyết định transaction |

Điểm quan trọng: `IWorkflowService` không phải database và cũng không tự làm DI như Spring container. Nó là **hợp đồng**. `services/index.ts` là nơi duy nhất chọn adapter.

### 4.2 Cấu hình môi trường

```env
VITE_USE_MOCK=true
VITE_API_BASE_URL=http://localhost:8080/api
```

- Demo local: `VITE_USE_MOCK=true`.
- Backend thật: `VITE_USE_MOCK=false`, `VITE_API_BASE_URL=http://localhost:8080/api`.
- Không cần sửa `components/`, `views/` hoặc Store để đổi adapter.

### 4.3 REST API contract tối thiểu frontend đang kỳ vọng

Các URL dưới đây được lấy từ `ApiWorkflowService`; prefix `/api` nằm trong `VITE_API_BASE_URL`.

#### A. Load Canvas Graph

```http
GET /api/projects/{projectId}/graph
```

Response tối thiểu:

```json
{
  "projectId": 2026,
  "projectStatus": "ACTIVE",
  "phases": [
    {
      "id": "p1",
      "title": "Phase 1",
      "subtitle": "Foundation",
      "status": "COMPLETED",
      "progress": 100,
      "tasks": []
    }
  ],
  "nodes": [],
  "edges": [
    {
      "id": "e-001-014",
      "source": "wpe-001",
      "target": "wpe-014",
      "sourceHandle": "source",
      "targetHandle": "target"
    }
  ]
}
```

Backend phải bảo đảm mọi `source`/`target` thuộc cùng project và tồn tại; frontend vẫn normalize/filter để tránh React Flow drop edge.

#### B. Load Personal Quest Map

```http
GET /api/projects/{projectId}/focus-graph?userId={userId}
```

Response hiện frontend kỳ vọng:

```json
{
  "artifactSubmitted": false,
  "jamie": "active",
  "database": "active",
  "integration": "locked"
}
```

Đây là DTO demo tối giản. Bản production nên trả focus nodes, ghost nodes, dependencies, progress và metadata thay vì chỉ 4 status.

#### C. Claim Task

```http
POST /api/nodes/{nodeId}/claim
```

Request body: không có trong adapter hiện tại.  
Response: một `WorkflowNode` mới, tối thiểu:

```json
{
  "id": "wpe-014",
  "title": "Build UI Library",
  "status": "IN_PROGRESS",
  "progress": 62,
  "version": 4
}
```

Backend cần kiểm tra project membership, `TODO`, assignee null và claim race condition theo compare-and-set/transaction. `version` hiện chưa có trong TypeScript Task nhưng cần bổ sung cho contract production.

#### D. Submit Artifact

```http
POST /api/nodes/{nodeId}/artifacts
```

Request body hiện tại:

```json
{ "fileUrl": "https://storage.example/artifacts/ui-library.zip" }
```

Response: `WorkflowNode` với status `REVIEW`.

Theo `PROJECT_CONTEXT.md`, production contract phải mở rộng để kiểm tra artifact thuộc đúng `current_round`; nên cân nhắc:

```json
{
  "fileUrl": "https://storage.example/artifacts/ui-library.zip",
  "roundNo": 1,
  "artifactType": "LINK"
}
```

#### E. Save Graph Layout

```http
PUT /api/projects/{projectId}/graph/layout
```

Request body:

```json
{
  "projectId": 2026,
  "positions": {
    "group-p1": { "x": 30, "y": 150, "width": 320, "height": 269 },
    "wpe-014": { "x": 16, "y": 68 }
  }
}
```

Adapter kỳ vọng `204 No Content` hoặc response JSON hợp lệ. Backend nên validate node thuộc project và chỉ lưu UI metadata; mutation edge/DAG phải là endpoint riêng có Kahn validation và transaction lock.

#### F. Quest mutations

```http
POST /api/quest/approve-review
POST /api/quest/complete-database
POST /api/quest/claim-integration
```

Request body: không có trong adapter hiện tại.  
Response:

```json
{
  "artifactSubmitted": true,
  "jamie": "done",
  "database": "done",
  "integration": "active"
}
```

Production nên gắn endpoint với `projectId`, `nodeId`, authenticated user và authorization policy; các URL hiện tại là demo contract tối giản.

### 4.4 Lifecycle mẫu: User bấm Claim Task

1. **User bấm Claim** trên Node card.
2. UI gọi action `claimTask(nodeId)` trong Zustand. Hiện action này chưa được wire; cần bổ sung vào Store và component.
3. Zustand gọi `workflowService.claimTask(nodeId)`, không biết đó là Mock hay HTTP.
4. Khi `VITE_USE_MOCK=false`, `ApiWorkflowService` gọi:

   ```http
   POST /api/nodes/{id}/claim
   ```

5. Spring Boot:
   - xác thực JWT và project membership;
   - kiểm tra node đang `TODO` và chưa có assignee;
   - thực hiện compare-and-set/transaction để chống hai người claim đồng thời;
   - cập nhật assignee/status và trả node mới.
6. Frontend nhận `WorkflowNode`, cập nhật node tương ứng trong Zustand.
7. React Flow re-render; class/status của node đổi sang `IN_PROGRESS`, màu UI thay đổi.
8. Nếu backend trả `409 Conflict`, Store phải đưa lỗi ra UI và giữ state cũ; không được biến lỗi thành success giả.

### 4.5 Quy tắc phối hợp frontend/backend

- Backend là nguồn sự thật cho state machine, authorization, transaction, Kahn DAG validation và optimistic locking.
- Frontend là nguồn trình bày/interaction; không tự giả định approve/claim thành công trước response server.
- Mỗi DTO Java cần mapping rõ với interface TypeScript và test contract.
- Dùng error envelope thống nhất, ví dụ:

```json
{
  "code": "NODE_ALREADY_CLAIMED",
  "message": "Task has already been claimed",
  "details": {}
}
```

- Không đưa secret vào Vite env: biến `VITE_*` được bundle ra browser. Access token nên được quản lý bởi auth architecture đã thống nhất, không hardcode.

---

## 5. Lộ trình đề xuất

1. **Contract hardening:** chốt DTO/status/round/review/version với backend; sửa auth adapter và error envelope.
2. **State completeness:** wire Claim, reject/feedback, API-backed Overview và quest graph.
3. **Quality gates:** thêm lockfile, lint, unit tests, Store/service contract tests, runtime schema validation.
4. **Structure cleanup:** tách `components/layout`, loại bỏ component legacy, bỏ hardcoded IDs/counts.
5. **Production integration:** bật `VITE_USE_MOCK=false` trong môi trường staging, chạy contract/e2e tests, sau đó mới production.
