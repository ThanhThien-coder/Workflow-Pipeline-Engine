# FRONTEND_ARCHITECTURE_AUDIT.md — Bản Thẩm định Kiến trúc Frontend

> **Vai trò của file này:** Đây là Bản thẩm định kỹ thuật (Technical Audit Plan) dành cho AI Coding Agent (Cursor / Roo Code / Claude Code / Cline). Agent đọc file này để: (1) tự quét mã nguồn hiện tại, (2) chấm điểm ĐẠT/CHƯA ĐẠT theo Scorecard ở Phần 1, (3) refactor theo đúng mẫu chuẩn ở Phần 2, (4) thực hiện đúng trình tự ở Phần 3. Không refactor tùy hứng ngoài phạm vi Scorecard.
>
> File này giả định Agent đã có ngữ cảnh nghiệp vụ đầy đủ từ `PROJECT_CONTEXT.md` (State Machine, DB schema, đặc tả 3 màn hình Canvas/Quest Map/Overview). File này **chỉ tập trung vào chất lượng kiến trúc code**, không lặp lại đặc tả nghiệp vụ.

---

## CÂU HỎI SỐNG CÒN CẦN TRẢ LỜI

Trước khi đọc chi tiết, Agent phải trả lời được 3 câu hỏi sau bằng bằng chứng cụ thể (trích dẫn đường dẫn file, không trả lời chung chung):

1. **Dự án hiện tại là "Mockup dùng 1 lần" hay "Production-ready Base"?** — Tiêu chí phân biệt: nếu xóa toàn bộ `mockData.ts` thì có bao nhiêu component/store bị vỡ do gọi thẳng vào mock thay vì gọi qua interface?
2. **Có đảm bảo Dependency Inversion (DIP) hay chưa?** — Tiêu chí: khi Backend Spring Boot sẵn sàng, việc chuyển từ Mock sang Real API có **CHỈ** cần đổi 1 biến môi trường (`VITE_USE_MOCK`) mà **không sửa bất kỳ dòng nào** ở tầng UI (`components/`, `views/`) và tầng Zustand Store hay không?
3. **Cấu trúc thư mục và các thư viện lõi (`reactflow`, `dagre`, `zustand`, `tailwind`) đã phối hợp đúng chuẩn chưa?** — Không phải "đã cài đặt" mà là "đã dùng đúng vai trò dự kiến".

Nếu câu trả lời cho câu 2 là "Không" ở **bất kỳ điểm nào**, dự án được xếp loại **Mockup**, bất kể UI có mượt và đẹp đến đâu. Độ đẹp của UI không phải tiêu chí thẩm định ở đây.

---

## PHẦN 1: MA TRẬN KIỂM ĐỊNH TỰ ĐỘNG (AUDIT SCORECARD)

Với mỗi hạng mục, Agent phải: (a) quét code, (b) điền cột "Bằng chứng" bằng đường dẫn file/dòng cụ thể, (c) đánh dấu ĐẠT hoặc CHƯA ĐẠT. Không được đánh dấu ĐẠT nếu không có bằng chứng cụ thể.

### 1.1 Kiến trúc phân tầng (Clean Layered Architecture)

| # | Tiêu chí | ĐẠT / CHƯA ĐẠT | Bằng chứng |
|---|---|---|---|
| 1.1.1 | Tồn tại đúng 3 tầng tách bạch: `Presentation` (`components/`, `views/`) → `Application/State` (`store/`) → `Data/Infrastructure` (`services/`) | | |
| 1.1.2 | Component trong `components/` và `views/` **không** import trực tiếp từ `data/mockData.ts` hoặc gọi `fetch`/`axios` trực tiếp | | |
| 1.1.3 | Zustand Store (`store/`) là nơi **duy nhất** được phép gọi vào tầng Service | | |
| 1.1.4 | Không có logic nghiệp vụ (tính toán trạng thái, validate) nằm lẫn trong JSX của component — logic thuộc về Store hoặc Service | | |

