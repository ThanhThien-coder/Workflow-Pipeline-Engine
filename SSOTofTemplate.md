# ADMIN PIPELINE TEMPLATE STUDIO: TECHNICAL SPECIFICATION (SSOT)

**Dự án:** Workflow Pipeline Engine | **Phân hệ:** Admin Console / Template Studio
**Phạm vi mã nguồn:** `wpe-frontend` (React + TypeScript), `wpe-backend` (Spring Boot)
**Trạng thái:** Implementation-Ready

---

## PHẦN 1: TỔNG QUAN PHÂN HỆ & BỐI CẢNH NGHIỆP VỤ

### 1.1 Mục tiêu

Cho phép Super Admin thiết lập **System Standard Templates** theo đồ thị **2 tầng**:

| Tầng | Thực thể | Mô tả |
| :--- | :--- | :--- |
| Macro | `Phase` | Các giai đoạn cấp cao, nối nhau bằng cạnh có hướng (DAG cấp Phase). |
| Detail | `Node` | Cây đa cấp trong mỗi Phase: `Root → Track → Task → Sub-task`, cộng các cạnh phụ thuộc chéo (dependency). |

Template được `Publish` thì mọi người dùng thấy và clone được khi tạo Workspace (use case 2.1 trong SSOT: Khởi tạo dự án & Clone Template).

### 1.2 Phân quyền (RBAC)

| Hành động | SUPER_ADMIN | Các role khác |
| :--- | :-: | :-: |
| Truy cập `/admin/templates`, Studio | ✔ | ✘ (403) |
| Tạo / sửa / nhân bản / xóa template | ✔ | ✘ |
| Xem & clone template đã publish | ✔ | ✔ (qua luồng tạo dự án, ngoài phạm vi tài liệu này) |

- **Frontend:** route guard chặn hiển thị. **Backend:** `@PreAuthorize` là lớp bảo vệ duy nhất có giá trị; guard của frontend chỉ phục vụ UX.
- **Điểm cần chốt:** SSOT hiện định nghĩa `USER.system_role ∈ {'ADMIN','USER'}`, trong khi tài liệu này dùng `SUPER_ADMIN`. Khuyến nghị: coi `system_role = 'ADMIN'` tương đương authority `SUPER_ADMIN`. Nếu muốn tách `ADMIN` và `SUPER_ADMIN` thì phải mở rộng CHECK constraint.

### 1.3 Ranh giới module

- Route: `/admin/templates` (Catalog), `/admin/templates/:id/studio` và `/admin/templates/new` (Studio).
- Kế thừa Design System Light Blueprint Grid và Graph Engine (layout, Kahn) của phân hệ Workflow. Nên tách thành module dùng chung (`src/lib/graph/`), tránh sao chép logic.
- Admin chỉ thao tác trên dữ liệu mẫu, không chạm dữ liệu nội bộ dự án (nguyên tắc §3.4 SSOT).

---

## PHẦN 2: ĐẶC TẢ GIAO DIỆN & LUỒNG TƯƠNG TÁC

### 2.1 View 1: Template Catalog (`/admin/templates`)

**Sidebar:** thêm mục `Template Library` (icon Layers), đặt cạnh Overview, Users, Workspaces, Audit Logs.

**Header:** tiêu đề `System Pipeline Templates`, bộ đếm `{filtered}/{total} templates`, ô tìm kiếm theo tên (debounce 250 ms), dropdown `Category` (`All | Software Engineering | Marketing | DevOps & Infra | General`), nút `+ Create Template`.

**Thẻ Template (grid 1/2/3 cột theo breakpoint):**

| Thành phần | Nguồn dữ liệu |
| :--- | :--- |
| Icon gradient (theo category) | `category` |
| Tiêu đề, mô tả (clamp 2 dòng) | `name`, `description` |
| `X Phases · Y Nodes` | `phaseCount`, `nodeCount` (backend tính khi lưu) |
| Lượt clone | `cloneCount` |
| Badge | `isSystemStandard ? PUBLIC · SYSTEM STANDARD (xanh ngọc) : DRAFT (cam)` |
| Menu ba chấm | `Edit in Studio`, `Duplicate`, `Delete` |

