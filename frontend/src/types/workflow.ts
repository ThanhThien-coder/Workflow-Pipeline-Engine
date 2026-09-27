export type TaskStatus = 'LOCKED' | 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE'
export type JoinLogic = 'ALL_COMPLETED' | 'ANY_COMPLETED'
export interface User { id: string; name: string; initials: string; color: string; role: string }
export interface Task { id: string; title: string; description: string; status: TaskStatus; phase: string; assignee: User; dueDate: string; progress: number; joinLogic: JoinLogic; dependencies: string[]; accent: string }
export type PhaseStatus = 'COMPLETED' | 'IN_PROGRESS' | 'LOCKED'
export interface Phase { id: string; title: string; subtitle: string; status: PhaseStatus; progress?: number; tasks: Task[] }
