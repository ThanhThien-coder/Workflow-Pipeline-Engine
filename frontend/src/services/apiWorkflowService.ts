import type { CanvasGraph, GraphLayoutUpdate, IWorkflowService, QuestState, WorkflowNode } from '../types/services'
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api'
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('accessToken')
  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } })
  if (!response.ok) throw new Error(`Request failed: ${response.status}`)
  return response.status === 204 ? (undefined as T) : response.json() as Promise<T>
}
export class ApiWorkflowService implements IWorkflowService {
  getCanvasGraph(projectId: number): Promise<CanvasGraph> { return request(`/projects/${projectId}/graph`) }
  getPersonalQuestStream(projectId: number, userId: number): Promise<QuestState> { return request(`/projects/${projectId}/focus-graph?userId=${userId}`) }
  claimTask(nodeId: string): Promise<WorkflowNode> { return request(`/nodes/${nodeId}/claim`, { method: 'POST' }) }
  submitArtifact(nodeId: string, url: string): Promise<WorkflowNode> { return request(`/nodes/${nodeId}/artifacts`, { method: 'POST', body: JSON.stringify({ fileUrl: url }) }) }
  saveGraphLayout(projectId: number, layout: GraphLayoutUpdate): Promise<void> { return request(`/projects/${projectId}/graph/layout`, { method: 'PUT', body: JSON.stringify(layout) }) }
  approveReview(): Promise<QuestState> { return request('/quest/approve-review', { method: 'POST' }) }
  completeDatabase(): Promise<QuestState> { return request('/quest/complete-database', { method: 'POST' }) }
  claimIntegration(): Promise<QuestState> { return request('/quest/claim-integration', { method: 'POST' }) }
}
