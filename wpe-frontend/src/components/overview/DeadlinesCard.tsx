import { useCallback } from 'react'
import { DeadlineAudit } from '../../views/guest-report/sections/DeadlineAudit'
import { useProjectReport } from '../../hooks/useProjectReport'
import { useWorkflowStore } from '../../store/useWorkflowStore'
import { useRouter } from '../../router/useRouter'
import { phaseDetailPath } from '../workflow/PhaseDetailView'

/**
 * Khối Deadlines ở Overview của thành viên: dùng lại DeadlineAudit của trang khách
 * (tab Needs attention / Finished late). Bấm Graph thì mở phase của task và làm nổi task đó.
 * Chưa có dữ liệu (đang tải, lỗi, chế độ mock) thì không hiện gì.
 */
export function DeadlinesCard({ projectId, refreshKey }: { projectId: string; refreshKey?: string | number | null }) {
  const model = useProjectReport(projectId, refreshKey)
  const setHighlightNodeId = useWorkflowStore((state) => state.ui.setHighlightNodeId)
  const { navigate } = useRouter()

  const handleGraph = useCallback(
    (taskId: string) => {
      const phaseId = model?.byId[taskId]?.phaseId
      if (!phaseId) return
      navigate(phaseDetailPath(projectId, phaseId))
      setHighlightNodeId(taskId)
    },
    [model, navigate, projectId, setHighlightNodeId],
  )

  if (!model || model.tasks.length === 0) return null

  return (
    <div data-testid="overview-deadlines">
      <DeadlineAudit model={model} onGraph={handleGraph} />
    </div>
  )
}
