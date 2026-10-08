# PROJECT_CONTEXT.md — Workflow Pipeline Engine (SSOT)

> **Vai trò của file này:** Đây là bộ nhớ trung tâm (Single Source of Truth) cho mọi AI Agent (Cursor, Roo Code, Cline, Claude Code) khi làm việc trên dự án "Workflow Pipeline Engine". Đọc toàn bộ file này trước khi sinh code. Không tự suy diễn kiến trúc ngoài những gì được mô tả ở đây — nếu thiếu thông tin, hỏi lại thay vì đoán.

---

## 1. Tổng quan & Tầm nhìn Dự án

### 1.1 Bản chất hệ thống
Workflow Pipeline Engine là nền tảng **điều phối công việc dựa trên đồ thị có hướng không chu trình (DAG)**. Điểm khác biệt cốt lõi so với một pipeline CI/CD: CI/CD điều phối cho **máy chạy** (build, test, deploy tự động); hệ thống này điều phối cho **con người làm việc** — nhận việc (Claim), nộp sản phẩm (Submit Artifact), duyệt bài (Approve/Reject), phản hồi giải trình (Feedback). Vì vậy mọi thiết kế UI/UX phải tránh tạo cảm giác "pipeline máy móc, lạnh lùng" — xem mục 5 và 7.

### 1.2 5 Phân hệ cốt lõi (Bounded Contexts)
| Phân hệ | Trách nhiệm chính |
|---|---|
| **Auth Gateway** | Đăng ký, đăng nhập, JWT, quản lý phiên, refresh token |
| **Project Workspace** | Khởi tạo dự án, thiết kế đồ thị DAG, mời/quản lý thành viên, Kahn validation |
| **Execution Engine** | State machine của Node, AND/OR-join, Claim (optimistic locking), Submit/Approve/Reject |
| **Review Portal & AI Engine** | Guest link (khách ngoài), feedback 2 chiều, AI chẩn đoán điểm nghẽn |
| **Admin Portal** | Quản lý user toàn hệ thống, kho template chuẩn, dọn dẹp/archive dự án |

### 1.3 Phân biệt bắt buộc: Project Lifecycle vs Work Phase
Đây là hai khái niệm **hoàn toàn độc lập**, dễ gây nhầm lẫn vì cùng dùng từ "Phase":

- **Project Lifecycle** (`project.status`): `DRAFT` → `ACTIVE` (= "Published") → `INACTIVE` → `ARCHIVED`. Đây là trạng thái vòng đời của **cả dự án**, hiển thị dưới dạng badge nhỏ ở góc trên-trái Canvas, ví dụ `"PHASE 2 · PUBLISHED"` — con số "2" ở đây **không liên quan** đến Work Phase.
- **Work Phase** (khái niệm UI thuần túy, không có bảng riêng trong DB): là cách nhóm trực quan các Node trên Canvas thành các giai đoạn công việc — `Phase 1 (Foundation)`, `Phase 2A (Frontend)`, `Phase 2B (Backend, song song với 2A)`, `Phase 3 (Verification & Delivery)`. Việc gán Node vào Phase nào là thuộc tính hiển thị (`ui_metadata` hoặc field nhóm riêng ở frontend), **không ảnh hưởng đến State Machine hay thuật toán Kahn**.

---

## 2. Ngăn xếp Công nghệ (Tech Stack)

**Frontend**
- React (TypeScript) + Vite
- Tailwind CSS — Light & Clean Theme (xem mục 5.1)
- `@xyflow/react` (React Flow) — canvas chính thức, **không dùng bản demo tự vẽ SVG thủ công cho sản phẩm thật**
- `dagre` — auto-layout cho Quest Map (tính tọa độ on-the-fly)
- `zustand` — state management
- `lucide-react` — icon set

**Backend & Database**
- Spring Boot 3.x (Java 17+)
- PostgreSQL 15+
- Spring Data JPA — ưu tiên Native Query + DTO Projection cho các truy vấn phức tạp (subgraph, bulk update state machine)
- Flyway — quản lý migration (`V1__init.sql`, ...)

---

## 3. Bộ Quy tắc Nghiệp vụ Cốt lõi & Máy Trạng thái

