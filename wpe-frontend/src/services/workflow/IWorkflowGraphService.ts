import type { GhostDependency, PhaseNode } from '../../types/workflow.types'

export interface IWorkflowService {
  getPhaseGraph(phaseId: string): Promise<{
    root: PhaseNode
    nodes: PhaseNode[]
    ghostDependencies: GhostDependency[]
  }>
  addRootTask(phaseId: string, payload: { title: string }): Promise<PhaseNode>
  attachGhostNode(
    phaseId: string,
    payload: { sourcePhaseId: string; sourceTaskId: string; targetTaskId: string }
  ): Promise<GhostDependency>
  resetPhaseTree(phaseId: string): Promise<void>
}

export type IWorkflowGraphService = IWorkflowService