### 1.2 Nguyên lý Dependency Inversion (DIP) & Service Abstraction

| # | Tiêu chí | ĐẠT / CHƯA ĐẠT | Bằng chứng |
|---|---|---|---|
| 1.2.1 | Tồn tại `frontend/src/types/services.ts` khai báo interface trừu tượng `IWorkflowService` | | |
| 1.2.2 | Tồn tại `frontend/src/services/mockWorkflowService.ts` implement `IWorkflowService`, có giả lập delay mạng | | |
| 1.2.3 | Tồn tại `frontend/src/services/apiWorkflowService.ts` implement `IWorkflowService`, sẵn sàng gọi Spring Boot thật | | |
| 1.2.4 | Tồn tại `frontend/src/services/index.ts` đóng vai trò Factory, chọn implementation dựa theo `import.meta.env.VITE_USE_MOCK` | | |
| 1.2.5 | Zustand Store gọi **duy nhất** qua biến service được inject từ `services/index.ts` — **không** có bất kỳ `import { mockNodes } from '../data/mockData'` nào trong `store/` | | |
| 1.2.6 | Đổi `VITE_USE_MOCK=false` → `true` (hoặc ngược lại) **không** yêu cầu sửa bất kỳ file nào trong `components/`, `views/`, `store/` | | |

**Đây là hạng mục quan trọng nhất.** Nếu 1.2.5 hoặc 1.2.6 CHƯA ĐẠT, toàn bộ audit coi như thất bại — mọi hạng mục khác trở thành thứ yếu.

### 1.3 Cấu trúc Thư mục & Bounded Context

| # | Thư mục | Vai trò bắt buộc | ĐẠT / CHƯA ĐẠT |
|---|---|---|---|
| 1.3.1 | `frontend/src/types/` | Interface TypeScript khớp DB schema + `services.ts` | |
| 1.3.2 | `frontend/src/services/` | `IWorkflowService`, `mockWorkflowService`, `apiWorkflowService`, `index.ts` | |
| 1.3.3 | `frontend/src/store/` | Zustand store, không chứa mock data hay fetch trực tiếp | |
| 1.3.4 | `frontend/src/components/canvas/` | `PhaseGroupNode`, `TaskNode`, custom Edge cho `/canvas` | |
| 1.3.5 | `frontend/src/components/quest-map/` | `GhostNode`, `SkillBadge`, `FocusCard` cho `/quest-map` | |
| 1.3.6 | `frontend/src/components/layout/` | Topbar, Drawer khung, Zoom controls dùng chung | |
| 1.3.7 | `frontend/src/views/` | `CanvasView.tsx`, `QuestMapView.tsx`, `OverviewView.tsx` — chỉ compose component, không chứa logic nghiệp vụ | |

Vi phạm cần gắn cờ đặc biệt: bất kỳ file nào nằm sai thư mục theo vai trò trên (ví dụ logic gọi API nằm trong `components/canvas/TaskNode.tsx`) phải được liệt kê riêng trong Audit Report.

### 1.4 Chuẩn mực React Flow & Dagre

| # | Tiêu chí | ĐẠT / CHƯA ĐẠT | Bằng chứng |
|---|---|---|---|
| 1.4.1 | Canvas: mỗi Phase (`Phase 1`, `2A`, `2B`, `3`) là 1 React Flow node kiểu `group`, **không** phải `<div>` định vị `absolute` thủ công | | |
| 1.4.2 | Các Task Node bên trong Phase có `parentId` trỏ đúng đến Group Node tương ứng và `extent: 'parent'` | | |
| 1.4.3 | Phase Group Node dùng `<NodeResizer />` để resize, sự kiện resize chỉ cập nhật local state (Zustand), **không** gọi API cho tới khi bấm Save | | |
| 1.4.4 | Mọi Edge nối bằng `source`/`target` + `sourceHandle`/`targetHandle` thật của React Flow — **không** có `<svg><path>` vẽ tay với tọa độ pixel cứng ở code sản phẩm | | |
| 1.4.5 | Quest Map: tọa độ node được tính bằng `dagre.layout()` mỗi khi subgraph thay đổi — **không** có dòng code nào đọc `node.uiMetadata.position` để hiển thị ở `/quest-map` | | |
| 1.4.6 | `dagre` chạy trong `useMemo`/custom hook riêng (ví dụ `useFocusLayout`), tách khỏi component render — tránh tính lại layout không cần thiết mỗi lần re-render | | |

