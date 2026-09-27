import { UserRound, LockKeyhole } from 'lucide-react'
import { Handle, Position } from '@xyflow/react'
import { Task } from '../../types/workflow'
export function TaskNodeCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const locked = task.status === 'LOCKED'
  return <button className={'task-node ' + task.status.toLowerCase()} onClick={onClick} style={{'--accent': task.accent} as React.CSSProperties}><Handle id="target" type="target" position={Position.Left}/><div className="node-top"><b>{task.title}</b><span className="status-chip">{locked ? <LockKeyhole size={11}/> : task.status.replace('_', ' ')}</span></div><div className="node-meta"><span className="node-user" style={{background: task.assignee.color}}><UserRound size={11}/>{task.assignee.initials}</span>{task.assignee.name}</div><Handle id="source" type="source" position={Position.Right}/></button>
}
