import type {
  CreateProjectCommand,
  ProjectCardVm,
  ProjectSummaryDto,
} from '../../types/workspace.types'
import { workflowService } from '../../services/container'
import { mapProjectDtoToVm } from '../../mappers/projectMapper'

export type WorkspaceTab = 'all' | 'mine' | 'shared' | 'archived'
export type WorkspaceSort = 'ts' | 'done' | 'nodes'

export interface WorkspaceStats {
  total: number
  activeNodes: number
  runningInProduction: number
}

export interface WorkspaceTabCounts {
  all: number
  mine: number
  shared: number
  archived: number
}

export interface WorkspaceState {
  projects: readonly ProjectCardVm[]
  tab: WorkspaceTab
  q: string
  sort: WorkspaceSort
  isCreateModalOpen: boolean
  activeProjectId: number | string | null
  status: 'idle' | 'loading' | 'ready' | 'error'
  error: string | null
}

export interface WorkspaceSlice {
  workspace: WorkspaceState & {
    loadProjects: () => Promise<void>
    createProject: (cmd: CreateProjectCommand) => Promise<ProjectSummaryDto>
    setTab: (tab: WorkspaceTab) => void
    setQuery: (q: string) => void
    setSort: (sort: WorkspaceSort) => void
    openModal: () => void
    closeModal: () => void
    setActiveProjectId: (id: number | string | null) => void
  }
}

// Selectors
export function selectVisibleProjects(
  projects: readonly ProjectCardVm[],
  tab: WorkspaceTab,
  q: string,
  sort: WorkspaceSort,
): ProjectCardVm[] {
  const query = q.trim().toLowerCase()

  const filtered = projects.filter((p) => {
    const matchesTab =
      tab === 'all' ||
      (tab === 'mine' && p.role === 'OWNER') ||
      (tab === 'shared' && p.role !== 'OWNER') ||
      (tab === 'archived' && p.status === 'ARCHIVED')

    const matchesQuery = query === '' || p.name.toLowerCase().includes(query) || p.desc.toLowerCase().includes(query)

    return matchesTab && matchesQuery
  })

  return [...filtered].sort((a, b) => {
    if (sort === 'done') return b.done - a.done
    if (sort === 'nodes') return b.nodes - a.nodes
    return b.ts - a.ts
  })
}

export function selectTabCounts(projects: readonly ProjectCardVm[]): WorkspaceTabCounts {
  return {
    all: projects.length,
    mine: projects.filter((p) => p.role === 'OWNER').length,
    shared: projects.filter((p) => p.role !== 'OWNER').length,
    archived: projects.filter((p) => p.status === 'ARCHIVED').length,
  }
}

export function selectStats(projects: readonly ProjectCardVm[]): WorkspaceStats {
  return {
    total: projects.length,
    activeNodes: projects.reduce((sum, p) => sum + p.nodes, 0),
    runningInProduction: projects.filter((p) => p.status === 'ACTIVE').length,
  }
}

type WorkspaceSetter = (
  partial: Partial<WorkspaceSlice> | ((state: WorkspaceSlice) => Partial<WorkspaceSlice>),
) => void

export const createWorkspaceSlice = (
  set: WorkspaceSetter,
  get: () => WorkspaceSlice,
): WorkspaceSlice => ({
  workspace: {
    projects: [],
    tab: 'all',
    q: '',
    sort: 'ts',
    isCreateModalOpen: false,
    activeProjectId: null,
    status: 'idle',
    error: null,

    loadProjects: async () => {
      set((state) => ({
        workspace: { ...state.workspace, status: 'loading', error: null },
      }))

      try {
        const dtos = await workflowService.getProjectsList()
        const cardVms = dtos.map(mapProjectDtoToVm)

        set((state) => ({
          workspace: {
            ...state.workspace,
            projects: cardVms,
            status: 'ready',
            error: null,
          },
        }))
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load projects'
        set((state) => ({
          workspace: { ...state.workspace, status: 'error', error: message },
        }))
      }
    },

    createProject: async (cmd: CreateProjectCommand) => {
      try {
        const newProjectDto = await workflowService.createProject(cmd)
        const newCardVm = mapProjectDtoToVm(newProjectDto)

        set((state) => ({
          workspace: {
            ...state.workspace,
            projects: [newCardVm, ...state.workspace.projects],
            isCreateModalOpen: false,
            tab: 'all',
            q: '',
          },
        }))

        return newProjectDto
      } catch (err) {
        throw err
      }
    },

    setTab: (tab: WorkspaceTab) => {
      set((state) => ({
        workspace: { ...state.workspace, tab },
      }))
    },

    setQuery: (q: string) => {
      set((state) => ({
        workspace: { ...state.workspace, q },
      }))
    },

    setSort: (sort: WorkspaceSort) => {
      set((state) => ({
        workspace: { ...state.workspace, sort },
      }))
    },

    openModal: () => {
      set((state) => ({
        workspace: { ...state.workspace, isCreateModalOpen: true },
      }))
    },

    closeModal: () => {
      set((state) => ({
        workspace: { ...state.workspace, isCreateModalOpen: false },
      }))
    },

    setActiveProjectId: (id: number | string | null) => {
      set((state) => ({
        workspace: { ...state.workspace, activeProjectId: id },
      }))
    },
  },
})