### 1.5 Độ sạch của TypeScript & Tailwind

| # | Tiêu chí | ĐẠT / CHƯA ĐẠT | Bằng chứng |
|---|---|---|---|
| 1.5.1 | Không tồn tại từ khóa `any` trong toàn bộ `frontend/src/` (trừ file `.d.ts` khai báo thư viện ngoài, nếu có phải ghi chú lý do) | | |
| 1.5.2 | `NodeStatus` là union type chuẩn: `'LOCKED' \| 'TODO' \| 'IN_PROGRESS' \| 'REVIEW' \| 'DONE'` — không dùng `string` chung chung | | |
| 1.5.3 | `JoinPolicy` là union type chuẩn: `'ALL_COMPLETED' \| 'ANY_COMPLETED'` | | |
| 1.5.4 | Không có Tailwind class magic-number tùy tiện không nhất quán (ví dụ vừa dùng `top-[137px]` vừa dùng `top-4` cho cùng một loại phần tử) — ưu tiên token nhất quán | | |
| 1.5.5 | `tsconfig.json` bật `"strict": true` | | |

### Bảng tổng kết điểm số

| Hạng mục | Số tiêu chí ĐẠT / Tổng | Trạng thái |
|---|---|---|
| 1.1 Kiến trúc phân tầng | ` /4` | |
| 1.2 Dependency Inversion | ` /6` | |
| 1.3 Cấu trúc thư mục | ` /7` | |
| 1.4 React Flow & Dagre | ` /6` | |
| 1.5 TypeScript & Tailwind | ` /5` | |
| **TỔNG** | ` /28` | **Production-ready Base** nếu ≥ 24/28 **và** toàn bộ mục 1.2 ĐẠT. Ngược lại: **Mockup, cần refactor**. |

---

## PHẦN 2: HƯỚNG DẪN THIẾT KẾ SERVICE LAYER (MẪU DI CHUẨN)

Agent dùng các file mẫu dưới đây làm đích đến khi refactor. Giữ nguyên tên file, tên hàm, chữ ký (signature) — chỉ được mở rộng thêm, không được đổi tên hoặc bớt tham số đã định nghĩa.

### 2.1 `frontend/src/types/services.ts`

```typescript
import type { WorkflowNode, NodeDependency } from './node';
import type { FocusCluster } from './focusGraph';

export interface CanvasGraph {
  projectId: number;
  projectStatus: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  nodes: WorkflowNode[];
  edges: NodeDependency[];
}

export interface GraphLayoutUpdate {
  projectId: number;
  positions: Record<number, { x: number; y: number; width?: number; height?: number }>;
}

/**
 * Hợp đồng nghiệp vụ duy nhất mà tầng UI/Store được phép biết đến.
 * KHÔNG được import trực tiếp MockWorkflowService hay ApiWorkflowService
 * ở bất kỳ đâu ngoài frontend/src/services/index.ts.
 */
export interface IWorkflowService {
  getCanvasGraph(projectId: number): Promise<CanvasGraph>;
  getPersonalQuestStream(projectId: number, userId: number): Promise<FocusCluster[]>;
  claimTask(nodeId: number): Promise<WorkflowNode>;
  submitArtifact(nodeId: number, url: string): Promise<WorkflowNode>;
  saveGraphLayout(projectId: number, layout: GraphLayoutUpdate): Promise<void>;
}
```

