# TECHNICAL SPECIFICATION & IMPLEMENTATION BLUEPRINT — OVERVIEW SCREEN

**Dự án:** Workflow Pipeline Engine · **Stack FE:** React 18 + TypeScript (strict) + Tailwind CSS + Zustand + Clean Architecture
**Nguồn chuẩn:** Prototype `overview.html` (single-file React) đã thống nhất. Tài liệu này là SSOT cho AI Coding Agent.

> **Quy tắc cho Agent:** Mọi class Tailwind, text tiếng Việt, số liệu mock trong tài liệu này phải được giữ nguyên 1:1 với prototype. Không thêm thư viện biểu đồ. Không dùng `any`.

---

## 0. GHI CHÚ ĐỐI CHIẾU PROTOTYPE (đọc trước khi code)

| # | Vấn đề | Quyết định |
|---|--------|-----------|
| 1 | Mock `TaskStatusBreakdown` cộng ra **51 tasks** (23+13+9+6) nhưng KPI ghi **24 nodes**, 72% hoàn tất | Giữ nguyên mock theo prototype. Khi nối API thật, `StatusBreakdown` PHẢI được tính từ `NODE.status` nên tổng = `totalNodes`. Có test đối soát ở mục 5. |
| 2 | State machine có `REVIEW` nhưng khối breakdown chỉ có 4 trạng thái | Giữ 4 trạng thái theo prototype. Type dùng `Exclude<NodeStatus,'REVIEW'>`; `pendingReviewCount` hiển thị ở KPI thứ 4. |
| 3 | Prototype không có Toggle Switch cho Guest Link | Dùng 2 nút: `Revoke` (khi active) và `Generate New Token` (khi đã khóa). Không thêm switch. |
| 4 | Yêu cầu AI popover `-translate-x-1/2` | **Không dùng `transform` để căn giữa**: keyframe `popIn` ghi đè `transform` gây giật lệch. Dùng `fixed inset-x-0 mx-auto w-[calc(100%-4rem)] max-w-5xl` (tương đương hình học). |
| 5 | `top-[74px]` cố định | Header thực tế ~90px. `top` = `button.bottom + 12` đo bằng `getBoundingClientRect()`. |
| 6 | Tailwind `animate-in/zoom-in-95` | Không có trong Tailwind core → khai báo keyframe `popIn`, `fadeIn`, `fadeUp`, `grow`, `spin360` trong `tailwind.config.ts` (mục 3.9). |
| 7 | `id` của `<linearGradient>` SVG | Phải duy nhất mỗi instance (`useId()`), tránh trùng khi render nhiều Sparkle. |

---

## PHẦN 1: DATA CONTRACTS & DI

### 1.1 `src/types/overview.types.ts`

```ts
/** Khớp CHECK constraint bảng NODE.status (SSOT §4.5) */
export type NodeStatus = 'LOCKED' | 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';
/** Khối breakdown của Overview chỉ hiển thị 4 trạng thái */
export type BreakdownStatus = Exclude<NodeStatus, 'REVIEW'>;

export type ISODateTime = string; // ISO-8601 có múi giờ, vd "2026-10-02T08:30:00Z"

/* ---------- KPI ---------- */
export interface OverviewMetrics {
  totalNodes: number;          // 24
  criticalPathNodes: number;   // 8
  completedNodes: number;      // 17
  completionRate: number;      // 72 (0..100)
  overdueCount: number;        // 4
  blockingReleaseCount: number;// 2
  pendingReviewCount: number;  // 3
}

/* ---------- Weekly Velocity ---------- */
export type WeekdayLabel = 'T2' | 'T3' | 'T4' | 'T5' | 'T6' | 'T7' | 'CN';
export interface DailyVelocity {
  day: WeekdayLabel;
  tasks: number;
  isPeak: boolean;             // đúng 1 phần tử true (cột Emerald)
}
export interface WeeklyVelocity {
  periodLabel: string;         // "Tháng này"
  days: DailyVelocity[];       // luôn đủ 7 phần tử, thứ tự T2..CN
}

/* ---------- Status Breakdown ---------- */
export interface TaskStatusBreakdownItem {
  status: BreakdownStatus;
  label: string;               // "Hoàn tất (Done)"
  percent: number;
  taskCount: number;
  barClass: string;            // "bg-emerald-500"
  dotClass: string;
}
export interface TaskStatusBreakdown {
  totalTasks: number;          // Σ taskCount
  items: TaskStatusBreakdownItem[]; // thứ tự: DONE, IN_PROGRESS, TODO, LOCKED
}

/* ---------- AI Diagnostic (khớp PROJECT.latest_ai_analysis, SSOT §4.2) ---------- */
export type InsightKind = 'CRITICAL_PATH' | 'BOTTLENECK' | 'RECOMMENDATION';
export type InsightSeverity = 'HIGH' | 'MEDIUM' | 'ADVICE';
export interface AiDiagnosticInsight {
  id: string;
  kind: InsightKind;
  severity: InsightSeverity;
  icon: string;                // "🔴" | "🟡" | "🟢"
  kicker: string;              // "Cảnh báo Đường găng · Critical Path at risk"
  tag: string;                 // "Nguy cơ cao"
  title: string;
  description: string;
  relatedNodeIds: string[];    // ["WPE-014"]
  boxClass: string;            // "bg-red-50 border-red-200"
  tagClass: string;
}
export interface AiDiagnosticReport {
  engine: 'Gemini';
  generatedAt: ISODateTime;
  insights: AiDiagnosticInsight[]; // đủ 3, thứ tự CRITICAL_PATH, BOTTLENECK, RECOMMENDATION
}

/* ---------- Guest Access (khớp PROJECT.guest_access, SSOT §4.2) ---------- */
export interface GuestAccessState {
  isActive: boolean;           // = !is_revoked && chưa hết hạn
  token: string;               // "gst_sec_89f2a4"
  expiresAt: ISODateTime;
  expiresLabel: string;        // "2026-10-09 (còn 7 ngày)" — do service/selector tạo
}
export interface GuestAccessActions {
  copyLink: () => Promise<void>;
  revoke: () => Promise<void>;
  generate: () => Promise<void>;
}

/* ---------- Feedback (khớp bảng NODE_FEEDBACK) ---------- */
export type FeedbackStatus = 'OPEN' | 'RESOLVED';
export type ReviewerRole = 'TEACHER' | 'GUEST';
export interface FeedbackItem {
  id: string;
  reviewerName: string;        // "Cô Lan" | "Anh Minh"
  reviewerRole: ReviewerRole;  // UI: TEACHER → "Giáo viên", GUEST → "Khách ngoài"
  nodeRef: { nodeId: string; code: string; title: string }; // code "WPE-009"
  content: string;
  status: FeedbackStatus;
  replyContent?: string | null;
  createdAt: ISODateTime;
}

/* ---------- Activity ---------- */
export type ActivityAction = 'SUBMITTED_PR' | 'APPROVED' | 'OVERDUE_ALERT' | 'CLAIMED';
export interface ActivityItem {
  id: string;
  actor: { initials: string; name: string; avatarClass: string }; // "SC", "bg-indigo-500"
  action: ActivityAction;
  message: string;             // "vừa nộp PR cho WPE-012"
  nodeCode: string;
  occurredAt: ISODateTime;
}

/* ---------- Aggregate ---------- */
export interface OverviewData {
  project: {
    id: string; name: string; role: 'OWNER' | 'COLLABORATOR' | 'VIEWER';
    phaseLabel: string;        // "Phase 2 · Published"
    lastUpdatedAt: ISODateTime;
  };
  metrics: OverviewMetrics;
  velocity: WeeklyVelocity;
  statusBreakdown: TaskStatusBreakdown;
  aiReport: AiDiagnosticReport;
  guestAccess: GuestAccessState;
  feedbackQueue: FeedbackItem[];
  recentActivity: ActivityItem[];
}
```

