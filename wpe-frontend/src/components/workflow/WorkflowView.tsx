import { MacroWorkflow } from './MacroWorkflow'
import { MindmapDrawer } from './MindmapDrawer'

export function WorkflowView() {
  return (
    <div className="flex h-full w-full overflow-hidden bg-slate-50">
      <MacroWorkflow className="flex-1 min-w-0" />
      <MindmapDrawer />
    </div>
  )
}

export default WorkflowView
