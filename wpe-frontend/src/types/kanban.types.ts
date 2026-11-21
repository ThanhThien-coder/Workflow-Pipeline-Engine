export type ISODateTime = string
export type TaskStatus = 'LOCKED' | 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE'
export type ProjectRole = 'OWNER' | 'MANAGER' | 'COLLABORATOR' | 'VIEWER'
export interface UserSummary { id: string; name: string; roleTitle: string; initials: string; avatarClass: string; projectRole: ProjectRole; assignedTaskCount: number; avatarUrl?: string | null }
export type ArtifactType = 'PR' | 'FIGMA' | 'DOCS' | 'ZIP'
export interface ArtifactItem { id: string; type: ArtifactType; url: string; note: string; uploadedAt: ISODateTime; label?: string }
/** Id phase thật của dự án (dữ liệu mock dùng P1/P2A/P2B/P3). */
export type PhaseId = string
export type PhaseFilterId = 'ALL' | PhaseId
export interface KanbanTask { id: string; code: string; title: string; description: string; status: TaskStatus; assignedUserId: string; phaseId: PhaseId; phaseLabel: string; dueDate: ISODateTime; isOverdue: boolean; joinPolicySummary: string; artifacts: ArtifactItem[]; version: number; rejectReason?: string; /** T6: the project owner unlocked this task early */ forceUnlocked?: boolean; /** G21: task creation date (ISO); the due date cannot be earlier than this */ createdAt?: ISODateTime; /** S04: lúc task Done được mở lại (Reopen); có giá trị thì artifact cũ hơn mốc này hiện nhãn "Before reopen" */ reopenedAt?: ISODateTime }
/** S04: một task con trong báo cáo ảnh hưởng khi mở lại task Done. willRelock = con đang To Do sẽ bị khóa lại. */
export interface ReopenImpactChild { id: string; code: string; title: string; status: TaskStatus; willRelock: boolean }
export interface ReopenImpact { taskCode: string; children: ReopenImpactChild[] }
export interface SubmitArtifactDto { taskId: string; type?: ArtifactType; url: string; note: string }
export interface KanbanFilterState { searchKeyword: string; selectedPhaseId: PhaseFilterId }
export type TransitionDecision = { kind: 'allow' } | { kind: 'needs-artifact' } | { kind: 'deny'; message: string }
