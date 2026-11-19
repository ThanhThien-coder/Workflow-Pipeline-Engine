import { useEffect, type FC } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { WorkflowView } from '../components/views/WorkflowView'
import { MyTasksView } from './MyTasksView'
import SettingsView from './SettingsView'
import { OverviewView as OverviewScreen } from '../components/views/OverviewView'
import NotificationBell from '../components/common/NotificationBell'
import { GlobalProfileMenu } from '../components/common/GlobalProfileMenu'
import { CurvedCobaltSidebar, type TeamMemberItem } from '../components/layout/CurvedCobaltSidebar'
import { useWorkflowStore, type NavigationTab } from '../store/useWorkflowStore'
import { DEV_PERSONAS } from '../store/slices/devSlice'
import { isMockMode } from '../services/env'
import { useRouter } from '../router/useRouter'
import { DemoToolsPanel } from '../components/dev/DemoToolsPanel'
import { useProjectRealtime } from '../hooks/useProjectRealtime'
import { ProjectSearchBox } from '../components/search/ProjectSearchBox'

interface ProjectWorkspaceViewProps {
  projectId: string
  subTab?: NavigationTab
  /** Có thì tab Workflow mở thẳng màn chi tiết phase này (đường dẫn .../workflow/phase/:phaseId). */
  phaseId?: string
}

export const ProjectWorkspaceView: FC<ProjectWorkspaceViewProps> = ({
  projectId,
  subTab,
  phaseId,
}) => {
  const { navigate } = useRouter()
  const activeTab = useWorkflowStore((state) => state.activeTab)
  const setActiveTab = useWorkflowStore((state) => state.setActiveTab)
  const currentUserId = useWorkflowStore((state) => state.kanban.currentUserId)
  const currentUser = useWorkflowStore((state) => state.auth.currentUser)
  const simulatedRole = useWorkflowStore((state) => state.settings.simulatedRole)
  const projects = useWorkflowStore((state) => state.workspace.projects)
  const logout = useWorkflowStore((state) => state.auth.logout)
  const showToast = useWorkflowStore((state) => state.ui.showToast)
  const settingsProject = useWorkflowStore((state) => state.settings.settings)
  const settingsMembers = useWorkflowStore((state) => state.settings.members)
  const project = useWorkflowStore((state) => state.project)
  const loadProject = useWorkflowStore((state) => state.project.loadProject)

  useEffect(() => {
    void loadProject(projectId)
  }, [loadProject, projectId])

  // Màn Settings sửa tên/thành viên thì cập nhật settings.*: dùng bản đó nếu đúng dự án đang mở
  const settingsIsCurrent = settingsProject != null && String(settingsProject.id) === String(projectId)
  const projectInfo = settingsIsCurrent ? settingsProject : project.projectId === projectId ? project.info : null
  const teamList: TeamMemberItem[] = settingsIsCurrent && settingsMembers.length > 0
    ? settingsMembers
    : project.projectId === projectId ? project.members : []

  const projectName = projectInfo?.name ?? (project.status === 'error' ? 'Could not load project' : 'Loading…')
  const projectStatus = projectInfo?.status ?? ''
  const currentProject = projects.find((p) => String(p.id) === String(projectId))

  // Chế độ mock: vai trò và người dùng theo persona của DevToolbar. Chế độ API: theo phiên đăng nhập và dự án thật.
  const activePersona = isMockMode ? DEV_PERSONAS.find((p) => p.id === currentUserId) || DEV_PERSONAS[0] : null
  const currentProjectRole = activePersona ? simulatedRole || activePersona.role : projectInfo?.myRole ?? 'VIEWER'
  const displayName = activePersona?.name ?? (currentUser?.name?.trim() || currentUser?.username || '')
  const avatarInitials = activePersona?.initials ?? (displayName.slice(0, 2).toUpperCase() || 'U')
  const avatarClass = activePersona?.avatarClass ?? 'bg-indigo-600'

  const currentTab = subTab || activeTab

  // Một bộ nghe realtime cấp dự án cho mọi tab: tự tải lại đúng phần vừa đổi
  useProjectRealtime(projectId, currentTab)

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
          {/* Left: ô tìm task và phase của dự án (Ctrl/⌘+K để focus) */}
          <div className="flex items-center gap-2">
            <ProjectSearchBox projectId={projectId} />
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
            {/* #24: công cụ demo, tự ẩn khi backend tắt DEMO_TOOLS_ENABLED hoặc người xem không phải chủ dự án / admin */}
            <DemoToolsPanel projectId={projectId} variant="header" />
            <NotificationBell />
            <GlobalProfileMenu
              displayName={displayName}
              roleLabel={currentProjectRole}
              avatarInitials={avatarInitials}
              avatarClassName={`${avatarClass} text-white`}
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
              {currentTab === 'workflow' && <WorkflowView projectId={projectId} phaseId={phaseId ?? null} />}
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
