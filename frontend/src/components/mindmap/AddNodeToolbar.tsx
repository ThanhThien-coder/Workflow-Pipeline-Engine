import { Link2, Plus } from 'lucide-react'

interface Props {
  onAddTrack: () => void
  onAddGhost: (pos: { x: number; y: number; anchorId?: string }) => void
}

export function AddNodeToolbar({ onAddTrack, onAddGhost }: Props) {
  return <div
    className="absolute bottom-6 left-6 z-30 flex items-center gap-3"
    onMouseDown={(event) => event.stopPropagation()}
    onClick={(event) => event.stopPropagation()}
    onWheel={(event) => event.stopPropagation()}
  >
    <button
      onClick={onAddTrack}
      className="flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-[12px] font-semibold text-slate-700 shadow-lg transition-colors hover:bg-slate-50 hover:text-blue-600"
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-600"><Plus size={12} /></span>
      Thêm Track vào Root
    </button>
    <button
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect()
        onAddGhost({ x: rect.left, y: rect.top - 8 })
      }}
      className="flex items-center gap-2 rounded-full border border-indigo-200 bg-white px-4 py-2.5 text-[12px] font-semibold text-indigo-700 shadow-lg transition-colors hover:bg-indigo-50"
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-indigo-600"><Link2 size={12} /></span>
      Thêm Ghost Node
    </button>
  </div>
}