> **Ánh xạ backend (Spring Boot):** `id`/FK là `Long` bên Java → FE nhận qua JSON dưới dạng **string** để tránh mất độ chính xác `bigint`. Thời gian là ISO-8601 có offset.

### 1.2 `src/services/contracts/IWorkflowService.ts`

```ts
import type { OverviewData, GuestAccessState } from '@/types/overview.types';

export interface IWorkflowService {
  // ... các method hiện có (canvas, nodes...) giữ nguyên

  /** GET /api/projects/{id}/overview */
  getOverviewData(projectId: string): Promise<OverviewData>;

  /**
   * active=false → POST /api/projects/{id}/guest-link/revoke  (guest_access.is_revoked = true)
   * active=true  → chỉ hợp lệ khi token còn hạn; thường dùng generateGuestToken thay thế
   */
  toggleGuestAccess(projectId: string, active: boolean): Promise<GuestAccessState>;

  /** POST /api/projects/{id}/guest-link — sinh token mới, is_revoked=false, hạn +7 ngày */
  generateGuestToken(projectId: string): Promise<GuestAccessState>;
}
```

### 1.3 Mock implementation — `src/services/mock/MockWorkflowService.overview.ts`

```ts
import type { IWorkflowService } from '@/services/contracts/IWorkflowService';
import type { OverviewData, GuestAccessState } from '@/types/overview.types';

const delay = (ms = 250) => new Promise<void>((r) => setTimeout(r, ms));

const buildGuest = (token: string, isActive: boolean): GuestAccessState => ({
  isActive,
  token,
  expiresAt: '2026-10-09T23:59:59Z',
  expiresLabel: '2026-10-09 (còn 7 ngày)',
});

const MOCK: OverviewData = {
  project: { id: '1', name: 'Marketing Campaign Q4', role: 'OWNER',
    phaseLabel: 'Phase 2 · Published', lastUpdatedAt: '2026-10-02T08:28:00Z' },
  metrics: { totalNodes: 24, criticalPathNodes: 8, completedNodes: 17, completionRate: 72,
    overdueCount: 4, blockingReleaseCount: 2, pendingReviewCount: 3 },
  velocity: { periodLabel: 'Tháng này', days: [
    { day: 'T2', tasks: 7,  isPeak: false }, { day: 'T3', tasks: 9,  isPeak: false },
    { day: 'T4', tasks: 11, isPeak: true  }, { day: 'T5', tasks: 8,  isPeak: false },
    { day: 'T6', tasks: 10, isPeak: false }, { day: 'T7', tasks: 4,  isPeak: false },
    { day: 'CN', tasks: 3,  isPeak: false },
  ]},
  statusBreakdown: { totalTasks: 51, items: [
    { status: 'DONE',        label: 'Hoàn tất (Done)',              percent: 45, taskCount: 23, barClass: 'bg-emerald-500', dotClass: 'bg-emerald-500' },
    { status: 'IN_PROGRESS', label: 'Đang thực hiện (In Progress)', percent: 25, taskCount: 13, barClass: 'bg-blue-500',    dotClass: 'bg-blue-500' },
    { status: 'TODO',        label: 'Chờ thực hiện (To Do)',        percent: 18, taskCount: 9,  barClass: 'bg-sky-400',     dotClass: 'bg-sky-400' },
    { status: 'LOCKED',      label: 'Đang khóa (Locked)',           percent: 12, taskCount: 6,  barClass: 'bg-slate-300',   dotClass: 'bg-slate-300' },
  ]},
  aiReport: { engine: 'Gemini', generatedAt: '2026-10-02T06:30:00Z', insights: [
    { id: 'i1', kind: 'CRITICAL_PATH', severity: 'HIGH', icon: '🔴',
      kicker: 'Cảnh báo Đường găng · Critical Path at risk', tag: 'Nguy cơ cao',
      title: 'QA Testing bị chặn bởi 2 upstream nodes.',
      description: 'Backend Auth API và Data Schema trễ hạn 2 ngày làm trễ toàn bộ mốc phát hành.',
      relatedNodeIds: [], boxClass: 'bg-red-50 border-red-200', tagClass: 'bg-red-100 text-red-700' },
    { id: 'i2', kind: 'BOTTLENECK', severity: 'MEDIUM', icon: '🟡',
      kicker: 'Điểm nghẽn nhân sự · Bottleneck detected', tag: 'Tắc nghẽn tải trọng',
      title: 'Node WPE-014 (Marcus Liu) quá tải 147%.',
      description: 'Đang ngâm 8 ngày không có cập nhật sub-task. Đề xuất san sẻ tải.',
      relatedNodeIds: ['WPE-014'], boxClass: 'bg-amber-50 border-amber-200', tagClass: 'bg-amber-100 text-amber-800' },
    { id: 'i3', kind: 'RECOMMENDATION', severity: 'ADVICE', icon: '🟢',
      kicker: 'Khuyến nghị hành động · AI Actionable Advice', tag: 'Khuyến nghị ưu tiên',
      title: 'Tái phân bổ nhánh UI Form sang Sarah Chen.',
      description: 'Giải phóng đường găng trước ngày 05/10 để kịp tiến độ bàn giao.',
      relatedNodeIds: [], boxClass: 'bg-emerald-50 border-emerald-200', tagClass: 'bg-emerald-100 text-emerald-700' },
  ]},
  guestAccess: buildGuest('gst_sec_89f2a4', true),
  feedbackQueue: [
    { id: 'f1', reviewerName: 'Cô Lan', reviewerRole: 'TEACHER',
      nodeRef: { nodeId: '9', code: 'WPE-009', title: 'Thiết kế Schema' },
      content: 'Chưa thấy ràng buộc UNIQUE cho cặp parent/child, cần giải trình.',
      status: 'OPEN', createdAt: '2026-10-02T05:30:00Z' },
    { id: 'f2', reviewerName: 'Anh Minh', reviewerRole: 'GUEST',
      nodeRef: { nodeId: '12', code: 'WPE-012', title: 'Auth API' },
      content: 'Thời gian hết hạn JWT chưa rõ, vui lòng bổ sung tài liệu.',
      status: 'OPEN', createdAt: '2026-10-01T09:00:00Z' },
  ],
  recentActivity: [
    { id: 'a1', actor: { initials: 'SC', name: 'Sarah Chen', avatarClass: 'bg-indigo-500' }, action: 'SUBMITTED_PR',  message: 'vừa nộp PR cho WPE-012',      nodeCode: 'WPE-012', occurredAt: '2026-10-02T08:18:00Z' },
    { id: 'a2', actor: { initials: 'AK', name: 'Alex Kim',   avatarClass: 'bg-emerald-500' }, action: 'APPROVED',      message: 'vừa duyệt schema WPE-009',    nodeCode: 'WPE-009', occurredAt: '2026-10-02T07:43:00Z' },
    { id: 'a3', actor: { initials: 'ML', name: 'Marcus Liu', avatarClass: 'bg-rose-500' },    action: 'OVERDUE_ALERT', message: 'cảnh báo WPE-014 trễ hạn',    nodeCode: 'WPE-014', occurredAt: '2026-10-02T06:28:00Z' },
    { id: 'a4', actor: { initials: 'JD', name: 'Jamie Doe',  avatarClass: 'bg-amber-500' },   action: 'CLAIMED',       message: 'nhận việc WPE-021 (Claim)',   nodeCode: 'WPE-021', occurredAt: '2026-10-02T03:28:00Z' },
  ],
};

export class MockOverviewApi implements Pick<IWorkflowService,
  'getOverviewData' | 'toggleGuestAccess' | 'generateGuestToken'> {
  private data: OverviewData = structuredClone(MOCK);

  async getOverviewData(_projectId: string) { await delay(); return structuredClone(this.data); }

  async toggleGuestAccess(_projectId: string, active: boolean) {
    await delay(150);
    this.data.guestAccess = buildGuest(this.data.guestAccess.token, active);
    return structuredClone(this.data.guestAccess);
  }

  async generateGuestToken(_projectId: string) {
    await delay(150);
    const suffix = Math.random().toString(16).slice(2, 8).padEnd(6, '0');
    this.data.guestAccess = buildGuest(`gst_sec_${suffix}`, true);
    return structuredClone(this.data.guestAccess);
  }
}
```

