import { create } from 'zustand'
import { workflowService } from '../services/container'
import type { CreatePhaseDto, IWorkflowService, TaskNodePatch } from '../services/contracts/IWorkflowService'
import type { ProjectSettingsDto } from '../types/settings.types'
import type { BranchGraphNode, GraphNodeMap, MacroPhase } from '../types/workflow.types'
import { ApiError } from '../services/http/ApiError'
import { computePhaseProgress, syncTrackProgress, withPhaseProgress } from '../domain/phaseProgress'
import { deleteNodeCascade, hasGhostAncestor } from '../utils/spanningTreeLayout'
import { rootIdOf } from '../mappers/graphMapper'
import { currentProjectInfo } from './projectInfo'
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
  /** Trạng thái tải đồ thị của dự án đang mở */
  graphStatus: 'idle' | 'loading' | 'ready' | 'error'
  graphError: string | null
  loadPhases: (projectId?: string) => Promise<void>
  /** Trả về id phase mới */
  createPhase: (dto: CreatePhaseDto) => Promise<string>
  /** true khi đang có một lần spawnChildPhase chưa xong (bỏ qua lần bấm mới) */
  isSpawningPhase: boolean
  /** Id phase vừa tạo bằng (+): thẻ phase tự bật ô sửa tên rồi gọi clearPhaseToRename */
  phaseToRename: string | null
  clearPhaseToRename: () => void
  renamePhase: (phaseId: string, name: string) => Promise<void>
  /** Gỡ cạnh phụ thuộc parent -> child (gỡ ghost: parent = ghost.refId, child = ghost.targetTaskId) rồi đọc lại cây */
  removeDependency: (phaseId: string, parentTaskId: string, childTaskId: string) => Promise<void>
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

/**
 * B5 — Có được sửa đồ thị không: Owner và Manager được sửa (khớp WorkflowGraphService ở backend).
 * - Dự án ARCHIVED: owner/manager cũng chỉ xem (backend trả 409 PROJECT_ARCHIVED).
 * - Vai trò lấy từ Settings hoặc từ thông tin dự án tải khi vào dự án (T3).
 * - Chưa nạp vai trò của đúng dự án này: KHÔNG khóa, để owner vào thẳng canvas vẫn làm được;
 *   backend vẫn chặn bằng 403 và UI hiện toast.
 */
export function selectCanEditGraph(state: Pick<WorkflowState, 'settings' | 'project' | 'currentProjectId'>): boolean {
  const info = currentProjectInfo(state)
  if (!info?.myRole) return true
  if (info.status === 'ARCHIVED') return false
  return info.myRole === 'OWNER' || info.myRole === 'MANAGER'
}

export const GRAPH_READ_ONLY_MESSAGE = 'Only the project owner or a manager can edit the graph'

/** Lớp chặn cuối ở store: không phải owner/manager thì không gửi request ghi đồ thị nào. */
function ensureCanEditGraph(state: WorkflowState): void {
  if (!selectCanEditGraph(state)) {
    throw new ApiError({ status: 403, code: 'GRAPH_READ_ONLY', message: GRAPH_READ_ONLY_MESSAGE })
  }
}