### 2.2 `frontend/src/services/mockWorkflowService.ts`

```typescript
import type { IWorkflowService, CanvasGraph, GraphLayoutUpdate } from '../types/services';
import type { WorkflowNode } from '../types/node';
import type { FocusCluster } from '../types/focusGraph';
import { mockNodes, mockEdges, mockClusters } from '../data/mockData';

const delay = <T>(value: T, ms = 400): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

/**
 * mockData.ts là dependency DUY NHẤT được phép import mock data.
 * Không component, không store nào khác được import mockData trực tiếp.
 */
export class MockWorkflowService implements IWorkflowService {
  async getCanvasGraph(projectId: number): Promise<CanvasGraph> {
    return delay({
      projectId,
      projectStatus: 'ACTIVE',
      nodes: mockNodes.filter((n) => n.projectId === projectId),
      edges: mockEdges.filter((e) => e.projectId === projectId),
    });
  }

  async getPersonalQuestStream(projectId: number, userId: number): Promise<FocusCluster[]> {
    return delay(mockClusters.filter((c) => c.projectId === projectId));
  }

  async claimTask(nodeId: number): Promise<WorkflowNode> {
    const node = mockNodes.find((n) => n.id === nodeId);
    if (!node) throw new Error(`Node ${nodeId} not found`);
    if (node.status !== 'TODO') throw new Error('Node is not claimable');
    node.status = 'IN_PROGRESS';
    node.assignedUserId = node.assignedUserId ?? 1; // mock current user id
    node.version += 1;
    return delay({ ...node });
  }

  async submitArtifact(nodeId: number, url: string): Promise<WorkflowNode> {
    const node = mockNodes.find((n) => n.id === nodeId);
    if (!node) throw new Error(`Node ${nodeId} not found`);
    node.status = 'REVIEW';
    node.version += 1;
    return delay({ ...node });
  }

  async saveGraphLayout(projectId: number, layout: GraphLayoutUpdate): Promise<void> {
    // Mock: chỉ log, không cần persist thật
    return delay(undefined, 200);
  }
}
```

### 2.3 `frontend/src/services/apiWorkflowService.ts`

```typescript
import type { IWorkflowService, CanvasGraph, GraphLayoutUpdate } from '../types/services';
import type { WorkflowNode } from '../types/node';
import type { FocusCluster } from '../types/focusGraph';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('accessToken');
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    // TODO: nối vào luồng refresh token của Auth Gateway (xem PROJECT_CONTEXT.md mục 1.2)
    throw new Error('Unauthorized — token expired or invalid');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Request failed: ${res.status}`);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export class ApiWorkflowService implements IWorkflowService {
  getCanvasGraph(projectId: number): Promise<CanvasGraph> {
    return request<CanvasGraph>(`/projects/${projectId}/graph`);
  }

  getPersonalQuestStream(projectId: number, userId: number): Promise<FocusCluster[]> {
    return request<FocusCluster[]>(`/projects/${projectId}/focus-graph?userId=${userId}`);
  }

  claimTask(nodeId: number): Promise<WorkflowNode> {
    return request<WorkflowNode>(`/nodes/${nodeId}/claim`, { method: 'POST' });
  }

  submitArtifact(nodeId: number, url: string): Promise<WorkflowNode> {
    return request<WorkflowNode>(`/nodes/${nodeId}/artifacts`, {
      method: 'POST',
      body: JSON.stringify({ fileUrl: url }),
    });
  }

  saveGraphLayout(projectId: number, layout: GraphLayoutUpdate): Promise<void> {
    return request<void>(`/projects/${projectId}/graph/layout`, {
      method: 'PUT',
      body: JSON.stringify(layout),
    });
  }
}
```

### 2.4 `frontend/src/services/index.ts`

```typescript
import type { IWorkflowService } from '../types/services';
import { MockWorkflowService } from './mockWorkflowService';
import { ApiWorkflowService } from './apiWorkflowService';