### 1.4 Dependency Injection

```ts
// src/services/container.ts
export const workflowService: IWorkflowService =
  import.meta.env.VITE_USE_MOCK === 'true' ? new MockWorkflowService() : new HttpWorkflowService();
```
Component **không** import trực tiếp service; chỉ gọi action trong store. Store nhận service qua `createOverviewSlice(service)` hoặc import từ `container.ts` (một điểm duy nhất).

### 1.5 Helper dùng chung

```ts
// src/utils/guestUrl.ts — khớp prototype
export const buildGuestUrl = (token: string) =>
  `https://pipeline.io/guest?token=${token.replace('gst_sec_', 'gst_')}`;
// UI hiển thị: `${buildGuestUrl(token)}...` (cắt bằng CSS truncate); sao chép: URL đầy đủ không có "..."

// src/utils/relativeTime.ts
export function relativeVi(iso: string, now = Date.now()): string {
  const m = Math.floor((now - Date.parse(iso)) / 60000);
  if (m < 1) return 'vừa xong';
  if (m < 60) return `${m} phút`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ`;
  return h < 48 ? 'Hôm qua' : `${Math.floor(h / 24)} ngày`;
}
```

---

## PHẦN 2: CẤU TRÚC THƯ MỤC

```text
src/
├── types/overview.types.ts
├── services/
│   ├── contracts/IWorkflowService.ts
│   ├── mock/MockWorkflowService.overview.ts
│   ├── http/HttpWorkflowService.overview.ts      # triển khai thật (sau)
│   └── container.ts
├── store/slices/overviewSlice.ts
├── hooks/
│   ├── useClickOutside.ts                        # mousedown + Escape dùng chung 2 popover
│   └── useAnchoredPosition.ts                    # đo toạ độ nút → vị trí popover/caret
├── utils/{guestUrl.ts, relativeTime.ts}
└── components/
    ├── common/
    │   ├── Icon.tsx
    │   ├── SparkleIcon.tsx                       # gradient tím→xanh, id = useId()
    │   └── ProgressRing.tsx
    ├── views/OverviewView.tsx
    ├── overview/
    │   ├── OverviewHeader.tsx
    │   ├── MetricRibbon.tsx
    │   ├── WeeklyVelocityCard.tsx
    │   ├── StatusBreakdownCard.tsx
    │   ├── FeedbackQueueCard.tsx
    │   └── RecentActivityCard.tsx
    └── popovers/
        ├── AiDiagnosisPopover.tsx
        └── GuestAccessPopover.tsx
```

**Quy tắc Clean Architecture:** `components` → `store` → `services/contracts`. Không import chéo ngược. Component trình bày (`*Card`) chỉ nhận props, không đọc store; `OverviewView` là container duy nhất chọn dữ liệu từ store và truyền xuống.

---

## PHẦN 3: ĐẶC TẢ CHI TIẾT COMPONENT

### 3.0 `OverviewView` (container)

```tsx
export function OverviewView({ projectId }: { projectId: string }) {
  const { data, status, error, load, revokeGuest, generateGuest, toast, showToast } =
    useBoundStore(useShallow((s) => ({
      data: s.overview.data, status: s.overview.status, error: s.overview.error,
      load: s.overview.load, revokeGuest: s.overview.revokeGuest,
      generateGuest: s.overview.generateGuest, toast: s.overview.toast, showToast: s.overview.showToast,
    })));

  useEffect(() => { if (status === 'idle') void load(projectId); }, [projectId, status, load]);

  if (status === 'loading' && !data) return <OverviewSkeleton />;
  if (status === 'error' && !data) return <ErrorState message={error} onRetry={() => load(projectId)} />;
  if (!data) return null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      <OverviewHeader project={data.project} aiReport={data.aiReport}
        guestAccess={data.guestAccess} onRevoke={revokeGuest} onGenerate={generateGuest} notify={showToast} />
      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <MetricRibbon metrics={data.metrics} />
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-8">
            <section className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
              <WeeklyVelocityCard velocity={data.velocity} />
              <StatusBreakdownCard breakdown={data.statusBreakdown} />
            </section>
          </div>
          <aside className="col-span-12 lg:col-span-4 space-y-6">
            <FeedbackQueueCard items={data.feedbackQueue} onExplain={(f) => showToast(`Mở khung giải trình cho ${f.nodeRef.code}`)} />
            <RecentActivityCard items={data.recentActivity} />
          </aside>
        </div>
      </main>
      {toast && <Toast message={toast} />}
    </div>
  );
}
```
> Lưu ý: `WeeklyVelocityCard` và `StatusBreakdownCard` nằm chung 1 thẻ `section` trắng `p-8` (như prototype); card con **không** tự vẽ khung ngoài. `StatusBreakdownCard` tự có `mt-10 pt-8 border-t border-slate-100`.

### 3.1 `OverviewHeader`

```tsx
<header className="bg-white border-b border-slate-200 sticky top-0 z-[45]">
  <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between gap-6">
    <div className="min-w-0">
      <div className="flex items-center gap-2.5 flex-wrap">
        <h1 className="text-xl font-bold tracking-tight">{project.name}</h1>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">Owner</span>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{project.phaseLabel}</span>
      </div>
      <p className="text-xs text-slate-500 mt-1.5">Cập nhật lần cuối {relativeVi(project.lastUpdatedAt)} trước · Engine đang hoạt động</p>
    </div>
    <div className="flex items-center gap-3 shrink-0">
      <AiDiagnosisPopover report={aiReport} />
      <GuestAccessPopover state={guestAccess} onRevoke={onRevoke} onGenerate={onGenerate} notify={notify} />
    </div>
  </div>
</header>
```
- **Badge vai trò**: `Owner` chỉ cho `role === 'OWNER'`; Collaborator/Viewer đổi nhãn và ẩn nút Revoke/Generate (RBAC §3.3 SSOT: chỉ Owner sinh/thu hồi token).
- **z-index**: Header `z-[45]`, backdrop AI `z-40`, popover `z-50`, toast `z-[70]`. Header phải cao hơn backdrop để 2 nút vẫn bấm được khi popover mở.

### 3.2 `AiDiagnosisPopover`

**Nút trigger (button + popover cùng nằm trong `div.relative.z-[45].shrink-0`):**

| Trạng thái | Class |
|---|---|
| Base | `flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-700 rounded-lg border transition` |
| Đóng | `bg-white border-indigo-200 hover:border-indigo-300 hover:bg-indigo-50/40` |
| Mở (`isOpen`) | `bg-indigo-50 border-indigo-400 ring-2 ring-indigo-100` |
| A11y | `aria-haspopup="dialog" aria-expanded={isOpen}` |

Icon: `<SparkleIcon className="w-4 h-4" />` (stroke `linearGradient` `#7c3aed → #0ea5e9`).

**Hook định vị — `useAnchoredPosition.ts` (logic cốt lõi, phải giữ đúng):**

```ts
export interface AiPopoverPos { top: number; caret: number; origin: number }

export function computeCenteredPopover(btn: DOMRect, vw: number, maxW = 1024): AiPopoverPos {
  const w = Math.min(maxW, vw - 64);               // w-[calc(100%-4rem)] max-w-5xl
  const left = (vw - w) / 2;                        // mép trái popover (căn giữa viewport)
  const btnCenter = btn.left + btn.width / 2;
  const caret = Math.min(Math.max(btnCenter - left - 8, 20), w - 36); // 8 = nửa bề rộng caret (w-4)
  return { top: btn.bottom + 12, caret, origin: caret + 8 };
}
// Dùng useLayoutEffect khi mở + window 'resize' khi đang mở.
// vw = document.documentElement.clientWidth (không dùng innerWidth để loại scrollbar).
```

**DOM popover:**
```tsx
{isOpen && (
  <>
    <div className="fade-in fixed inset-0 bg-slate-900/10 z-40" />
    <div ref={popRef} role="dialog" aria-label="AI Pipeline Diagnostic Insights"
      className="pop-in fixed inset-x-0 mx-auto z-50 w-[calc(100%-4rem)] max-w-5xl rounded-2xl border border-slate-200/80 bg-white/95 backdrop-blur-md shadow-2xl max-h-[calc(100vh-120px)] overflow-y-auto"
      style={{ top: pos.top, transformOrigin: `${pos.origin}px top`,
        boxShadow: '0 25px 50px -12px rgba(15,23,42,.25), 0 10px 20px -8px rgba(79,70,229,.12)' }}>
      {/* CARET: bắt buộc thẳng hàng dưới tâm nút AI, KHÔNG nằm giữa popover */}
      <div className="absolute -top-2 w-4 h-4 bg-white rotate-45 border-l border-t border-slate-200" style={{ left: pos.caret }} />
      ...
```
- **Header trong popover:** `relative flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-slate-100 rounded-t-2xl bg-white` — icon `p-2 rounded-xl bg-gradient-to-br from-violet-100 to-sky-100`; tiêu đề `AI Pipeline Diagnostic Insights` (`text-base font-semibold`); badge `Model: Gemini Engine · Cập nhật {updated}` (`text-[11px] font-medium px-2 py-0.5 rounded-full bg-violet-50 text-violet-700`); nút X `p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100`.
- **Lưới:** `grid grid-cols-1 md:grid-cols-3 gap-4 px-6 my-5`. Mỗi thẻ: `rounded-xl border p-4 flex flex-col ${boxClass}` + khi quét `opacity-50 transition-opacity`. Bên trong: hàng icon + tag (`text-lg` / `text-[11px] font-bold px-2 py-0.5 rounded-full ${tagClass}`), kicker `mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500`, tiêu đề `mt-1 text-sm font-semibold text-slate-900 leading-snug`, mô tả `mt-2 text-sm text-slate-700 leading-relaxed`.
- **Footer:** `flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 border-t border-slate-100 bg-slate-50/70 rounded-b-2xl`; text `text-[11px] text-slate-400 max-w-xl`: *"Phân tích tự động dựa trên cấu trúc đồ thị DAG và trạng thái máy trạng thái (State Machine) của từng Node trong dự án."*; nút `Chạy lại chẩn đoán (Re-scan Pipeline)` (`px-3.5 py-2 text-xs font-semibold text-indigo-700 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-50 hover:border-indigo-300 disabled:opacity-70`), icon refresh quay (`spin-360`) khi `scanning`, nhãn `Đang quét…`.
- **Re-scan:** prototype giả lập `setTimeout 1400ms` rồi đổi badge thành `Cập nhật vừa xong`. Bản thật: gọi `rescanAiDiagnosis(projectId)` (ngoài phạm vi tài liệu này; hiện giữ mock). Theo SSOT §7.1, UI **chỉ đọc cache** `latest_ai_analysis`; re-scan chỉ kích hoạt background job, không gọi Gemini trực tiếp từ FE.

### 3.3 `GuestAccessPopover`

**Trigger:**

| `isActive` | Class | Nhãn |
|---|---|---|
| true | `bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300` | `Share Guest Link` |
| false | `bg-white border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300` | `Guest Link (Đã đóng)` + chấm đỏ `absolute -top-1 -right-1` (ping `animate-ping` + dot `ring-2 ring-white`) |
| mở | `bg-slate-50 border-slate-400 ring-2 ring-slate-100 text-slate-800` | — |

**Popover:** `pop-in absolute right-0 top-full mt-3 z-50 w-[400px] max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white shadow-2xl`.
Caret: `absolute -top-2 w-4 h-4 bg-white rotate-45 border-l border-t border-slate-200` với `style={{ right: Math.max(btnW/2 - 8, 16) }}`; `btnW` đo bằng `getBoundingClientRect().width` trong `useLayoutEffect` phụ thuộc `[isActive, isOpen]` (vì nhãn nút đổi → bề rộng đổi). `transformOrigin: calc(100% - ${btnW/2}px) top`.

**Nhánh `isActive === true`** (`key="active"`, class `fade-up px-5 py-4 space-y-4`):
1. Tag `inline-flex ... bg-emerald-100 text-emerald-700` → `🟢 Đang mở truy cập`.
2. Ô URL `flex-1 min-w-0 px-3 py-2 text-sm font-mono text-slate-600 bg-slate-50 border border-slate-200 rounded-lg truncate` hiển thị `${buildGuestUrl(token)}...`; nút `Sao chép` → `Đã sao chép!` (class `bg-emerald-50 border-emerald-300 text-emerald-700`, icon check) trong **1800ms**.
3. Danh sách: `Quyền: Chỉ xem & gửi Feedback`, `Hết hạn: {expiresLabel}`, dòng mono nhỏ `token: {token}`.
4. Nút đỏ: `w-full ... text-red-600 bg-white border border-red-300 rounded-lg hover:bg-red-50 hover:border-red-400` — `Đóng liên kết (Vô hiệu hóa token)`.

**Nhánh `isActive === false`** (`key="closed"`): tag `bg-red-100 text-red-700` `🔴 Đã khóa liên kết`; hộp `rounded-xl border border-slate-200 bg-slate-50` với câu *"Khách ngoài và giáo viên không thể truy cập dự án bằng liên kết trước đó nữa."*; nút `w-full ... text-white bg-blue-600 hover:bg-blue-700` — `Tạo liên kết mới (Generate New Token)`.

**Footer:** *"Token có thời hạn, có thể thu hồi tức thì và chỉ mở các tài nguyên được cấu hình công khai."*

**Logic copy (bắt buộc try/catch — sandbox/iframe có thể chặn clipboard):**
```ts
const copy = async () => {
  try { await navigator.clipboard.writeText(buildGuestUrl(token)); } catch { /* fallback im lặng */ }
  setCopied(true);
};
```
Thông báo toast: revoke → `Đã vô hiệu hóa token. Liên kết cũ không còn truy cập được.`; generate → `Đã tạo liên kết mới (Generate New Token)`.

### 3.4 `MetricRibbon` — `grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4`

Thẻ KPI: `bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition fade-up`. Hàng đầu: icon trong `p-2 rounded-lg ${badgeCls}` + nhãn `text-sm font-medium text-slate-500`, badge tuỳ chọn bên phải `text-[11px] font-semibold px-2 py-0.5 rounded-full`. Số lớn `text-4xl font-bold tracking-tight`, subtext `text-xs text-slate-500 mt-1`.

| Thẻ | Nhãn | Giá trị | Subtext | badgeCls | Badge |
|---|---|---|---|---|---|
| 1 | Tổng Nodes | `totalNodes` | `{criticalPathNodes} trên đường găng (Critical path)` | `bg-sky-100 text-sky-700` | — |
| 2 | Tiến độ dự án | `{completionRate}%` + `ProgressRing` | `{completedNodes} / {totalNodes} nodes hoàn tất` | `bg-indigo-100 text-indigo-700` | — |
| 3 | Tác vụ trễ hạn | `overdueCount` | `{blockingReleaseCount} blocking release` | `bg-red-100 text-red-700` | `Cảnh báo` |
| 4 | Nghiệm thu chờ duyệt | `pendingReviewCount` | `Artifacts chờ Owner duyệt` | `bg-violet-100 text-violet-700` | `REVIEW` |

**`ProgressRing` (SVG thuần, 56×56):**
```tsx
export function ProgressRing({ percent, size = 56 }: { percent: number; size?: number }) {
  const r = 22, c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" role="img" aria-label={`${percent}%`}>
      <circle cx="28" cy="28" r={r} stroke="#e0e7ff" strokeWidth="6" fill="none" />
      <circle cx="28" cy="28" r={r} stroke="#6366f1" strokeWidth="6" fill="none" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - percent / 100)} transform="rotate(-90 28 28)"
        style={{ transition: 'stroke-dashoffset .8s' }} />
      <text x="28" y="32" textAnchor="middle" fontSize="12" fontWeight="700" fill="#4338ca">{percent}%</text>
    </svg>
  );
}
```
Clamp `percent` về 0–100 trước khi tính.

### 3.5 `WeeklyVelocityCard`

- Header: `flex flex-wrap items-center justify-between gap-3 mb-8` — tiêu đề `text-lg font-semibold` "Weekly Velocity"; subtext `text-xs text-slate-500 mt-0.5`: `Task hoàn thành theo ngày · {periodLabel} · Tổng {Σ tasks} tasks`; pill đỉnh `text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700`: `Đỉnh: {peak.day} · {peak.tasks} tasks`.
- Biểu đồ: `flex gap-3`. Trục Y `flex flex-col justify-between h-64 text-[11px] text-slate-400 text-right w-6 shrink-0` với ticks `[1, .75, .5, .25, 0]` × `max`. Vùng vẽ `relative h-64`: lớp lưới `absolute inset-0 flex flex-col justify-between pointer-events-none` (đường `border-t border-dashed border-slate-200`, đường đáy `border-slate-300`), lớp cột `absolute inset-0 flex items-end gap-4 px-2`.
- Mỗi cột: wrapper `flex-1 h-full flex flex-col justify-end items-center relative` (`onMouseEnter/Leave` → `hoverIdx`), thanh `bar w-full max-w-[56px] rounded-t-lg cursor-pointer transition-colors`, `style={{ height: `${tasks/max*100}%`, animationDelay: `${i*50}ms` }}`.
  - Peak: `bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-200`; thường: `bg-indigo-200 hover:bg-indigo-300`.
  - Tooltip: `absolute bg-slate-900 text-white text-xs px-2.5 py-1.5 rounded-md whitespace-nowrap z-10 shadow-lg`, `style={{ bottom: `calc(${tasks/max*100}% + 8px)` }}`, nội dung `{day}: <b>{tasks} tasks</b>`.
- Nhãn ngày: `flex gap-4 px-2 mt-3 text-xs text-slate-500`; ngày peak thêm `font-bold text-emerald-600`.
- **Edge case:** `max = Math.max(1, ...tasks)` để tránh chia 0. Peak lấy từ `isPeak` của DTO, **không** tự tính ở FE.
- Tooltip hover là **state cục bộ** (`useState<number | null>`).

### 3.6 `StatusBreakdownCard`

```tsx
<div className="mt-10 pt-8 border-t border-slate-100">
  <div className="flex items-center justify-between mb-4">
    <h3 className="font-semibold text-sm">Phân bổ trạng thái công việc</h3>
    <span className="text-xs text-slate-500">Tổng {totalTasks} tasks</span>
  </div>
  <div className="flex h-3 rounded-full overflow-hidden bg-slate-100">
    {items.map((s) => (
      <div key={s.status} className={`${s.barClass} hover:opacity-80 transition-opacity`}
        style={{ width: `${s.percent}%` }} title={`${s.label}: ${s.percent}% · ${s.taskCount}/${totalTasks} tasks`} />
    ))}
  </div>
  <div className="mt-5 space-y-4">
    {items.map((s) => (
      <div key={s.status} className="group">
        <div className="flex justify-between text-sm mb-1.5">
          <span className="flex items-center gap-2"><i className={`w-2.5 h-2.5 rounded-full ${s.dotClass}`} />{s.label}</span>
          <span className="text-slate-500"><b className="text-slate-800">{s.percent}%</b> · {s.taskCount} / {totalTasks} tasks</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${s.barClass} group-hover:opacity-80 transition-all`} style={{ width: `${s.percent}%` }} />
        </div>
      </div>
    ))}
  </div>
