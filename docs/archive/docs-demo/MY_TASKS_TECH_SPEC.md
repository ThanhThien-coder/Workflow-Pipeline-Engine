# TECHNICAL SPECIFICATION & IMPLEMENTATION BLUEPRINT — MY TASKS (KANBAN CÁ NHÂN)

**Dự án:** Workflow Pipeline Engine · **Stack FE:** React 18 + TypeScript (strict) + Tailwind CSS + Zustand (+ immer) + Clean Architecture / DI
**Nguồn chuẩn:** Prototype `My Tasks` (single-file React) đã nghiệm thu. Tài liệu này là SSOT cho AI Coding Agent.

> **Quy tắc cho Agent:** Class Tailwind, text tiếng Việt, mock data trong tài liệu này phải khớp 1:1 với prototype. Không dùng `any`. Không thêm thư viện kéo thả (dùng HTML5 Drag & Drop). Mọi chuyển trạng thái đi qua **một** hàm thuần `evaluateTransition` (mục 4.1), không được `set` status trực tiếp.

---

## PHẦN 0: ĐỐI CHIẾU PROTOTYPE & QUY TẮC NGHIỆP VỤ

### 0.1 Các điểm lệch giữa đề bài và prototype (quyết định đã chốt)

| # | Đề bài ghi | Prototype thực tế | Quyết định |
|---|---|---|---|
| 1 | "15 tasks" | 5 + 6 + 3 = **14 tasks** | Giữ **14** để khớp 100% prototype. Muốn đủ 15 thì thêm 1 task rồi sửa số đếm trong mock + test. |
| 2 | `UserSummary` chỉ có id, name, roleTitle, avatarClass, initials | Switcher cần biết ai là Owner và số task mỗi người | Bổ sung `projectRole` và `assignedTaskCount` vào `UserSummary`. |
| 3 | Thành viên không được kéo sang `DONE` | Owner (Alex Kim) được duyệt `REVIEW → DONE` kể cả task của chính mình | Giữ hành vi prototype (SSOT §3.2: Owner kế thừa quyền Collaborator, duyệt là đặc quyền Owner). Rule dựa trên `actor.projectRole`, không hard-code tên. |
| 4 | Loại tài liệu: `PR GitHub / Figma / API Contract / Khác` | `GitHub PR Link / Figma URL / Tài liệu API / Zip` | Dùng nhãn **prototype**; enum code `'PR' \| 'FIGMA' \| 'DOCS' \| 'ZIP'`. |
| 5 | Lọc Phase dạng dropdown | Segmented control 5 nút (Tất cả, Phase 1, 2A, 2B, 3) | Dùng segmented control như prototype. |
| 6 | Placeholder "Tìm kiếm theo mã, tiêu đề task..." | "Tìm theo tiêu đề hoặc mã task…" | Dùng placeholder prototype. |
| 7 | User Switcher nằm trong `KanbanToolbar` | Nằm ở **header của View** (góc phải, cùng hàng tiêu đề) | Theo prototype: tách `UserSwitcher.tsx`, render trong `MyTasksView`. `KanbanToolbar` chỉ còn Search + Phase + Stats. |
| 8 | Drag-over `border-dashed border-2` | `ring-2 ring-{màu cột} bg-white` | Dùng ring theo màu cột như prototype. |
| 9 | Cột `max-h-[calc(100vh-220px)]` | Đã dùng đúng | Trong repo chính `<main>` còn sidebar/topbar nên offset 220px dễ sai: ưu tiên `flex-1 min-h-0` + `overflow-y-auto`; giữ `max-h-[calc(100vh-220px)]` chỉ làm fallback. |
| 10 | `isOverdue` là boolean từ DTO | Prototype tính theo `TODAY = 2026-10-02` và cả task `TODO` | Mock tính bằng `MOCK_NOW` cố định (mục 1.3). Backend thật: lấy từ `NODE.is_overdue` (job quét chỉ gán cho `IN_PROGRESS`/`REVIEW`, SSOT §5.2). Với mock hiện tại không có task `TODO` quá hạn nên không lệch. |

### 0.2 Mô hình phân công (Direct Push)
- Không có "Chấp nhận / Từ chối". Lead gán `assignedUserId` ⇒ task xuất hiện ngay trên bảng người đó (đã `TODO`, vì DAG đã mở khóa).
- `LOCKED` **không** xuất hiện trên bảng My Tasks (chưa làm được). Bảng chỉ có 4 cột.
- Không có nút "Nhận việc". Nút `Bắt đầu làm` thực hiện `TODO → IN_PROGRESS` trên task đã được gán.

### 0.3 Ma trận chuyển trạng thái (bắt buộc, đối chiếu SSOT §5.2)

| Từ → Đến | Collaborator (chủ task) | Owner | Ghi chú |
|---|---|---|---|
| `TODO → IN_PROGRESS` | ✅ trực tiếp | ✅ | Backend: kiểm tra `version` (optimistic locking) |
| `IN_PROGRESS → TODO` (Hủy nhận) | ✅ | ✅ | Giải phóng việc, SSOT §5.1 |
| `IN_PROGRESS → REVIEW` | ✅ **chỉ qua modal Artifact** | ✅ qua modal | Không bao giờ chuyển trực tiếp |
| `REVIEW → DONE` | ❌ toast chặn | ✅ (Duyệt) | Strict Review Constraint |
| `REVIEW → IN_PROGRESS` (Làm lại) | ❌ | ✅ | Owner nhập lý do ở bản thật (ngoài phạm vi) |
| `TODO → REVIEW` | ❌ | ❌ | "Cần bắt đầu làm trước khi nộp kết quả." |
| `REVIEW → TODO` | ❌ | ❌ | Không hợp lệ |
| `TODO/IN_PROGRESS → DONE` | ❌ | ❌ | Phải qua REVIEW |
| `DONE → *` | ❌ | ❌ | Đóng băng, thẻ `draggable=false` |

### 0.4 Lọc theo người dùng
User Switcher chỉ phục vụ demo/kiểm thử, bật bằng `VITE_ENABLE_USER_SWITCHER=true`. **Slice chỉ giữ task của `currentUserId`** (xóa `tasks` rồi fetch lại khi đổi user) nên task của người khác không bao giờ nằm trong store. Production: server tự lấy user từ JWT, bỏ qua tham số `userId`.

