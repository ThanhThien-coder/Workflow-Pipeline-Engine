import { useCallback, useRef, useState } from 'react'
import { RefreshCw, X } from 'lucide-react'
import type { AiDiagnosticReport } from '../../types/overview.types'
import { useAnchoredPosition } from '../../hooks/useAnchoredPosition'
import { useDismiss } from '../../hooks/useDismiss'
import { SparkleIcon } from '../common/SparkleIcon'
import { relativeEn } from '../../utils/relativeTime'

/** Nhãn nguồn: chỉ AI thật (hoặc server cũ chưa trả source) mới được gọi là Gemini. */
function engineLabel(report: AiDiagnosticReport): string {
  if (report.source === 'MOCK' || report.source === 'MOCK_FALLBACK') return 'Dữ liệu giả lập'
  return `${report.engine} Engine`
}

export function AiDiagnosisPopover({ report, onRescan }: { report: AiDiagnosticReport; onRescan?: () => Promise<unknown> }) {
  const [isOpen, setIsOpen] = useState(false)
  const [scanning, setScanning] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const position = useAnchoredPosition(isOpen, buttonRef)
  const close = useCallback(() => setIsOpen(false), [])
  useDismiss(isOpen, close, [buttonRef, popoverRef])
  const rescan = async () => {
    if (!onRescan || scanning) return
    setScanning(true)
    try {
      await onRescan()
    } finally {
      setScanning(false)
    }
  }
  const hasInsights = report.insights.length > 0
  return <div className="relative z-[45] shrink-0"><button ref={buttonRef} type="button" onClick={() => setIsOpen((value) => !value)} aria-haspopup="dialog" aria-expanded={isOpen} className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium text-indigo-700 transition ${isOpen ? 'border-indigo-400 bg-indigo-50 ring-2 ring-indigo-100' : 'border-indigo-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/40'}`}><SparkleIcon /> AI Diagnosis</button>
    {isOpen && <><div className="fade-in fixed inset-0 z-40 bg-slate-900/10" /><div ref={popoverRef} role="dialog" aria-label="AI Pipeline Diagnostic Insights" data-lenis-prevent className="pop-in fixed inset-x-0 z-50 mx-auto max-h-[calc(100vh-120px)] w-[calc(100%-4rem)] max-w-5xl overflow-y-auto rounded-2xl border border-slate-200/80 bg-white/95 shadow-2xl backdrop-blur-md" style={{ top: position.top, transformOrigin: `${position.origin}px top` }}><div className="absolute -top-2 h-4 w-4 rotate-45 border-l border-t border-slate-200 bg-white" style={{ left: position.caret }} /><div className="relative flex items-start justify-between gap-4 rounded-t-2xl border-b border-slate-100 bg-white px-6 pb-4 pt-5"><div className="flex items-center gap-3"><span className="rounded-xl bg-gradient-to-br from-violet-100 to-sky-100 p-2"><SparkleIcon className="h-5 w-5" /></span><div><h3 className="text-base font-semibold">AI Pipeline Diagnostic Insights</h3><span className="mt-1 inline-block rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">{hasInsights ? `Model: ${engineLabel(report)} · Updated ${relativeEn(report.generatedAt)}` : 'Chưa có chẩn đoán'}</span></div></div><button type="button" onClick={close} aria-label="Close" className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={16} /></button></div>
      {report.warning && <div role="alert" data-testid="ai-warning" className="mx-6 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{report.warning}</div>}
      {!hasInsights && <div data-testid="ai-empty-state" className="my-5 px-6 text-sm text-slate-500">{report.emptyMessage || 'Chưa có chẩn đoán cho dự án này.'} Bấm “Chạy chẩn đoán” để AI phân tích đồ thị hiện tại.</div>}
      <div className="my-5 grid grid-cols-1 gap-4 px-6 md:grid-cols-3">{report.insights.map((insight) => <div key={insight.id} className={`flex flex-col rounded-xl border p-4 transition-opacity ${insight.boxClass} ${scanning ? 'opacity-50' : ''}`}><div className="flex items-center justify-between gap-2"><span className="text-lg">{insight.icon}</span><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${insight.tagClass}`}>{insight.tag}</span></div><div className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{insight.kicker}</div><h4 className="mt-1 text-sm font-semibold leading-snug text-slate-900">{insight.title}</h4><p className="mt-2 text-sm leading-relaxed text-slate-700">{insight.description}</p></div>)}</div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-b-2xl border-t border-slate-100 bg-slate-50/70 px-6 py-3.5"><p className="max-w-xl text-[11px] text-slate-400">Automated diagnosis evaluated against DAG topology and state machine transitions across all project nodes.</p><button type="button" onClick={() => void rescan()} disabled={scanning || !onRescan} className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-white px-3.5 py-2 text-xs font-semibold text-indigo-700 hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-70"><RefreshCw size={14} className={scanning ? 'spin-360' : ''} />{scanning ? 'Scanning…' : hasInsights ? 'Re-scan Pipeline' : 'Chạy chẩn đoán'}</button></div>
    </div></>}
  </div>
}
