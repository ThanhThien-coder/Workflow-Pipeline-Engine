import { useState, useEffect, useRef, type FC } from 'react'
import { Logo } from '../common/Logo'
import { Avatar } from '../common/Avatar'
import { ProjectCard } from './ProjectCard'
import { CreatePipelineModal } from './CreatePipelineModal'
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
  const menuRef = useRef<HTMLDivElement>(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

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

  // Initial load
  useEffect(() => {
    if (projects.length === 0) {
      loadProjects()
    }
  }, [loadProjects, projects.length])

  // Keyboard shortcut ⌘K / Ctrl+K and outside menu click
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }

    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('mousedown', handleMouseDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('mousedown', handleMouseDown)
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

  const handleCreatePipeline = async (data: { name: string; desc: string }) => {
    try {
      const created = await createProjectAction({
        name: data.name,
        desc: data.desc,
      })
      showToast(`Pipeline "${data.name}" created as DRAFT.`)
      navigate(`/project/${created.id}/workflow`)
    } catch {
      showToast('Failed to create pipeline.')
    }
  }

  const handleLogout = async () => {
    setIsMenuOpen(false)
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
  const userAvatarUrl = currentUser?.avatarUrl || null

  return (
    <div
      className="min-h-screen bg-tech-grid"
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

          <button
            type="button"
            onClick={() => showToast('You have 3 new notifications (demo).')}
            aria-label="Notifications"
            className="relative w-9 h-9 grid place-items-center rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 8a6 6 0 1112 0c0 7 3 8 3 8H3s3-1 3-8" />
              <path d="M10 20a2 2 0 004 0" />
            </svg>
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
          </button>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 pl-1.5 pr-2.5 py-1 transition-colors cursor-pointer"
            >
              {userAvatarUrl ? (
                <img src={userAvatarUrl} alt={userDisplayName} className="w-7 h-7 rounded-full object-cover ring-2 ring-white" />
              ) : (
                <Avatar name={userDisplayName} index={0} className="w-7 h-7 text-[10px]" />
              )}
              <span className="hidden sm:block text-xs font-semibold text-slate-800">
                {userDisplayName}
              </span>
            </button>

            {isMenuOpen && (
              <div className="pop absolute right-0 mt-2 w-48 rounded-xl border border-slate-200/90 bg-white shadow-xl p-1.5 text-sm z-50">
                <div className="px-3 py-2 text-[11px] text-slate-500 border-b border-slate-100 mb-1 truncate">
                  {userEmail}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false)
                    navigate('/profile')
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Profile
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false)
                    navigate('/admin')
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-between"
                >
                  <span>Admin Portal</span>
                  <span className="text-[9px] bg-purple-50 text-purple-700 font-bold px-1.5 py-0.5 rounded border border-purple-200">
                    SUPER ADMIN
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-2 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors font-medium"
                >
                  Log Out
                </button>
              </div>
            )}

          </div>
        </div>
      </header>

      {/* Main Workspace Content */}
      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
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

        {/* Project Cards Grid */}
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
