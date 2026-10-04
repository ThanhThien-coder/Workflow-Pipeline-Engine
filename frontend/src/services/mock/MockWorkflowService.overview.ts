import type { IWorkflowService } from '../contracts/IWorkflowService'
import type { GuestAccessState, OverviewData } from '../../types/overview.types'
import type { ProjectStatus } from '../../types/settings.types'
import { mockDelay } from './MockConfig'

const buildGuest = (token: string, isActive: boolean): GuestAccessState => ({
  isActive,
  token,
  expiresAt: '2026-10-09T23:59:59Z',
  expiresLabel: '2026-10-09 (còn 7 ngày)',
})

export const MOCK_OVERVIEW: OverviewData = {
  project: { id: '1', name: 'Marketing Campaign Q4', role: 'OWNER', phaseLabel: 'Phase 2 · Published', lastUpdatedAt: '2026-10-02T08:28:00Z' },
  metrics: { totalNodes: 24, criticalPathNodes: 8, completedNodes: 17, completionRate: 72, overdueCount: 4, blockingReleaseCount: 2, pendingReviewCount: 3 },
  velocity: { periodLabel: 'Tháng này', days: [
    { day: 'T2', tasks: 7, isPeak: false }, { day: 'T3', tasks: 9, isPeak: false },
    { day: 'T4', tasks: 11, isPeak: true }, { day: 'T5', tasks: 8, isPeak: false },
    { day: 'T6', tasks: 10, isPeak: false }, { day: 'T7', tasks: 4, isPeak: false },
    { day: 'CN', tasks: 3, isPeak: false },
  ] },
  statusBreakdown: { totalTasks: 51, items: [
    { status: 'DONE', label: 'Hoàn tất (Done)', percent: 45, taskCount: 23, barClass: 'bg-emerald-500', dotClass: 'bg-emerald-500' },
    { status: 'IN_PROGRESS', label: 'Đang thực hiện (In Progress)', percent: 25, taskCount: 13, barClass: 'bg-blue-500', dotClass: 'bg-blue-500' },
    { status: 'TODO', label: 'Chờ thực hiện (To Do)', percent: 18, taskCount: 9, barClass: 'bg-sky-400', dotClass: 'bg-sky-400' },
    { status: 'LOCKED', label: 'Đang khóa (Locked)', percent: 12, taskCount: 6, barClass: 'bg-slate-300', dotClass: 'bg-slate-300' },
  ] },
  aiReport: { engine: 'Gemini', generatedAt: '2026-10-02T06:30:00Z', insights: [
    { id: 'i1', kind: 'CRITICAL_PATH', severity: 'HIGH', icon: '🔴', kicker: 'Cảnh báo Đường găng · Critical Path at risk', tag: 'Nguy cơ cao', title: 'QA Testing bị chặn bởi 2 upstream nodes.', description: 'Backend Auth API và Data Schema trễ hạn 2 ngày làm trễ toàn bộ mốc phát hành.', relatedNodeIds: [], boxClass: 'bg-red-50 border-red-200', tagClass: 'bg-red-100 text-red-700' },
    { id: 'i2', kind: 'BOTTLENECK', severity: 'MEDIUM', icon: '🟡', kicker: 'Điểm nghẽn nhân sự · Bottleneck detected', tag: 'Tắc nghẽn tải trọng', title: 'Node WPE-014 (Marcus Liu) quá tải 147%.', description: 'Đang ngâm 8 ngày không có cập nhật sub-task. Đề xuất san sẻ tải.', relatedNodeIds: ['WPE-014'], boxClass: 'bg-amber-50 border-amber-200', tagClass: 'bg-amber-100 text-amber-800' },
    { id: 'i3', kind: 'RECOMMENDATION', severity: 'ADVICE', icon: '🟢', kicker: 'Khuyến nghị hành động · AI Actionable Advice', tag: 'Khuyến nghị ưu tiên', title: 'Tái phân bổ nhánh UI Form sang Sarah Chen.', description: 'Giải phóng đường găng trước ngày 05/10 để kịp tiến độ bàn giao.', relatedNodeIds: [], boxClass: 'bg-emerald-50 border-emerald-200', tagClass: 'bg-emerald-100 text-emerald-700' },
  ] },
  guestAccess: buildGuest('gst_sec_89f2a4', true),
  feedbackQueue: [
    { id: 'f1', reviewerName: 'Cô Lan', reviewerRole: 'TEACHER', nodeRef: { nodeId: '9', code: 'WPE-009', title: 'Thiết kế Schema' }, content: 'Chưa thấy ràng buộc UNIQUE cho cặp parent/child, cần giải trình.', status: 'OPEN', createdAt: '2026-10-02T05:30:00Z' },
    { id: 'f2', reviewerName: 'Anh Minh', reviewerRole: 'GUEST', nodeRef: { nodeId: '12', code: 'WPE-012', title: 'Auth API' }, content: 'Thời gian hết hạn JWT chưa rõ, vui lòng bổ sung tài liệu.', status: 'OPEN', createdAt: '2026-10-01T09:00:00Z' },
  ],
  recentActivity: [
    { id: 'a1', actor: { initials: 'SC', name: 'Sarah Chen', avatarClass: 'bg-indigo-500' }, action: 'SUBMITTED_PR', message: 'vừa nộp PR cho WPE-012', nodeCode: 'WPE-012', occurredAt: '2026-10-02T08:18:00Z' },
    { id: 'a2', actor: { initials: 'AK', name: 'Alex Kim', avatarClass: 'bg-emerald-500' }, action: 'APPROVED', message: 'vừa duyệt schema WPE-009', nodeCode: 'WPE-009', occurredAt: '2026-10-02T07:43:00Z' },
    { id: 'a3', actor: { initials: 'ML', name: 'Marcus Liu', avatarClass: 'bg-rose-500' }, action: 'OVERDUE_ALERT', message: 'cảnh báo WPE-014 trễ hạn', nodeCode: 'WPE-014', occurredAt: '2026-10-02T06:28:00Z' },
    { id: 'a4', actor: { initials: 'JD', name: 'Jamie Doe', avatarClass: 'bg-amber-500' }, action: 'CLAIMED', message: 'nhận việc WPE-021 (Claim)', nodeCode: 'WPE-021', occurredAt: '2026-10-02T03:28:00Z' },
  ],
}

