import { type FC } from 'react'
import { WorkflowView } from '../components/views/WorkflowView'

export interface WorkflowCanvasViewProps {
  projectId?: string
}

export const WorkflowCanvasView: FC<WorkflowCanvasViewProps> = ({ projectId = '1' }) => {
  return <WorkflowView projectId={projectId} />
}

export default WorkflowCanvasView