**Quy tắc:**
- `Duplicate` tạo bản sao `"{name} (Copy)"`, luôn ở trạng thái `DRAFT`, `cloneCount = 0`.
- `Delete` luôn qua modal xác nhận. Xóa mềm hoặc cứng đều không ảnh hưởng dự án đã clone, vì clone là sao chép sâu chứ không tham chiếu.
- Trạng thái UI bắt buộc: `loading` (skeleton), `empty`, `error` (kèm nút Retry), `no-result` khi lọc.

### 2.2 View 2: Visual Template Studio (toàn màn hình)

**Studio Topbar (trái → phải):**

| Control | Hành vi |
| :--- | :--- |
| `← Back` | Nếu `isDirty` thì hiện modal "Discard changes?". |
| Inline title | Input viền trong suốt, focus viền xanh; bắt buộc không rỗng, tối đa 150 ký tự. |
| `Description` | Mở modal textarea nhập mô tả và hướng dẫn áp dụng. |
| `Category` | Dropdown 4 giá trị. |
| `Public to All Users` | Switch ↔ `isSystemStandard`. |
| `Validate DAG (Kahn)` | Chạy Kahn cục bộ; hiện badge `DAG Valid · 0 Cycles` hoặc `Cycle Detected · N nodes`; tô đỏ phần tử vi phạm. |
| `Save & Publish` | Validate bắt buộc, sau đó gọi service; thành công thì toast và quay về Catalog. |

**Khu vực 1: Macro Phase Canvas**
- Nền `#f8fafc` với lưới 24 px. Pan bằng kéo chuột, zoom bằng wheel và toolbar `− % + Fit`; zoom giới hạn 40%–200%.
- Phase Card hiển thị: nhãn `PHASE n`, tên, số track/task, nút xóa (khi còn >1 phase).
- Đường nối SVG Bézier bậc 3: `M x1 y1 C (x1+dx) y1, (x2−dx) y2, x2 y2` với `dx = max(60, |x2−x1|/2)`.
- `+ Add New Phase`: tạo Phase mới, nối từ Phase cuối cùng.
- Click Phase Card mở Drawer. Phải phân biệt click với kéo-pan (ngưỡng di chuyển > 4 px thì coi là pan).
- Quan hệ phụ thuộc giữa các Phase chỉnh trong header Drawer (chip "Runs after: …"), cho phép đồ thị không tuyến tính.

**Khu vực 2: Phase Detail Drawer**
- Trượt từ phải, rộng 60vw (tối thiểu 720 px), có backdrop mờ; đóng bằng `✕`, click backdrop hoặc `Esc`.
- Header: tên Phase (sửa trực tiếp), thống kê, chuyển đổi `Graph View ⇄ Kanban View`.
- **Graph View:** cây đa cấp, rẽ nhánh sang phải vô hạn cấp. Nút `+` tròn ở mép phải mỗi node tạo node con cấp N+1. Dây nối Bézier từ mép phải cha sang mép trái con. Layout tính bằng thuật toán 5.2.
- **Kanban View:** mỗi Track là một cột; Task và Sub-task là thẻ trong cột đó, kèm badge AND/OR. Có `+ Add Task` ở mỗi cột và `+ Add Track`.
- **Task Inspector** (thanh dưới Drawer, hiện khi chọn node): `title` (bắt buộc), `description`, `joinPolicy` (`ALL_COMPLETED` | `ANY_COMPLETED`), nút `+ Add child`, `Delete` (xóa kèm toàn bộ nhánh con; không áp dụng cho Root).
- **Cô lập hover:** hover xử lý bằng CSS (`:hover`) hoặc state cục bộ của node, không đặt ở state cha, để không làm re-render và tính lại layout.

---

## PHẦN 3: ĐẶC TẢ DỮ LIỆU & DATA CONTRACT

### 3.1 Bảng `PIPELINE_TEMPLATE` (PostgreSQL)

