import { useState } from 'react'
import { useWorkflowStore } from '../../store/useWorkflowStore'
import { currentProjectInfo } from '../../store/projectInfo'
import { StatusBadge } from '../common/StatusBadge'
import { ConfirmDialog } from '../../features/admin/templates/components/ConfirmDialog'
import { KahnCycleModal } from '../settings/KahnCycleModal'
import type { ProjectStatus } from '../../types/workspace.types'

/**
 * Trạng thái dự án và nút Start project, đặt ở màn Workflow (chỉ chủ dự án thấy nút).
 * Dự án có 3 trạng thái (G34): DRAFT có nút Start project (publish, kiểm chu trình); ACTIVE không có nút
 * (xong hết task vẫn ACTIVE); ARCHIVED chỉ đọc. Lưu trữ / khôi phục / xóa dự án ở Settings (vùng nguy hiểm).
 */
type Action = {
  key: string
  label: string
  primary?: boolean
  title: string
  message: string
}

const PUBLISH: Action = {
  key: 'publish', label: 'Start project', primary: true,
  title: 'Start this project?',
  message: 'The graph is checked for dependency cycles first. Tasks with no prerequisites become To Do and collaborators can start working on their tasks.',
}

export function actionsForStatus(status: string | null | undefined): Action[] {
  return status === 'DRAFT' ? [PUBLISH] : []
}

export function ProjectStatusControl({ projectId }: { projectId: string }) {
  const info = useWorkflowStore((state) => currentProjectInfo(state))
  const publishProject = useWorkflowStore((state) => state.settings.publishProject)
  const kahnErrors = useWorkflowStore((state) => state.settings.kahnCycleErrors)
  const setKahnErrors = useWorkflowStore((state) => state.settings.setKahnCycleErrors)
  const loadProject = useWorkflowStore((state) => state.project.loadProject)
  const loadPhases = useWorkflowStore((state) => state.loadPhases)
  const showToast = useWorkflowStore((state) => state.ui.showToast)
  const [pending, setPending] = useState<Action | null>(null)
  const [busy, setBusy] = useState(false)

  const status = info?.status
  if (!status) return null
  const isOwner = info?.myRole === 'OWNER'
  const actions = isOwner ? actionsForStatus(status) : []

  const run = async () => {
    setBusy(true)
    try {
      const ok = await publishProject(projectId)
      if (!ok) {
        // Chu trình: KahnCycleModal tự mở. Lỗi khác: publishProject ghi vào toast của Settings (không hiện ở đây) -> báo lại
        const settings = useWorkflowStore.getState().settings
        if (!settings.kahnCycleErrors) showToast(settings.toast || 'Could not start the project.', 4000)
        return
      }
      showToast('Project started. Tasks with no prerequisites are now To Do.')
      // Sự kiện realtime của chính tab này bị bỏ qua: tự tải lại thông tin dự án và đồ thị (publish mở task gốc)
      await Promise.all([loadProject(projectId), loadPhases(projectId)])
    } catch (error) {
      showToast(error instanceof Error && error.message ? error.message : 'Could not start the project.', 4000)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-1.5" data-testid="project-status-control">
      <StatusBadge status={status as ProjectStatus} />
      {actions.map((action) => (
        <button
          key={action.key}
          type="button"
          disabled={busy}
          onClick={() => setPending(action)}
          className={
            action.primary
              ? 'flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50'
              : 'flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50'
          }
        >
          {action.label}
        </button>
      ))}
      <ConfirmDialog
        isOpen={pending !== null}
        title={pending?.title ?? ''}
        message={pending?.message ?? ''}
        confirmLabel={pending?.label}
        onConfirm={() => {
          const action = pending
          setPending(null)
          if (action) void run()
        }}
        onCancel={() => setPending(null)}
      />
      <KahnCycleModal violatingNodeIds={kahnErrors} onClose={() => setKahnErrors(null)} />
    </div>
  )
}