### 3.1 Vòng đời trạng thái Node

```
LOCKED → TODO → IN_PROGRESS → REVIEW → DONE
                     ↑            │
                     └── REJECTED ┘ (kèm lý do bắt buộc, quay lại IN_PROGRESS)
```

- `LOCKED → TODO`: do Engine tự động mở khóa (không phải hành động thủ công).
- `TODO → IN_PROGRESS`: hành động **Claim**, dùng Optimistic Locking (mục 3.4).
- `IN_PROGRESS → REVIEW`: hành động **Submit**, bắt buộc phải có ít nhất 1 bản ghi `artifacts` gắn với node (Strict Review Constraint, mục 3.5).
- `REVIEW → DONE`: chỉ **Owner** được quyền Approve. Collaborator **không bao giờ** được tự chuyển sang DONE.
- `REVIEW → IN_PROGRESS`: Owner Reject, **bắt buộc nhập lý do** (`reason`), lý do lưu trong bảng `node_review`.

### 3.2 Quy tắc mở khóa của Engine (Join Policy)
- `ALL_COMPLETED` (AND-join): Node con chuyển `LOCKED → TODO` chỉ khi **tất cả** node cha trực tiếp đã `DONE`.
- `ANY_COMPLETED` (OR-join): Node con chuyển `LOCKED → TODO` ngay khi **có ít nhất một** node cha đạt `DONE`.
- Mở khóa chạy bằng câu lệnh SQL set-based (không N+1), nằm **cùng transaction** với thao tác Approve, và phải **khóa hàng `project`** (`FOR NO KEY UPDATE`) trước khi tính điều kiện mở khóa để tránh race condition "lost-unlock" khi 2 node cha của cùng 1 AND-join được duyệt gần như đồng thời.

### 3.3 Kiểm tra chu trình DAG (Kahn's Algorithm)
- Bắt buộc chạy thuật toán sắp xếp Topo của Kahn tại 2 thời điểm: (1) khi Owner lưu/kiểm tra đồ thị trên Canvas, (2) trước khi chuyển dự án từ `DRAFT → ACTIVE`.
- Mọi thao tác sửa Edge (thêm/xóa `node_dependency`) phải **khóa dự án rồi mới chạy Kahn trong cùng transaction**, để tránh race condition hai request đồng thời cùng tạo ra chu trình hợp lệ riêng lẻ nhưng kết hợp lại thành vòng lặp.

### 3.4 Cơ chế Claim (Optimistic Locking)
- Cột `node.version` dùng cho khóa lạc quan. **Không dùng một `@Version` chung cho mọi loại ghi** — các cột "ồn" (`ui_metadata`, `is_overdue`, `due_date`) phải loại khỏi version tracking (`@OptimisticLock(excluded = true)`) để tránh việc kéo-thả UI hoặc job quét overdue làm văng lỗi `OptimisticLockException` oan cho thao tác Claim/Submit của người dùng khác.
- Claim dùng compare-and-set trực tiếp trên `status` (`UPDATE ... WHERE status='TODO' AND assigned_user_id IS NULL`), không dựa vào version client gửi lên.

### 3.5 Điều kiện Nghiệm thu nghiêm ngặt (Strict Review Constraint)
- `IN_PROGRESS → REVIEW` bắt buộc có ≥ 1 bản ghi `artifacts` cho **đúng round hiện tại** (`artifacts.round_no = node.current_round`) — không được tính artifact cũ của round đã bị Reject.
- Mỗi lần Reject: `node.current_round += 1`, đóng bản ghi `node_review` hiện tại kèm `reason`, mở round mới.

---

## 4. Cơ sở Dữ liệu & Quy tắc Truy vấn

### 4.1 Danh sách bảng chính
`users`, `refresh_token`, `pipeline_template`, `project`, `project_member`, `project_invitation`, `guest_link`, `guest_access_log`, `project_ai_analysis`, `node`, `node_dependency`, `node_review`, `artifacts`, `node_feedback`, `node_event`, `notification`.