| Cột | Kiểu | Ràng buộc | Ghi chú |
| :--- | :--- | :--- | :--- |
| `id` | `bigint` | PK, tự tăng | Khớp SSOT §9: `Long`. DTO truyền dạng `string`. |
| `name` | `varchar(150)` | NOT NULL | |
| `description` | `text` | NULL | |
| `category` | `varchar(50)` | NOT NULL, DEFAULT `'General'`, CHECK 4 giá trị | **Mới.** SSOT hiện để category trong `graph_data.metadata`. |
| `created_by` | `bigint` | FK → `USER.id`, NOT NULL | |
| `is_system_standard` | `boolean` | NOT NULL, DEFAULT `false` | `true` = `PUBLIC · SYSTEM STANDARD`; `false` = `DRAFT`. |
| `graph_data` | `jsonb` | NOT NULL | Mục 3.2. |
| `clone_count` | `integer` | NOT NULL, DEFAULT 0 | **Mới.** Tăng nguyên tử khi dự án clone template. |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT `now()` | **Mới.** SSOT chưa có cột này. |

**Migration cần thực hiện:** thêm `category`, `clone_count`, `updated_at`; chuyển `metadata.category` cũ sang cột `category`. Nên có index trên `(is_system_standard, category)` và GIN trên `graph_data` nếu về sau cần truy vấn nội dung.

### 3.2 Cấu trúc JSONB `graph_data` (schema v2)

```json
{
  "schemaVersion": 2,
  "phases": [
    { "id": "ph-1", "name": "Foundation", "order": 0,
      "rootNodeId": "nd-1", "uiMetadata": { "position": { "x": 0, "y": 0 } } }
  ],
  "phaseEdges": [
    { "parentPhaseId": "ph-1", "childPhaseId": "ph-2" }
  ],
  "nodes": [
    { "id": "nd-1", "phaseId": "ph-1", "parentId": null, "trackId": null,
      "title": "Foundation", "description": "", "level": 0,
      "joinPolicy": "ALL_COMPLETED",
      "uiMetadata": { "position": { "x": 0, "y": 120 } } },
    { "id": "nd-2", "phaseId": "ph-1", "parentId": "nd-1", "trackId": "nd-2",
      "title": "Requirements", "description": "", "level": 1,
      "joinPolicy": "ALL_COMPLETED",
      "uiMetadata": { "position": { "x": 280, "y": 60 } } }
  ],
  "edges": [
    { "id": "e-1", "parentId": "nd-3", "childId": "nd-7", "kind": "DEPENDENCY" }
  ],
  "metadata": { "version": "1.0" }
}
```

**Quy ước:**
- `id` trong `graph_data` là **ID tạm** (chuỗi). Khi clone, backend sinh `NODE.id` thật và ánh xạ lại, theo đúng cơ chế `temp-node-*` trong SSOT.
- Cấu trúc cây được biểu diễn bằng `parentId` (cạnh `TREE` ngầm định). Mảng `edges` chỉ chứa cạnh `DEPENDENCY` chéo (cùng Phase) để biểu diễn hội tụ AND/OR ngoài quan hệ cha-con. Nhờ vậy cạnh TREE không bị lưu trùng.
- `level`: 0 = Root, 1 = Track, 2 = Task, ≥3 = Sub-task. `trackId` = id của tổ tiên cấp 1 (null với Root). Cả hai là **trường dẫn xuất**, backend tính lại khi lưu và không tin giá trị client gửi lên.
- `uiMetadata.position` là tọa độ tương đối do layout tính. Studio vẫn tính lại khi mở, nên lưu chỉ để render nhanh và tương thích ngược.
- `joinPolicy` có nghĩa đầy đủ khi node có nhiều "cha hiệu dụng" (cha cây + các cạnh `DEPENDENCY` đi tới). Với node chỉ có một cha, hai chính sách tương đương về hành vi.
- **Khi clone:** `phaseEdges` được khai triển thành `NODE_DEPENDENCY` giữa các nút của Phase trước và Root của Phase sau (quy tắc cụ thể cần thống nhất với luồng Clone Template).

### 3.3 TypeScript DTOs: `src/types/template.types.ts`

