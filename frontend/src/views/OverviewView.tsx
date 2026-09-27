import { useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'

export function OverviewView() {
  const [isAiAnalyzed, setIsAiAnalyzed] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const handleRunDiagnostics = () => {
    if (isAnalyzing) return
    setIsAnalyzing(true)
    window.setTimeout(() => { setIsAnalyzing(false); setIsAiAnalyzed(true) }, 1200)
  }
  const alerts = [
    ['Bottleneck detected: Frontend Dev node', 'Task WPE-014 (UI Component Library) has been in progress for 8 days with no sub-task completions.'],
    ['Critical path at risk: QA Testing blocked', '2 upstream nodes (Backend Auth API, Data Schema v3) are both overdue. QA Testing cannot start until these complete.'],
    ['Phase 1 milestone achieved ahead of schedule', 'Design Review, Wireframes, and Stakeholder Sign-off all completed 3 days before target.'],
  ]
  return <div className="overview"><div className="stat-grid">{[['Total Nodes', '24', '8 on critical path'], ['Completed', '72%', '17 of 24 nodes done'], ['Overdue Tasks', '4', '2 blocking release']].map((stat, index) => <div className="stat" key={stat[0]}><div className={`stat-icon i${index}`}>{index === 1 ? '72%' : index === 2 ? '!' : '✣'}</div><div><small>{stat[0]}</small><strong>{stat[1]}</strong><span>{stat[2]}</span></div></div>)}</div><div className="report card ai-report">
    <div className="report-title"><Sparkles size={18}/> <b>AI Diagnostic Report</b>{isAiAnalyzed ? <><span>Updated just now</span><button className="ai-rerun" onClick={handleRunDiagnostics} disabled={isAnalyzing}>Re-run Analysis</button></> : <span>Not analyzed yet</span>}</div>
    <div className={isAiAnalyzed ? 'ai-report-content revealed' : 'ai-report-content filter blur-md select-none pointer-events-none opacity-40'}>{alerts.map((alert, index) => <div className={`alert a${index} ${index === 0 ? 'bg-amber-50 border-l-4 border-amber-500 text-amber-900' : index === 1 ? 'bg-rose-50 border-l-4 border-rose-500 text-rose-900' : 'bg-emerald-50 border-l-4 border-emerald-500 text-emerald-900'}`} key={alert[0]}><b>{alert[0]}</b><p>{alert[1]}</p></div>)}</div>
    <div className={`ai-report-overlay ${isAiAnalyzed && !isAnalyzing ? 'is-hidden' : ''}`}><button onClick={handleRunDiagnostics} disabled={isAnalyzing} className="ai-run-button">{isAnalyzing ? <Loader2 className="animate-spin" size={16}/> : <Sparkles size={16} className="text-violet-200" />}<span>{isAnalyzing ? 'Analyzing workflow bottlenecks...' : 'Run AI Diagnostics'}</span></button><p>{isAnalyzing ? 'Scanning DAG structure...' : 'Click to scan DAG structure and identify execution bottlenecks'}</p></div>
  </div></div>
}
