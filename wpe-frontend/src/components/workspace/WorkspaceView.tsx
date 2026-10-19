import { useEffect, useRef, type FC } from 'react'
import { Logo } from '../common/Logo'
import { GlobalProfileMenu } from '../common/GlobalProfileMenu'
import { ProjectCard } from './ProjectCard'
import { CreatePipelineModal } from './CreatePipelineModal'
import NotificationBell from '../common/NotificationBell'
import {
  useWorkflowStore,
} from '../../store/useWorkflowStore'
import {
  selectVisibleProjects,
  selectTabCounts,
  selectStats,
  type WorkspaceTab,
  type WorkspaceSort,
} from '../../store/slices/workspaceSlice'
import { useRouter } from '../../router/useRouter'
import type { ProjectCardVm } from '../../types/workspace.types'

export const WorkspaceView: FC = () => {
  const { navigate } = useRouter()
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Store state & actions
  const projects = useWorkflowStore((state) => state.workspace.projects)
  const tab = useWorkflowStore((state) => state.workspace.tab)
  const q = useWorkflowStore((state) => state.workspace.q)
  const sort = useWorkflowStore((state) => state.workspace.sort)
  const isCreateModalOpen = useWorkflowStore((state) => state.workspace.isCreateModalOpen)
  const loadProjects = useWorkflowStore((state) => state.workspace.loadProjects)
  const createProjectAction = useWorkflowStore((state) => state.workspace.createProject)
  const setTab = useWorkflowStore((state) => state.workspace.setTab)
  const setQuery = useWorkflowStore((state) => state.workspace.setQuery)
  const setSort = useWorkflowStore((state) => state.workspace.setSort)
  const openModal = useWorkflowStore((state) => state.workspace.openModal)
  const closeModal = useWorkflowStore((state) => state.workspace.closeModal)

  const currentUser = useWorkflowStore((state) => state.auth.currentUser)
  const logout = useWorkflowStore((state) => state.auth.logout)
  const showToast = useWorkflowStore((state) => state.ui.showToast)

  // Always refresh projects on mount to reflect latest status
  useEffect(() => {
    void loadProjects()
  }, [loadProjects])

  // Keyboard shortcut ⌘K / Ctrl+K and outside menu click
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  // Derived selectors
  const visibleProjects = selectVisibleProjects(projects, tab, q, sort)
  const tabCounts = selectTabCounts(projects)
  const stats = selectStats(projects)

  const handleOpenProject = (project: ProjectCardVm) => {
    showToast(`Opening ${project.name} workspace...`)
    navigate(`/project/${project.id}/workflow`)
  }

  const handleCreatePipeline = async (data: { name: string; desc: string; templateId?: string }) => {
    try {
      const created = await createProjectAction({
        name: data.name,
        desc: data.desc,
        templateId: data.templateId,
      })
      showToast(`Pipeline "${data.name}" created as DRAFT.`)
      navigate(`/project/${created.id}/workflow`)
    } catch {
      showToast('Failed to create pipeline.')
    }
  }

  const handleLogout = async () => {
    await logout()
    showToast('Logged out successfully.')
    navigate('/auth?tab=signin')
  }

  const tabs: { id: WorkspaceTab; label: string; count: number }[] = [
    { id: 'all', label: 'All Pipelines', count: tabCounts.all },
    { id: 'mine', label: 'My Projects', count: tabCounts.mine },
    { id: 'shared', label: 'Shared with me', count: tabCounts.shared },
    { id: 'archived', label: 'Archived', count: tabCounts.archived },
  ]

  const userDisplayName = currentUser?.username || 'Alex Kim'
  const userEmail = currentUser?.email || 'alex.kim@pipeline.engine'

  return (
    <div
      className="h-screen flex flex-col bg-tech-grid bg-fixed overflow-hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {/* Top Fixed Header */}
      <header
        className="sticky top-0 z-40 bg-white/95 border-b border-slate-200/80 backdrop-blur-md"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate('/workspaces')}
            className="flex items-center gap-2 shrink-0 cursor-pointer text-left"
          >
            <Logo />
            <span className="font-bold text-slate-900 hidden sm:inline">Pipeline Engine</span>
          </button>

          <div className="flex-1 max-w-md mx-auto relative">
            <input
              ref={searchInputRef}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                  showToast(`Global search for "${e.currentTarget.value.trim()}" (demo).`)
                }
              }}
              placeholder="Search projects, pipelines, nodes... (⌘K)"
              className="w-full text-xs rounded-xl border border-slate-200/90 bg-slate-50 focus:bg-white focus:border-indigo-500 px-3.5 py-2 outline-none transition-colors"
            />
          </div>

          <NotificationBell />

          <GlobalProfileMenu
            displayName={userDisplayName}
            email={userEmail}
            showName
            onLogout={handleLogout}
          />
        </div>
      </header>

      {/* Main Workspace Content */}
      <main className="flex-1 min-h-0 overflow-y-auto relative">
        {/* Sticky Header & Filters Container */}
        <div className="sticky top-0 z-10 backdrop-blur-md bg-white/80 border-b border-slate-200/50 px-6 pt-8 pb-4">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Header Ribbon & Stat Chips */}
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                  Pipelines &amp; Workspaces
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Orchestrate, monitor, and govern all active engineering DAG pipelines.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="text-xs font-semibold text-slate-700 bg-white/95 border border-slate-200/90 rounded-full px-3 py-1 shadow-sm">
                    📂 {stats.total} Total Projects
                  </span>
                  <span className="text-xs font-semibold text-slate-700 bg-white/95 border border-slate-200/90 rounded-full px-3 py-1 shadow-sm">
                    ⚡ {stats.activeNodes} Active Nodes
                  </span>
                  <span className="text-xs font-semibold text-slate-700 bg-white/95 border border-slate-200/90 rounded-full px-3 py-1 shadow-sm">
                    🟢 {stats.runningInProduction} Running in Production
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={openModal}
                className="btn-primary-gradient text-sm font-semibold text-white rounded-xl px-4 py-2.5 flex items-center gap-1.5 cursor-pointer"
              >
                <span className="text-base leading-none">+</span> New Pipeline
              </button>
            </div>

            {/* Filters Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200/70">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={`text-xs font-semibold rounded-lg px-3 py-1.5 transition-all cursor-pointer ${
                      tab === t.id
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {t.label}{' '}
                    <span className={tab === t.id ? 'text-indigo-600' : 'text-slate-400'}>
                      ({t.count})
                    </span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <input
                  value={q}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter by project name..."
                  className="text-xs rounded-xl border border-slate-200/90 bg-white focus:border-indigo-500 px-3 py-2 outline-none w-48 transition-colors"
                />
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as WorkspaceSort)}
                  className="text-xs font-semibold rounded-xl border border-slate-200/90 bg-white px-2.5 py-2 text-slate-700 outline-none cursor-pointer"
                >
                  <option value="ts">Last Updated</option>
                  <option value="done">Completion %</option>
                  <option value="nodes">Node Count</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Project Cards Grid */}
        <div className="max-w-6xl mx-auto px-6 pt-6 pb-16">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleProjects.map((p, i) => (
              <ProjectCard key={p.id} p={p} index={i} onOpen={handleOpenProject} />
            ))}

            <button
              type="button"
              onClick={openModal}
              className="group border-2 border-dashed border-slate-300 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/20 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all min-h-[220px]"
            >
              <span className="w-11 h-11 rounded-full bg-indigo-100 text-indigo-600 text-2xl grid place-items-center group-hover:scale-110 transition-transform">
                +
              </span>
              <span className="text-sm font-semibold text-slate-700 group-hover:text-indigo-700 font-medium">
                Create New Pipeline
              </span>
            </button>
          </div>

          {visibleProjects.length === 0 && (
            <p className="text-center text-sm text-slate-400 py-6">
              No pipelines match your filters.
            </p>
          )}
        </div>
      </main>

      {/* Create Pipeline Modal */}
      <CreatePipelineModal
        isOpen={isCreateModalOpen}
        onClose={closeModal}
        onCreate={handleCreatePipeline}
      />
    </div>
  )
}