```ts
export type TemplateCategory = 'Software Engineering' | 'Marketing' | 'DevOps & Infra' | 'General';
export type JoinPolicy = 'ALL_COMPLETED' | 'ANY_COMPLETED';
export type EdgeKind = 'DEPENDENCY';

export interface UiPosition { x: number; y: number }
export interface UiMetadata { position: UiPosition }

export interface PhaseDto {
  id: string; name: string; order: number; rootNodeId: string; uiMetadata: UiMetadata;
}
export interface PhaseEdgeDto { parentPhaseId: string; childPhaseId: string }
export interface TemplateNodeDto {
  id: string; phaseId: string; parentId: string | null; trackId: string | null;
  title: string; description: string; level: number; joinPolicy: JoinPolicy; uiMetadata: UiMetadata;
}
export interface NodeEdgeDto { id: string; parentId: string; childId: string; kind: EdgeKind }

export interface GraphDataPayload {
  schemaVersion: 2;
  phases: PhaseDto[];
  phaseEdges: PhaseEdgeDto[];
  nodes: TemplateNodeDto[];
  edges: NodeEdgeDto[];
  metadata: { version: string };
}

export interface TemplateSummaryDto {
  id: string; name: string; description: string | null; category: TemplateCategory;
  isSystemStandard: boolean; phaseCount: number; nodeCount: number; cloneCount: number;
  createdBy: string; createdAt: string; updatedAt: string;   // ISO-8601 có múi giờ
}
export interface TemplateDetailDto extends TemplateSummaryDto { graphData: GraphDataPayload }

export interface CreateTemplateRequestDto {
  name: string; description?: string; category: TemplateCategory;
  isSystemStandard: boolean; graphData: GraphDataPayload;
}
export type UpdateTemplateRequestDto = CreateTemplateRequestDto;

export interface TemplateFilter { search?: string; category?: TemplateCategory | 'All'; isSystemStandard?: boolean }

export interface DagViolation { scope: 'PHASE' | 'NODE'; phaseId?: string; nodeIds: string[] }
export interface DagValidationResult {
  valid: boolean; visitedCount: number; totalCount: number; violations: DagViolation[];
}
```

**Quy tắc DTO:** `id` luôn là `string` ở frontend (tránh mất độ chính xác `bigint` trong JS). `phaseCount` và `nodeCount` do backend tính. Backend dùng record/class Java tương ứng với `@JsonProperty` camelCase, và map `graphData` qua lớp DTO cụ thể, không dùng `String` thô hay `Map<String,Object>` (SSOT §9).

### 3.4 API Backend (`wpe-backend`)

| Method | Endpoint | Mô tả |
| :--- | :--- | :--- |
| GET | `/api/admin/templates?search=&category=` | Danh sách `TemplateSummaryDto[]` |
| GET | `/api/admin/templates/{id}` | `TemplateDetailDto` |
| POST | `/api/admin/templates` | Tạo mới; **validate server-side**, 422 nếu có chu trình |
| PUT | `/api/admin/templates/{id}` | Cập nhật toàn bộ |
| DELETE | `/api/admin/templates/{id}` | Xóa |
| POST | `/api/admin/templates/validate` | Trả `DagValidationResult` |

Tất cả được bảo vệ bởi `@PreAuthorize("hasAuthority('SUPER_ADMIN')")`. **Validate lại ở server là bắt buộc**: không tin kết quả Kahn của client. Server cũng kiểm tra tính toàn vẹn: mỗi Phase có đúng 1 Root; `parentId` trỏ tới node tồn tại cùng Phase; `title` không rỗng; kích thước `graph_data` có trần (ví dụ 1 MB) và số node tối đa (ví dụ 500).

---

## PHẦN 4: DEPENDENCY INJECTION & SERVICE LAYER

### 4.1 `src/services/template/ITemplateService.ts`

```ts
import type {
  TemplateFilter, TemplateSummaryDto, TemplateDetailDto,
  CreateTemplateRequestDto, UpdateTemplateRequestDto, GraphDataPayload, DagValidationResult,
} from '@/types/template.types';

export interface ITemplateService {
  getTemplates(filter?: TemplateFilter): Promise<TemplateSummaryDto[]>;
  getTemplateById(id: string): Promise<TemplateDetailDto>;
  createTemplate(dto: CreateTemplateRequestDto): Promise<TemplateDetailDto>;
  updateTemplate(id: string, dto: UpdateTemplateRequestDto): Promise<TemplateDetailDto>;
  deleteTemplate(id: string): Promise<void>;
  validateGraph(graphData: GraphDataPayload): Promise<DagValidationResult>;
}
```

