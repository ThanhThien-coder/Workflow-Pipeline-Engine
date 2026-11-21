import { useCallback, useEffect, useMemo, useState } from 'react'
import { buildGuestReport, type GuestReportModel } from '../../domain/guestReport'
import type { GuestOverviewDto } from '../../types/guest.types'
import { GuestPhaseExplorer } from './GuestPhaseExplorer'
import { SectionHead } from './ui'
import { AiSummaryCard } from './sections/AiSummaryCard'
import { BurnUpChart } from './sections/BurnUpChart'
import { DeadlineAudit } from './sections/DeadlineAudit'
import { EvidenceCard } from './sections/EvidenceCard'
import { FeedbackSection } from './sections/FeedbackSection'
import { KpiGrid } from './sections/KpiGrid'
import { PhaseScorecard } from './sections/PhaseScorecard'
import { ProjectHeader } from './sections/ProjectHeader'
import { SectionNav } from './sections/SectionNav'
import { StatusRibbon } from './sections/StatusRibbon'
import { TeamTable } from './sections/TeamTable'
import { TopBar } from './sections/TopBar'
import { buildAvatarMap } from './sections/helpers'

export interface GuestReportViewProps {
  token: string
  overview: GuestOverviewDto
}

function pickDefaultPhaseId(model: GuestReportModel): string | null {
  const realPhases = model.phases.filter((p) => p.index >= 0)
  if (realPhases.length === 0) {
    return model.phases[0]?.id ?? null
  }
  if (model.metrics.completed) {
    const mostLate = realPhases.reduce((best, p) => (p.late > best.late ? p : best), realPhases[0])
    return mostLate.id
  }
  return model.metrics.currentPhase?.id ?? realPhases[0].id
}

function scrollToElement(id: string) {
  window.setTimeout(() => {
    document.getElementById(id)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  }, 60)
}