const useMock = import.meta.env.VITE_USE_MOCK === 'true';

/**
 * Điểm inject DUY NHẤT trong toàn bộ ứng dụng.
 * Store gọi `workflowService`, không bao giờ new trực tiếp Mock/Api service.
 * Đổi Mock <-> Real API chỉ bằng cách đổi VITE_USE_MOCK trong .env — không sửa dòng nào khác.
 */
export const workflowService: IWorkflowService = useMock
  ? new MockWorkflowService()
  : new ApiWorkflowService();
```

### 2.5 `frontend/src/store/useWorkflowStore.ts`

```typescript
import { create } from 'zustand';
import { workflowService } from '../services';
import type { WorkflowNode, NodeDependency } from '../types/node';
import type { FocusCluster } from '../types/focusGraph';

interface WorkflowState {
  nodes: WorkflowNode[];
  edges: NodeDependency[];
  focusClusters: FocusCluster[];
  selectedNodeId: number | null;
  isDirty: boolean;          // true khi có thay đổi layout chưa Save
  isLoading: boolean;
  error: string | null;

  loadCanvas: (projectId: number) => Promise<void>;
  loadQuestMap: (projectId: number, userId: number) => Promise<void>;
  selectNode: (nodeId: number | null) => void;
  claim: (nodeId: number) => Promise<void>;
  submit: (nodeId: number, url: string) => Promise<void>;
  updateLocalPosition: (nodeId: number, x: number, y: number) => void; // KHÔNG gọi API
  saveLayout: (projectId: number) => Promise<void>;                    // gọi API khi bấm Save
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  nodes: [],
  edges: [],
  focusClusters: [],
  selectedNodeId: null,
  isDirty: false,
  isLoading: false,
  error: null,

  loadCanvas: async (projectId) => {
    set({ isLoading: true, error: null });
    try {
      const graph = await workflowService.getCanvasGraph(projectId);
      set({ nodes: graph.nodes, edges: graph.edges, isLoading: false });
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
    }
  },

  loadQuestMap: async (projectId, userId) => {
    set({ isLoading: true, error: null });
    try {
      const clusters = await workflowService.getPersonalQuestStream(projectId, userId);
      set({ focusClusters: clusters, isLoading: false });
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
    }
  },

  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

  claim: async (nodeId) => {
    const updated = await workflowService.claimTask(nodeId);
    set((s) => ({ nodes: s.nodes.map((n) => (n.id === nodeId ? updated : n)) }));
  },

  submit: async (nodeId, url) => {
    const updated = await workflowService.submitArtifact(nodeId, url);
    set((s) => ({ nodes: s.nodes.map((n) => (n.id === nodeId ? updated : n)) }));
  },

