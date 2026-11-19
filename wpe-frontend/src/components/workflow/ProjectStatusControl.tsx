import { useState } from 'react'
import { CheckCircle2, Pause, Play, RotateCcw, Rocket } from 'lucide-react'
import { useWorkflowStore } from '../../store/useWorkflowStore'
import { currentProjectInfo } from '../../store/projectInfo'
import { workflowService } from '../../services/container'
import { StatusBadge } from '../common/StatusBadge'
import { ConfirmDialog } from '../../features/admin/templates/components/ConfirmDialog'
import { KahnCycleModal } from '../settings/KahnCycleModal'
import type { ProjectStatus } from '../../types/workspace.types'

/**
 * Trạng thái dự án và các nút chuyển trạng thái, đặt ở màn Workflow (chỉ chủ dự án thấy nút).
 * DRAFT/PLANNING: Start project (publish, kiểm chu trình) · ACTIVE: Pause, Complete · PAUSED: Resume, Complete · COMPLETED: Reopen.
 * Lưu trữ / khôi phục / xóa dự án vẫn ở Settings (vùng nguy hiểm).
 */
type Action = {
  key: string
  label: string
  to: 'PUBLISH' | 'ACTIVE' | 'PAUSED' | 'COMPLETED'
  icon: typeof Play
  primary?: boolean
  title: string
  message: string
}

const PUBLISH: Action = {
  key: 'publish', label: 'Start project', to: 'PUBLISH', icon: Rocket, primary: true,
  title: 'Start this project?',
  message: 'The graph is checked for dependency cycles first. Tasks with no prerequisites become To Do and collaborators can start working on their tasks.',
}
const PAUSE: Action = {
  key: 'pause', label: 'Pause', to: 'PAUSED', icon: Pause,
  title: 'Pause this project?',
  message: 'While paused, collaborators can only view tasks. The owner and managers can still work on tasks.',
}
const RESUME: Action = {
  key: 'resume', label: 'Resume', to: 'ACTIVE', icon: Play, primary: true,
  title: 'Resume this project?', message: 'Collaborators can work on their tasks again.',
}
const COMPLETE: Action = {
  key: 'complete', label: 'Mark completed', to: 'COMPLETED', icon: CheckCircle2,
  title: 'Mark this project as completed?',
  message: 'Collaborators can only view tasks. You can reopen the project later if more work is needed.',
}
const REOPEN: Action = {
  key: 'reopen', label: 'Reopen project', to: 'ACTIVE', icon: RotateCcw,
  title: 'Reopen this project?', message: 'The project becomes active again and collaborators can work on their tasks.',
}

export function actionsForStatus(status: string | null | undefined): Action[] {
  switch (status) {
    case 'DRAFT':
    case 'PLANNING':
      return [PUBLISH]
    case 'ACTIVE':
      return [PAUSE, COMPLETE]
    case 'PAUSED':
      return [RESUME, COMPLETE]
    case 'COMPLETED':
      return [REOPEN]
    default:
      return []
  }
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

  // Trạng thái mới cũng ghi vào bản Settings (nếu đang giữ), để màn Settings không hiện trạng thái cũ
  const rememberStatus = (next: string) =>
    useWorkflowStore.setState((state) =>
      state.settings.settings && String(state.settings.settings.id) === String(projectId)
        ? { settings: { ...state.settings, settings: { ...state.settings.settings, status: next as never } } }
        : {},
    )

  const run = async (action: Action) => {
    setBusy(true)
    try {
      if (action.to === 'PUBLISH') {
        const ok = await publishProject(projectId)
        if (!ok) {
          // Chu trình: KahnCycleModal tự mở. Lỗi khác: publishProject ghi vào toast của Settings (không hiện ở đây) -> báo lại
          const settings = useWorkflowStore.getState().settings
          if (!settings.kahnCycleErrors) showToast(settings.toast || 'Could not start the project.', 4000)
          return
        }
        showToast('Project started. Tasks with no prerequisites are now To Do.')
      } else {
        if (!workflowService.updateProjectStatus) throw new Error('Changing the project status is not supported.')
        await workflowService.updateProjectStatus(projectId, action.to)
        rememberStatus(action.to)
        showToast(`Project is now ${action.to === 'ACTIVE' ? 'active' : action.to.toLowerCase()}.`)
      }
      // Sự kiện realtime của chính tab này bị bỏ qua: tự tải lại thông tin dự án và đồ thị (publish mở task gốc)
      await Promise.all([loadProject(projectId), loadPhases(projectId)])
    } catch (error) {
      showToast(error instanceof Error && error.message ? error.message : 'Could not change the project status.', 4000)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-1.5" data-testid="project-status-control">
      <StatusBadge status={status as ProjectStatus} />
      {actions.map((action) => {
        const Icon = action.icon
        return (
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
            <Icon size={13} /> {action.label}
          </button>
        )
      })}
      <ConfirmDialog
        isOpen={pending !== null}
        title={pending?.title ?? ''}
        message={pending?.message ?? ''}
        confirmLabel={pending?.label}
        onConfirm={() => {
          const action = pending
          setPending(null)
          if (action) void run(action)
        }}
        onCancel={() => setPending(null)}
      />
      <KahnCycleModal violatingNodeIds={kahnErrors} onClose={() => setKahnErrors(null)} />
    </div>
  )
}