export const createWorkflowStore = (service: IWorkflowService = workflowService) => {
  // Số thứ tự lần loadPhases: lần cũ về muộn thì bỏ kết quả (chống lẫn dự án)
  let loadSeq = 0
  // S03: số thứ tự thay đổi cây theo phase. Lần đọc lại cây (đồng bộ nền) bắt đầu trước một thay đổi mới
  // thì bỏ kết quả, để bản cũ về muộn không xóa thẻ vừa chèn.
  const treeSeq: Record<string, number> = {}
  const bumpTreeSeq = (phaseId: string) => {
    treeSeq[phaseId] = (treeSeq[phaseId] ?? 0) + 1
  }
  const sameNode = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b)
  return create<WorkflowState>((set, get) => {
  /** S03: áp thay đổi lên cây ngay; trả hàm hoàn lại đúng các thẻ đã đổi (không đụng thẻ khác). */
  const applyOptimistic = (phaseId: string, mutate: (nodes: GraphNodeMap) => GraphNodeMap): (() => void) => {
    const before = get().trees[phaseId] ?? {}
    bumpTreeSeq(phaseId)
    get().updateTree(phaseId, mutate)
    const after = get().trees[phaseId] ?? {}
    return () => {
      bumpTreeSeq(phaseId)
      get().updateTree(phaseId, (current) => {
        const next = { ...current }
        for (const id of new Set([...Object.keys(before), ...Object.keys(after)])) {
          if (sameNode(before[id], after[id])) continue
          if (before[id]) next[id] = before[id]
          else delete next[id]
        }
        return next
      })
    }
  }

  /** S03: chèn thẻ task vừa tạo (id thật) vào cây. false = không chèn được (chưa có cây / service không trả thẻ). */
  const insertCreatedNode = (phaseId: string, node: BranchGraphNode | undefined, parentIds: string[]): boolean => {
    const tree = get().trees[phaseId]
    if (!node || !tree) return false
    const rootId = rootIdOf(phaseId)
    const realParents = parentIds.filter((id) => tree[id]?.kind === 'branch')
    // POST trả trạng thái lúc chưa nối cha; nối xong backend khóa lại nếu còn cha chưa Done (task mới: ALL_COMPLETED).
    // Hiện đúng trạng thái ngay, không chờ lần đọc lại cây.
    const parentsDone = realParents.every((id) => (tree[id] as BranchGraphNode).status === 'DONE')
    const status = realParents.length > 0 && !parentsDone ? 'LOCKED' : node.status
    bumpTreeSeq(phaseId)
    get().updateTree(phaseId, (nodes) =>
      nodes[node.id] ? nodes : { ...nodes, [node.id]: { ...node, status, parentIds: realParents.length > 0 ? realParents : [rootId] } }
    )
    return true
  }

  return {
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
  graphStatus: 'idle',
  graphError: null,
  isSpawningPhase: false,
  phaseToRename: null,
  clearPhaseToRename: () => set({ phaseToRename: null }),
  loadPhases: async (projectId?: string) => {
    const pid = projectId || null
    const seq = ++loadSeq
    const switching = get().currentProjectId !== pid
    set({
      currentProjectId: pid,
      graphStatus: 'loading',
      graphError: null,
      ...(switching ? { macroPhases: [], workflowEdges: [], trees: {}, selectedPhaseId: null } : {}),
    })
    const isStale = () => seq !== loadSeq || get().currentProjectId !== pid
    try {
      let phases: MacroPhase[]
      let edges: [string, string][]
      let rawTrees: Record<string, GraphNodeMap>
      if (service.getProjectGraph) {
        const graph = await service.getProjectGraph(projectId || '1')
        phases = graph.phases
        edges = graph.edges
        rawTrees = graph.trees
      } else {
        phases = await service.getMacroPhases(projectId)
        edges = await service.getPhaseEdges(projectId)
        const entries = await Promise.all(phases.map(async (phase) => [phase.id, await service.getPhaseGraph(phase.id, projectId)] as const))
        rawTrees = Object.fromEntries(entries)
      }
      if (isStale()) return
      const trees = Object.fromEntries(
        Object.entries(rawTrees).map(([id, tree]) => [id, syncTrackProgress(tree)]),
      ) as Record<string, GraphNodeMap>
      set({
        macroPhases: phases.map((phase) => withPhaseProgress(phase, trees[phase.id])),
        workflowEdges: edges,
        trees,
        graphStatus: 'ready',
        graphError: null,
      })
    } catch (error) {
      if (isStale()) return
      set({ graphStatus: 'error', graphError: error instanceof Error ? error.message : 'Failed to load the graph' })
    }
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
    return phase.id
  },
  spawnChildPhase: async (parentPhaseId) => {
    if (get().isSpawningPhase) return
    const parent = get().macroPhases.find((phase) => phase.id === parentPhaseId)
    if (!parent) return
    set({ isSpawningPhase: true })
    try {
      const id = await get().createPhase({ name: 'New phase', sub: '', parentPhaseId })
      set({ phaseToRename: id })
    } finally {
      set({ isSpawningPhase: false })
    }
  },
  renamePhase: async (phaseId, name) => {
    ensureCanEditGraph(get())
    const trimmed = name.trim()
    if (!trimmed) throw new Error('Phase name cannot be empty')
    const currentProjectId = get().currentProjectId
    if (service.renamePhase) {
      await service.renamePhase(phaseId, trimmed, currentProjectId || undefined)
    }
    set((state) => ({
      macroPhases: state.macroPhases.map((phase) => (phase.id === phaseId ? { ...phase, name: trimmed } : phase)),
    }))
  },
  removeDependency: async (phaseId, parentTaskId, childTaskId) => {
    ensureCanEditGraph(get())
    if (!service.deleteDependency) throw new Error('The current service does not support removing dependencies.')
    const rootId = rootIdOf(phaseId)
    const undo = applyOptimistic(phaseId, (nodes) => {
      const next: GraphNodeMap = {}
      for (const [id, node] of Object.entries(nodes)) {
        // Ghost của cạnh này: bỏ hẳn
        if (node.kind === 'ghost' && node.refId === parentTaskId && node.targetTaskId === childTaskId) continue
        // Cạnh cùng phase: con bỏ cha này (hết cha thì treo lại dưới root)
        if (id === childTaskId && node.parentIds.includes(parentTaskId)) {
          const parentIds = node.parentIds.filter((p) => p !== parentTaskId)
          next[id] = { ...node, parentIds: parentIds.length > 0 || node.kind !== 'branch' ? parentIds : [rootId] }
          continue
        }
        next[id] = node
      }
      return next
    })
    try {
      await service.deleteDependency(phaseId, parentTaskId, childTaskId)
    } catch (error) {
      undo()
      throw error
    }
    void get().resetPhaseTree(phaseId)
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
    // Cây các phase khác còn ghost trỏ tới task đã xóa: đọc lại cả đồ thị một lần
    if (currentProjectId) await get().loadPhases(currentProjectId)
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
      const seqAtStart = treeSeq[phaseId] ?? 0
      const cleanTree = syncTrackProgress(await service.getPhaseGraph(phaseId, currentProjectId || undefined))
      if (get().currentProjectId !== currentProjectId) return
      // Có thay đổi cây mới hơn lúc bắt đầu đọc: bản đọc này đã cũ, thay đổi đó tự đồng bộ lại
      if ((treeSeq[phaseId] ?? 0) !== seqAtStart) return
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
    const created = await service.addRootTask(phaseId, { title })
    // Có thẻ trả về: chèn vào cây ngay (id thật từ server), đọc lại cây chạy nền. Không thì đọc lại và chờ như cũ.
    if (!insertCreatedNode(phaseId, created?.node, [])) {
      await get().resetPhaseTree(phaseId)
      return
    }
    void get().resetPhaseTree(phaseId)
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
    // S03: vẽ cạnh ngay; server từ chối (vd. 422 tạo vòng) thì gỡ cạnh về như cũ rồi ném lỗi
    const rootId = rootIdOf(phaseId)
    const addEdge = (nodes: GraphNodeMap): GraphNodeMap => {
      const child = nodes[childId]
      if (!child || child.parentIds.includes(parentId)) return nodes
      const base = child.kind === 'branch' ? child.parentIds.filter((p) => p !== rootId) : child.parentIds
      return { ...nodes, [childId]: { ...child, parentIds: [...base, parentId] } }
    }
    const payload = { sourcePhaseId: phaseId, sourceTaskId: parentId, targetTaskId: childId }
    // Vòng trong phase đã bị chặn lúc kéo (isAncestor). Vòng đi qua phase khác chỉ có khi phía trên node cha có ghost:
    // khi đó chờ server nhận rồi mới vẽ cạnh, để cạnh không hiện lên rồi biến mất (nhấp nháy) khi server trả 422.
    const tree = get().trees[phaseId]
    if (tree && hasGhostAncestor(tree, parentId)) {
      await service.attachGhostNode(phaseId, payload)
      applyOptimistic(phaseId, addEdge)
      void get().resetPhaseTree(phaseId)
      return
    }
    const undo = applyOptimistic(phaseId, addEdge)
    try {
      await service.attachGhostNode(phaseId, payload)
    } catch (error) {
      undo()
      throw error
    }
    void get().resetPhaseTree(phaseId)
  },
  addChildTask: async (phaseId, parentTaskIds, title) => {
    ensureCanEditGraph(get())
    if (!service.addChildTask) throw new Error('The current service does not support adding child tasks.')
    const created = await service.addChildTask(phaseId, parentTaskIds, { title })
    if (!insertCreatedNode(phaseId, created?.node, parentTaskIds)) {
      await get().resetPhaseTree(phaseId)
      return
    }
    void get().resetPhaseTree(phaseId)
  },
  updateNodeInfo: async (phaseId, nodeId, patch) => {
    ensureCanEditGraph(get())
    if (!service.updateTaskNode) throw new Error('The current service does not support editing tasks.')
    const before = get().trees[phaseId]?.[nodeId]
    const undo =
      before && before.kind === 'branch'
        ? applyOptimistic(phaseId, (nodes) => ({
            ...nodes,
            [nodeId]: {
              ...before,
              title: patch.title.trim(),
              description: patch.description,
              joinPolicy: patch.joinPolicy,
              assignee: patch.assigneeId,
              due: patch.dueDate,
            },
          }))
        : null
    try {
      await service.updateTaskNode(nodeId, patch)
    } catch (error) {
      undo?.()
      throw error
    }
    void get().resetPhaseTree(phaseId)
  },
  removeNode: async (phaseId, nodeId) => {
    ensureCanEditGraph(get())
    if (!service.deleteTaskNode) throw new Error('The current service does not support deleting tasks.')
    const rootId = rootIdOf(phaseId)
    const undo = applyOptimistic(phaseId, (nodes) => {
      if (!nodes[nodeId] || nodes[nodeId].kind === 'root') return nodes
      const next: GraphNodeMap = {}
      for (const [id, node] of Object.entries(nodes)) {
        if (id === nodeId) continue
        // Ghost trỏ tới task này (hoặc nằm trên task này) không còn nghĩa
        if (node.kind === 'ghost' && (node.refId === nodeId || node.targetTaskId === nodeId)) continue
        if (node.parentIds.includes(nodeId)) {
          const parentIds = node.parentIds.filter((p) => p !== nodeId)
          next[id] = { ...node, parentIds: parentIds.length > 0 || node.kind !== 'branch' ? parentIds : [rootId] }
        } else {
          next[id] = node
        }
      }
      return next
    })
    try {
      await service.deleteTaskNode(nodeId)
    } catch (error) {
      undo()
      throw error
    }
    void get().resetPhaseTree(phaseId)
  },
  forceUnlockNode: async (phaseId, nodeId) => {
    ensureCanEditGraph(get())
    if (!service.forceUnlockTask) throw new Error('The current service does not support early unlock.')
    await service.forceUnlockTask(nodeId)
    await get().resetPhaseTree(phaseId)
  },
  setActiveTab: (activeTab) => set({ activeTab }),
  }
  })
}

export const useWorkflowStore = createWorkflowStore()
