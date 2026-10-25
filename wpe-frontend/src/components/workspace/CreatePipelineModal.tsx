import { useState, useEffect, type FC, type KeyboardEvent } from 'react'
import { Layers, Loader2 } from 'lucide-react'
import { StatusBadge } from '../common/StatusBadge'
import { container } from '../../services/container'
import type { TemplateSummaryDto } from '../../types/template.types'

interface CreatePipelineModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (data: { name: string; desc: string; templateId?: string; visibility?: string }) => Promise<void>
  initialTemplateId?: string
}

export const CreatePipelineModal: FC<CreatePipelineModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  initialTemplateId = '',
}) => {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [templateId, setTemplateId] = useState(initialTemplateId)
  const [visibility, setVisibility] = useState('PRIVATE')
  const [templates, setTemplates] = useState<TemplateSummaryDto[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [err, setErr] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose()
    }

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
      let isMounted = true
      setLoadingTemplates(true)
      if (initialTemplateId) {
        setTemplateId(initialTemplateId)
      }
      container.templateService
        .getAllTemplates()
        .then((items) => {
          if (isMounted) {
            setTemplates(items)
            if (initialTemplateId) {
              const matched = items.find((t) => t.id === initialTemplateId)
              if (matched && !name) {
                setName(`${matched.name} (Project)`)
              }
              if (matched && !desc) {
                setDesc(matched.description || '')
              }
            }
          }
        })
        .catch(() => {
          if (isMounted) setTemplates([])
        })
        .finally(() => {
          if (isMounted) setLoadingTemplates(false)
        })

      return () => {
        isMounted = false
        window.removeEventListener('keydown', handleKeyDown)
      }
    } else {
      setName('')
      setDesc('')
      setTemplateId(initialTemplateId || '')
      setVisibility('PRIVATE')
      setErr('')
    }
  }, [isOpen, onClose, initialTemplateId, submitting, name, desc])

  if (!isOpen) return null

  const handleSubmit = async () => {
    if (!name.trim()) {
      setErr('Pipeline name is required.')
      return
    }

    setSubmitting(true)
    setErr('')
    try {
      await onCreate({
        name: name.trim(),
        desc: desc.trim(),
        templateId: templateId || undefined,
        visibility,
      })
    } catch (error: any) {
      setErr(error?.message || 'Có lỗi xảy ra khi tạo dự án.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-sm grid place-items-center p-4"
      onClick={() => {
        if (!submitting) onClose()
      }}
    >
      <div
        data-lenis-prevent
        className="pop w-full max-w-lg rounded-2xl bg-white border border-slate-200/90 shadow-2xl p-6 space-y-4 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">
              {templateId ? 'Nhân bản quy trình từ Template' : 'Create New Pipeline'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {templateId
                ? 'Sao chép sâu toàn bộ giai đoạn (Phases), tác vụ và cạnh phụ thuộc DAG.'
                : 'Set up a deterministic workflow pipeline with DAG constraints.'}
            </p>
          </div>
          <StatusBadge status={templateId ? 'PLANNING' : 'DRAFT'} />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-800">
            Pipeline Name <span className="text-rose-500">*</span>
          </label>
          <input
            autoFocus
            disabled={submitting}
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (err) setErr('')
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="e.g. Authentication Service V2"
            className={`mt-1.5 w-full text-sm rounded-xl border bg-white px-3.5 py-2.5 outline-none transition-colors disabled:opacity-60 ${
              err ? 'border-rose-300 focus:border-rose-400' : 'border-slate-200/90 focus:border-indigo-500'
            }`}
          />
          {err && <p className="mt-1 text-[11px] font-medium text-rose-600 fade">{err}</p>}
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-800 flex items-center justify-between">
            <span>
              Khởi tạo từ Template mẫu{' '}
              <span className="text-slate-400 font-normal">(Tùy chọn / Optional)</span>
            </span>
            {loadingTemplates && (
              <span className="text-[10px] text-indigo-500 font-normal">Đang tải templates…</span>
            )}
          </label>
          <div className="relative mt-1.5">
            <select
              disabled={submitting}
              value={templateId}
              onChange={(e) => {
                setTemplateId(e.target.value)
                const chosen = templates.find((t) => t.id === e.target.value)
                if (chosen && !desc) {
                  setDesc(chosen.description || '')
                }
              }}
              className="w-full text-sm rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 outline-none transition-colors focus:border-indigo-500 text-slate-800 disabled:opacity-60"
            >
              <option value="">Blank Project (Khởi tạo dự án trống - Mặc định)</option>
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.name} ({tpl.category} · {tpl.phaseCount} phases, {tpl.nodeCount} tasks)
                </option>
              ))}
            </select>
          </div>
          {templateId && (
            <div className="mt-1.5 flex items-center gap-1.5 rounded-lg bg-indigo-50/60 px-2.5 py-1.5 text-[11px] text-indigo-700">
              <Layers size={13} className="shrink-0 text-indigo-600" />
              <span>
                Hệ thống sẽ tự động nhân bản cấu trúc Phases & DAG Nodes từ template đã chọn.
              </span>
            </div>
          )}
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-800">
            Description <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <textarea
            rows={3}
            disabled={submitting}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Describe the goal of this workflow"
            className="mt-1.5 w-full text-sm rounded-xl border border-slate-200/90 bg-white focus:border-indigo-500 px-3.5 py-2.5 outline-none resize-none transition-colors disabled:opacity-60"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-800">
            Chế độ hiển thị / Visibility
          </label>
          <div className="mt-1.5 grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setVisibility('PRIVATE')}
              className={`rounded-xl border p-2.5 text-left font-medium transition-all ${
                visibility === 'PRIVATE'
                  ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 font-bold'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="block font-bold">Private (Riêng tư)</span>
              <span className="text-[10px] text-slate-500 font-normal">Chỉ bạn và thành viên được mời</span>
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => setVisibility('PUBLIC')}
              className={`rounded-xl border p-2.5 text-left font-medium transition-all ${
                visibility === 'PUBLIC'
                  ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 font-bold'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="block font-bold">Public (Công khai)</span>
              <span className="text-[10px] text-slate-500 font-normal">Mọi người trong workspace đều thấy</span>
            </button>
          </div>
        </div>

        <p className="text-[11px] text-slate-500">
          New pipelines start as <b>{templateId ? 'PLANNING' : 'DRAFT'}</b> and are published after Kahn&apos;s cycle check passes.
        </p>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="text-sm font-semibold text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-xl px-4 py-2 transition-colors cursor-pointer disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            className="btn-primary-gradient text-sm font-semibold text-white rounded-xl px-4 py-2 cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2 min-w-[140px]"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>{templateId ? 'Đang nhân bản...' : 'Creating...'}</span>
              </>
            ) : (
              <span>{templateId ? 'Nhân bản quy trình ➔' : 'Create Pipeline ➔'}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
