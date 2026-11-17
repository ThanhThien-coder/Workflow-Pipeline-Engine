import { create } from 'zustand'
import { workflowService } from '../services/container'
import type { CreatePhaseDto, IWorkflowService, TaskNodePatch } from '../services/contracts/IWorkflowService'
import type { ProjectSettingsDto } from '../types/settings.types'
import type { GraphNodeMap, MacroPhase } from '../types/workflow.types'
import { ApiError } from '../services/http/ApiError'
import { computePhaseProgress, syncTrackProgress, withPhaseProgress } from '../domain/phaseProgress'
import { deleteNodeCascade } from '../utils/spanningTreeLayout'
import { computeNewPhasePosition } from '../utils/macroLayout'
import { getStoredProjectGraph, saveStoredProjectGraph } from '../services/mock/mockProjectGraphStore'
import { TREES } from '../services/MockWorkflowService'
import { createOverviewSlice, type OverviewSlice } from './slices/overviewSlice'
import { createKanbanSlice, type KanbanSlice } from './slices/kanbanSlice'
import { createSettingsSlice, type SettingsSlice } from './slices/settingsSlice'
import { createDevSlice, type DevSlice } from './slices/devSlice'
import { createAuthSlice, type AuthSlice } from './slices/authSlice'
import { createWorkspaceSlice, type WorkspaceSlice } from './slices/workspaceSlice'
import { createUiSlice, type UiSlice } from './slices/uiSlice'
import { createArtifactsSlice, type ArtifactsSlice } from './slices/artifactsSlice'
import { createProjectSlice, type ProjectSlice } from './slices/projectSlice'

export type NavigationTab = 'overview' | 'workflow' | 'my-tasks' | 'settings'

export interface WorkflowState
  extends OverviewSlice,
    KanbanSlice,
    SettingsSlice,
    DevSlice,
    AuthSlice,
    WorkspaceSlice,
    UiSlice,
    ArtifactsSlice,
    ProjectSlice {
  activeTab: NavigationTab
  currentProjectId: string | null
  macroPhases: MacroPhase[]
  workflowEdges: [string, string][]
  selectedPhaseId: string | null
  trees: Record<string, GraphNodeMap>
  loadPhases: (projectId?: string) => Promise<void>
  createPhase: (dto: CreatePhaseDto) => Promise<void>
  spawnChildPhase: (parentPhaseId: string) => Promise<void>
  connectPhases: (sourceId: string, targetId: string) => Promise<void>
  disconnectPhases: (sourceId: string, targetId: string) => Promise<void>
  deletePhase: (phaseId: string) => Promise<void>
  updatePhasePosition: (phaseId: string, pos: { x: number; y: number }) => Promise<void>
  selectPhase: (phaseId: string | null) => void
  updateTree: (phaseId: string, update: (nodes: GraphNodeMap) => GraphNodeMap) => void
  deleteNode: (phaseId: string, nodeId: string) => void
  resetPhaseTree: (phaseId: string) => Promise<void>
  /** true khi service có API thêm node, nối node (chế độ API thật). Mock thì false, canvas giữ cách thêm node cục bộ. */
  graphWritesUseApi: boolean
  /** B5: thêm 1 node vào phase qua API rồi đọc lại cây của phase. */
  addRootTask: (phaseId: string, title: string) => Promise<void>
  /** B5: tạo cạnh phụ thuộc từ node ở phase khác (ghost) qua API rồi đọc lại cây. */
  attachGhostNode: (phaseId: string, payload: { sourcePhaseId: string; sourceTaskId: string; targetTaskId: string }) => Promise<void>
  /** B5: nối 2 node cùng phase qua API. Thành công mới vẽ cạnh. Tạo vòng thì ném ApiError 422. */
  connectNodes: (phaseId: string, parentId: string, childId: string) => Promise<void>
  /** T3: thêm task con dưới các task cha (1 cha = subtask, nhiều cha = task hội tụ) qua API rồi đọc lại cây. */
  addChildTask: (phaseId: string, parentTaskIds: string[], title: string) => Promise<void>
  /** T3: sửa thông tin task (không sửa trạng thái) qua API rồi đọc lại cây. */
  updateNodeInfo: (phaseId: string, nodeId: string, patch: TaskNodePatch) => Promise<void>
  /** T3: xóa task qua API rồi đọc lại cây. */
  removeNode: (phaseId: string, nodeId: string) => Promise<void>
  /** T6: chủ dự án mở khóa sớm task đang khóa, rồi đọc lại cây. */
  forceUnlockNode: (phaseId: string, nodeId: string) => Promise<void>
  setActiveTab: (tab: NavigationTab) => void
}

