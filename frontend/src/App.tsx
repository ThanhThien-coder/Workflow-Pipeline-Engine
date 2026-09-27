import { useEffect, useState } from 'react'
import { LayoutDashboard, Network, Map, ClipboardList, MessageSquare, Settings, ChevronLeft, Sparkles, Save, Plus, Search, Bell, ChevronDown } from 'lucide-react'
import { CanvasView } from './views/CanvasView'
import { QuestMapView } from './views/QuestMapView'
import { OverviewView } from './views/OverviewView'
import { Task } from './types/workflow'
import { useWorkflowStore } from './store/useWorkflowStore'

type View = 'overview' | 'canvas' | 'quest'
const nav = [{ id: 'overview', label: 'Overview', icon: LayoutDashboard }, { id: 'canvas', label: 'Canvas', icon: Network }, { id: 'quest', label: 'Quest Map', icon: Map }, { id: 'tasks', label: 'Tasks', icon: ClipboardList }, { id: 'feedback', label: 'Feedback', icon: MessageSquare }, { id: 'settings', label: 'Settings', icon: Settings }]
function App() {
  const [view, setView] = useState<View>('canvas')
  const [selected, setSelected] = useState<Task | null>(null)
  const canvasNodes = useWorkflowStore((state) => state.nodes)
  const loadCanvas = useWorkflowStore((state) => state.loadCanvas)
  const loadQuestMap = useWorkflowStore((state) => state.loadQuestMap)
  const saveLayout = useWorkflowStore((state) => state.saveLayout)
  const users = canvasNodes.flatMap((node) => node.data.task?.assignee ?? []).filter((user, index, all) => all.findIndex((candidate) => candidate.id === user.id) === index)
  useEffect(() => { void loadCanvas(2026); void loadQuestMap(2026, 1) }, [loadCanvas, loadQuestMap])
  const onSave = () => { void saveLayout(2026) }
  const current = view === 'quest' ? 'Quest Map' : view === 'canvas' ? 'Canvas' : 'Overview'
  return <div className="app-shell">
    <div className="top-strip"><b>WPE DEMO</b><span>Login</span><span>Dashboard</span><span>Overview</span><span className={view === 'canvas' ? 'active' : ''}>Canvas</span><span>Kanban</span><span className={view === 'quest' ? 'active' : ''}>Quest Map</span><span>Feedback</span><span>Guest</span><span>Admin</span></div>
    <header className="topbar"><div className="brand"><div className="brand-mark"><Sparkles size={17}/></div><strong>Pipeline Engine</strong></div><div className="search"><Search size={17}/><span>Search projects, tasks, nodes...</span><kbd>⌘K</kbd></div><div className="account"><Bell size={18}/><span className="notif-dot"/><div className="avatar">AK</div><b>Alex Kim</b><ChevronDown size={14}/></div></header>
    <div className="workspace"><aside className="sidebar"><div className="project"><ChevronLeft size={16}/><div className="project-icon">✣</div><b>Marketing Q4</b></div><div className="phase-label">PHASE <span>2 · Published</span></div><nav>{nav.map(item => { const Icon = item.icon; const id = item.id as View; return <button key={item.id} className={(current === item.label ? 'selected ' : '') + 'nav-item'} onClick={() => ['overview','canvas','quest'].includes(item.id) && setView(id)}><Icon size={17}/>{item.label}{item.id === 'feedback' && <em>3</em>}</button>})}</nav><div className="team"><small>TEAM</small><div className="team-stack">{users.map(u => <div key={u.id} className="mini-avatar" style={{background: u.color}}>{u.initials}</div>)}<div className="mini-avatar plus">+2</div></div></div></aside><main className="main-area">{view !== 'quest' && <div className="view-header"><div><h1>{current}</h1><span>Marketing Q4 <i>·</i> Updated Sep 22, 2026</span></div>{view === 'canvas' && <div className="header-actions"><button className="button ghost"><Plus size={16}/> Add Node</button><button className="button primary" onClick={onSave}><Save size={16}/> Save</button></div>}</div>    }{view === 'canvas' && <CanvasView selected={selected} onSelect={setSelected}/>} {view === 'quest' && <QuestMapView/>}{view === 'overview' && <OverviewView/>}</main></div></div>
    }
export default App