</div>
```
**Lưu ý Tailwind JIT:** `barClass/dotClass` đến từ dữ liệu → class phải xuất hiện nguyên văn trong source để không bị purge. Thêm `safelist` (mục 3.9) hoặc đặt map hằng `STATUS_STYLE` trong code FE và để DTO chỉ chứa `status` (khuyến nghị cho bản production: backend không trả class Tailwind).

### 3.7 `FeedbackQueueCard` (cột phải, đầu tiên)

- Khung: `bg-white rounded-2xl border border-slate-200 p-5 shadow-sm`. Header: `Hàng đợi phản hồi` (`font-semibold`) + badge `{openCount} OPEN` (`text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700`). `openCount` tính từ `items.filter(i => i.status === 'OPEN')`, **không** hard-code "2".
- Item: `p-3 rounded-xl border border-slate-200 hover:border-indigo-300 transition`: dòng 1 `{reviewerName} ({roleLabel})` `text-sm font-semibold` + tag `OPEN` `text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700`; dòng 2 `{code} · {title}` `text-xs text-indigo-600 mt-0.5`; nội dung `text-sm text-slate-600 mt-2`; chân: thời gian `text-xs text-slate-400` và nút `Giải trình` `text-xs font-semibold text-indigo-600 hover:underline`.
- `roleLabel`: `TEACHER → "Giáo viên"`, `GUEST → "Khách ngoài"`.
- Chỉ Collaborator/Owner thấy nút `Giải trình` (SSOT §3.3). Hiện `onExplain` → toast; bản thật mở modal nhập `reply_content`.

### 3.8 `RecentActivityCard`

`bg-white rounded-2xl border border-slate-200 p-5 shadow-sm`; tiêu đề `Hoạt động gần đây` `font-semibold mb-4`; `ul.space-y-4`; mỗi `li.flex.items-center.gap-3`: avatar `w-9 h-9 rounded-full text-white text-xs font-bold flex items-center justify-center ${avatarClass}`, nội dung `flex-1 text-sm` → `<b>{initials}</b> <span class="text-slate-600">{message}</span>`, thời gian `text-xs text-slate-400 whitespace-nowrap` (dùng `relativeVi`). Đặt `title={actor.name}` cho avatar.

### 3.9 `tailwind.config.ts` (bổ sung)

```ts
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  safelist: [/^bg-(emerald|blue|sky|slate|red|amber|indigo|violet|rose)-(50|100|200|300|400|500)$/,
             /^border-(red|amber|emerald)-200$/, /^text-(red|amber|emerald)-(700|800)$/],
  theme: { extend: {
    fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
    keyframes: {
      fadeUp:  { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'none' } },
      grow:    { from: { transform: 'scaleY(0)' }, to: { transform: 'scaleY(1)' } },
      popIn:   { from: { opacity: '0', transform: 'scale(.97)' }, to: { opacity: '1', transform: 'scale(1)' } },
      fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
      spin360: { to: { transform: 'rotate(360deg)' } },
    },
    animation: {
      'fade-up': 'fadeUp .25s ease-out both', bar: 'grow .5s ease-out both',
      'pop-in': 'popIn .15s ease-out both', 'fade-in': 'fadeIn .15s ease-out both',
      'spin-360': 'spin360 .9s linear infinite',
    },
  }},
};
```
Thêm vào `index.css`: `.bar{transform-origin:bottom}`. Nếu giữ tên class `.fade-up/.pop-in/.fade-in/.spin-360/.bar` như prototype, khai báo chúng trong `@layer utilities` trỏ tới animation tương ứng, hoặc đổi sang `animate-fade-up`… và cập nhật nhất quán.

---

## PHẦN 4: STATE MANAGEMENT & ĐIỀU HƯỚNG TƯƠNG TÁC

### 4.1 Phân loại state

| State | Nơi lưu | Lý do |
|---|---|---|
| `data: OverviewData`, `status`, `error` | **Zustand** `overviewSlice` | Sống sót khi chuyển tab Sidebar; nhiều màn hình có thể dùng (badge Guest Link, số REVIEW) |
| `guestAccess` (isActive, token, expiresAt) | **Zustand** (nằm trong `data.guestAccess`) | Header + popover phải đồng bộ; là dữ liệu server |
| `toast` | **Zustand** (hoặc Toast provider chung của app) | Phát từ nhiều nơi |
| `isOpen` của 2 popover | **Local** `useState` | UI tạm thời, reset khi rời màn hình là chấp nhận được |
| `pos {top, caret, origin}` (AI popover), `btnW` (Guest) | **Local** | Phụ thuộc DOM |
| `hoverIdx` (tooltip cột), `copied`, `scanning`, `updated` | **Local** | Hiệu ứng cục bộ |

### 4.2 `src/store/slices/overviewSlice.ts`

```ts
import type { StateCreator } from 'zustand';
import type { OverviewData } from '@/types/overview.types';
import { workflowService } from '@/services/container';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface OverviewSlice {
  overview: {
    data: OverviewData | null;
    status: LoadStatus;
    error: string | null;
    toast: string | null;
    load: (projectId: string) => Promise<void>;
    revokeGuest: () => Promise<void>;
    generateGuest: () => Promise<void>;
    showToast: (msg: string) => void;
    reset: () => void;
  };
}