  // Kéo/resize Phase hoặc Node trên Canvas: CHỈ set local state, KHÔNG gọi service.
  updateLocalPosition: (nodeId, x, y) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId ? { ...n, uiMetadata: { ...n.uiMetadata, position: { x, y } } } : n
      ),
      isDirty: true,
    })),

  // Chỉ khi bấm nút Save ở Toolbar mới thực sự gọi API.
  saveLayout: async (projectId) => {
    const { nodes } = get();
    const positions = Object.fromEntries(
      nodes.map((n) => [n.id, n.uiMetadata.position])
    );
    await workflowService.saveGraphLayout(projectId, { projectId, positions });
    set({ isDirty: false });
  },
}));
```

**Điểm mấu chốt để Agent tự kiểm chứng:** đọc lại toàn bộ file `useWorkflowStore.ts` — nếu tìm thấy bất kỳ dòng nào có chữ `mock` hoặc `fetch(` hoặc `axios.` xuất hiện trực tiếp, đó là vi phạm DIP nghiêm trọng (tiêu chí 1.2.5).

---

## PHẦN 3: LỆNH HÀNH ĐỘNG DÀNH CHO AGENT (ACTIONABLE INSTRUCTIONS)

Thực hiện tuần tự theo đúng 3 bước. **Không được nhảy bước.** Không refactor bước 2 trước khi hoàn thành báo cáo ở bước 1.

### Bước 1 — Quét & Báo cáo (Audit Report)

1. Quét toàn bộ `frontend/src/` theo từng tiêu chí ở Phần 1.
2. Với mỗi tiêu chí CHƯA ĐẠT, ghi rõ: đường dẫn file, số dòng (nếu có), và mô tả ngắn vi phạm gì.
3. Xuất ra một khối markdown độc lập tên `AUDIT_REPORT.md` (không sửa code ở bước này), theo mẫu:

   ```markdown
   ## Audit Report — <ngày giờ>

   ### Tổng điểm: XX/28 — Phân loại: [Production-ready Base | Mockup, cần refactor]

   ### Vi phạm phát hiện được
   - [1.2.5] `frontend/src/store/useWorkflowStore.ts:14` — import trực tiếp `mockNodes` từ `data/mockData.ts`, bỏ qua tầng Service.
   - [1.4.1] `frontend/src/components/canvas/CanvasView.tsx:42` — Phase được vẽ bằng `<div className="absolute">`, không phải React Flow group node.
   - ...
   ```
4. **Dừng lại và chờ xác nhận của người dùng trước khi refactor**, trừ khi người dùng đã ra lệnh "audit và tự refactor luôn" trong cùng một yêu cầu.

### Bước 2 — Refactor theo mẫu chuẩn

1. Tạo/chuẩn hóa đúng 5 file ở Phần 2 (`types/services.ts`, `services/mockWorkflowService.ts`, `services/apiWorkflowService.ts`, `services/index.ts`, `store/useWorkflowStore.ts`) — giữ nguyên chữ ký hàm đã định nghĩa, có thể bổ sung nhưng không xóa.
2. Với mỗi vi phạm liệt kê ở Audit Report, sửa đúng vị trí đó — không refactor tràn lan ra các phần code không liên quan đến vi phạm đã ghi nhận.
3. Đảm bảo `frontend/.env.example` có khai báo `VITE_USE_MOCK=true` và `VITE_API_BASE_URL=http://localhost:8080/api`.
4. Sau khi refactor, chạy lại toàn bộ Scorecard ở Phần 1 một lần nữa và cập nhật điểm số.

### Bước 3 — Build & Kiểm tra hồi quy (Regression Check)

1. Chạy `npm run build` (hoặc `tsc --noEmit` nếu chỉ cần kiểm tra type) — **0 lỗi TypeScript** là điều kiện bắt buộc để coi bước refactor thành công.
2. Kiểm tra thủ công (hoặc bằng test nếu có) rằng 3 màn hình vẫn giữ nguyên hành vi trước refactor:
   - `/canvas`: kéo/resize Phase Group Node, click chọn Task Node mở Drawer, bấm Save.
   - `/quest-map`: layout `dagre` vẫn tính đúng vị trí cho từng cluster, tương tác Claim/Submit vẫn hoạt động qua Store → Service.
   - `/overview`: nút Run AI Diagnostics vẫn chạy đúng luồng blur → spinner 1.2s → unlock 3 thẻ cảnh báo.
3. Xác nhận việc đổi `VITE_USE_MOCK=true` ↔ `false` trong `.env` **không đòi hỏi sửa bất kỳ file nào** trong `components/`, `views/`, `store/` — đây là bài kiểm tra chấp nhận cuối cùng (acceptance test) cho toàn bộ audit.
4. Nếu bất kỳ hành vi UI nào bị vỡ sau refactor, ưu tiên sửa lại cho đúng hành vi cũ trước khi báo cáo hoàn thành — refactor kiến trúc **không được phép** đánh đổi bằng việc làm hỏng trải nghiệm người dùng đã được duyệt trước đó.