Lỗi nghiệp vụ được ném dưới dạng `ServiceError` có `code` (`NOT_FOUND`, `CYCLE_DETECTED`, `VALIDATION_FAILED`, `FORBIDDEN`) để UI hiển thị toast phù hợp.

### 4.2 `MockTemplateService.ts`

- Triển khai `ITemplateService`, giữ dữ liệu trong bộ nhớ.
- Chứa tối thiểu **3 template hoàn chỉnh**: `Standard Software Development (SDLC)` (PUBLIC), `Marketing Campaign Launch` (PUBLIC), `Data Science / ETL Pipeline` (DRAFT). Mỗi template có ≥3 Phase và cây ≥3 cấp.
- Mọi phương thức bọc trong `await delay(200–600ms)`.
- `validateGraph` dùng chung hàm Kahn của `src/lib/graph/kahn.ts`, giống backend thật.
- Trả về bản sao sâu (`structuredClone`), không trả tham chiếu nội bộ.

### 4.3 `src/services/container.ts`

```ts
import type { ITemplateService } from './template/ITemplateService';
import { MockTemplateService } from './template/MockTemplateService';
// import { HttpTemplateService } from './template/HttpTemplateService';

export interface ServiceContainer { templateService: ITemplateService /* , ...các service khác */ }

export const container: ServiceContainer = {
  templateService: new MockTemplateService(), // đổi sang HttpTemplateService khi backend sẵn sàng
};
```

**Nguyên tắc DI (bắt buộc):**
1. Component và hook chỉ truy cập `container.templateService`.
2. Cấm `fetch/axios` trực tiếp trong UI; cấm import `MockTemplateService` ngoài `container.ts`.
3. Chuyển Mock sang HTTP chỉ cần sửa một dòng trong container, không sửa UI.

---

## PHẦN 5: THUẬT TOÁN ĐỒ THỊ & QUY TẮC NGHIỆP VỤ

### 5.1 Kahn's Algorithm: kiểm tra chu trình

**Phạm vi kiểm tra (2 lượt, chạy độc lập):**

| Lượt | Tập đỉnh | Tập cạnh |
| :--- | :--- | :--- |
| Cấp Phase | tất cả `phases` | `phaseEdges` |
| Cấp Node (mỗi Phase) | `nodes` thuộc Phase | cạnh TREE (`parentId → id`) ∪ `edges` (`DEPENDENCY`) |

Cạnh TREE tự nó không thể tạo chu trình, nhưng khi kết hợp với `DEPENDENCY` (ví dụ con trỏ ngược về tổ tiên) thì có thể. Vì vậy phải kiểm tra trên **hợp** của hai tập cạnh. Cạnh nối hai node khác Phase bị từ chối ở bước validate toàn vẹn.

```
function kahn(vertices: id[], edges: [from,to][]):
  indeg = {v: 0}; adj = {v: []}
  for (a,b) in edges: indeg[b]++; adj[a].push(b)
  queue = [v where indeg[v] == 0]; visited = 0
  while queue not empty:
    u = queue.shift(); visited++
    for v in adj[u]: if --indeg[v] == 0: queue.push(v)
  if visited == len(vertices): return { valid: true }
  return { valid: false, violations: [v where indeg[v] > 0] }
```

- Độ phức tạp O(V + E).
- Cạnh có đầu mút không tồn tại bị loại và báo `VALIDATION_FAILED` trước khi chạy Kahn.
- **Hành vi khi vi phạm:** `Save & Publish` bị chặn; toast lỗi; badge `Cycle Detected · N`; các Phase/Node trong `violations` được tô viền đỏ; danh sách `nodeIds` vi phạm trả về trong `DagValidationResult` để hiển thị. Nút `Validate DAG` không bị ràng buộc bởi trạng thái lưu và có thể chạy bất cứ lúc nào.
- Kết quả validate cũ phải bị vô hiệu (ẩn badge) khi đồ thị thay đổi.

### 5.2 Recursive Subtree Spacing Layout

**Hằng số:** `NODE_W = 210`, `NODE_H = 62`, `GAP_X = 70`, `GAP_Y = 18`.

**Bước 1: chiều cao nhánh (hậu thứ tự):**