Ràng buộc quan trọng cần giữ nguyên khi sinh Entity/Migration:
- `node_dependency`: composite FK `(parent_node_id, project_id)` và `(child_node_id, project_id)` → **một cạnh không bao giờ nối 2 node khác project**. CHECK chặn self-loop (`parent_node_id <> child_node_id`).
- `node`: composite FK `(project_id, assigned_user_id) → project_member(project_id, user_id)` → assignee bắt buộc là thành viên của đúng project đó. CHECK bất biến: `status IN ('LOCKED','TODO') ⇒ assigned_user_id IS NULL`; ngược lại `assigned_user_id IS NOT NULL`.
- `project_member`: unique partial index đảm bảo mỗi project chỉ có đúng 1 `role='OWNER'` đang active (`removed_at IS NULL`).
- Không hard-delete `users` (FK `RESTRICT`) — khóa tài khoản bằng `is_locked` + tăng `token_version`, không xóa bản ghi.

### 4.2 Truy vấn Focus Graph / Quest Map (Subgraph 1 bậc)
- **KHÔNG dùng `WITH RECURSIVE`** — đây là truy vấn đúng 1 bậc (parent/child trực tiếp), không phải duyệt toàn bộ dòng dõi. Dùng CTE thường kết hợp `UNION`.
- Cấu trúc chuẩn: `my_nodes` (task của user, lọc theo `assigned_user_id` + `project_member.removed_at IS NULL`) → `neighbor_ids` (UNION của cha trực tiếp và con trực tiếp qua `node_dependency`) → `ghost_nodes` (loại trừ node đã có trong `my_nodes`).
- Vì `node_dependency` không xuyên project, kết quả trả về là **một rừng (forest) nhiều cụm độc lập**, mỗi cụm gói gọn trong 1 `project_id` — nhóm theo `clusters[]` ở response, không cố ghép thành 1 đồ thị duy nhất.
- Luôn `LIMIT` số node chính (ví dụ 20, sort theo `due_date`/`is_overdue`) — không trả toàn bộ nếu user có hàng chục task active.

---

## 5. Đặc tả Giao diện & Các Màn hình Trực quan

### 5.1 Ngôn ngữ thiết kế chung (Light & Clean Theme)
- Canvas nền: `bg-slate-50` (`#f8fafc`) kèm lưới chấm bi `radial-gradient(#cbd5e1 1px, transparent 1px)`.
- Khung Phase Container: nền **đậm hơn nền canvas** để nổi bật ranh giới — `bg-slate-200/70 border border-slate-300 shadow-sm` (không dùng nền quá mờ kiểu `bg-slate-50/70` vì bị chìm vào lưới chấm). Có dải accent màu ở đỉnh container theo trạng thái tổng hợp: xanh emerald = Completed, xanh blue = In Progress, xám slate = Locked.
- Thẻ Node: luôn trắng tinh `bg-white shadow-sm border border-slate-200/80` — tạo phân lớp độ sâu rõ ràng: **Canvas (nhạt nhất) → Phase Box (đậm vừa) → Node Card (trắng, nổi nhất)**.
- Đường nối Bézier: nội bộ trong 1 Phase = bạc/xám nhạt tĩnh; xuyên Phase (cross-boundary) = xanh blue rõ nét, có hiệu ứng chạy (animated dash) khi dữ liệu đang thực sự "chảy" (node nguồn đã DONE và đã mở khóa node đích).

### 5.2 Màn hình 1: Global DAG Canvas (`/canvas`)
- **Bố cục Phase Containers** (branching layout, không phải 3 cột Kanban cứng):
  - Phase 1 (Foundation) — cột trái, cao suốt, trạng thái Completed.
  - Phase 2 tách thành **2 container độc lập xếp chồng dọc**, cách nhau ≥ 32px: Phase 2A (Frontend) phía trên, Phase 2B (Backend) phía dưới — đây là hai track chạy **song song**, không lồng chung 1 khung.
  - Phase 3 (Verification & Delivery) — cột phải, cao suốt, trạng thái Locked cho đến khi cả 2A và 2B hội tụ đủ điều kiện AND-join.
