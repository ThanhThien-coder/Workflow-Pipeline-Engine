import { type FC } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search } from 'lucide-react'
import { WorkflowView } from '../components/views/WorkflowView'
import { MyTasksView } from './MyTasksView'
import SettingsView from './SettingsView'
import { OverviewView as OverviewScreen } from '../components/views/OverviewView'
import NotificationBell from '../components/common/NotificationBell'
import { GlobalProfileMenu } from '../components/common/GlobalProfileMenu'
import { CurvedCobaltSidebar } from '../components/layout/CurvedCobaltSidebar'
import { useWorkflowStore, type NavigationTab } from '../store/useWorkflowStore'
import { DEV_PERSONAS } from '../store/slices/devSlice'
import { useRouter } from '../router/useRouter'

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
  const settingsMembers = useWorkflowStore((state) => state.settings.members)
  const kanbanMembers = useWorkflowStore((state) => state.kanban.members)
  const teamList = settingsMembers.length > 0 ? settingsMembers : (kanbanMembers.length > 0 ? kanbanMembers : DEV_PERSONAS)

  const activePersona = DEV_PERSONAS.find((p) => p.id === currentUserId) || DEV_PERSONAS[0]
  const settingsProject = useWorkflowStore((state) => state.settings.settings)
  const currentProject = projects.find((p) => String(p.id) === String(projectId))
  const isViewingCurrentInSettings = settingsProject && String(settingsProject.id) === String(projectId)
  const projectName = isViewingCurrentInSettings ? settingsProject.name : currentProject?.name || 'Marketing Campaign Q4'
  const projectStatus = isViewingCurrentInSettings ? settingsProject.status : currentProject?.status || 'ACTIVE'

  // Determine current project-scoped role (reactive to DevToolbar persona switch)
  const currentProjectRole = simulatedRole || settingsRole || overviewRole || activePersona.role || currentProject?.role || 'OWNER'

  const currentTab = subTab || activeTab

  const handleLogout = async () => {
    await logout()
    showToast('Logged out successfully.')
    navigate('/auth?tab=signin')
  }

  const handleTabClick = (tabId: NavigationTab) => {
    setActiveTab(tabId)
    navigate(`/project/${projectId}/${tabId}`)
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-800">
      {/* 1. Curved Cobalt Ribbon Sidebar (Hover-to-Expand with Spring Physics) */}
      <CurvedCobaltSidebar
        currentTab={currentTab}
        onTabChange={handleTabClick}
        projectName={projectName}
        projectStatus={projectStatus}
        projectIcon={currentProject?.icon || '✣'}
        onBackToWorkspaces={() => navigate('/workspaces')}
        teamMembers={teamList}
      />

      {/* 2. Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Workspace Top Header with Floating Tab Slider */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200/90 bg-white/90 px-5 backdrop-blur-md z-10">
          {/* Left: Search box with fluid responsive width */}
          <div className="flex items-center gap-2">
            <label className="hidden sm:flex items-center gap-2 rounded-full border border-slate-200/90 bg-slate-50/80 px-3 py-1.5 text-xs text-slate-400 focus-within:border-indigo-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-100/60 w-48 lg:w-64 focus-within:w-80 transition-all duration-200">
              <Search size={15} className="shrink-0 text-slate-400" />
              <input
                type="text"
                placeholder="Search projects, tasks..."
                className="w-full bg-transparent text-xs text-slate-800 placeholder:text-slate-400 outline-none"
              />
              <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-400 font-mono shrink-0">
                ⌘K
              </kbd>
            </label>
          </div>


          {/* Right: Quick actions, notifications & profile */}
          <div className="flex items-center gap-3 text-slate-500">
            <button
              type="button"
              onClick={() => navigate('/workspaces')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline mr-1 transition-colors"
            >
              All Pipelines
            </button>
            <NotificationBell />
            <GlobalProfileMenu
              displayName={activePersona.name}
              roleLabel={currentProjectRole}
              avatarInitials={activePersona.initials}
              avatarClassName={`${activePersona.avatarClass || 'bg-indigo-600'} text-white`}
              onLogout={handleLogout}
            />
          </div>
        </header>

        {/* 3. Fluid Screen Transitions (Apple-smooth Cubic Bezier AnimatePresence) */}
        <main className="relative h-full min-h-0 flex-1 overflow-hidden bg-slate-50">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={currentTab}
              initial={{ opacity: 0, y: 14, scale: 0.995 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.995 }}
              transition={{
                duration: 0.28,
                ease: [0.22, 1, 0.36, 1], // Custom Cubic Bezier "Apple-smooth"
              }}
              className="h-full w-full overflow-hidden"
              style={{ willChange: 'transform, opacity' }}
            >
              {currentTab === 'workflow' && <WorkflowView projectId={projectId} />}
              {currentTab === 'overview' && <OverviewScreen projectId={projectId} />}
              {currentTab === 'my-tasks' && <MyTasksView projectId={projectId} projectName={projectName} />}
              {currentTab === 'settings' && <SettingsView projectId={projectId} />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}