$$H(n) = \begin{cases} NODE\_H & \text{nếu } n \text{ là lá} \\ \max\!\Big(NODE\_H,\ \sum_{c \in children(n)} H(c) + GAP\_Y\cdot(|children(n)|-1)\Big) & \text{ngược lại} \end{cases}$$

**Bước 2: tọa độ (tiền thứ tự, truyền `top` xuống):**

$$X(n) = X_{parent} + NODE\_W + GAP\_X \quad (X_{root}=0)$$

- Gọi `top` là biên trên của vùng dành cho nhánh `n`. Các con được đặt tuần tự: `top_c1 = top`, `top_c(i+1) = top_ci + H(c_i) + GAP_Y`.
- **Nút lá:** `Y(n) = top + (H(n) − NODE_H) / 2`.
- **Nút trong:** `Y(n) = (Y(c_first) + Y(c_last)) / 2`, tức căn giữa theo con đầu và con cuối.

Mỗi nhánh con chiếm một dải dọc riêng có độ cao `H(c)` và các dải liền kề cách nhau `GAP_Y`, nên hai node bất kỳ không bao giờ giao nhau, bất kể số cấp. Kích thước canvas: `width = (maxDepth+1)·(NODE_W+GAP_X) − GAP_X`, `height = H(root)`.

**Ràng buộc hiệu năng:**
- Layout là **hàm thuần** `layout(tree) → Map<id, {x,y}>`, bọc `useMemo` theo tham chiếu cây; độ phức tạp O(N).
- Hover không nằm trong dependency của layout.
- Dây nối: `M (xp+W) (yp+H/2) C (xp+W+dx) (yp+H/2), (xc−dx) (yc+H/2), xc (yc+H/2)` với `dx = (xc − (xp+W)) / 2`.

### 5.3 Quy tắc nghiệp vụ bổ sung

| # | Quy tắc |
| :-- | :--- |
| R1 | Mỗi Phase luôn có đúng 1 Root; Root không xóa được; đổi tên Root ≡ đổi tên Phase. |
| R2 | Template phải có ≥1 Phase; không xóa Phase cuối cùng. |
| R3 | Xóa Phase ở giữa: tự nối lại các Phase trước/sau (nối tắt) để không làm đứt chuỗi. |
| R4 | Xóa node xóa cả nhánh con và mọi cạnh `DEPENDENCY` liên quan. |
| R5 | `Save & Publish` yêu cầu: `name` hợp lệ + Kahn hợp lệ (2 cấp) + toàn vẹn. Lưu khi `isSystemStandard = false` chỉ lưu bản nháp, toast phản ánh đúng trạng thái. |
| R6 | Toast khi lưu công khai: *"Mẫu quy trình đã được lưu và công khai cho toàn bộ người dùng thành công!"*; khi lưu nháp: toast riêng cho DRAFT. |
| R7 | Rời Studio khi `isDirty` phải xác nhận. |
| R8 | Chuyển template từ PUBLIC về DRAFT không ảnh hưởng dự án đã clone. |

---

## PHẦN 6: KẾ HOẠCH TRIỂN KHAI & TIÊU CHÍ NGHIỆM THU

### 6.1 Cấu trúc thư mục `wpe-frontend`

```
src/
├── types/
│   └── template.types.ts
├── lib/graph/
│   ├── kahn.ts                      # hàm thuần, dùng chung Frontend & MockService
│   ├── treeLayout.ts                # Recursive Subtree Spacing
│   └── phaseLayout.ts               # layout Macro Phase Canvas
├── services/
│   ├── container.ts
│   └── template/
│       ├── ITemplateService.ts
│       ├── MockTemplateService.ts
│       └── mockTemplateData.ts
├── hooks/
│   └── useTemplateStudio.ts         # state: draft template, selection, dirty, validation, actions
└── features/admin/templates/
    ├── TemplateCatalogView.tsx
    ├── TemplateStudioView.tsx
    └── components/
        ├── TemplateCard.tsx
        ├── StudioTopbar.tsx
        ├── PhaseCanvas.tsx          # pan/zoom + PhaseCard + PhaseEdgeLayer
        ├── PhaseDetailDrawer.tsx
        ├── TreeGraphView.tsx
        ├── PhaseKanbanView.tsx
        ├── TaskInspector.tsx
        ├── DagStatusBadge.tsx
        └── ConfirmDialog.tsx
```

