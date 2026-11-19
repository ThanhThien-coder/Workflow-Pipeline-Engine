import { useEffect, useRef } from 'react'
import { MacroWorkflow } from './MacroWorkflow'
import { PhaseDetailView, phaseDetailPath } from './PhaseDetailView'
import { useWorkflowStore } from '../../store/useWorkflowStore'
import { useRouter } from '../../router/useRouter'

/**
 * Tab Workflow. Đường dẫn là nguồn sự thật:
 * - `/project/:id/workflow`              → canvas Macro
 * - `/project/:id/workflow/phase/:phaseId` → màn chi tiết phase toàn màn hình (sidebar dự án vẫn giữ)
 * `selectedPhaseId` trong store được giữ đồng bộ hai chiều (không để store xóa selectedPhaseId đẩy đường dẫn về Macro).
 */
export function WorkflowView({ projectId = '1', phaseId = null }: { projectId?: string; phaseId?: string | null }) {
  const { navigate } = useRouter()
  const selectedPhaseId = useWorkflowStore((state) => state.selectedPhaseId)
  const selectPhase = useWorkflowStore((state) => state.selectPhase)
  const graphStatus = useWorkflowStore((state) => state.graphStatus)
  const currentProjectId = useWorkflowStore((state) => state.currentProjectId)

  // Store → đường dẫn: chỉ khi selectedPhaseId VỪA ĐỔI sang một phase khác đường dẫn hiện tại
  // (MacroWorkflow chọn phase, ...). Đổi sang null thì bỏ qua: nút Back của màn chi tiết lo việc quay về.
  const prevSelected = useRef(selectedPhaseId)
  useEffect(() => {
    const previous = prevSelected.current
    prevSelected.current = selectedPhaseId
    if (selectedPhaseId && selectedPhaseId !== previous && selectedPhaseId !== phaseId) {
      navigate(phaseDetailPath(projectId, selectedPhaseId))
    }
  }, [selectedPhaseId, phaseId, projectId, navigate])

  // Đường dẫn → store: khi đường dẫn đổi (kể cả nút Back của trình duyệt) và sau mỗi lần tải đồ thị
  // (loadPhases khi đổi dự án đặt selectedPhaseId = null). So sánh trước khi gọi để không lặp vòng.
  useEffect(() => {
    const target = phaseId ?? null
    if (useWorkflowStore.getState().selectedPhaseId !== target) selectPhase(target)
  }, [phaseId, graphStatus, currentProjectId, selectPhase])

  if (phaseId) {
    return (
      <div className="relative h-full w-full overflow-hidden bg-slate-50">
        <PhaseDetailView key={phaseId} projectId={projectId} phaseId={phaseId} />
      </div>
    )
  }

  return (
    <div className="relative flex h-full w-full overflow-hidden bg-slate-50">
      <MacroWorkflow projectId={projectId} className="flex-1 min-w-0" />
    </div>
  )
}

export default WorkflowView
