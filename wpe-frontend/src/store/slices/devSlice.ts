import { produce } from 'immer'
import type { ProjectRole, ProjectStatus } from '../../types/settings.types'
import { workflowService } from '../../services/container'
import type { WorkflowState } from '../useWorkflowStore'

export interface DevPersona {
  id: string
  name: string
  role: ProjectRole
  title: string
  initials: string
  avatarClass: string
  icon: string
}

export const DEV_PERSONAS: DevPersona[] = [
  { id: '1', name: 'Alex Kim', role: 'OWNER', title: 'Project Lead / Owner', initials: 'AK', avatarClass: 'bg-emerald-500', icon: '👑' },
  { id: '2', name: 'Sarah Chen', role: 'COLLABORATOR', title: 'Frontend Dev', initials: 'SC', avatarClass: 'bg-indigo-500', icon: '🛠' },
  { id: '3', name: 'Marcus Liu', role: 'COLLABORATOR', title: 'Backend Dev', initials: 'ML', avatarClass: 'bg-rose-500', icon: '⚙️' },
  { id: '4', name: 'Jamie Doe', role: 'VIEWER', title: 'QA / Viewer', initials: 'JD', avatarClass: 'bg-amber-500', icon: '👁' },
]

export interface DevSlice {
  dev: {
    currentPersonaId: string
    simulateCycle: boolean
    latencyMs: number
    isFakeError500: boolean
    isOpen: boolean

    switchDevPersona: (userId: string) => Promise<void>
    setDevProjectStatus: (status: ProjectStatus) => Promise<void>
    setDevSimulateCycle: (enabled: boolean) => void
    setDevLatency: (ms: number) => void
    setDevFakeError: (enabled: boolean) => void
    resetDevMockData: () => Promise<void>
    toggleDevToolbar: () => void
    setDevToolbarOpen: (open: boolean) => void
  }
}

export const createDevSlice = (
  set: (update: (state: WorkflowState) => WorkflowState) => void,
  get: () => WorkflowState,
): DevSlice => ({
  dev: {
    currentPersonaId: '1',
    simulateCycle: false,
    latencyMs: 150,
    isFakeError500: false,
    isOpen: false,

    switchDevPersona: async (userId: string) => {
      const persona = DEV_PERSONAS.find((p) => p.id === userId) || DEV_PERSONAS[0]

      set((state) =>
        produce(state, (draft) => {
          draft.dev.currentPersonaId = userId

          // Update Settings slice role
          draft.settings.simulatedRole = persona.role
          if (draft.settings.settings) {
            draft.settings.settings.myRole = persona.role
          }

          // Update Overview slice role
          if (draft.overview.data?.project) {
            draft.overview.data.project.role = persona.role
          }
        }),
      )

      // Synchronize Kanban user & reload tasks
      await get().kanban.setUserId('1', userId)

      // Notify via toast
      get().settings.showToast(`Switched persona to ${persona.name} (${persona.role})`)
    },

    setDevProjectStatus: async (status: ProjectStatus) => {
      // Synchronize store slices
      set((state) =>
        produce(state, (draft) => {
          if (draft.settings.settings) {
            draft.settings.settings.status = status
          }
          if (draft.overview.data?.project) {
            const labelMap: Record<ProjectStatus, string> = {
              DRAFT: 'Phase 2 · Draft',
              ACTIVE: 'Phase 2 · Published',
              INACTIVE: 'Phase 2 · Paused',
              ARCHIVED: 'Phase 2 · Archived',
            }
            draft.overview.data.project.phaseLabel = labelMap[status] || status
          }
        }),
      )

      // Persist in mock service memory
      if (workflowService.setProjectStatus) {
        await workflowService.setProjectStatus('1', status)
      }

      get().settings.showToast(`Project status set to ${status}`)
    },

    setDevSimulateCycle: (enabled: boolean) => {
      set((state) =>
        produce(state, (draft) => {
          draft.dev.simulateCycle = enabled
        }),
      )
    },

    setDevLatency: (ms: number) => {
      set((state) =>
        produce(state, (draft) => {
          draft.dev.latencyMs = ms
        }),
      )
      if (workflowService.setMockLatency) {
        workflowService.setMockLatency(ms)
      }
    },

    setDevFakeError: (enabled: boolean) => {
      set((state) =>
        produce(state, (draft) => {
          draft.dev.isFakeError500 = enabled
        }),
      )
      if (workflowService.setMockError) {
        workflowService.setMockError(enabled)
      }
    },

    resetDevMockData: async () => {
      if (workflowService.resetMockData) {
        await workflowService.resetMockData()
      }

      // Reload all slices
      await Promise.all([
        get().kanban.loadTasks('1'),
        get().settings.loadSettings('1'),
        get().overview.load('1'),
      ])

      // Reset dev flags
      set((state) =>
        produce(state, (draft) => {
          draft.dev.simulateCycle = false
          draft.dev.isFakeError500 = false
          draft.dev.latencyMs = 150
        }),
      )
      if (workflowService.setMockLatency) workflowService.setMockLatency(150)
      if (workflowService.setMockError) workflowService.setMockError(false)

      get().settings.showToast('All mock data reset to initial SEED.')
    },

    toggleDevToolbar: () => {
      set((state) =>
        produce(state, (draft) => {
          draft.dev.isOpen = !draft.dev.isOpen
        }),
      )
    },

    setDevToolbarOpen: (open: boolean) => {
      set((state) =>
        produce(state, (draft) => {
          draft.dev.isOpen = open
        }),
      )
    },
  },
})