---

## PHẦN 1: DATA CONTRACTS & DI

### 1.1 `src/types/kanban.types.ts`

```ts
export type ISODateTime = string; // ISO-8601 có offset, vd "2026-10-06T23:59:59+07:00"

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';
export type ProjectRole = 'OWNER' | 'COLLABORATOR' | 'VIEWER';

export interface UserSummary {
  id: string;                 // bigint → string
  name: string;               // "Sarah Chen"
  roleTitle: string;          // "Frontend Dev"
  initials: string;           // "SC"
  avatarClass: string;        // "bg-indigo-500"
  projectRole: ProjectRole;   // quyết định quyền duyệt
  assignedTaskCount: number;  // hiển thị "5 tasks" trong switcher
}

export type ArtifactType = 'PR' | 'FIGMA' | 'DOCS' | 'ZIP';
export interface ArtifactItem {
  id: string;
  type: ArtifactType;
  url: string;
  note: string;               // có thể rỗng
  uploadedAt: ISODateTime;
  label?: string;             // ghi đè nhãn hiển thị (vd "Schema v1.0"); không có thì dùng artifactLabel()
}

export interface KanbanTask {
  id: string;
  code: string;               // "WPE-014"
  title: string;
  description: string;
  status: TaskStatus;
  assignedUserId: string;
  phaseId: PhaseId;
  phaseLabel: string;         // "Phase 2A · Auth"
  dueDate: ISODateTime;
  isOverdue: boolean;
  joinPolicySummary: string;  // chuỗi hiển thị: "AND-Join: 2 tiền đề đã xong" | "Artifact: PR Merged"
  artifacts: ArtifactItem[];
  version: number;            // NODE.version – optimistic locking (SSOT §4.5)
}

export type PhaseId = 'P1' | 'P2A' | 'P2B' | 'P3';
export type PhaseFilterId = 'ALL' | PhaseId;

export interface SubmitArtifactDto {
  taskId: string;
  type: ArtifactType;
  url: string;
  note: string;
}

export interface KanbanFilterState {
  searchKeyword: string;
  selectedPhaseId: PhaseFilterId;
}

/* ---- Domain: quyết định chuyển trạng thái ---- */
export type TransitionDecision =
  | { kind: 'allow' }
  | { kind: 'needs-artifact' }                 // mở SubmitArtifactModal
  | { kind: 'deny'; message: string };         // toast
```

> `phaseId/phaseLabel` **không có** trong 8 bảng SSOT §4 (không có bảng PHASE hay cột phase ở NODE). Cần thống nhất với backend: thêm bảng/cột, hoặc lưu trong `ui_metadata`. `ArtifactItem.type` và `note` cũng chưa có cột ở bảng `ARTIFACTS` (chỉ có `file_url`, `file_type`, `version`, `is_public_for_guest`): cần migration hoặc map tạm `PR/FIGMA/DOCS → file_type='link'`, `ZIP → 'zip'` và bỏ `note`. Ghi quyết định vào PR.

### 1.2 `src/services/contracts/IWorkflowService.ts` (bổ sung)

```ts
import type { KanbanTask, SubmitArtifactDto, ArtifactItem, TaskStatus, UserSummary } from '@/types/kanban.types';

export interface IWorkflowService {
  // ...giữ nguyên các method hiện có

  /** GET /api/projects/{pid}/my-tasks (server lấy user từ JWT; userId chỉ dùng cho mock/demo) */
  getMyTasks(projectId: string, userId: string): Promise<KanbanTask[]>;

  /** PATCH /api/tasks/{id}/status  body {status, version}
   *  Lỗi: 403 sai quyền · 409 version lệch · 422 chuyển trạng thái không hợp lệ */
  updateTaskStatus(taskId: string, newStatus: TaskStatus): Promise<KanbanTask>;

  /** POST /api/tasks/{id}/artifacts — tạo Artifact + chuyển REVIEW trong MỘT transaction.
   *  Lỗi: 422 URL không hợp lệ / task không ở IN_PROGRESS */
  submitTaskArtifact(dto: SubmitArtifactDto): Promise<{ task: KanbanTask; artifact: ArtifactItem }>;

  /** GET /api/projects/{pid}/members */
  getProjectMembers(projectId: string): Promise<UserSummary[]>;
}
```

### 1.3 Mock — `src/services/mock/MockWorkflowService.tasks.ts`

