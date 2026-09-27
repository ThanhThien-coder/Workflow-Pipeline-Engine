import { useState } from 'react'
import { ArrowRight, UserRound } from 'lucide-react'
import { Handle, Position } from '@xyflow/react'
import { Task } from '../../types/workflow'
export function FocusNodeCard({task}: {task: Task}) { const [open,setOpen] = useState(false); return <div className="focus-card"><Handle id="target" type="target" position={Position.Left}/><div className="focus-top"><span className="focus-status">● IN PROGRESS</span><span className="you">You</span></div><h2>{task.title}</h2><p>{task.description}</p><div className="completion"><span>Completion</span><b>{task.progress}%</b></div><div className="progress"><i style={{width: task.progress + '%'}}/></div><button className="button primary full" onClick={() => setOpen(!open)}>Submit Artifact <ArrowRight size={15}/></button>{open && <div className="submit-box"><input placeholder="Paste artifact link..." /><button>Send to review</button></div>}<Handle id="source" type="source" position={Position.Right}/></div> }