/** Thông tin dự án đang mở có vai trò của tôi: bản ở Settings nếu đã tải, không thì bản tải lúc vào dự án. */
function currentProjectInfo(state: Pick<WorkflowState, 'settings' | 'project' | 'currentProjectId'>): ProjectSettingsDto | null {
  const matches = (info: ProjectSettingsDto | null): info is ProjectSettingsDto =>
    info != null && (!state.currentProjectId || String(info.id) === String(state.currentProjectId))
  if (matches(state.settings.settings)) return state.settings.settings
  if (matches(state.project.info)) return state.project.info
  return null
}

/**
 * B5 — Có được sửa đồ thị không. Quy ước giống GeneralSettingsSection: isOwner = myRole === 'OWNER'.
 * - Dự án ARCHIVED: owner cũng chỉ xem (backend trả 409 PROJECT_ARCHIVED).
 * - Vai trò lấy từ Settings hoặc từ thông tin dự án tải khi vào dự án (T3).
 * - Chưa nạp vai trò của đúng dự án này: KHÔNG khóa, để owner vào thẳng canvas vẫn làm được;
 *   backend vẫn chặn bằng 403 và UI hiện toast.
 */
export function selectCanEditGraph(state: Pick<WorkflowState, 'settings' | 'project' | 'currentProjectId'>): boolean {
  const info = currentProjectInfo(state)
  if (!info?.myRole) return true
  if (info.status === 'ARCHIVED') return false
  return info.myRole === 'OWNER'
}

export const GRAPH_READ_ONLY_MESSAGE = 'Only the project owner can edit the graph'

/** Lớp chặn cuối ở store: không phải owner thì không gửi request ghi đồ thị nào. */
function ensureCanEditGraph(state: WorkflowState): void {
  if (!selectCanEditGraph(state)) {
    throw new ApiError({ status: 403, code: 'GRAPH_READ_ONLY', message: GRAPH_READ_ONLY_MESSAGE })
  }
}