**Backend (`wpe-backend`):** `TemplateController`, `TemplateService`, `TemplateRepository`, `GraphValidator` (Kahn + toàn vẹn), các DTO tương ứng mục 3.3, và migration Flyway cho cột mới.

### 6.2 `useTemplateStudio` (hợp đồng hook)

```ts
interface UseTemplateStudio {
  draft: TemplateDetailDto | null; isDirty: boolean; status: 'idle'|'loading'|'saving'|'error';
  selection: { phaseId: string | null; nodeId: string | null };
  validation: DagValidationResult | null;
  addPhase(): void; removePhase(id: string): void; setPhaseDeps(phaseId: string, parents: string[]): void;
  addChild(parentId: string): string;              // trả id node mới
  updateNode(id: string, patch: Partial<Pick<TemplateNodeDto,'title'|'description'|'joinPolicy'>>): void;
  removeNode(id: string): void;
  updateMeta(patch: Partial<Pick<TemplateDetailDto,'name'|'description'|'category'|'isSystemStandard'>>): void;
  validate(): Promise<DagValidationResult>;
  save(): Promise<void>;                            // validate → create/update qua container
}
```

State mang tính cục bộ (reducer); mọi I/O đi qua `container.templateService`.

### 6.3 Checklist nghiệm thu

**Kiến trúc**
- [ ] 100% truy cập dữ liệu qua `container.templateService`; không có `fetch`/`axios`/import mock trong UI.
- [ ] Không có dữ liệu mẫu hard-code trong component.
- [ ] `kahn.ts` và `treeLayout.ts` là hàm thuần, có unit test.
- [ ] `npm run typecheck` đạt **0 lỗi**; không dùng `any` ngoài ranh giới được ghi chú.

**Catalog**
- [ ] Hiển thị ≥3 template từ Mock; có trạng thái loading/empty/error/no-result.
- [ ] Tìm kiếm theo tên và lọc category hoạt động đồng thời.
- [ ] `Duplicate` tạo bản DRAFT; `Delete` có xác nhận và cập nhật danh sách.

**Studio**
- [ ] Thêm Phase, nối tiếp Phase cuối; xóa Phase tự nối tắt; chỉnh được phụ thuộc giữa các Phase.
- [ ] Pan/zoom mượt; click Phase mở Drawer, kéo pan không mở Drawer nhầm.
- [ ] Thêm node sang phải qua nút `+` tới ít nhất 5 cấp; layout không đè node ở mọi cấu hình.
- [ ] Chỉnh `title`, `description`, `joinPolicy` trong Inspector; chuyển Graph ⇄ Kanban giữ nguyên dữ liệu.
- [ ] Hover node không gây re-render layout (xác nhận bằng React Profiler).
- [ ] Switch `Public to All Users` thay đổi badge sau khi lưu.

**Validate & Save**
- [ ] Đồ thị hợp lệ hiện `DAG Valid · 0 Cycles`.
- [ ] Tạo chu trình (Phase hoặc Node) thì hiện badge lỗi, tô đỏ phần tử vi phạm, **chặn lưu**.
- [ ] Lưu thành công cập nhật Catalog và hiện đúng toast.
- [ ] Rời Studio khi có thay đổi chưa lưu thì có modal xác nhận.

**Backend**
- [ ] Endpoint yêu cầu `SUPER_ADMIN`; user thường nhận 403.
- [ ] Server tự validate Kahn và toàn vẹn, trả 422 kèm `violations`.
- [ ] Migration thêm `category`, `clone_count`, `updated_at` chạy sạch trên dữ liệu hiện có.

### 6.4 Điểm cần chốt trước khi giao Agent

1. **Role:** dùng `SUPER_ADMIN` thật hay ánh xạ từ `system_role = 'ADMIN'` (mục 1.2).
2. **Trạng thái template:** hiện chỉ có hai trạng thái suy ra từ `is_system_standard`. Nếu cần thêm `ARCHIVED` thì phải thêm cột `status`.
3. **Khai triển `phaseEdges` khi clone:** nối vào Root của Phase sau, hay vào các node lá của Phase trước (mục 3.2).
4. **Xóa mềm hay cứng** template, vì ảnh hưởng đến thống kê `cloneCount` lịch sử.