- Mỗi Phase **bắt buộc là Group Node của React Flow** (không dùng `<div>` HTML định vị `absolute` cứng cho sản phẩm thật — bản demo Artifact trước đó chỉ để duyệt ý tưởng thị giác), có thể resize bằng `<NodeResizer/>`.
- Đường nối Bézier dùng **React Flow Handles/Edges thật sự** — không vẽ `<path>` SVG với tọa độ pixel tự tính tay.
- Toolbar trên Canvas: **chỉ 2 nút** `+ Add Node` và `Save`. **Không có** nút "Run AI Diagnostics" ở màn hình này (nút đó chỉ thuộc về Overview, mục 5.4).
- Thanh zoom (`- 100% + fit`): cố định giữa đáy màn hình, `fixed bottom-6 left-1/2 -translate-x-1/2`.
- Drawer "Node Properties" bên phải: trượt ra khi click chọn Node, cho phép xem/sửa thuộc tính (title, assignee, due date, join policy).
- Resize Phase Group Node **chỉ lưu cục bộ trong state** khi đang kéo — **không gọi API mỗi lần di chuột**; chỉ gửi lên server khi người dùng bấm **Save**.

### 5.3 Màn hình 2: Quest Map / Personal Task Stream (`/quest-map`)
- **Thay thế hoàn toàn** bảng Kanban chia cột trạng thái truyền thống.
- Ngôn ngữ thiết kế "Skill Tree":
  - Node `DONE` → co thành huy hiệu tròn xanh mint (mint-green circular badge).
  - Node `IN_PROGRESS` / `TODO` → card lớn, mở rộng thành drawer nộp artifact khi tương tác.
  - Node `LOCKED` / phụ thuộc của người khác → hiển thị dạng Ghost (mờ, thu nhỏ, desaturate).
- Tọa độ hiển thị **tính on-the-fly bằng `dagre`** ngay tại frontend cho từng cụm (cluster) trả về từ API — **tuyệt đối không dùng tọa độ `ui_metadata` gốc trong DB** cho view này, vì đó là tọa độ của bản vẽ toàn cục, sẽ gây layout vỡ/trống khi hiển thị subgraph nhỏ.
- Mỗi cluster (theo `project_id`) render bằng 1 instance React Flow riêng, có tiêu đề tên project — vì Focus Graph về bản chất là rừng nhiều cụm, không phải 1 đồ thị liền mạch xuyên project.

### 5.4 Màn hình 3: Overview (`/overview`)
- Topbar **không có** nút `+ Add Node` và `Save` (đây là màn hình chỉ-xem/phân tích, không chỉnh sửa đồ thị).
- Khung "AI Diagnostic Report": mặc định bị **làm mờ (blur)**, có nút `Run AI Diagnostics` nổi bật ở giữa. Khi click: hiện spinner phân tích trong 1.2s, sau đó unlock hiển thị 3 thẻ cảnh báo — **Bottleneck**, **Critical Path**, **Milestone**.

---

## 6. Cấu trúc Mã nguồn & Quy tắc Lưu trữ Trạng thái

### 6.1 Zustand store
State toàn cục quản lý tại `frontend/src/store/useWorkflowStore.ts` — chứa danh sách node/edge hiện tại của Canvas đang mở, trạng thái Drawer (node đang được chọn), và cờ "có thay đổi chưa lưu" (dirty flag) phục vụ nút Save.

### 6.2 Danh mục thư mục chuẩn
```
frontend/src/
├── types/                  # TypeScript interfaces khớp 100% schema DB (xem 6.4)
├── data/                   # mockData.ts — dữ liệu giả lập khi chưa nối API thật
├── store/
│   └── useWorkflowStore.ts
├── components/
│   ├── layout/              # Topbar, Drawer khung, Zoom controls
│   ├── canvas/               # PhaseGroupNode, TaskNode, custom Edge cho /canvas
│   └── quest-map/            # GhostNode, SkillBadge, FocusCard cho /quest-map
└── views/
    ├── CanvasView.tsx         # /canvas
    ├── QuestMapView.tsx       # /quest-map
    └── OverviewView.tsx       # /overview
```

