import { MacroWorkflow } from './MacroWorkflow'
import { MindmapDrawer } from './MindmapDrawer'

export function WorkflowView({ projectId = '1' }: { projectId?: string }) {
  return (
    <div className="relative flex h-full w-full overflow-hidden bg-slate-50">
      <MacroWorkflow projectId={projectId} className="flex-1 min-w-0" />
      <MindmapDrawer />
    </div>
  )
}

export default WorkflowView
