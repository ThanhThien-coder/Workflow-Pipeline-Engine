import { useState } from 'react'
import type { KanbanTask, TaskStatus, UserSummary } from '../../types/kanban.types'
import { KanbanColumn } from './KanbanColumn'
const columns: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE']
export function KanbanBoard({
  tasks,
  actor,
  pendingIds,
  onMove,
  filtering,
  onOpenDetails,
}: {
  tasks: KanbanTask[]
  actor: UserSummary
  pendingIds: string[]
  onMove: (id: string, to: TaskStatus) => void
  filtering: boolean
  onOpenDetails: (task: KanbanTask) => void
}) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<TaskStatus | null>(null)
  return (
    <div className="mt-2.5 grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {columns.map((column) => (
        <KanbanColumn
          key={column}
          status={column}
          actor={actor}
          pendingIds={pendingIds}
          over={overCol === column}
          onOver={() => setOverCol(column)}
          onLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) setOverCol(null)
          }}
          onDrop={(event) => {
            event.preventDefault()
            const id = event.dataTransfer.getData('text/plain') || dragId
            if (id) onMove(id, column)
            setDragId(null)
            setOverCol(null)
          }}
          onMove={onMove}
          onDragStart={(id) => {
            setDragId(id)
          }}
          dragId={dragId}
          filtering={filtering}
          onOpenDetails={onOpenDetails}
          tasks={tasks.filter((task) => task.status === column)}
        />
      ))}
    </div>
  )
}
