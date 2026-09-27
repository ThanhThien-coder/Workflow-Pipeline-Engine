import { CheckCircle2, Lock, CircleDot } from 'lucide-react'
import { Phase, Task } from '../../types/workflow'
import { TaskNodeCard } from './TaskNodeCard'
export function StageContainer({phase, onSelect}: {phase: Phase; onSelect: (t: Task) => void}) {
 const Icon = phase.status === 'COMPLETED' ? CheckCircle2 : phase.status === 'LOCKED' ? Lock : CircleDot
 return <section className={'stage ' + phase.status.toLowerCase()}><div className="stage-head"><div><div className="stage-title"><Icon size={15}/><b>{phase.title}: {phase.subtitle}</b></div><small>{phase.status === 'COMPLETED' ? 'COMPLETED' : phase.status === 'LOCKED' ? 'LOCKED' : 'IN PROGRESS'}</small></div>{phase.progress !== undefined && <div className="stage-progress"><b>{phase.progress}%</b><div><i style={{width: phase.progress + '%'}}/></div></div>}</div><div className="stage-nodes">{phase.tasks.map(task => <TaskNodeCard key={task.id} task={task} onClick={() => onSelect(task)}/>)}</div></section>
}