export const createWorkflowStore = (service: IWorkflowService = workflowService) => create<WorkflowState>((set, get) => ({
  ...createOverviewSlice(set, get),
  ...createKanbanSlice(set, get),
  ...createSettingsSlice(set, get),
  ...createDevSlice(set, get),
  ...createAuthSlice(set, get),
  ...createWorkspaceSlice(set, get),
  ...createUiSlice(set, get),
  ...createArtifactsSlice(set, get, service),
  ...createProjectSlice(set, get, service),
  activeTab: 'workflow',
  currentProjectId: null,
  macroPhases: [],
  workflowEdges: [],
  selectedPhaseId: null,
  trees: {},
  loadPhases: async (projectId?: string) => {
    set({ currentProjectId: projectId || null })
    const macroPhases = await service.getMacroPhases(projectId)
    const workflowEdges = await service.getPhaseEdges(projectId)
    const treeEntries = await Promise.all(macroPhases.map(async (phase) => [phase.id, syncTrackProgress(await service.getPhaseGraph(phase.id, projectId))] as const))
    const trees = Object.fromEntries(treeEntries) as Record<string, GraphNodeMap>
    set({
      macroPhases: macroPhases.map((phase) => withPhaseProgress(phase, trees[phase.id])),
      workflowEdges,
      trees,
    })
  },
  createPhase: async (dto) => {
    ensureCanEditGraph(get())
    const currentProjectId = get().currentProjectId
    const position =
      dto.x != null && dto.y != null ? { x: dto.x, y: dto.y } : computeNewPhasePosition(get().macroPhases, dto.parentPhaseId)
    const phase = await service.createPhase(
      { ...dto, ...position, projectId: currentProjectId || undefined },
      currentProjectId || undefined
    )
    const rootTree = syncTrackProgress(await service.getPhaseGraph(phase.id, currentProjectId || undefined))
    set((state) => ({
      macroPhases: [...state.macroPhases, withPhaseProgress(phase, rootTree)],
      workflowEdges: [...state.workflowEdges, ...phase.parentPhaseIds.map((parent) => [parent, phase.id] as [string, string])],
      trees: { ...state.trees, [phase.id]: rootTree },
    }))
  },
  spawnChildPhase: async (parentPhaseId) => {
    const parent = get().macroPhases.find((phase) => phase.id === parentPhaseId)
    if (!parent) return
    const num = get().macroPhases.length + 1
    await get().createPhase({ name: `PHASE ${num}`, sub: `Work group ${num}`, parentPhaseId })
  },
  connectPhases: async (sourceId, targetId) => {
    ensureCanEditGraph(get())
    const currentProjectId = get().currentProjectId
    await service.connectPhases(sourceId, targetId, currentProjectId || undefined)
    set((state) => ({
      macroPhases: state.macroPhases.map((phase) =>
        phase.id === targetId && !phase.parentPhaseIds.includes(sourceId)
          ? { ...phase, parentPhaseIds: [...phase.parentPhaseIds, sourceId] }
          : phase
      ),
      workflowEdges: state.workflowEdges.some(([from, to]) => from === sourceId && to === targetId)
        ? state.workflowEdges
        : [...state.workflowEdges, [sourceId, targetId]],
    }))
  },
  disconnectPhases: async (sourceId, targetId) => {
    ensureCanEditGraph(get())
    const currentProjectId = get().currentProjectId
    if (service.disconnectPhases) {
      await service.disconnectPhases(sourceId, targetId, currentProjectId || undefined)
    }
    set((state) => ({
      macroPhases: state.macroPhases.map((phase) =>
        phase.id === targetId
          ? { ...phase, parentPhaseIds: phase.parentPhaseIds.filter((p) => p !== sourceId) }
          : phase
      ),
      workflowEdges: state.workflowEdges.filter(([from, to]) => !(from === sourceId && to === targetId)),
    }))
  },
  deletePhase: async (phaseId) => {
    ensureCanEditGraph(get())
    const currentProjectId = get().currentProjectId
    await service.deletePhase(phaseId, currentProjectId || undefined)
    set((state) => ({
      macroPhases: state.macroPhases
        .filter((phase) => phase.id !== phaseId)
        .map((phase) => ({ ...phase, parentPhaseIds: phase.parentPhaseIds.filter((parent) => parent !== phaseId) })),
      workflowEdges: state.workflowEdges.filter(([from, to]) => from !== phaseId && to !== phaseId),
      trees: Object.fromEntries(Object.entries(state.trees).filter(([id]) => id !== phaseId)),
      selectedPhaseId: state.selectedPhaseId === phaseId ? null : state.selectedPhaseId,
    }))
  },
  updatePhasePosition: async (phaseId, pos) => {
    // Chỉ xem thì không đổi vị trí và không gửi PUT (canvas cũng đã chặn kéo thả)
    ensureCanEditGraph(get())
    const currentProjectId = get().currentProjectId
    set((state) => ({
      macroPhases: state.macroPhases.map((phase) =>
        phase.id === phaseId ? { ...phase, x: pos.x, y: pos.y } : phase
      ),
    }))
    if (service.updatePhasePosition) {
      await service.updatePhasePosition(phaseId, pos, currentProjectId || undefined)
    }
  },
  selectPhase: (selectedPhaseId) => set({ selectedPhaseId }),
  updateTree: (phaseId, update) => {
    const currentProjectId = get().currentProjectId
    set((state) => {
      // Track đi theo task con của nó, rồi Phase đi theo toàn bộ task
      const nextTree = syncTrackProgress(update(state.trees[phaseId] ?? {}))

      // Tiến độ & trạng thái Phase luôn suy ra từ cây task hiện tại
      const { pct, status } = computePhaseProgress(nextTree)
      const nextMacroPhases = state.macroPhases.map((p) =>
        p.id === phaseId ? withPhaseProgress(p, nextTree) : p
      )

      if (currentProjectId && currentProjectId !== '1') {
        const customGraph = getStoredProjectGraph(currentProjectId)
        if (customGraph) {
          if (!customGraph.trees[phaseId]) {
            customGraph.trees[phaseId] = {
              title: phaseId,
              breadcrumb: '',
              pct,
              gate: { prLink: null, prMerged: false, swagger: '' },
              nodes: nextTree,
            }
          } else {
            customGraph.trees[phaseId].nodes = nextTree
            customGraph.trees[phaseId].pct = pct
          }
          const p = customGraph.phases.find((ph) => ph.id === phaseId)
          if (p) {
            p.pct = pct
            p.status = status
            p.locked = status === 'LOCKED'
          }
          saveStoredProjectGraph(currentProjectId, customGraph)
        }
      }

      if (TREES[phaseId]) {
        TREES[phaseId].nodes = nextTree
        TREES[phaseId].pct = pct
      }

      return {
        macroPhases: nextMacroPhases,
        trees: { ...state.trees, [phaseId]: nextTree },
      }
    })
  },
  deleteNode: (phaseId, nodeId) => {
    const currentProjectId = get().currentProjectId
    set((state) => {
      const currentTree = state.trees[phaseId]
      if (!currentTree || !currentTree[nodeId]) return state
      if (nodeId === 'root' || currentTree[nodeId].kind === 'root') return state
      const nextTree = syncTrackProgress(deleteNodeCascade(currentTree, nodeId))

      if (currentProjectId && currentProjectId !== '1') {
        const customGraph = getStoredProjectGraph(currentProjectId)
        if (customGraph && customGraph.trees[phaseId]) {
          customGraph.trees[phaseId].nodes = nextTree
          saveStoredProjectGraph(currentProjectId, customGraph)
        }
      }

      if (TREES[phaseId]) {
        TREES[phaseId].nodes = nextTree
      }

      return {
        macroPhases: state.macroPhases.map((p) => (p.id === phaseId ? withPhaseProgress(p, nextTree) : p)),
        trees: { ...state.trees, [phaseId]: nextTree },
      }
    })
  },
  resetPhaseTree: async (phaseId: string) => {
    try {
      const currentProjectId = get().currentProjectId
      const cleanTree = syncTrackProgress(await service.getPhaseGraph(phaseId, currentProjectId || undefined))
      set((state) => ({
        macroPhases: state.macroPhases.map((p) => (p.id === phaseId ? withPhaseProgress(p, cleanTree) : p)),
        trees: { ...state.trees, [phaseId]: cleanTree },
      }))
    } catch (err) {
      console.error('Failed to reset phase tree:', err)
    }
  },
  graphWritesUseApi: Boolean(service.addRootTask && service.attachGhostNode),
  addRootTask: async (phaseId, title) => {
    ensureCanEditGraph(get())
    if (!service.addRootTask) throw new Error('The current service doesn\'t support adding tasks through the API.')
    await service.addRootTask(phaseId, { title })
    await get().resetPhaseTree(phaseId)
  },
  attachGhostNode: async (phaseId, payload) => {
    ensureCanEditGraph(get())
    if (!service.attachGhostNode) throw new Error('The current service doesn\'t support linking tasks through the API.')
    await service.attachGhostNode(phaseId, payload)
    // Ghost do mapper dựng từ dependencies: đọc lại cây là thấy
    await get().resetPhaseTree(phaseId)
  },
  connectNodes: async (phaseId, parentId, childId) => {
    ensureCanEditGraph(get())
    if (!service.attachGhostNode) throw new Error('The current service doesn\'t support linking tasks through the API.')
    // Cùng một API POST /dependencies với ghost; nguồn và đích nằm cùng phase
    await service.attachGhostNode(phaseId, { sourcePhaseId: phaseId, sourceTaskId: parentId, targetTaskId: childId })
    // Server nhận rồi mới vẽ cạnh (không vẽ trước rồi phải gỡ)
    get().updateTree(phaseId, (nodes) => {
      const child = nodes[childId]
      if (!child || child.parentIds.includes(parentId)) return nodes
      return { ...nodes, [childId]: { ...child, parentIds: [...child.parentIds, parentId] } }
    })
  },
  addChildTask: async (phaseId, parentTaskIds, title) => {
    ensureCanEditGraph(get())
    if (!service.addChildTask) throw new Error('The current service does not support adding child tasks.')
    await service.addChildTask(phaseId, parentTaskIds, { title })
    await get().resetPhaseTree(phaseId)
  },
  updateNodeInfo: async (phaseId, nodeId, patch) => {
    ensureCanEditGraph(get())
    if (!service.updateTaskNode) throw new Error('The current service does not support editing tasks.')
    await service.updateTaskNode(nodeId, patch)
    await get().resetPhaseTree(phaseId)
  },
  removeNode: async (phaseId, nodeId) => {
    ensureCanEditGraph(get())
    if (!service.deleteTaskNode) throw new Error('The current service does not support deleting tasks.')
    await service.deleteTaskNode(nodeId)
    await get().resetPhaseTree(phaseId)
  },
  forceUnlockNode: async (phaseId, nodeId) => {
    ensureCanEditGraph(get())
    if (!service.forceUnlockTask) throw new Error('The current service does not support early unlock.')
    await service.forceUnlockTask(nodeId)
    await get().resetPhaseTree(phaseId)
  },
  setActiveTab: (activeTab) => set({ activeTab }),
}))

export const useWorkflowStore = createWorkflowStore()