### 6.3 Quy tắc `mockData.ts`
Mọi field trong mock data phải khớp tên và kiểu dữ liệu với cột DB tương ứng (mục 4.1) — không tự đặt thêm field tùy tiện (ví dụ không tự thêm `progress: number` trên Node nếu DB không có cột này; phần trăm tiến độ Phase phải được **tính toán ở frontend** từ tập hợp `status` của các node con, không lưu cứng).

### 6.4 TypeScript Interfaces mẫu

```typescript
// types/node.ts
export type NodeStatus = 'LOCKED' | 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';
export type JoinPolicy = 'ALL_COMPLETED' | 'ANY_COMPLETED';

export interface WorkflowNode {
  id: number;                       // bigint PK
  projectId: number;
  title: string;
  description?: string;
  status: NodeStatus;
  assignedUserId: number | null;
  joinPolicy: JoinPolicy;
  dueDate: string | null;           // ISO-8601
  isOverdue: boolean;
  currentRound: number;
  version: number;                  // optimistic locking
  uiMetadata: {
    position: { x: number; y: number };
    style?: { fill?: string; stroke?: string };
    color?: string;
  };
  updatedAt: string;
}

// types/edge.ts
export interface NodeDependency {
  id: number;
  projectId: number;
  parentNodeId: number;
  childNodeId: number;
}

// types/project.ts
export type ProjectStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export interface Project {
  id: number;
  ownerId: number;
  name: string;
  description?: string;
  status: ProjectStatus;            // Project Lifecycle — KHÁC với Work Phase (mục 1.3)
  createdAt: string;
}

// types/focusGraph.ts — payload cho /quest-map
export interface FocusNode extends WorkflowNode {
  bucket: 'FOCUS' | 'GHOST';
  relation: 'PARENT' | 'CHILD' | null;
  assignee: { id: number; name: string } | null;
}

export interface FocusCluster {
  projectId: number;
  projectName: string;
  nodes: FocusNode[];
  edges: Pick<NodeDependency, 'parentNodeId' | 'childNodeId'>[];
}
```

---

## 7. Danh sách Điều cấm kỵ (Anti-Patterns / Golden Rules for Agents)

Mọi AI Agent đọc file này phải tuân thủ tuyệt đối các quy tắc sau — vi phạm bất kỳ điều nào dưới đây được xem là lỗi kiến trúc nghiêm trọng:

1. **KHÔNG** dùng thẻ `<div>` HTML định vị `absolute` tĩnh để bọc các Phase trên Canvas sản phẩm thật — bắt buộc dùng **React Flow Group Node**.
2. **KHÔNG** vẽ đường nối bằng `<svg><path>` với tọa độ pixel tính tay — bắt buộc dùng **React Flow Handles và Edges**.
3. **KHÔNG** dùng bảng Kanban chia cột trạng thái để hiển thị task cá nhân (`/quest-map`) — bắt buộc dùng bố cục Skill Tree/Ghost node đã đặc tả ở mục 5.3.
4. **KHÔNG** dùng `WITH RECURSIVE` cho truy vấn Subgraph 1 bậc — dùng CTE thường + `UNION` (mục 4.2).
5. **KHÔNG** gọi API mỗi khi người dùng đang kéo/resize Phase trên Canvas — chỉ lưu state cục bộ (Zustand), chỉ gửi lên server khi bấm **Save**.
6. **KHÔNG** để Collaborator tự chuyển Node sang `DONE` — chỉ Owner được Approve (mục 3.1).
7. **KHÔNG** dùng một `@Version` duy nhất cho mọi cột của `node` — loại trừ các cột "ồn" (`ui_metadata`, `is_overdue`, `due_date`) khỏi optimistic lock (mục 3.4).
8. **KHÔNG** cho phép `node_dependency` nối 2 node khác `project_id`, hoặc tạo self-loop (mục 4.1).
9. **KHÔNG** đặt nút "Run AI Diagnostics" ở màn hình `/canvas` — nút này chỉ thuộc `/overview` (mục 5.2, 5.4).
10. **KHÔNG** dùng tọa độ `ui_metadata` gốc trong DB cho `/quest-map` — luôn tính lại bằng `dagre` on-the-fly (mục 5.3).
