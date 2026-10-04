import { useState, useEffect, useRef, type FC } from 'react'
import {
  Bell,
  ChevronDown,
  ChevronLeft,
  ClipboardList,
  LayoutDashboard,
  Network,
  Search,
  Settings,
  Sparkles,
} from 'lucide-react'
import { WorkflowView } from '../components/views/WorkflowView'
import { MyTasksView } from './MyTasksView'
import SettingsView from './SettingsView'
import { OverviewView as OverviewScreen } from '../components/views/OverviewView'
import { useWorkflowStore, type NavigationTab } from '../store/useWorkflowStore'
import { DEV_PERSONAS } from '../store/slices/devSlice'
import { useRouter } from '../router/useRouter'

const navigation: { id: NavigationTab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'workflow', label: 'Workflow', icon: Network },
  { id: 'my-tasks', label: 'My Tasks', icon: ClipboardList },
  { id: 'settings', label: 'Settings', icon: Settings },
]

const ROLE_BADGE_STYLES: Record<string, string> = {
  OWNER: 'bg-violet-50 text-violet-700 border-violet-200',
  COLLABORATOR: 'bg-sky-50 text-sky-700 border-sky-200',
  VIEWER: 'bg-slate-100 text-slate-600 border-slate-200',
}

interface ProjectWorkspaceViewProps {
  projectId: string
  subTab?: NavigationTab
}

export const ProjectWorkspaceView: FC<ProjectWorkspaceViewProps> = ({
  projectId,
  subTab,
}) => {
  const { navigate } = useRouter()
  const activeTab = useWorkflowStore((state) => state.activeTab)
  const setActiveTab = useWorkflowStore((state) => state.setActiveTab)
  const currentUserId = useWorkflowStore((state) => state.kanban.currentUserId)
  const simulatedRole = useWorkflowStore((state) => state.settings.simulatedRole)
  const settingsRole = useWorkflowStore((state) => state.settings.settings?.myRole)
  const overviewRole = useWorkflowStore((state) => state.overview.data?.project.role)
  const projects = useWorkflowStore((state) => state.workspace.projects)
  const logout = useWorkflowStore((state) => state.auth.logout)
  const showToast = useWorkflowStore((state) => state.ui.showToast)

  const activePersona = DEV_PERSONAS.find((p) => p.id === currentUserId) || DEV_PERSONAS[0]
  const currentProject = projects.find((p) => String(p.id) === String(projectId))
  const projectName = currentProject?.name || 'Marketing Campaign Q4'
  const projectStatus = currentProject?.status || 'ACTIVE'

  // Determine current project-scoped role (reactive to DevToolbar persona switch)
  const currentProjectRole = simulatedRole || settingsRole || overviewRole || activePersona.role || currentProject?.role || 'OWNER'

  const currentTab = subTab || activeTab

  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false)
      }
    }
    window.addEventListener('mousedown', handleMouseDown)
    return () => window.removeEventListener('mousedown', handleMouseDown)
  }, [])

  const handleTabClick = (tabId: NavigationTab) => {
    setActiveTab(tabId)
    navigate(`/project/${projectId}/${tabId}`)
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-800">
      {/* Project Sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
        <div className="flex h-14 items-center gap-2 border-b border-slate-200 px-4">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-white">
            <Sparkles size={17} />
          </div>
          <strong className="text-sm">Pipeline Engine</strong>
        </div>

        {/* Project Selector / Back to Workspaces */}
        <button
          type="button"
          onClick={() => navigate('/workspaces')}
          title="Back to all pipelines"
          className="flex items-center gap-2 border-b border-slate-100 px-4 py-3.5 hover:bg-slate-50 transition-colors text-left group cursor-pointer"
        >
          <ChevronLeft
            size={16}
            className="text-slate-400 group-hover:text-indigo-600 group-hover:-translate-x-0.5 transition-all shrink-0"
          />
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-50 text-indigo-600 shrink-0 font-bold">
            {currentProject?.icon || '✣'}
          </div>
          <div className="min-w-0 flex-1">
            <b className="block text-sm truncate text-slate-900 group-hover:text-indigo-600 transition-colors">
              {projectName}
            </b>
            <span className="text-[11px] text-slate-400">
              PHASE 2 · {projectStatus}
            </span>
          </div>
        </button>

        {/* Navigation Tabs */}
        <nav className="space-y-1 p-3">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => handleTabClick(id)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors cursor-pointer ${
                currentTab === id
                  ? 'bg-indigo-50 font-semibold text-indigo-700'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </nav>

        {/* Team Avatars */}
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

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Workspace Top Header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5">
          <div className="flex items-center gap-3 text-slate-400">
            <Search size={17} />
            <span className="hidden text-sm md:inline">Search projects, tasks, nodes...</span>
            <kbd className="hidden rounded border border-slate-200 px-1.5 text-[10px] md:inline">
              ⌘K
            </kbd>
          </div>
          <div className="flex items-center gap-3 text-slate-500">
            <button
              type="button"
              onClick={() => navigate('/workspaces')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline mr-2"
            >
              All Pipelines
            </button>
            <Bell size={18} />
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 pl-1.5 pr-2.5 py-1 transition-colors cursor-pointer"
              >
                <div
                  className={`grid h-7 w-7 place-items-center rounded-full text-[10px] font-bold text-white shadow-xs ${
                    activePersona.avatarClass || 'bg-indigo-600'
                  }`}
                >
                  {activePersona.initials}
                </div>
                <span className="hidden sm:block text-xs font-semibold text-slate-800">
                  {activePersona.name}
                </span>

                {/* Project-scoped Role Badge */}
                {currentProjectRole && (
                  <span
                    className={`text-[10px] font-bold border rounded-full px-2 py-0.5 uppercase tracking-wide select-none ${
                      ROLE_BADGE_STYLES[currentProjectRole] || ROLE_BADGE_STYLES.VIEWER
                    }`}
                  >
                    {currentProjectRole}
                  </span>
                )}
                <ChevronDown size={14} className="text-slate-400" />
              </button>

              {isMenuOpen && (
                <div className="pop absolute right-0 mt-2 w-48 rounded-xl border border-slate-200/90 bg-white shadow-xl p-1.5 text-sm z-50">
                  <div className="px-3 py-2 text-[11px] text-slate-500 border-b border-slate-100 mb-1">
                    <span className="block font-semibold text-slate-800">{activePersona.name}</span>
                    <span className="block text-[10px] text-slate-400">{activePersona.title}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false)
                      navigate('/workspaces')
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    All Pipelines
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setIsMenuOpen(false)
                      await logout()
                      showToast('Logged out successfully.')
                      navigate('/auth?tab=signin')
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors font-medium"
                  >
                    Log Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Tab Views */}
        <main className="relative h-full min-h-0 flex-1 overflow-hidden">
          <div className={`h-full ${currentTab === 'workflow' ? '' : 'hidden'}`}>
            <WorkflowView />
          </div>
          {currentTab === 'overview' && <OverviewScreen projectId={projectId} />}
          {currentTab === 'my-tasks' && <MyTasksView />}
          {currentTab === 'settings' && <SettingsView />}
        </main>
      </div>
    </div>
  )
}