export const createOverviewSlice: StateCreator<OverviewSlice, [['zustand/immer', never]], [], OverviewSlice> =
  (set, get) => ({
    overview: {
      data: null, status: 'idle', error: null, toast: null,

      load: async (projectId) => {
        set((s) => { s.overview.status = 'loading'; s.overview.error = null; });
        try {
          const data = await workflowService.getOverviewData(projectId);
          set((s) => { s.overview.data = data; s.overview.status = 'ready'; });
        } catch (e) {
          set((s) => { s.overview.status = 'error'; s.overview.error = e instanceof Error ? e.message : 'Không tải được dữ liệu'; });
        }
      },

      revokeGuest: async () => {
        const d = get().overview.data; if (!d) return;
        const prev = d.guestAccess;
        // optimistic update
        set((s) => { s.overview.data!.guestAccess.isActive = false; });
        try {
          const next = await workflowService.toggleGuestAccess(d.project.id, false);
          set((s) => { s.overview.data!.guestAccess = next; });
          get().overview.showToast('Đã vô hiệu hóa token. Liên kết cũ không còn truy cập được.');
        } catch {
          set((s) => { s.overview.data!.guestAccess = prev; });         // rollback
          get().overview.showToast('Không thể đóng liên kết. Vui lòng thử lại.');
        }
      },

      generateGuest: async () => {
        const d = get().overview.data; if (!d) return;
        try {
          const next = await workflowService.generateGuestToken(d.project.id);
          set((s) => { s.overview.data!.guestAccess = next; });
          get().overview.showToast('Đã tạo liên kết mới (Generate New Token)');
        } catch {
          get().overview.showToast('Không thể tạo liên kết mới. Vui lòng thử lại.');
        }
      },

      showToast: (msg) => {
        set((s) => { s.overview.toast = msg; });
        setTimeout(() => { if (get().overview.toast === msg) set((s) => { s.overview.toast = null; }); }, 2400);
      },

      reset: () => set((s) => { s.overview.data = null; s.overview.status = 'idle'; s.overview.error = null; }),
    }),
  });
