import type {
  CloneTemplateCommand,
  CreateProjectCommand,
  ProjectCardVm,
  ProjectDetailDto,
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
  isLoading: boolean
  error: string | null
}

export interface WorkspaceSlice {
  workspace: WorkspaceState & {
    loadProjects: () => Promise<void>
    fetchProjects: () => Promise<void>
    createProject: (cmd: CreateProjectCommand) => Promise<ProjectSummaryDto>
    cloneTemplate: (req: CloneTemplateCommand) => Promise<ProjectDetailDto>
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
      (tab === 'all' && p.status !== 'ARCHIVED') ||
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
    all: projects.filter((p) => p.status !== 'ARCHIVED').length,
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
    isLoading: false,
    error: null,

    fetchProjects: async () => {
      set((state) => ({
        workspace: { ...state.workspace, isLoading: true, status: 'loading', error: null },
      }))

      try {
        const getProjects = workflowService.getMyProjects
          ? workflowService.getMyProjects.bind(workflowService)
          : workflowService.getProjectsList.bind(workflowService)
        const sort = get().workspace.sort
        const [allDtos, archivedDtos] = await Promise.all([
          getProjects({ tab: 'all', sort }),
          getProjects({ tab: 'archived', sort }),
        ])
        const map = new Map<string, ProjectSummaryDto>()
        for (const item of [...allDtos, ...archivedDtos]) {
          map.set(String(item.id), item)
        }
        const mergedDtos = Array.from(map.values())
        const cardVms = mergedDtos.map(mapProjectDtoToVm)

        set((state) => ({
          workspace: {
            ...state.workspace,
            projects: cardVms,
            isLoading: false,
            status: 'ready',
            error: null,
          },
        }))
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load projects'
        set((state) => ({
          workspace: { ...state.workspace, isLoading: false, status: 'error', error: message },
        }))
      }
    },

    loadProjects: async () => {
      return get().workspace.fetchProjects()
    },

    createProject: async (cmd: CreateProjectCommand) => {
      set((state) => ({
        workspace: { ...state.workspace, isLoading: true, error: null },
      }))
      try {
        let newProjectDto: ProjectSummaryDto
        if (cmd.templateId) {
          const detail = await workflowService.cloneTemplate({
            templateId: cmd.templateId,
            projectName: cmd.name,
            description: cmd.desc ?? cmd.description ?? '',
            visibility: cmd.visibility,
          })
          newProjectDto = {
            id: detail.id,
            name: detail.name,
            description: detail.description || '',
            status: detail.status,
            role: detail.role || 'OWNER',
            nodeCount: detail.totalNodes ?? detail.nodeCount ?? 0,
            totalNodes: detail.totalNodes ?? detail.nodeCount ?? 0,
            completedNodes: detail.completedNodes ?? 0,
            inProgressNodes: detail.inProgressNodes ?? 0,
            criticalPathLength: 0,
            completionPercent: detail.completionPercent ?? 0,
            progressPercentage: detail.progressPercentage ?? 0,
            updatedAt: detail.updatedAt || new Date().toISOString(),
            createdAt: detail.createdAt || new Date().toISOString(),
            members: detail.members || [{ id: 'u1', displayName: detail.ownerName || 'Owner' }],
          }
        } else {
          newProjectDto = await workflowService.createProject(cmd)
        }
        const newCardVm = mapProjectDtoToVm(newProjectDto)

        set((state) => ({
          workspace: {
            ...state.workspace,
            projects: [newCardVm, ...state.workspace.projects],
            isLoading: false,
            isCreateModalOpen: false,
            tab: 'all',
            q: '',
            error: null,
          },
        }))

        return newProjectDto
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create project'
        set((state) => ({
          workspace: { ...state.workspace, isLoading: false, error: message },
        }))
        throw err
      }
    },

    cloneTemplate: async (req: CloneTemplateCommand) => {
      set((state) => ({
        workspace: { ...state.workspace, isLoading: true, error: null },
      }))
      try {
        const detailDto = await workflowService.cloneTemplate(req)
        const summaryLike: ProjectSummaryDto = {
          id: detailDto.id,
          name: detailDto.name,
          description: detailDto.description || '',
          status: detailDto.status,
          role: detailDto.role || 'OWNER',
          nodeCount: detailDto.totalNodes ?? detailDto.nodeCount ?? 0,
          totalNodes: detailDto.totalNodes ?? detailDto.nodeCount ?? 0,
          completedNodes: detailDto.completedNodes ?? 0,
          inProgressNodes: detailDto.inProgressNodes ?? 0,
          criticalPathLength: 0,
          completionPercent: detailDto.completionPercent ?? 0,
          progressPercentage: detailDto.progressPercentage ?? 0,
          updatedAt: detailDto.updatedAt || new Date().toISOString(),
          createdAt: detailDto.createdAt || new Date().toISOString(),
          members: detailDto.members || [{ id: 'u1', displayName: detailDto.ownerName || 'Owner' }],
        }
        const newCardVm = mapProjectDtoToVm(summaryLike)

        set((state) => ({
          workspace: {
            ...state.workspace,
            projects: [newCardVm, ...state.workspace.projects],
            isLoading: false,
            isCreateModalOpen: false,
            tab: 'all',
            q: '',
            error: null,
          },
        }))

        return detailDto
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to clone template'
        set((state) => ({
          workspace: { ...state.workspace, isLoading: false, error: message },
        }))
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
