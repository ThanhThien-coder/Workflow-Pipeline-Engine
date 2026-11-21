import type { GuestArtifact, GuestTask } from '../../../domain/guestReport'
import { StatusDot, fmtDay, plural, type AvatarPerson } from '../ui'
import { ARTIFACT_ICON_PATHS, PHASE_ICON_PATHS, PhaseIcon } from './icons'
import { isSafeHttpUrl } from './taskHelpers'

export interface TaskDetailsProps {
  task: GuestTask
  byId: Record<string, GuestTask>
  people: Record<string, AvatarPerson>
  artifacts: GuestArtifact[]
  estimatedHours: number | null
  onJumpTask: (taskId: string) => void
  onCommentTask: (taskId: string) => void
  flush?: boolean
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{children}</p>
  )
}

function CodeButtonList({
  ids,
  byId,
  emptyText,
  onJumpTask,
}: {
  ids: string[]
  byId: Record<string, GuestTask>
  emptyText: string
  onJumpTask: (taskId: string) => void
}) {
  const validTasks = ids.map((id) => byId[id]).filter((t): t is GuestTask => Boolean(t))
  if (validTasks.length === 0) {
    return <span className="text-slate-400">{emptyText}</span>
  }

  return (
    <div className="flex flex-wrap gap-1">
      {validTasks.slice(0, 8).map((refTask) => (
        <button
          key={refTask.id}
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onJumpTask(refTask.id)
          }}
          title={refTask.title}
          className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-0.5 hover:border-indigo-300 hover:text-indigo-700"
        >
          <StatusDot status={refTask.status} />
          <span className="font-mono text-[10.5px]">{refTask.code}</span>
        </button>
      ))}
      {validTasks.length > 8 && (
        <span className="self-center text-[11px] text-slate-400">+{validTasks.length - 8}</span>
      )}
    </div>
  )
}

export function TaskDetails({
  task,
  byId,
  people,
  artifacts,
  estimatedHours,
  onJumpTask,
  onCommentTask,
  flush = false,
}: TaskDetailsProps) {
  const person = task.assigneeId ? people[task.assigneeId] ?? null : null

  return (
    <div
      className={`min-w-0 break-words rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 ${
        flush ? '' : 'mb-2.5 sm:ml-[68px]'
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-slate-700">
        {task.description ? task.description : <span className="text-slate-400">No description.</span>}
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <SectionLabel>Assignee &amp; dates</SectionLabel>
          <p>
            {person ? person.name : <span className="text-amber-700">No assignee</span>}
            {estimatedHours !== null && ` · est. ${estimatedHours}h`}
          </p>
          <p className="text-slate-500">
            Due {fmtDay(task.due)}
            {task.done && ` · done ${fmtDay(task.done)}`}
          </p>
        </div>

        <div>
          <SectionLabel>Depends on</SectionLabel>
          <CodeButtonList
            ids={task.deps}
            byId={byId}
            emptyText="Nothing, could start any time"
            onJumpTask={onJumpTask}
          />
        </div>

        <div>
          <SectionLabel>Unlocks next</SectionLabel>
          <CodeButtonList
            ids={task.dependents}
            byId={byId}
            emptyText="Nothing"
            onJumpTask={onJumpTask}
          />
          {task.blocks.length > task.dependents.length && (
            <p className="mt-1 text-[11px] text-slate-500">
              {plural(task.blocks.length, 'open task')} further down the chain
            </p>
          )}
        </div>
      </div>

      {artifacts.length > 0 && (
        <div className="mt-3">
          <SectionLabel>Deliverables</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {artifacts.map((artifact) => {
              const iconPaths = ARTIFACT_ICON_PATHS[artifact.kind] ?? ARTIFACT_ICON_PATHS.OTHER_LINK
              if (isSafeHttpUrl(artifact.url)) {
                return (
                  <a
                    key={artifact.id}
                    href={artifact.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded border border-indigo-200 bg-white px-1.5 py-0.5 text-indigo-700 hover:bg-indigo-50"
                  >
                    <PhaseIcon paths={iconPaths} className="h-3 w-3 shrink-0" />
                    <span>{artifact.name}</span>
                  </a>
                )
              }
              return (
                <span
                  key={artifact.id}
                  className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-slate-600"
                >
                  <PhaseIcon paths={iconPaths} className="h-3 w-3 shrink-0" />
                  <span>{artifact.name}</span>
                </span>
              )
            })}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => onCommentTask(task.id)}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-700 print:hidden"
      >
        <PhaseIcon paths={PHASE_ICON_PATHS.msg} className="h-3.5 w-3.5" />
        <span>Comment on this task</span>
      </button>
    </div>
  )
}