```
> `reset()` chỉ gọi khi **đổi `projectId`** (không gọi khi chuyển tab). Dùng `useEffect` trong container cha để so sánh `projectId`.

### 4.3 `useClickOutside.ts` — dùng chung cho cả 2 popover

```ts
import { useEffect, type RefObject } from 'react';

export function useDismiss(
  isOpen: boolean,
  onClose: () => void,
  refs: RefObject<HTMLElement | null>[],   // vùng được coi là "bên trong"
) {
  useEffect(() => {
    if (!isOpen) return;                    // CHỈ gắn listener khi đang mở
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (refs.some((r) => r.current?.contains(t))) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);   // mousedown, không dùng click
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose, refs]);
}
```
- **AI popover:** `refs = [btnRef, popRef]` (popover là `fixed`, nằm ngoài DOM wrapper nút nên phải ref riêng). Backdrop không cần `onClick` vì `mousedown` đã đóng.
- **Guest popover:** `refs = [wrapRef]` (popover là con của wrapper `relative`).
- Khi mở popover này, **đóng popover kia** (đề xuất: lift `openPopover: 'ai' | 'guest' | null` lên `OverviewHeader`; prototype hiện để độc lập nhưng backdrop AI che nút Guest nên không xảy ra đồng thời trong thực tế).

---

## PHẦN 5: ACCEPTANCE CRITERIA

### 5.1 Bắt buộc
- [ ] `tsc --noEmit` pass, `strict: true`, **không** có `any`, không `// @ts-ignore`.
- [ ] ESLint pass (`react-hooks/exhaustive-deps` bật).
- [ ] **Sidebar:** bấm `Overview` → render `OverviewView`; bấm `Canvas` → quay lại đồ thị DAG; quay lại `Overview` **không refetch** (status `ready`, dữ liệu giữ nguyên) và trạng thái Guest Link (kể cả đã revoke) được giữ. Không sửa cơ chế chuyển tab hiện có.
- [ ] Responsive: hiển thị đúng ≥ **1280px** (`max-w-7xl`, lưới 8/4). Dưới 1280px không được vỡ layout (tự xuống 1 cột ở `< lg`; AI popover lưới 1 cột ở `< md`).
- [ ] AI popover: khoảng cách trái/phải tới mép viewport **bằng nhau**; caret thẳng hàng tâm nút AI ở mọi độ rộng (kiểm tra 1280/1440/1920 và khi resize khi đang mở).
- [ ] Cả 2 popover: toggle bằng nút; đóng bằng click ngoài, `Escape`, nút X; listener được gỡ khi đóng (không rò rỉ).
- [ ] Guest Link: revoke → nút Header đổi `Guest Link (Đã đóng)` + chấm đỏ, popover chuyển nhánh khoá; Generate → quay về active với token mới.
- [ ] Copy: ghi `buildGuestUrl(token)` vào clipboard; nút hiện `Đã sao chép!` 1800ms; không throw khi clipboard bị chặn.
- [ ] Biểu đồ: không dùng thư viện chart; tooltip hover đúng vị trí; cột peak Emerald.
- [ ] Mock hiển thị **giống hệt** prototype (so sánh ảnh chụp).

