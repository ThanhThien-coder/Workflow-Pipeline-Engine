import { create } from 'zustand'
import { applyEdgeChanges, applyNodeChanges, type Edge, type Node, type NodeChange, type OnEdgesChange, type OnNodesChange } from '@xyflow/react'
import { workflowService } from '../services'
import type { Phase, Task } from '../types/workflow'
import type { QuestState } from '../types/services'

export type WorkflowNodeData = { label: string; phase?: Phase; task?: Task }
export type WorkflowNode = Node<WorkflowNodeData>
export type QuestStatus = QuestState['jamie']
const phasePositions = [{ x: 30, y: 150 }, { x: 380, y: 80 }, { x: 380, y: 320 }, { x: 790, y: 150 }]

function toFlowNodes(phases: Phase[]): WorkflowNode[] {
  return phases.flatMap((phase, index) => {
    const width = 320
    const height = Math.max(220, phase.tasks.length * 91 + 87)
    const groupId = `group-${phase.id}`
    return [{ id: String(groupId), type: 'phaseGroup', position: phasePositions[index], width, height, style: { width, height }, data: { label: `${phase.title}: ${phase.subtitle}`, phase } },
      ...phase.tasks.map((task, taskIndex) => ({ id: String(task.id), type: 'task', parentId: String(groupId), extent: 'parent' as const, position: { x: 16, y: 68 + taskIndex * 91 }, data: { label: task.title, task } }))] as WorkflowNode[]
  })
}
function normalizeEdges(rawEdges: Edge[], nodes: WorkflowNode[]): Edge[] {
  const nodeIds = new Set(nodes.map((node) => String(node.id)))
  return rawEdges.map((edge) => ({
    ...edge,
    id: `edge-${String(edge.source)}-${String(edge.target)}`,
    source: String(edge.source),
    target: String(edge.target),
    sourceHandle: edge.sourceHandle ?? undefined,
    targetHandle: edge.targetHandle ?? undefined,
  })).filter((edge) => {
    const valid = nodeIds.has(edge.source) && nodeIds.has(edge.target)
    if (!valid) console.error('Dropping workflow edge with missing endpoint', edge)
    return valid
  })
}
function applyWorkflowNodeChanges(changes: NodeChange<WorkflowNode>[], nodes: WorkflowNode[]) {
  const changed = applyNodeChanges(changes, nodes)
  return changed.map((node) => {
    const dimension = changes.find((change) => change.type === 'dimensions' && change.id === node.id)
    if (!dimension || dimension.type !== 'dimensions' || !dimension.dimensions) return node
    return { ...node, width: dimension.dimensions.width, height: dimension.dimensions.height, style: { ...node.style, width: dimension.dimensions.width, height: dimension.dimensions.height } }
  })
}
type WorkflowState = {
  nodes: WorkflowNode[]; edges: Edge[]; selectedTask: Task | null; quest: QuestState; isDirty: boolean; isLoading: boolean; error: string | null
  onNodesChange: OnNodesChange<WorkflowNode>; onEdgesChange: OnEdgesChange; selectTask: (task: Task | null) => void
  loadCanvas: (projectId: number) => Promise<void>; loadQuestMap: (projectId: number, userId: number) => Promise<void>
  submitArtifact: (nodeId: string, url: string) => Promise<void>; approveReview: () => Promise<void>; completeDatabase: () => Promise<void>; claimIntegration: () => Promise<void>
  saveLayout: (projectId: number) => Promise<void>
}
const initialQuest: QuestState = { artifactSubmitted: false, jamie: 'active', database: 'active', integration: 'locked' }
export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  nodes: [], edges: [], selectedTask: null, quest: initialQuest, isDirty: false, isLoading: false, error: null,
  onNodesChange: (changes) => set((state) => ({ nodes: applyWorkflowNodeChanges(changes, state.nodes), isDirty: changes.some((change) => change.type === 'position' || change.type === 'dimensions') || state.isDirty })),
  onEdgesChange: (changes) => set((state) => ({ edges: applyEdgeChanges(changes, state.edges) })),
  selectTask: (selectedTask) => set({ selectedTask }),
  loadCanvas: async (projectId) => { set({ isLoading: true, error: null }); try { const graph = await workflowService.getCanvasGraph(projectId); const nodes = toFlowNodes(graph.phases); set({ nodes, edges: normalizeEdges(graph.edges, nodes), isLoading: false }) } catch (error) { set({ error: error instanceof Error ? error.message : 'Unable to load canvas', isLoading: false }) } },
  loadQuestMap: async (projectId, userId) => { set({ isLoading: true, error: null }); try { const quest = await workflowService.getPersonalQuestStream(projectId, userId); set({ quest, isLoading: false }) } catch (error) { set({ error: error instanceof Error ? error.message : 'Unable to load quest map', isLoading: false }) } },
  submitArtifact: async (nodeId, url) => { const updated = await workflowService.submitArtifact(nodeId, url); set((state) => ({ nodes: state.nodes.map((node) => node.id === nodeId ? { ...node, data: { ...node.data, task: updated } } : node), quest: { ...state.quest, artifactSubmitted: true, jamie: 'review' } })) },
  approveReview: async () => set({ quest: await workflowService.approveReview() }),
  completeDatabase: async () => set({ quest: await workflowService.completeDatabase() }),
  claimIntegration: async () => set({ quest: await workflowService.claimIntegration() }),
  saveLayout: async (projectId) => { const nodes = get().nodes; const positions = Object.fromEntries(nodes.map((node) => [node.id, { x: node.position.x, y: node.position.y, width: node.width, height: node.height }])); await workflowService.saveGraphLayout(projectId, { projectId, positions }); set({ isDirty: false }) },
}))