```ts
import type { IWorkflowService } from '@/services/contracts/IWorkflowService';
import type {
  KanbanTask, UserSummary, ArtifactItem, ArtifactType, PhaseId, TaskStatus, SubmitArtifactDto,
} from '@/types/kanban.types';
import { evaluateTransition } from '@/domain/taskTransitions';
import { artifactLabel } from '@/utils/artifactLabel';

const delay = (ms = 200) => new Promise<void>((r) => setTimeout(r, ms));
export const MOCK_NOW = Date.parse('2026-10-02T00:00:00+07:00');   // = TODAY của prototype

const PHASE_LABEL: Record<PhaseId, string> = {
  P1: 'Phase 1 · Foundation', P2A: 'Phase 2A · Auth', P2B: 'Phase 2B · Core', P3: 'Phase 3 · QA & Release',
};

const USERS_BASE = [
  { id: '1', name: 'Sarah Chen', roleTitle: 'Frontend Dev',        initials: 'SC', avatarClass: 'bg-indigo-500',  projectRole: 'COLLABORATOR' },
  { id: '2', name: 'Marcus Liu', roleTitle: 'Backend Dev',         initials: 'ML', avatarClass: 'bg-rose-500',    projectRole: 'COLLABORATOR' },
  { id: '3', name: 'Alex Kim',   roleTitle: 'Project Lead / Owner', initials: 'AK', avatarClass: 'bg-emerald-500', projectRole: 'OWNER' },
] as const satisfies readonly Omit<UserSummary, 'assignedTaskCount'>[];

const due = (d: string) => `${d}T23:59:59+07:00`;
const art = (id: string, type: ArtifactType, url: string, label?: string, note = ''): ArtifactItem =>
  ({ id, type, url, note, uploadedAt: '2026-09-30T09:00:00+07:00', ...(label ? { label } : {}) });

const mk = (
  id: string, code: string, title: string, description: string, phaseId: PhaseId, status: TaskStatus,
  assignedUserId: string, dueDay: string, joinPolicySummary: string, artifacts: ArtifactItem[] = [],
): KanbanTask => ({
  id, code, title, description, status, assignedUserId, phaseId, phaseLabel: PHASE_LABEL[phaseId],
  dueDate: due(dueDay), isOverdue: status !== 'DONE' && Date.parse(due(dueDay)) < MOCK_NOW,
  joinPolicySummary, artifacts, version: 0,
});

const SEED: KanbanTask[] = [
  // ── Sarah Chen (5) ──
  mk('1', 'WPE-021', 'Thiết kế UI Form đăng nhập', 'Dựng form Login/Register theo bản Figma, có validate phía client.', 'P2A', 'TODO', '1', '2026-10-06', 'AND-Join: 2 tiền đề đã xong'),
  mk('2', 'WPE-017', 'Bộ component Button / Input', 'Chuẩn hóa design token và các biến thể component dùng chung.', 'P1', 'DONE', '1', '2026-09-20', 'Artifact: Figma specs', [art('a2', 'FIGMA', 'https://figma.com/file/ds-core', 'Figma specs')]),
  mk('3', 'WPE-023', 'Layout Dashboard Overview', 'Lưới KPI, biểu đồ cột Weekly Velocity và cột phải.', 'P2B', 'IN_PROGRESS', '1', '2026-10-01', 'Artifact: PR Merged'),
  mk('4', 'WPE-025', 'Form khởi tạo dự án', 'Tạo dự án mới hoặc clone Template quy trình chuẩn.', 'P2B', 'REVIEW', '1', '2026-10-04', 'AND-Join: 1 tiền đề đã xong', [art('a4', 'PR', 'https://github.com/wpe/web/pull/42', undefined, 'Đã tự test trên Chrome/Safari.')]),
  mk('5', 'WPE-028', 'Gắn dữ liệu vào Canvas React Flow', 'Map NODE / NODE_DEPENDENCY sang node & edge, lưu toạ độ ui_metadata.', 'P2B', 'TODO', '1', '2026-10-10', 'OR-Join: 1/2 tiền đề đã xong'),
  // ── Marcus Liu (6) ──
  mk('6', 'WPE-014', 'Dịch vụ cấp phát JWT', 'Sinh/xác minh JWT, refresh token và chặn tài khoản bị khóa.', 'P2A', 'IN_PROGRESS', '2', '2026-09-28', 'Artifact: PR Merged'),
  mk('7', 'WPE-012', 'API Auth endpoints', 'POST /auth/register, /auth/login, GET /auth/me kèm DTO tách biệt Entity.', 'P2A', 'REVIEW', '2', '2026-10-01', 'AND-Join: 2 tiền đề đã xong', [art('a7', 'PR', 'https://github.com/wpe/api/pull/38', undefined, 'Cần Lead soát lại thời hạn JWT.')]),
  mk('8', 'WPE-009', 'Thiết kế Data Schema PostgreSQL', '8 bảng chuẩn hóa, JSONB cho guest_access / ui_metadata.', 'P1', 'DONE', '2', '2026-09-18', 'Artifact: Tài liệu API', [art('a8', 'DOCS', 'https://docs.wpe.io/schema', 'Schema v1.0')]),
  mk('9', 'WPE-016', 'Claim Node bằng Optimistic Locking', "UPDATE ... WHERE status='TODO' AND version=:v, trả 409 nếu 0 dòng.", 'P2B', 'TODO', '2', '2026-10-08', 'AND-Join: 2 tiền đề đã xong'),
  mk('10', 'WPE-019', 'Thuật toán Kahn kiểm tra chu trình', 'Chặn DRAFT → ACTIVE nếu đồ thị có vòng, trả danh sách node vi phạm.', 'P2B', 'IN_PROGRESS', '2', '2026-10-07', 'Artifact: PR Merged'),
  mk('11', 'WPE-030', 'Scheduled Job quét trễ hạn', 'Gán is_overdue cho node IN_PROGRESS / REVIEW quá due_date.', 'P3', 'TODO', '2', '2026-10-14', 'OR-Join: 1/2 tiền đề đã xong'),
  // ── Alex Kim (3) ──
  mk('12', 'WPE-005', 'Kickoff & chốt SSOT', 'Chốt phạm vi MVP, RBAC matrix và vòng đời trạng thái.', 'P1', 'DONE', '3', '2026-09-10', 'Artifact: Tài liệu API', [art('a12', 'DOCS', 'https://docs.wpe.io/ssot', 'SSOT v1')]),
  mk('13', 'WPE-032', 'Rà soát chính sách nghiệm thu Artifact', 'Thống nhất định dạng minh chứng bắt buộc trước khi Review.', 'P2B', 'REVIEW', '3', '2026-10-03', 'Artifact: Tài liệu API', [art('a13', 'DOCS', 'https://docs.wpe.io/review-policy', 'Review policy', 'Bản nháp chờ chốt.')]),
  mk('14', 'WPE-034', 'Checklist phát hành bản MVP', 'Danh mục kiểm tra trước khi chuyển Phase 3 sang Release.', 'P3', 'TODO', '3', '2026-10-12', 'AND-Join: 3 tiền đề đã xong'),
];

export class MockTaskApi implements Pick<IWorkflowService,
  'getMyTasks' | 'updateTaskStatus' | 'submitTaskArtifact' | 'getProjectMembers'> {
  private tasks: KanbanTask[] = structuredClone(SEED);

  async getMyTasks(_pid: string, userId: string) {
    await delay();
    return structuredClone(this.tasks.filter((t) => t.assignedUserId === userId));
  }

  async getProjectMembers(_pid: string): Promise<UserSummary[]> {
    await delay(100);
    return USERS_BASE.map((u) => ({ ...u, assignedTaskCount: this.tasks.filter((t) => t.assignedUserId === u.id).length }));
  }

  async updateTaskStatus(taskId: string, newStatus: TaskStatus) {
    await delay(150);
    const t = this.tasks.find((x) => x.id === taskId);
    if (!t) throw new Error('Không tìm thấy task');
    const actor = USERS_BASE.find((u) => u.id === t.assignedUserId)!;   // mock: coi actor là người được giao; backend thật dùng JWT
    const d = evaluateTransition(t, newStatus, actor);
    if (d.kind !== 'allow') throw new Error(d.kind === 'deny' ? d.message : 'Cần nộp Artifact');
    t.status = newStatus; t.version += 1;
    return structuredClone(t);
  }

  async submitTaskArtifact(dto: SubmitArtifactDto) {
    await delay(200);
    const t = this.tasks.find((x) => x.id === dto.taskId);
    if (!t || t.status !== 'IN_PROGRESS') throw new Error('Chỉ nộp được task đang thực hiện');
    const artifact: ArtifactItem = { id: `a${Date.now()}`, type: dto.type, url: dto.url, note: dto.note, uploadedAt: new Date().toISOString() };
    t.artifacts.push(artifact); t.status = 'REVIEW'; t.version += 1;
    return structuredClone({ task: t, artifact });
  }
}
```
> Test mock phải khẳng định: 14 task; `assignedTaskCount` = 5/6/3; task quá hạn = `WPE-023`, `WPE-014`, `WPE-012`.

