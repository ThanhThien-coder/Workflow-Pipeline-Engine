import type { Edge } from '@xyflow/react'
import type { Phase, Task } from './workflow'

export type WorkflowNode = Task
export type NodeDependency = Edge
export type QuestStatus = 'done' | 'active' | 'review' | 'locked'
export interface QuestState { artifactSubmitted: boolean; jamie: QuestStatus; database: QuestStatus; integration: QuestStatus }
export interface CanvasGraph { projectId: number; projectStatus: 'ACTIVE' | 'DRAFT' | 'INACTIVE' | 'ARCHIVED'; phases: Phase[]; nodes: WorkflowNode[]; edges: NodeDependency[] }
export interface GraphLayoutUpdate { projectId: number; positions: Record<string, { x: number; y: number; width?: number; height?: number }> }
export interface IWorkflowService {
  getCanvasGraph(projectId: number): Promise<CanvasGraph>
  getPersonalQuestStream(projectId: number, userId: number): Promise<QuestState>
  claimTask(nodeId: string): Promise<WorkflowNode>
  submitArtifact(nodeId: string, url: string): Promise<WorkflowNode>
  saveGraphLayout(projectId: number, layout: GraphLayoutUpdate): Promise<void>
  approveReview(): Promise<QuestState>
  completeDatabase(): Promise<QuestState>
  claimIntegration(): Promise<QuestState>
}
