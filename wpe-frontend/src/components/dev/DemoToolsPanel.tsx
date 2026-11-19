import { useCallback, useEffect, useMemo, useState } from 'react'
import { useWorkflowStore } from '../../store/useWorkflowStore'
import { ApiError } from '../../services/http/ApiError'
import { phaseDisplayName } from '../../utils/phaseName'
import type { NodeStatus } from '../../types/workflow.types'
import {
  completeAllInPhase,
  expireGuestLink,
  expireInvitations,
  fetchDemoStatus,
  forceStatus,
  makeOverdue,
  resetAiCooldown,
  runOverdueScan,
  sendTestNotification,
} from '../../services/impl/http/demo'

const STATUSES: NodeStatus[] = ['LOCKED', 'TODO', 'IN_PROGRESS', 'REVIEW', 'DONE']

interface DemoToolsPanelProps {
  projectId: string
}

/**
 * TASK_74 — Panel công cụ demo (chỉ để test đồ án). Hiện khi backend bật demo-tools
 * và người dùng là OWNER của dự án hoặc ADMIN hệ thống. Gọi API thật, không dùng mock.
 */
export function DemoToolsPanel({ projectId }: DemoToolsPanelProps) {
  const [enabled, setEnabled] = useState(false)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [phaseId, setPhaseId] = useState('')
  const [taskId, setTaskId] = useState('')
  const [status, setStatus] = useState<NodeStatus>('IN_PROGRESS')

  const macroPhases = useWorkflowStore((s) => s.macroPhases)
  const trees = useWorkflowStore((s) => s.trees)
  const systemRole = useWorkflowStore((s) => s.auth.currentUser?.systemRole)
  // Chỉ lấy vai trò của ĐÚNG dự án đang mở (settings/project có thể còn dữ liệu dự án trước)
  const myRole = useWorkflowStore((s) => {
    if (s.settings.settings && String(s.settings.settings.id) === String(projectId)) return s.settings.settings.myRole
    if (s.project.projectId === projectId) return s.project.info?.myRole
    return undefined
  })

  useEffect(() => {
    let cancelled = false
    setEnabled(false)
    void fetchDemoStatus().then((value) => {
      if (!cancelled) setEnabled(value)
    })
    return () => {
      cancelled = true
    }
  }, [projectId])

  const allowed = enabled && (myRole === 'OWNER' || systemRole === 'ADMIN')

  useEffect(() => {
    if (!allowed) return
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [allowed])

  const tasks = useMemo(() => {
    const tree = trees[phaseId]
    if (!tree) return []
    return Object.values(tree).filter((n) => n.kind === 'branch')
  }, [trees, phaseId])

  const run = useCallback(
    async (action: () => Promise<string>) => {
      const state = useWorkflowStore.getState()
      setBusy(true)
      try {
        const message = await action()
        state.ui.showToast(message)
        await state.loadPhases(projectId)
        if (useWorkflowStore.getState().activeTab === 'my-tasks') {
          await state.kanban.loadTasks(projectId)
        }
      } catch (err) {
        state.ui.showToast(err instanceof ApiError ? err.message : 'Demo action failed.')
      } finally {
        setBusy(false)
      }
    },
    [projectId],
  )

  if (!allowed) return null

  const needTask = !taskId
  const needPhase = !phaseId
  const btn =
    'px-2 py-1 text-xs rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed'

  return (
    // Giữa cạnh dưới: góc dưới trái là thanh "+ Add task" của cây task, góc dưới phải là nút zoom
    <div className="absolute bottom-4 left-1/2 z-40 flex -translate-x-1/2 flex-col items-center">
      {open && (
        <div
          role="dialog"
          aria-label="Demo tools"
          className="mb-2 w-80 max-h-[70vh] overflow-y-auto rounded-lg border border-amber-300 bg-white p-3 shadow-lg text-slate-700"
        >
          <div className="mb-2 text-sm font-semibold">Demo tools (testing only)</div>

          <label className="block text-xs mb-1">
            Phase
            <select
              aria-label="Demo phase"
              className="mt-1 w-full rounded border border-slate-300 p-1 text-xs"
              value={phaseId}
              onChange={(e) => {
                setPhaseId(e.target.value)
                setTaskId('')
              }}
            >
              <option value="">-- choose phase --</option>
              {macroPhases.map((p) => (
                <option key={p.id} value={p.id}>
                  {phaseDisplayName(p)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs mb-2">
            Task
            <select
              aria-label="Demo task"
              className="mt-1 w-full rounded border border-slate-300 p-1 text-xs"
              value={taskId}
              onChange={(e) => setTaskId(e.target.value)}
              disabled={!phaseId}
            >
              <option value="">-- choose task --</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-wrap gap-1 mb-2">
            <button
              type="button"
              className={btn}
              disabled={busy || needTask}
              onClick={() =>
                run(async () => {
                  await makeOverdue(projectId, taskId)
                  return 'Task is now overdue.'
                })
              }
            >
              Make overdue now
            </button>
            <button
              type="button"
              className={btn}
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const r = await runOverdueScan(projectId)
                  return `Overdue scan done: ${r?.overdueCount ?? 0} overdue.`
                })
              }
            >
              Run overdue scan
            </button>
          </div>

          <div className="flex gap-1 mb-2">
            <select
              aria-label="Demo status"
              className="flex-1 rounded border border-slate-300 p-1 text-xs"
              value={status}
              onChange={(e) => setStatus(e.target.value as NodeStatus)}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={btn}
              disabled={busy || needTask}
              onClick={() =>
                run(async () => {
                  await forceStatus(projectId, taskId, status)
                  return `Status forced to ${status}.`
                })
              }
            >
              Force status
            </button>
          </div>

          <div className="mb-2">
            <button
              type="button"
              className={btn}
              disabled={busy || needPhase}
              onClick={() =>
                run(async () => {
                  const r = await completeAllInPhase(projectId, phaseId)
                  return `Completed ${r?.completedCount ?? 0} tasks.`
                })
              }
            >
              Complete all tasks in phase
            </button>
          </div>

          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              className={btn}
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await resetAiCooldown(projectId)
                  return 'AI cooldown reset.'
                })
              }
            >
              Reset AI cooldown
            </button>
            <button
              type="button"
              className={btn}
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await expireGuestLink(projectId)
                  return 'Guest link expired.'
                })
              }
            >
              Expire guest link
            </button>
            <button
              type="button"
              className={btn}
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const r = await expireInvitations(projectId)
                  return `Expired ${r?.expiredCount ?? 0} pending invitations.`
                })
              }
            >
              Expire pending invitations
            </button>
            <button
              type="button"
              className={btn}
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await sendTestNotification(projectId)
                  return 'Test notification sent.'
                })
              }
            >
              Send test notification
            </button>
          </div>
        </div>
      )}
      <button
        type="button"
        aria-label="Toggle demo tools"
        title="Demo tools (testing only) - Ctrl+Shift+D"
        onClick={() => setOpen((v) => !v)}
        className="h-9 w-9 rounded-full border border-amber-400 bg-amber-100 text-xs font-bold text-amber-800 shadow hover:bg-amber-200"
      >
        D
      </button>
    </div>
  )
}

export default DemoToolsPanel
