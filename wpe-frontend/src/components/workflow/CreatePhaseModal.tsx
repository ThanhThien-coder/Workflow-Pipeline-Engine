import { X } from 'lucide-react'
import { useState } from 'react'
import type { CreatePhaseDto } from '../../services/contracts/IWorkflowService'
import type { MacroPhase } from '../../types/workflow.types'

export function CreatePhaseModal({ phases, onSubmit, onClose }: { phases: MacroPhase[]; onSubmit: (dto: CreatePhaseDto) => Promise<void>; onClose: () => void }) {
  const [name, setName] = useState('')
  const [sub, setSub] = useState('')
  const [parentPhaseId, setParentPhaseId] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim() || !sub.trim()) {
      setError('Vui lòng nhập tên và tiêu đề phụ của Phase.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSubmit({ name: name.trim(), sub: sub.trim(), parentPhaseId: parentPhaseId || undefined })
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể tạo Phase.')
    } finally {
      setSaving(false)
    }
  }
  return <div className="absolute inset-0 z-40 grid place-items-center bg-slate-900/20 p-4" onMouseDown={(event) => event.stopPropagation()} onWheel={(event) => event.stopPropagation()}>
    <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
      <div className="mb-4 flex items-center justify-between"><div><h2 className="text-base font-semibold text-slate-800">Tạo Phase mới</h2><p className="mt-0.5 text-xs text-slate-400">Thêm một cụm vào Macro Pipeline</p></div><button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Đóng"><X size={17} /></button></div>
      <label className="mb-3 block text-xs font-semibold text-slate-600">Tên Phase<input value={name} onChange={(event) => setName(event.target.value)} placeholder="PHASE 4" className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" autoFocus /></label>
      <label className="mb-3 block text-xs font-semibold text-slate-600">Tiêu đề phụ<input value={sub} onChange={(event) => setSub(event.target.value)} placeholder="Vận hành & Giám sát" className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" /></label>
      <label className="block text-xs font-semibold text-slate-600">Phase tiền đề<select value={parentPhaseId} onChange={(event) => setParentPhaseId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"><option value="">Không nối từ Phase nào</option>{phases.map((phase) => <option key={phase.id} value={phase.id}>{phase.name} · {phase.sub}</option>)}</select></label>
      {error && <p className="mt-3 text-xs text-rose-600">{error}</p>}
      <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100">Hủy</button><button type="submit" disabled={saving} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-md hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">{saving ? 'Đang tạo...' : 'Xác nhận tạo'}</button></div>
    </form>
  </div>
}
