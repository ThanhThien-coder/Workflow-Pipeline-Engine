import { Check, Lock, ArrowRight } from 'lucide-react'
import { ReactFlow, Background, Handle, Position, BezierEdge, type NodeProps } from '@xyflow/react'
import { useMemo } from 'react'
import dagre from 'dagre'
import { useWorkflowStore, type QuestStatus } from '../../store/useWorkflowStore'

function QuestCard({ data }: NodeProps) {
  const { title, status, action, actionLabel, description, kind, assignee, progress } = data as { title: string; kind: string; status: QuestStatus; action?: () => void; actionLabel?: string; description?: string; assignee?: string; progress?: number }
  if (status === 'done') return <div className="quest-done-card"><Handle id="target" type="target" position={Position.Left} className="!w-2 !h-2 !bg-blue-500 !border-2 !border-white !opacity-100"/><Check size={21}/><b>{title}</b><small>Jamie Doe</small><Handle id="source" type="source" position={Position.Right} className="!w-2 !h-2 !bg-blue-500 !border-2 !border-white !opacity-100"/></div>
  if (status === 'locked') return <div className="quest-locked-card"><Handle id="target" type="target" position={Position.Left} className="!w-2 !h-2 !bg-blue-500 !border-2 !border-white !opacity-100"/><Lock size={16}/><b>{title}</b><small>Waiting for 2 nodes</small><Handle id="source" type="source" position={Position.Right} className="!w-2 !h-2 !bg-blue-500 !border-2 !border-white !opacity-100"/></div>
  return <div className={`quest-focus-card ${status}`}>
    <Handle id="target" type="target" position={Position.Left} className="!w-2 !h-2 !bg-blue-500 !border-2 !border-white !opacity-100"/>
    <span className="focus-status">● {status === 'review' ? 'PENDING REVIEW' : 'IN PROGRESS'}{progress !== undefined ? ` · ${progress}%` : ''}</span>
    <h2>{title}</h2><p>{description}</p>
    {assignee && <small className="quest-assignee">{assignee}</small>}
    {action && <button className="button primary full" onClick={action}>{actionLabel}<ArrowRight size={15}/></button>}
    <Handle id="source" type="source" position={Position.Right} className="!w-2 !h-2 !bg-blue-500 !border-2 !border-white !opacity-100"/>
  </div>
}

const edgeTypes = { bezier: BezierEdge }

export function QuestMapCanvas() {
  const quest = useWorkflowStore((state) => state.quest)
  const submitArtifact = useWorkflowStore((state) => state.submitArtifact)
  const approveReview = useWorkflowStore((state) => state.approveReview)
  const completeDatabase = useWorkflowStore((state) => state.completeDatabase)
  const claimIntegration = useWorkflowStore((state) => state.claimIntegration)
  const baseNodes = [
    { id: 'kickoff', type: 'quest', position: { x: 25, y: 145 }, data: { title: 'Kickoff & Scope', kind: 'done', status: 'done' as QuestStatus } },
    { id: 'jamie', type: 'quest', position: { x: 270, y: 35 }, data: { title: 'Build UI Library', kind: 'review', status: quest.jamie, assignee: 'Jamie Doe', progress: 62, description: 'Build reusable components, state management, and design tokens across all screens.', action: quest.jamie === 'active' ? submitArtifact : quest.jamie === 'review' ? approveReview : undefined, actionLabel: quest.jamie === 'active' ? 'Submit Artifact' : 'Approve owner review' } },
    { id: 'database', type: 'quest', position: { x: 270, y: 280 }, data: { title: 'Setup Database', kind: 'database', status: quest.database, assignee: 'Alex Kim', description: 'Provision environments and connect the persistence layer.', action: quest.database === 'active' ? completeDatabase : undefined, actionLabel: 'Mark Setup Database done' } },
    { id: 'integration', type: 'quest', position: { x: 650, y: 155 }, data: { title: 'Integration Test', kind: 'integration', status: quest.integration, description: 'Verify both workstreams merge cleanly before release.', action: quest.integration === 'active' ? claimIntegration : undefined, actionLabel: 'Claim Integration Test' } },
  ]
  const rawEdges = [
    { id: 'q-kickoff-jamie', source: 'kickoff', target: 'jamie', sourceHandle: 'source', targetHandle: 'target', type: 'bezier' },
    { id: 'q-kickoff-db', source: 'kickoff', target: 'database', sourceHandle: 'source', targetHandle: 'target', type: 'bezier' },
    { id: 'q-jamie-integration', source: 'jamie', target: 'integration', sourceHandle: 'source', targetHandle: 'target', type: 'bezier' },
    { id: 'q-db-integration', source: 'database', target: 'integration', sourceHandle: 'source', targetHandle: 'target', type: 'bezier' },
  ]
  const nodes = useMemo(() => {
    const graph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}))
    graph.setGraph({ rankdir: 'LR', nodesep: 70, ranksep: 130 })
    baseNodes.forEach((node) => graph.setNode(node.id, { width: node.id === 'kickoff' ? 180 : 280, height: node.id === 'kickoff' ? 100 : 230 }))
    rawEdges.forEach((edge) => graph.setEdge(String(edge.source), String(edge.target)))
    dagre.layout(graph)
    return baseNodes.map((node) => {
      const position = graph.node(node.id)
      return { ...node, position: { x: position.x - (node.id === 'kickoff' ? 90 : 140), y: position.y - (node.id === 'kickoff' ? 50 : 115) } }
    })
  }, [quest, baseNodes, rawEdges])
  const edges = rawEdges.map((edge) => ({ ...edge, id: `edge-${String(edge.source)}-${String(edge.target)}`, source: String(edge.source), target: String(edge.target), sourceHandle: edge.sourceHandle ?? undefined, targetHandle: edge.targetHandle ?? undefined, type: 'bezier' as const, animated: true, style: { stroke: '#3b82f6', strokeWidth: 2 } }))
  return <div className="quest-canvas"><div className="quest-legend"><span>Completed</span><span>Active</span><span>Done</span><span>In Progress</span><span>Review</span><span>Locked</span></div><ReactFlow nodes={nodes} edges={edges} nodeTypes={{ quest: QuestCard }} edgeTypes={edgeTypes} defaultEdgeOptions={{ type: 'bezier', animated: true, style: { strokeWidth: 2, stroke: '#3b82f6' } }} fitView fitViewOptions={{ padding: 0.2 }} minZoom={0.45} maxZoom={1.35} nodesDraggable={false} nodesConnectable={false} panOnDrag><Background color="#cbd3df" gap={18} size={1}/></ReactFlow></div>
}