export function GuestReportView({ token, overview }: GuestReportViewProps) {
  const report = overview.report
  if (!report) {
    throw new Error('Guest report data is missing')
  }

  const model = useMemo(() => buildGuestReport(report), [report])
  const avatarById = useMemo(() => buildAvatarMap(model.members), [model.members])

  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(() => pickDefaultPhaseId(model))
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null)
  const [focusSeq, setFocusSeq] = useState<number>(0)
  const [feedbackScope, setFeedbackScope] = useState<string>('')
  const [feedbackFocusKey, setFeedbackFocusKey] = useState<number>(0)

  // body bị khóa cuộn cho toàn app (index.css); trang khách dài nên mở cuộn cấp cửa sổ khi đang mở trang,
  // giống landing-mode. Không bọc khung h-screen để bản in và ảnh chụp toàn trang không bị cắt.
  useEffect(() => {
    const html = document.documentElement
    html.classList.add('guest-scroll')
    document.body.classList.add('guest-scroll')
    return () => {
      html.classList.remove('guest-scroll')
      document.body.classList.remove('guest-scroll')
    }
  }, [])

  useEffect(() => {
    setSelectedPhaseId(pickDefaultPhaseId(model))
    setFocusTaskId(null)
    setFocusSeq(0)
    setFeedbackScope('')
  }, [model])

  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  const handleSelectPhase = useCallback((phaseId: string) => {
    setSelectedPhaseId(phaseId)
    setFocusTaskId(null)
  }, [])

  const handleOpenPhase = useCallback((phaseId: string) => {
    setSelectedPhaseId(phaseId)
    setFocusTaskId(null)
    scrollToElement('s-deep')
  }, [])

  const handleGoTask = useCallback(
    (taskId: string) => {
      const task = model.byId[taskId]
      if (!task) return
      setSelectedPhaseId(task.phaseId ?? 'none')
      setFocusTaskId(task.id)
      setFocusSeq((n) => n + 1)
    },
    [model.byId],
  )

  const handleCommentTask = useCallback((taskId: string) => {
    setFeedbackScope(`t:${taskId}`)
    setFeedbackFocusKey((k) => k + 1)
  }, [])

  const handleCommentPhase = useCallback((phaseId: string) => {
    setFeedbackScope(`p:${phaseId}`)
    setFeedbackFocusKey((k) => k + 1)
  }, [])

  const gridBgStyle = {
    backgroundColor: '#f8fafc',
    backgroundImage:
      'linear-gradient(to right, rgba(203,213,225,.4) 1px, transparent 1px), linear-gradient(to bottom, rgba(203,213,225,.4) 1px, transparent 1px)',
    backgroundSize: '32px 32px',
  }

  return (
    <div className="relative min-h-screen bg-slate-50 text-slate-800 print:bg-white">
      <div className="pointer-events-none fixed inset-0 z-0 print:hidden" style={gridBgStyle} aria-hidden="true" />

      <div className="relative z-10">
        <TopBar
          linkExpiresAt={model.project.linkExpiresAt}
          onPrint={handlePrint}
          onFeedback={() => scrollToElement('s-feedback')}
        />
        <SectionNav />

        <main className="mx-auto max-w-6xl px-4 pb-24 sm:px-6 print:px-0 print:pb-4">
          {/* 1. Overview */}
          <section id="s-overview" className="scroll-mt-28 space-y-4 pt-6 print:pt-0">
            <ProjectHeader model={model} lastUpdated={overview.lastUpdated} />
            <KpiGrid model={model} onOverdue={() => scrollToElement('s-schedule')} />
            <StatusRibbon metrics={model.metrics} />
            <AiSummaryCard token={token} serverNow={model.serverNow} />
          </section>

          {/* 2. Schedule & deadlines */}
          <section id="s-schedule" className="scroll-mt-28">
            <SectionHead
              n={2}
              title="Schedule & deadlines"
              question="Did each phase finish by its plan, did the team work steadily, and what slipped?"
            />
            <PhaseScorecard model={model} onOpenPhase={handleOpenPhase} />
            <div className="mt-5 grid items-start gap-5 lg:grid-cols-12 print:block print:space-y-5">
              <div className="min-w-0 lg:col-span-7">
                <BurnUpChart model={model} />
              </div>
              <div className="min-w-0 lg:col-span-5">
                <DeadlineAudit model={model} onGraph={handleGoTask} onComment={handleCommentTask} />
              </div>
            </div>
          </section>

          {/* 3. Team & proof */}
          <section id="s-team" className="scroll-mt-28">
            <SectionHead
              n={3}
              title="Team & proof"
              question="Who delivered what, and where is the evidence?"
            />
            <div className="grid items-start gap-5 lg:grid-cols-12 print:block print:space-y-5">
              <div className="min-w-0 lg:col-span-7">
                <TeamTable model={model} avatarById={avatarById} />
              </div>
              <div className="min-w-0 lg:col-span-5">
                <EvidenceCard model={model} onGoTask={handleGoTask} />
              </div>
            </div>
          </section>

          {/* 4. Phases & tasks */}
          <section id="s-deep" className="scroll-mt-28">
            <SectionHead
              n={4}
              title="Phases & tasks"
              question="How the phases depend on each other. Pick a phase to see its tasks as a graph or a list."
            />
            <GuestPhaseExplorer
              model={model}
              graph={report.graph}
              selectedPhaseId={selectedPhaseId}
              onSelectPhase={handleSelectPhase}
              focusTaskId={focusTaskId}
              focusSeq={focusSeq}
              onCommentTask={handleCommentTask}
              onCommentPhase={handleCommentPhase}
            />
          </section>

          {/* 5. Feedback */}
          <section id="s-feedback" className="scroll-mt-28">
            <SectionHead
              n={5}
              title="Feedback"
              question="Comment on the whole project, a phase or a task. It is one-way: there is no reply thread."
            />
            <div className="max-w-2xl">
              <FeedbackSection
                token={token}
                model={model}
                scope={feedbackScope}
                onScopeChange={setFeedbackScope}
                focusKey={feedbackFocusKey}
              />
            </div>
          </section>

          <p className="pt-8 text-center text-[11px] text-slate-400">
            Shared read-only by the project owner · Pipeline Engine
          </p>
        </main>
      </div>
    </div>
  )
}

export default GuestReportView