export class MockOverviewApi implements Pick<IWorkflowService, 'getOverviewData' | 'toggleGuestAccess' | 'generateGuestToken'> {
  private data: OverviewData = structuredClone(MOCK_OVERVIEW)

  async getOverviewData(_projectId: string): Promise<OverviewData> {
    await mockDelay()
    return structuredClone(this.data)
  }

  async toggleGuestAccess(_projectId: string, active: boolean): Promise<GuestAccessState> {
    await mockDelay(150)
    this.data.guestAccess = buildGuest(this.data.guestAccess.token, active)
    return structuredClone(this.data.guestAccess)
  }

  async generateGuestToken(_projectId: string): Promise<GuestAccessState> {
    await mockDelay(150)
    const suffix = Math.random().toString(16).slice(2, 8).padEnd(6, '0')
    this.data.guestAccess = buildGuest(`gst_sec_${suffix}`, true)
    return structuredClone(this.data.guestAccess)
  }

  setProjectStatus(status: ProjectStatus): void {
    const labelMap: Record<ProjectStatus, string> = {
      DRAFT: 'Phase 2 · Draft',
      ACTIVE: 'Phase 2 · Published',
      INACTIVE: 'Phase 2 · Paused',
      ARCHIVED: 'Phase 2 · Archived',
    }
    this.data.project.phaseLabel = labelMap[status] || status
  }

  reset(): void {
    this.data = structuredClone(MOCK_OVERVIEW)
  }
}