### 1.4 DI & hằng/hàm dùng chung

```ts
// src/services/container.ts — một điểm duy nhất chọn implementation
export const workflowService: IWorkflowService =
  import.meta.env.VITE_USE_MOCK === 'true' ? new MockWorkflowService() : new HttpWorkflowService();
```

```ts
// src/utils/artifactLabel.ts
import type { ArtifactItem, ArtifactType } from '@/types/kanban.types';
export const ARTIFACT_TYPE_OPTIONS: { value: ArtifactType; label: string }[] = [
  { value: 'PR', label: 'GitHub PR Link' }, { value: 'FIGMA', label: 'Figma URL' },
  { value: 'DOCS', label: 'Tài liệu API' },  { value: 'ZIP', label: 'Zip' },
];
export function artifactLabel(a: Pick<ArtifactItem, 'type' | 'url' | 'label'>): string {
  if (a.label) return a.label;
  const pr = /\/pull\/(\d+)/.exec(a.url);
  if (a.type === 'PR' && pr) return `PR #${pr[1]}`;
  if (a.type === 'FIGMA') return 'Figma specs';
  if (a.type === 'ZIP') return 'File .zip';
  return ARTIFACT_TYPE_OPTIONS.find((o) => o.value === a.type)!.label;
}
export const isValidArtifactUrl = (u: string) => /^https?:\/\/\S+\.\S+/.test(u.trim());
```

```ts
// src/utils/date.ts
export const fmtDayMonth = (iso: string) => { const d = new Date(iso); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`; };
```

---

## PHẦN 2: CẤU TRÚC THƯ MỤC

```text
src/
├── types/kanban.types.ts
├── domain/taskTransitions.ts                      # hàm thuần: ma trận 0.3 (+ test)
├── services/
│   ├── contracts/IWorkflowService.ts
│   ├── mock/MockWorkflowService.tasks.ts
│   ├── http/HttpWorkflowService.tasks.ts          # bản thật (sau)
│   └── container.ts
├── store/slices/kanbanSlice.ts
├── hooks/useClickOutside.ts                       # useDismiss(isOpen, onClose, refs) — dùng chung với Overview
├── utils/{artifactLabel.ts, date.ts}
└── components/
    ├── views/MyTasksView.tsx
    └── kanban/
        ├── UserSwitcher.tsx                       # (thêm so với đề bài – theo prototype)
        ├── KanbanToolbar.tsx                      # Search + Phase filter + Stats
        ├── KanbanBoard.tsx
        ├── KanbanColumn.tsx
        ├── TaskCard.tsx
        └── SubmitArtifactModal.tsx
```
**Luật phụ thuộc:** `components → store → services/contracts`; `domain` không import React/Zustand. Card/Column/Modal là component trình bày (props-only); `MyTasksView` là container duy nhất đọc store.

---

## PHẦN 3: ĐẶC TẢ GIAO DIỆN & TƯƠNG TÁC

### 3.0 `MyTasksView` (container)

```tsx
<div className="h-full overflow-hidden flex flex-col p-6 bg-slate-50">
  <div className="flex flex-wrap items-center justify-between gap-4">
    <div>
      <h1 className="text-xl font-bold tracking-tight">My Tasks</h1>
      <p className="text-xs text-slate-500 mt-1">Bảng Kanban cá nhân · {projectName} · Task do Lead giao hiển thị trực tiếp, không cần xác nhận</p>
    </div>
    {enableSwitcher && <UserSwitcher members={members} currentUserId={currentUserId} onSelect={setUserId} />}
  </div>
  <KanbanToolbar ... />
  <KanbanBoard ... />
  {isSubmitModalOpen && submittingTask && <SubmitArtifactModal ... />}
  {toast && <Toast message={toast} />}   {/* fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-xl z-[70] */}
</div>
```
Mount: `useEffect` gọi `loadMembers(projectId)` một lần, `loadTasks(projectId)` khi đổi `currentUserId`. Trạng thái `loading/error/empty` có skeleton/`ErrorState` riêng.

### 3.1 `UserSwitcher`
- Pill: `flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-full border text-sm transition`; đóng `bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50`; mở `bg-indigo-50 border-indigo-400 ring-2 ring-indigo-100`. Avatar `w-7 h-7 text-[11px]`, tên `font-semibold`, vai trò `text-[11px] text-slate-500`, chevron xoay 180° khi mở. `aria-haspopup="listbox" aria-expanded`.
- Dropdown: `pop-in absolute right-0 top-full mt-2 w-72 z-40 bg-white border border-slate-200 rounded-2xl shadow-2xl p-1.5`, `transformOrigin: top right`; nhãn `Xem với tư cách (giả lập)` (`text-[11px] font-semibold uppercase tracking-wide text-slate-400`). Mỗi dòng `role="option"`: avatar `w-8 h-8`, `👤 {name}`, `{roleTitle}`, chip `{assignedTaskCount} tasks` (`bg-slate-100 text-slate-600`), dấu tích khi đang chọn; dòng chọn `bg-indigo-50`.
- Đóng: `useDismiss(open, close, [ref])` (mousedown ngoài + `Escape`). Chọn user ⇒ `setUserId(id)` **đồng thời reset** `searchQuery=''` và `filterPhaseId='ALL'`.

### 3.2 `KanbanToolbar`
- Search: `w-72 pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400`, icon kính lúp `absolute left-3`, placeholder `Tìm theo tiêu đề hoặc mã task…`. Khớp không phân biệt hoa/thường trên `title` và `code`.
- Phase: `flex bg-slate-100 rounded-lg p-1`; nút `px-3 py-1.5 text-sm rounded-md font-medium transition`; chọn `bg-white shadow text-indigo-700`, thường `text-slate-500 hover:text-slate-800`. 5 lựa chọn: `ALL=Tất cả`, `P1=Phase 1`, `P2A=Phase 2A`, `P2B=Phase 2B`, `P3=Phase 3`.
- Stats (`ml-auto`, `bg-white border border-slate-200 rounded-lg px-3.5 py-2`): `Tổng: {n} việc | Đang làm: {m} | Trễ hạn: {k}`; `Đang làm` màu `text-blue-600`; `Trễ hạn` `text-red-600` khi > 0. **Stats tính trên toàn bộ task của user (trước search/phase filter)**, không phải trên danh sách đã lọc.

### 3.3 `KanbanBoard` / `KanbanColumn`
Lưới: `mt-5 flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4`.

| Cột | `title` / `en` | Header class | Badge | Ring khi drag-over |
|---|---|---|---|---|
| `TODO` | Chờ thực hiện / To Do | `bg-sky-100 text-sky-800` | `bg-sky-200 text-sky-800` | `ring-sky-300` |
| `IN_PROGRESS` | Đang thực hiện / In Progress | `bg-blue-600 text-white` | `bg-white/25 text-white` | `ring-blue-300` |
| `REVIEW` | Chờ duyệt / In Review | `bg-violet-100 text-violet-800` | `bg-violet-200 text-violet-800` | `ring-violet-300` |
| `DONE` | Hoàn thành / Done | `bg-emerald-100 text-emerald-800` | `bg-emerald-200 text-emerald-800` | `ring-emerald-300` |

- Section: `flex flex-col rounded-2xl bg-slate-100/70 border transition`; đang kéo qua: `ring-2 {ring} border-transparent bg-white`, thường `border-slate-200`.
- Header: `flex items-center justify-between px-4 py-3 rounded-t-2xl {head}` — chấm màu `w-2 h-2 rounded-full` (cột IN_PROGRESS dùng `bg-white`), `h2 text-sm font-bold`, nhãn tiếng Anh `text-[11px] font-medium opacity-70`, badge `text-xs font-bold min-w-[22px] text-center px-1.5 py-0.5 rounded-full`.
- Vùng thẻ: `p-3 space-y-3 overflow-y-auto flex-1 min-h-0` (+ fallback `max-h-[calc(100vh-220px)]`); scrollbar mảnh 6px `#cbd5e1`.
- Rỗng: `text-center text-xs text-slate-400 border border-dashed border-slate-300 rounded-xl py-8`; chữ `Không có task khớp bộ lọc` khi đang lọc, ngược lại `Chưa có task`.
- **Drag & Drop (HTML5):** `onDragOver` ⇒ `preventDefault()` + `setOverCol`; `onDragLeave` chỉ clear khi `!currentTarget.contains(relatedTarget)`; `onDrop` ⇒ `moveTask(taskId, col)`. `dataTransfer.setData('text/plain', id)` và giữ `dragId` trong local state (fallback đọc từ `dataTransfer`). Thẻ đang kéo `opacity-40`. Cột/thẻ **luôn nhận drop**, quyết định cho/không do `moveTask` (hiện toast), không tự chặn bằng UI để người dùng thấy lý do.

### 3.4 `TaskCard`
```tsx
<article draggable={t.status !== 'DONE'}
  className={`fade-up bg-white rounded-xl border p-4 shadow-sm transition
    ${frozen ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 hover:shadow-md hover:border-slate-300'}
    ${draggable ? 'cursor-grab active:cursor-grabbing' : ''} ${dragging ? 'opacity-40' : ''}`}>
  {/* Header */}
  <div className="flex items-center gap-1.5 flex-wrap">
    <span className="text-[11px] font-bold font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">{t.code}</span>
    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">{t.phaseLabel}</span>
    {t.isOverdue && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex items-center gap-1"><AlertIcon className="w-3 h-3" />Trễ hạn</span>}
    {frozen && <span className="ml-auto w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center"><CheckIcon className="w-3 h-3" /></span>}
  </div>
  <h3 className={`mt-2.5 text-sm font-bold leading-snug ${frozen ? 'text-slate-600' : 'text-slate-900'}`}>{t.title}</h3>
  <p className="mt-1 text-xs text-slate-500 leading-relaxed line-clamp-2">{t.description}</p>
  {/* Prerequisites */}
  <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-slate-500 bg-slate-50 border border-slate-100 rounded-md px-2 py-1">
    {frozen ? <LockIcon className="w-3 h-3 shrink-0" /> : <CheckIcon className="w-3 h-3 shrink-0" />}{t.joinPolicySummary}
  </div>
  {/* Artifact tag (REVIEW/DONE) */}
  {latest && <span title={latest.url} className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-md bg-violet-50 text-violet-700 border border-violet-100"><ClipIcon className="w-3 h-3" />{artifactLabel(latest)}</span>}
  {/* Footer */}
  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
    <div className="flex items-center gap-2 min-w-0">
      <span className={`flex items-center gap-1 text-xs font-medium ${t.isOverdue ? 'text-red-600' : 'text-slate-500'}`}><CalendarIcon className="w-3.5 h-3.5" />{fmtDayMonth(t.dueDate)}</span>
      <span className="flex items-center gap-1 text-xs text-slate-500 min-w-0"><Avatar u={assignee} /><b className="font-semibold text-slate-600">{assignee.initials}</b></span>
    </div>
    <div className="flex items-center gap-1.5 shrink-0">{actions}</div>
  </div>
</article>
```
`latest` = artifact cuối của `t.artifacts`. Thẻ `<a>` artifact trong prototype chặn điều hướng; bản thật mở `target="_blank" rel="noreferrer noopener"` (URL đã qua `isValidArtifactUrl`).

**Nút nhanh theo cột** (`Btn`: `flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition`):

| Cột | Điều kiện | Nút |
|---|---|---|
| `TODO` | — | `Bắt đầu làm` `text-white bg-blue-600 hover:bg-blue-700` (icon play) → `moveTask(id,'IN_PROGRESS')` |
| `IN_PROGRESS` | — | `Hủy nhận` `text-slate-600 bg-slate-100 hover:bg-slate-200` → `moveTask(id,'TODO')`; `Nộp kết quả` `text-white bg-violet-600 hover:bg-violet-700` → `moveTask(id,'REVIEW')` (mở modal) |
| `REVIEW` | actor là `OWNER` | `Làm lại` (slate) → `IN_PROGRESS`; `Duyệt` `text-white bg-emerald-600 hover:bg-emerald-700` → `DONE` |
| `REVIEW` | actor khác | chỉ nhãn `Chờ Lead nghiệm thu` (`text-[11px] font-medium text-violet-600`, icon đồng hồ), **không có nút** |
| `DONE` | — | nhãn `Đã nghiệm thu` (`text-[11px] font-semibold text-emerald-600`) |

### 3.5 `SubmitArtifactModal`
- Overlay: `fixed inset-0 z-50 flex items-center justify-center p-4`; backdrop `fade-in absolute inset-0 bg-slate-900/40` (đóng bằng `onMouseDown`); hộp `pop-in relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200`, `role="dialog"`.
- Header: `Nộp kết quả (Submit Artifact)` + `<b class="font-mono">{code}</b> · {title}`, nút X. Footer `bg-slate-50/70 rounded-b-2xl`: `Hủy` và `Nộp nghiệm thu` (`text-white bg-violet-600 hover:bg-violet-700`, icon upload).
- Trường: **Loại tài liệu** (`<select>` từ `ARTIFACT_TYPE_OPTIONS`, mặc định `PR`), **URL minh chứng** (bắt buộc, placeholder `https://github.com/repo/pull/128`), **Ghi chú bàn giao** (`textarea rows=3`, `resize-none`, tùy chọn).
- Validate: `!isValidArtifactUrl(url)` ⇒ không submit, hiện `Vui lòng nhập URL hợp lệ (bắt đầu bằng http:// hoặc https://).` dưới ô (viền `border-red-300 focus:ring-red-100`); sửa input thì xóa lỗi.
- Đóng: nút X, `Hủy`, click backdrop, `Escape`. Submit thành công ⇒ đóng modal, toast `Đã nộp {code}: chờ Lead nghiệm thu.`. Đang gọi API thì disable nút và hiện `Đang nộp…`. Lỗi API ⇒ giữ modal, hiện toast lỗi.

---

## PHẦN 4: STATE MANAGEMENT (ZUSTAND + IMMER)

### 4.1 `src/domain/taskTransitions.ts` — hàm thuần, nguồn duy nhất của ma trận 0.3

```ts
import type { KanbanTask, TaskStatus, TransitionDecision, UserSummary } from '@/types/kanban.types';

export function evaluateTransition(
  task: Pick<KanbanTask, 'status' | 'assignedUserId'>,
  to: TaskStatus,
  actor: Pick<UserSummary, 'id' | 'projectRole'>,
): TransitionDecision {
  const from = task.status;
  const isOwner = actor.projectRole === 'OWNER';
  if (from === to) return { kind: 'deny', message: '' };                       // no-op, không toast
  if (task.assignedUserId !== actor.id) return { kind: 'deny', message: 'Bạn chỉ thao tác được trên task của mình.' };
  if (from === 'DONE') return { kind: 'deny', message: 'Task đã DONE nên bị đóng băng, không thể thay đổi.' };

  if (to === 'DONE') {
    if (!isOwner) return { kind: 'deny', message: 'Chỉ Owner mới có quyền duyệt sang DONE (Strict Review Constraint).' };
    if (from !== 'REVIEW') return { kind: 'deny', message: 'Task phải qua bước Chờ duyệt trước khi Owner nghiệm thu.' };
    return { kind: 'allow' };
  }
  switch (`${from}>${to}`) {
    case 'TODO>IN_PROGRESS':        return { kind: 'allow' };
    case 'IN_PROGRESS>TODO':        return { kind: 'allow' };
    case 'IN_PROGRESS>REVIEW':      return { kind: 'needs-artifact' };
    case 'TODO>REVIEW':             return { kind: 'deny', message: 'Cần bắt đầu làm trước khi nộp kết quả.' };
    case 'REVIEW>IN_PROGRESS':      return isOwner ? { kind: 'allow' } : { kind: 'deny', message: 'Chỉ Owner mới có thể yêu cầu làm lại task đang chờ duyệt.' };
    case 'REVIEW>TODO':             return { kind: 'deny', message: 'Không thể trả task đang chờ duyệt về Chờ thực hiện.' };
    default:                        return { kind: 'deny', message: 'Chuyển trạng thái không hợp lệ.' };
  }
}
```
Thông báo toast thành công: `Bắt đầu làm {code}.` · `Đã hủy nhận {code}, trả về Chờ thực hiện.` · `Đã duyệt {code}: chuyển sang Hoàn thành.` · `{code} bị trả lại để chỉnh sửa.`

### 4.2 `src/store/slices/kanbanSlice.ts`

```ts
import type { StateCreator } from 'zustand';
import type { KanbanTask, PhaseFilterId, SubmitArtifactDto, TaskStatus, UserSummary } from '@/types/kanban.types';
import { workflowService } from '@/services/container';
import { evaluateTransition } from '@/domain/taskTransitions';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface KanbanSlice {
  kanban: {
    members: UserSummary[];
    tasks: KanbanTask[];                // CHỈ task của currentUserId
    currentUserId: string;
    filterPhaseId: PhaseFilterId;
    searchQuery: string;
    isSubmitModalOpen: boolean;
    submittingTaskId: string | null;
    pendingTaskIds: string[];           // chặn thao tác chồng khi đang gọi API
    status: LoadStatus;
    error: string | null;
    toast: string | null;

    loadMembers: (projectId: string) => Promise<void>;
    loadTasks: (projectId: string) => Promise<void>;
    setUserId: (projectId: string, userId: string) => Promise<void>;
    setFilterPhase: (id: PhaseFilterId) => void;
    setSearchQuery: (q: string) => void;
    moveTask: (taskId: string, to: TaskStatus) => Promise<void>;
    closeSubmitModal: () => void;
    submitArtifact: (dto: Omit<SubmitArtifactDto, 'taskId'>) => Promise<boolean>;
    showToast: (msg: string) => void;
  };
}

export const createKanbanSlice: StateCreator<KanbanSlice, [['zustand/immer', never]], [], KanbanSlice> = (set, get) => {
  const k = () => get().kanban;
  const actor = () => k().members.find((m) => m.id === k().currentUserId);
  const SUCCESS: Partial<Record<string, (c: string) => string>> = {
    'TODO>IN_PROGRESS': (c) => `Bắt đầu làm ${c}.`,
    'IN_PROGRESS>TODO': (c) => `Đã hủy nhận ${c}, trả về Chờ thực hiện.`,
    'REVIEW>DONE':      (c) => `Đã duyệt ${c}: chuyển sang Hoàn thành.`,
    'REVIEW>IN_PROGRESS': (c) => `${c} bị trả lại để chỉnh sửa.`,
  };

  return { kanban: {
    members: [], tasks: [], currentUserId: '1', filterPhaseId: 'ALL', searchQuery: '',
    isSubmitModalOpen: false, submittingTaskId: null, pendingTaskIds: [],
    status: 'idle', error: null, toast: null,

    loadMembers: async (pid) => {
      const members = await workflowService.getProjectMembers(pid);
      set((s) => { s.kanban.members = members; });
    },

    loadTasks: async (pid) => {
      set((s) => { s.kanban.status = 'loading'; s.kanban.error = null; });
      try {
        const tasks = await workflowService.getMyTasks(pid, k().currentUserId);
        set((s) => { s.kanban.tasks = tasks; s.kanban.status = 'ready'; });
      } catch (e) {
        set((s) => { s.kanban.status = 'error'; s.kanban.error = e instanceof Error ? e.message : 'Không tải được task'; });
      }
    },

    setUserId: async (pid, userId) => {
      if (userId === k().currentUserId) return;
      set((s) => {                       // xóa ngay task cũ → không lộ dữ liệu người trước
        s.kanban.currentUserId = userId; s.kanban.tasks = [];
        s.kanban.searchQuery = ''; s.kanban.filterPhaseId = 'ALL';
        s.kanban.isSubmitModalOpen = false; s.kanban.submittingTaskId = null;
      });
      await get().kanban.loadTasks(pid);
      await get().kanban.loadMembers(pid);  // cập nhật assignedTaskCount
    },

    setFilterPhase: (id) => set((s) => { s.kanban.filterPhaseId = id; }),
    setSearchQuery: (q) => set((s) => { s.kanban.searchQuery = q; }),

    moveTask: async (taskId, to) => {
      const task = k().tasks.find((t) => t.id === taskId);
      const me = actor();
      if (!task || !me || k().pendingTaskIds.includes(taskId)) return;

      const d = evaluateTransition(task, to, me);
      if (d.kind === 'deny') { if (d.message) get().kanban.showToast(d.message); return; }
      if (d.kind === 'needs-artifact') {                       // KHÔNG optimistic: chưa có Artifact thì không đổi cột
        set((s) => { s.kanban.isSubmitModalOpen = true; s.kanban.submittingTaskId = taskId; });
        return;
      }

      const prev = task.status;
      set((s) => {                                             // optimistic update
        const t = s.kanban.tasks.find((x) => x.id === taskId)!;
        t.status = to; s.kanban.pendingTaskIds.push(taskId);
      });
      try {
        const saved = await workflowService.updateTaskStatus(taskId, to);
        set((s) => {
          const i = s.kanban.tasks.findIndex((x) => x.id === taskId);
          if (i >= 0) s.kanban.tasks[i] = saved;               // lấy version mới từ server
        });
        const msg = SUCCESS[`${prev}>${to}`]; if (msg) get().kanban.showToast(msg(task.code));
      } catch (e) {
        set((s) => { const t = s.kanban.tasks.find((x) => x.id === taskId); if (t) t.status = prev; });   // rollback
        get().kanban.showToast(e instanceof Error && e.message ? e.message : 'Không thể cập nhật trạng thái. Vui lòng thử lại.');
      } finally {
        set((s) => { s.kanban.pendingTaskIds = s.kanban.pendingTaskIds.filter((id) => id !== taskId); });
      }
    },

    closeSubmitModal: () => set((s) => { s.kanban.isSubmitModalOpen = false; s.kanban.submittingTaskId = null; }),

    submitArtifact: async (form) => {
      const id = k().submittingTaskId; const task = k().tasks.find((t) => t.id === id);
      if (!id || !task) return false;
      try {
        const { task: saved } = await workflowService.submitTaskArtifact({ taskId: id, ...form });
        set((s) => {
          const i = s.kanban.tasks.findIndex((x) => x.id === id); if (i >= 0) s.kanban.tasks[i] = saved;
          s.kanban.isSubmitModalOpen = false; s.kanban.submittingTaskId = null;
        });
        get().kanban.showToast(`Đã nộp ${task.code}: chờ Lead nghiệm thu.`);
        return true;
      } catch (e) {
        get().kanban.showToast(e instanceof Error && e.message ? e.message : 'Không thể nộp kết quả. Vui lòng thử lại.');
        return false;
      }
    },

    showToast: (msg) => {
      set((s) => { s.kanban.toast = msg; });
      setTimeout(() => { if (k().toast === msg) set((s) => { s.kanban.toast = null; }); }, 2600);
    },
  }};
};
```

### 4.3 Selector / state cục bộ
```ts
// KHÔNG trả mảng mới trực tiếp từ selector Zustand; chọn state thô rồi useMemo ở container.
const visible = useMemo(() => {
  const kw = searchQuery.trim().toLowerCase();
  return tasks.filter((t) =>
    (filterPhaseId === 'ALL' || t.phaseId === filterPhaseId) &&
    (!kw || t.title.toLowerCase().includes(kw) || t.code.toLowerCase().includes(kw)));
}, [tasks, filterPhaseId, searchQuery]);
const stats = useMemo(() => ({
  total: tasks.length,
  doing: tasks.filter((t) => t.status === 'IN_PROGRESS').length,
  late: tasks.filter((t) => t.isOverdue).length,
}), [tasks]);
```

| State | Nơi lưu |
|---|---|
| `members`, `tasks`, `currentUserId`, filter, search, modal, toast, pending | **Zustand** (sống qua chuyển tab Sidebar) |
| `dragId`, `overCol` | **Local** trong `KanbanBoard` |
| `open` của UserSwitcher; `type/url/note/err/submitting` của modal | **Local** |

---

## PHẦN 5: ACCEPTANCE CRITERIA

### 5.1 Bắt buộc
- [ ] `tsc --noEmit` pass với `strict: true`; không `any`, không `@ts-ignore`; ESLint (`react-hooks/exhaustive-deps`) pass.
- [ ] **Lọc theo user:** đổi user trong switcher ⇒ bảng đổi ngay; số task đúng 5 / 6 / 3; không có task nào có `assignedUserId` khác `currentUserId` trong `store.kanban.tasks` ở bất kỳ thời điểm nào (kể cả trong lúc loading).
- [ ] **Strict Review:** mọi đường đi tới `REVIEW` (kéo thả hoặc nút) đều mở `SubmitArtifactModal`; task **không đổi cột** cho tới khi nộp thành công; hủy modal thì task giữ nguyên.
- [ ] Collaborator kéo/bấm sang `DONE` ⇒ toast chặn, task không đổi; không thấy nút `Duyệt`/`Làm lại`. Owner thấy và dùng được.
- [ ] Task `DONE`: `draggable=false`, không có nút chuyển, hiển thị dấu tích + `Đã nghiệm thu`.
- [ ] Optimistic update: thẻ nhảy cột ngay; service lỗi ⇒ trả về cột cũ + toast lỗi; không double-submit khi đang pending.
- [ ] Modal: validate URL; đóng bằng X / Hủy / backdrop / `Escape`; ghim tag minh chứng đúng (`PR #128` từ `/pull/128`).
- [ ] Layout: Board vừa trong `<main>` của `App.tsx`, mỗi cột cuộn dọc riêng, trang không xuất hiện thanh cuộn ngoài; đẹp ở ≥ 1280px (4 cột), xuống 2 cột `< xl`, 1 cột `< md`.
- [ ] Chuyển tab Sidebar sang tab khác rồi quay lại: giữ nguyên user, filter, task (không refetch khi `status === 'ready'`).
- [ ] Mock hiển thị giống hệt prototype (so ảnh chụp 3 user).

### 5.2 Test gợi ý (Vitest + RTL)
```ts
const sarah = { id: '1', projectRole: 'COLLABORATOR' } as const;
const alex  = { id: '3', projectRole: 'OWNER' } as const;

it.each([
  ['TODO','IN_PROGRESS','allow'], ['IN_PROGRESS','TODO','allow'], ['IN_PROGRESS','REVIEW','needs-artifact'],
  ['TODO','REVIEW','deny'], ['REVIEW','TODO','deny'], ['REVIEW','DONE','deny'], ['REVIEW','IN_PROGRESS','deny'], ['DONE','TODO','deny'],
] as const)('Collaborator %s → %s = %s', (from, to, kind) => {
  expect(evaluateTransition({ status: from, assignedUserId: '1' }, to, sarah).kind).toBe(kind);
});
it('Owner duyệt REVIEW → DONE', () =>
  expect(evaluateTransition({ status: 'REVIEW', assignedUserId: '3' }, 'DONE', alex).kind).toBe('allow'));
it('Owner không duyệt task TODO thẳng sang DONE', () =>
  expect(evaluateTransition({ status: 'TODO', assignedUserId: '3' }, 'DONE', alex).kind).toBe('deny'));

it('mock: 14 task, đếm 5/6/3, quá hạn = WPE-023/014/012', async () => { /* getProjectMembers + getMyTasks */ });
it('setUserId xóa tasks ngay trước khi fetch', async () => { /* kiểm tra tasks === [] ở state trung gian */ });
it('moveTask → REVIEW không đổi status, chỉ mở modal', () => { /* status giữ IN_PROGRESS, isSubmitModalOpen === true */ });
it('moveTask rollback khi updateTaskStatus reject', async () => { /* status trở lại giá trị cũ */ });
it('artifactLabel: PR #128 từ /pull/128; có label thì ưu tiên label', () => { /* ... */ });
```

### 5.3 Ngoài phạm vi
Cột `LOCKED`, tạo/gán task (Lead push), nhập lý do khi `Làm lại`, đính kèm file thật (Storage Service), real-time đồng bộ nhiều người, sắp xếp thứ tự thẻ trong cột. Các phần này giữ nguyên hành vi mock/toast như prototype.

### 5.4 Khi nối backend thật
1. `getMyTasks`: server suy ra user từ JWT; trả đúng task có `assigned_user_id = principal`, status ∈ `TODO/IN_PROGRESS/REVIEW/DONE`.
2. `updateTaskStatus`: `UPDATE node SET status=?, version=version+1 WHERE id=? AND version=?` (SSOT §5.2); 0 dòng ⇒ `409`. Kiểm quyền ở service layer: chỉ `OWNER` được sang `DONE` hoặc `REVIEW → IN_PROGRESS` (`403`).
3. `submitTaskArtifact`: một transaction tạo bản ghi `ARTIFACTS` + chuyển `IN_PROGRESS → REVIEW`; thiếu URL hợp lệ ⇒ `422`. Quyết định schema cho `type`/`note` (mục 1.1).
4. Overdue: dùng `NODE.is_overdue` do Scheduled Job gán, không tính ở FE.
5. Id `Long` ⇒ JSON string; thời gian ISO-8601 có offset.
