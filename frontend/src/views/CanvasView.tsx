import { useCallback } from 'react'
import { ReactFlow, Background, Handle, NodeResizer, Position, BezierEdge, type NodeProps } from '@xyflow/react'
import { NodePropertiesDrawer } from '../components/canvas/NodePropertiesDrawer'
import { ViewportControls } from '../components/canvas/ViewportControls'
import { useWorkflowStore } from '../store/useWorkflowStore'
import type { Phase, Task } from '../types/workflow'

function GroupNode({ data, selected }: NodeProps) {
  const { label, phase } = data as { label: string; phase: Phase }
  return <div className={`flow-group ${phase.status.toLowerCase()}`}>
    <NodeResizer
      minWidth={320}
      minHeight={220}
      isVisible={selected}
      lineClassName="border-blue-400"
      handleClassName="w-2.5 h-2.5 bg-white border-2 border-blue-500 rounded-sm"
    />
    <Handle id="target" type="target" position={Position.Left} className="!w-2 !h-2 !bg-blue-500 !border-2 !border-white !opacity-100 group-handle" />
    <div className="stage-head"><div><div className="stage-title"><b>{label}</b></div><small>{phase.status === 'COMPLETED' ? 'COMPLETED' : phase.status === 'LOCKED' ? 'LOCKED' : 'IN PROGRESS'}</small></div>{phase.progress !== undefined && <div className="stage-progress"><b>{phase.progress}%</b><div><i style={{ width: `${phase.progress}%` }} /></div></div>}</div>
    <Handle id="source" type="source" position={Position.Right} className="!w-2 !h-2 !bg-blue-500 !border-2 !border-white !opacity-100 group-handle" />
  </div>
}

function TaskFlowNode({ data }: NodeProps) {
  const { task } = data as { label: string; task: Task }
  return <button className={`task-node ${task.status.toLowerCase()}`} onClick={() => useWorkflowStore.getState().selectTask(task)} style={{ '--accent': task.accent } as React.CSSProperties}>
    <Handle id="target" type="target" position={Position.Left} className="!w-2 !h-2 !bg-blue-500 !border-2 !border-white !opacity-100" />
    <div className="node-top"><b>{task.title}</b><span className="status-chip">{task.status.replace('_', ' ')}</span></div>
    <div className="node-meta"><span className="node-user" style={{ background: task.assignee.color }}>{task.assignee.initials}</span>{task.assignee.name}</div>
    <Handle id="source" type="source" position={Position.Right} className="!w-2 !h-2 !bg-blue-500 !border-2 !border-white !opacity-100" />
  </button>
}

const nodeTypes = { phaseGroup: GroupNode, task: TaskFlowNode, quest: TaskFlowNode }
const edgeTypes = { bezier: BezierEdge }

export function CanvasView({ selected, onSelect }: { selected: Task | null; onSelect: (task: Task | null) => void }) {
  const nodes = useWorkflowStore((state) => state.nodes)
  const edges = useWorkflowStore((state) => state.edges)
  const onNodesChange = useWorkflowStore((state) => state.onNodesChange)
  const onEdgesChange = useWorkflowStore((state) => state.onEdgesChange)
  const selectTask = useWorkflowStore((state) => state.selectTask)
  const storeSelected = useWorkflowStore((state) => state.selectedTask)
  const closeDrawer = useCallback(() => { selectTask(null); onSelect(null) }, [selectTask, onSelect])
  const visibleSelected = storeSelected ?? selected
  return <div className="canvas-wrap">
    <div className="canvas-toolbar"><div className="legend"><i/> Done <i/> In Progress <i/> Todo <i/> Blocked</div><span className="node-count">7 nodes · 6 edges</span></div>
    <div className="dag-canvas">
      <ReactFlow nodes={nodes} edges={edges.map((edge) => ({ ...edge, type: 'bezier' }))} nodeTypes={nodeTypes} edgeTypes={edgeTypes} defaultEdgeOptions={{ type: 'bezier', style: { strokeWidth: 2, stroke: '#94a3b8' } }} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} fitView fitViewOptions={{ padding: 0.18 }} minZoom={0.45} maxZoom={1.5} nodesDraggable nodesConnectable={false} className="workflow-flow">
        <Background color="#cbd3df" gap={18} size={1} />
      </ReactFlow>
      <ViewportControls />
    </div>
    {visibleSelected && <NodePropertiesDrawer task={visibleSelected} onClose={closeDrawer} />}
  </div>
}
