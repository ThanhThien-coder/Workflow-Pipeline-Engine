import { create } from 'zustand'
import { workflowService } from '../services/container'
import type { CreatePhaseDto, IWorkflowService } from '../services/contracts/IWorkflowService'
import type { GraphNodeMap, MacroPhase } from '../types/workflow.types'
import { deleteNodeCascade } from '../utils/spanningTreeLayout'
import { createOverviewSlice, type OverviewSlice } from './slices/overviewSlice'
import { createKanbanSlice, type KanbanSlice } from './slices/kanbanSlice'
import { createSettingsSlice, type SettingsSlice } from './slices/settingsSlice'
import { createDevSlice, type DevSlice } from './slices/devSlice'

export type NavigationTab = 'overview' | 'workflow' | 'my-tasks' | 'settings'

export interface WorkflowState extends OverviewSlice, KanbanSlice, SettingsSlice, DevSlice {
  activeTab: NavigationTab
  macroPhases: MacroPhase[]
  workflowEdges: [string, string][]
  selectedPhaseId: string | null
  trees: Record<string, GraphNodeMap>
  loadPhases: () => Promise<void>
  createPhase: (dto: CreatePhaseDto) => Promise<void>
  spawnChildPhase: (parentPhaseId: string) => Promise<void>
  connectPhases: (sourceId: string, targetId: string) => Promise<void>
  deletePhase: (phaseId: string) => Promise<void>
  selectPhase: (phaseId: string | null) => void
  updateTree: (phaseId: string, update: (nodes: GraphNodeMap) => GraphNodeMap) => void
  deleteNode: (phaseId: string, nodeId: string) => void
  setActiveTab: (tab: NavigationTab) => void
}

export const createWorkflowStore = (service: IWorkflowService = workflowService) => create<WorkflowState>((set, get) => ({
  ...createOverviewSlice(set, get),
  ...createKanbanSlice(set, get),
  ...createSettingsSlice(set, get),
  ...createDevSlice(set, get),
  activeTab: 'workflow',
  macroPhases: [],
  workflowEdges: [],
  selectedPhaseId: null,
  trees: {},
  loadPhases: async () => {
    const macroPhases = await service.getMacroPhases()
    const workflowEdges = await service.getPhaseEdges()
    const trees = await Promise.all(macroPhases.map(async (phase) => [phase.id, await service.getPhaseGraph(phase.id)] as const))
    set({ macroPhases, workflowEdges, trees: Object.fromEntries(trees) as Record<string, GraphNodeMap> })
  },
  createPhase: async (dto) => {
    const phase = await service.createPhase(dto)
    const rootTree = await service.getPhaseGraph(phase.id)
    set((state) => ({
      macroPhases: [...state.macroPhases, phase],
      workflowEdges: [...state.workflowEdges, ...phase.parentPhaseIds.map((parent) => [parent, phase.id] as [string, string])],
      trees: { ...state.trees, [phase.id]: rootTree },
    }))
  },
  spawnChildPhase: async (parentPhaseId) => {
    const parent = get().macroPhases.find((phase) => phase.id === parentPhaseId)
    if (!parent) return
    await get().createPhase({ name: 'PHASE MỚI', sub: 'Cụm công việc mới', parentPhaseId })
  },
  connectPhases: async (sourceId, targetId) => {
    await service.connectPhases(sourceId, targetId)
    set((state) => ({
      macroPhases: state.macroPhases.map((phase) => phase.id === targetId && !phase.parentPhaseIds.includes(sourceId) ? { ...phase, parentPhaseIds: [...phase.parentPhaseIds, sourceId] } : phase),
      workflowEdges: state.workflowEdges.some(([from, to]) => from === sourceId && to === targetId) ? state.workflowEdges : [...state.workflowEdges, [sourceId, targetId]],
    }))
  },
  deletePhase: async (phaseId) => {
    await service.deletePhase(phaseId)
    set((state) => ({
      macroPhases: state.macroPhases.filter((phase) => phase.id !== phaseId).map((phase) => ({ ...phase, parentPhaseIds: phase.parentPhaseIds.filter((parent) => parent !== phaseId) })),
      workflowEdges: state.workflowEdges.filter(([from, to]) => from !== phaseId && to !== phaseId),
      trees: Object.fromEntries(Object.entries(state.trees).filter(([id]) => id !== phaseId)),
      selectedPhaseId: state.selectedPhaseId === phaseId ? null : state.selectedPhaseId,
    }))
  },
  selectPhase: (selectedPhaseId) => set({ selectedPhaseId }),
  updateTree: (phaseId, update) => set((state) => ({ trees: { ...state.trees, [phaseId]: update(state.trees[phaseId] ?? {}) } })),
  deleteNode: (phaseId, nodeId) => set((state) => {
    if (nodeId === 'root') return state
    const currentTree = state.trees[phaseId]
    if (!currentTree || !currentTree[nodeId]) return state
    return { trees: { ...state.trees, [phaseId]: deleteNodeCascade(currentTree, nodeId) } }
  }),
  setActiveTab: (activeTab) => set({ activeTab }),
}))

export const useWorkflowStore = createWorkflowStore()
