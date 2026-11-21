import {
  daysBetween,
  vnDay,
  type GuestArtifact,
  type GuestMember,
  type GuestReportPhase,
  type GuestTask,
} from '../../../domain/guestReport'
import type { GuestReportDto } from '../../../types/guest.types'
import type { AvatarPerson } from '../ui'

export function phaseLabel(phase: GuestReportPhase): string {
  return phase.index >= 0 ? `Phase ${phase.index + 1} · ${phase.name}` : 'No phase'
}

export function isTaskOverdue(task: GuestTask, serverNow: Date): boolean {
  return task.status !== 'DONE' && task.due !== null && vnDay(task.due).getTime() < vnDay(serverNow).getTime()
}

export function taskLateBy(task: GuestTask): number {
  if (task.status !== 'DONE' || task.due === null || task.done === null) return 0
  return daysBetween(task.due, task.done)
}

export function isTaskLateDone(task: GuestTask): boolean {
  return taskLateBy(task) > 0
}

export function taskOverdueDays(task: GuestTask, serverNow: Date): number {
  if (!task.due) return 0
  return Math.max(0, daysBetween(task.due, serverNow))
}

export function isSafeHttpUrl(url: string | null | undefined): url is string {
  if (!url) return false
  return /^https?:\/\//i.test(url.trim())
}

export function buildAvatarPeople(members: GuestMember[]): Record<string, AvatarPerson> {
  const map: Record<string, AvatarPerson> = {}
  members.forEach((m, i) => {
    map[m.id] = {
      name: m.name,
      initials: m.initials,
      colorIndex: i,
    }
  })
  return map
}

export function buildArtifactsByTask(artifacts: GuestArtifact[]): Record<string, GuestArtifact[]> {
  const map: Record<string, GuestArtifact[]> = {}
  for (const a of artifacts) {
    if (a.nodeId == null) continue
    if (!map[a.nodeId]) map[a.nodeId] = []
    map[a.nodeId].push(a)
  }
  return map
}

export function buildEstimatedHoursById(graph: GuestReportDto['graph']): Record<string, number | null> {
  const map: Record<string, number | null> = {}
  for (const node of graph?.nodes ?? []) {
    const hours = typeof node.estimatedHours === 'number' && Number.isFinite(node.estimatedHours)
      ? node.estimatedHours
      : null
    map[String(node.id)] = hours
  }
  return map
}

export function countPhaseArtifacts(
  phase: GuestReportPhase,
  artifactsByTask: Record<string, GuestArtifact[]>,
): number {
  return phase.tasks.reduce((sum, task) => sum + (artifactsByTask[task.id]?.length ?? 0), 0)
}
