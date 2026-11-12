export type ISODateTime = string
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE'
export type ProjectRole = 'OWNER' | 'MANAGER' | 'COLLABORATOR' | 'VIEWER'
export interface UserSummary { id: string; name: string; roleTitle: string; initials: string; avatarClass: string; projectRole: ProjectRole; assignedTaskCount: number; avatarUrl?: string | null }
export type ArtifactType = 'PR' | 'FIGMA' | 'DOCS' | 'ZIP'
export interface ArtifactItem { id: string; type: ArtifactType; url: string; note: string; uploadedAt: ISODateTime; label?: string }
export type PhaseId = 'P1' | 'P2A' | 'P2B' | 'P3'
export type PhaseFilterId = 'ALL' | PhaseId
export interface KanbanTask { id: string; code: string; title: string; description: string; status: TaskStatus; assignedUserId: string; phaseId: PhaseId; phaseLabel: string; dueDate: ISODateTime; isOverdue: boolean; joinPolicySummary: string; artifacts: ArtifactItem[]; version: number; rejectReason?: string }
export interface SubmitArtifactDto { taskId: string; type: ArtifactType; url: string; note: string }
export interface KanbanFilterState { searchKeyword: string; selectedPhaseId: PhaseFilterId }
export type TransitionDecision = { kind: 'allow' } | { kind: 'needs-artifact' } | { kind: 'deny'; message: string }
