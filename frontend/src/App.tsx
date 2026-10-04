import { Bell, ChevronDown, ChevronLeft, ClipboardList, LayoutDashboard, Network, Search, Settings, Sparkles } from 'lucide-react'
import { WorkflowView } from './components/views/WorkflowView'
import { MyTasksView } from './views/MyTasksView'
import SettingsView from './views/SettingsView'
import { OverviewView as OverviewScreen } from './components/views/OverviewView'
import { useWorkflowStore, type NavigationTab } from './store/useWorkflowStore'
import { DevToolbar } from './components/dev/DevToolbar'
import { DEV_PERSONAS } from './store/slices/devSlice'

const navigation: { id: NavigationTab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'workflow', label: 'Workflow', icon: Network },
  { id: 'my-tasks', label: 'My Tasks', icon: ClipboardList },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export default function App() {
  const activeTab = useWorkflowStore((state) => state.activeTab)
  const setActiveTab = useWorkflowStore((state) => state.setActiveTab)
  const currentUserId = useWorkflowStore((state) => state.kanban.currentUserId)
  const activePersona = DEV_PERSONAS.find((p) => p.id === currentUserId) || DEV_PERSONAS[0]

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-800">
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
        <div className="flex h-14 items-center gap-2 border-b border-slate-200 px-4">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-white">
            <Sparkles size={17} />
          </div>
          <strong className="text-sm">Pipeline Engine</strong>
        </div>
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-4">
          <ChevronLeft size={16} className="text-slate-400" />
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-50 text-indigo-600">✣</div>
          <div>
            <b className="block text-sm">Marketing Q4</b>
            <span className="text-[11px] text-slate-400">PHASE 2 · Published</span>
          </div>
        </div>
        <nav className="space-y-1 p-3">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                activeTab === id
                  ? 'bg-indigo-50 font-semibold text-indigo-700'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </nav>
        <div className="mt-auto border-t border-slate-100 p-4">
          <small className="font-semibold tracking-widest text-slate-400">TEAM</small>
          <div className="mt-3 flex -space-x-1">
            <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-blue-400 text-[10px] font-bold text-white">
              AK
            </span>
            <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-emerald-400 text-[10px] font-bold text-white">
              SC
            </span>
            <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-slate-400 text-[10px] font-bold text-white">
              +2
            </span>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5">
          <div className="flex items-center gap-3 text-slate-400">
            <Search size={17} />
            <span className="hidden text-sm md:inline">Search projects, tasks, nodes...</span>
            <kbd className="hidden rounded border border-slate-200 px-1.5 text-[10px] md:inline">⌘K</kbd>
          </div>
          <div className="flex items-center gap-3 text-slate-500">
            <Bell size={18} />
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            <div
              className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold text-white shadow-xs ${
                activePersona.avatarClass || 'bg-indigo-600'
              }`}
            >
              {activePersona.initials}
            </div>
            <b className="hidden text-sm text-slate-700 sm:inline">{activePersona.name}</b>
            <ChevronDown size={14} />
          </div>
        </header>

        <main className="relative h-full min-h-0 flex-1 overflow-hidden">
          <div className={`h-full ${activeTab === 'workflow' ? '' : 'hidden'}`}>
            <WorkflowView />
          </div>
          {activeTab === 'overview' && <OverviewScreen projectId="1" />}
          {activeTab === 'my-tasks' && <MyTasksView />}
          {activeTab === 'settings' && <SettingsView />}
        </main>
      </div>

      {/* Dev floating panel - Tự động bị loại bỏ hoàn toàn khi build production hoặc khi VITE_USE_MOCK=false */}
      {import.meta.env.DEV && import.meta.env.VITE_USE_MOCK === 'true' && (
        <DevToolbar />
      )}
    </div>
  )
}