### 5.2 Test gợi ý (Vitest + React Testing Library)

```ts
it('breakdown: tổng percent = 100 và Σ taskCount = totalTasks', () => {
  const { items, totalTasks } = MOCK.statusBreakdown;
  expect(items.reduce((a, i) => a + i.percent, 0)).toBe(100);
  expect(items.reduce((a, i) => a + i.taskCount, 0)).toBe(totalTasks);
});
it('velocity: đúng 7 ngày, đúng 1 isPeak', () => {
  expect(MOCK.velocity.days).toHaveLength(7);
  expect(MOCK.velocity.days.filter((d) => d.isPeak)).toHaveLength(1);
});
it('computeCenteredPopover: caret nằm trong [20, w-36]', () => {
  const p = computeCenteredPopover({ left: 1000, width: 130, bottom: 70 } as DOMRect, 1440);
  expect(p.caret).toBeGreaterThanOrEqual(20); expect(p.top).toBe(82);
});
it('revoke rollback khi service lỗi', async () => { /* mock reject → isActive trở lại true */ });
it('Escape đóng popover', async () => { /* userEvent.keyboard('{Escape}') */ });
```

### 5.3 Ngoài phạm vi (không làm trong task này)
Bộ lọc thời gian (đã bị loại), nút `Mở Canvas` (đã bị loại), AI Diagnostic Report dạng thẻ trong cột trái, Phase Timeline, chặn re-scan thật bằng Gemini, modal nhập giải trình thật. Mọi thứ trên chỉ là mock/toast như prototype.

### 5.4 Khi nối backend thật (lộ trình)
1. `HttpWorkflowService.getOverviewData` → `GET /api/projects/{id}/overview` trả DTO đúng `OverviewData` (Java `record`, `Long` → JSON string).
2. `StatusBreakdown` & `metrics` tính từ bảng `NODE` (status, `is_overdue`, join `NODE_DEPENDENCY` cho critical path) để tổng khớp `totalNodes`.
3. `aiReport` đọc từ `PROJECT.latest_ai_analysis` (cache JSONB) — không gọi Gemini khi tải trang.
4. `guestAccess` ánh xạ `PROJECT.guest_access` (`token`, `expires_at`, `is_revoked`); revoke có hiệu lực **tức thì** phía server (SSOT §3.4).
5. Mã lỗi: `403` nếu không phải OWNER thao tác token; `404` project không tồn tại; `409` nếu thao tác xung đột trạng thái.
