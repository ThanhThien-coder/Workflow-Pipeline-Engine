import { phases, tasks } from '../data/mockData'
import type { CanvasGraph, GraphLayoutUpdate, IWorkflowService, QuestState, WorkflowNode } from '../types/services'

const delay = <T>(value: T, ms = 250): Promise<T> => new Promise((resolve) => setTimeout(() => resolve(value), ms))
const edges = [
  { id: 'e-001-014', source: 'wpe-001', target: 'wpe-014', sourceHandle: 'source', targetHandle: 'target', type: 'default' },
  { id: 'e-002-016', source: 'wpe-002', target: 'wpe-016', sourceHandle: 'source', targetHandle: 'target', type: 'default' },
  { id: 'e-014-015', source: 'wpe-014', target: 'wpe-015', sourceHandle: 'source', targetHandle: 'target', type: 'default' },
  { id: 'e-016-017', source: 'wpe-016', target: 'wpe-017', sourceHandle: 'source', targetHandle: 'target', type: 'default' },
  { id: 'e-015-020', source: 'wpe-015', target: 'wpe-020', sourceHandle: 'source', targetHandle: 'target', type: 'default' },
  { id: 'e-017-020', source: 'wpe-017', target: 'wpe-020', sourceHandle: 'source', targetHandle: 'target', type: 'default' },
] as const
let quest: QuestState = { artifactSubmitted: false, jamie: 'active', database: 'active', integration: 'locked' }

export class MockWorkflowService implements IWorkflowService {
  async getCanvasGraph(projectId: number): Promise<CanvasGraph> { return delay({ projectId, projectStatus: 'ACTIVE', phases, nodes: tasks, edges: [...edges] }) }
  async getPersonalQuestStream(): Promise<QuestState> { return delay({ ...quest }) }
  async claimTask(nodeId: string): Promise<WorkflowNode> {
    const node = tasks.find((task) => task.id === nodeId)
    if (!node) throw new Error(`Node ${nodeId} not found`)
    if (node.status !== 'TODO') throw new Error('Node is not claimable')
    node.status = 'IN_PROGRESS'
    return delay({ ...node })
  }
  async submitArtifact(nodeId: string, url: string): Promise<WorkflowNode> {
    if (!url.trim()) throw new Error('Artifact URL is required')
    const node = tasks.find((task) => task.id === nodeId)
    if (!node) throw new Error(`Node ${nodeId} not found`)
    node.status = 'REVIEW'
    quest = { ...quest, artifactSubmitted: true, jamie: 'review' }
    return delay({ ...node })
  }
  async saveGraphLayout(_projectId: number, _layout: GraphLayoutUpdate): Promise<void> { return delay(undefined, 150) }
  async approveReview(): Promise<QuestState> { quest = { ...quest, jamie: 'done', integration: quest.database === 'done' ? 'active' : 'locked' }; return delay({ ...quest }) }
  async completeDatabase(): Promise<QuestState> { quest = { ...quest, database: 'done', integration: quest.jamie === 'done' ? 'active' : 'locked' }; return delay({ ...quest }) }
  async claimIntegration(): Promise<QuestState> { if (quest.integration === 'active') quest = { ...quest, integration: 'done' }; return delay({ ...quest }) }
}
