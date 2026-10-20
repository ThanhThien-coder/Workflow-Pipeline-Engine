import React, { useState } from 'react'
import {
  Link as LinkIcon,
  Trash2,
  AlertTriangle,
  FolderGit2,
  ArrowRight,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react'
import { useWorkflowStore } from '../../store/useWorkflowStore'
import { useProjectArtifacts } from '../../hooks/useProjectArtifacts'
import { useRouter } from '../../router/useRouter'
import type { ProjectArtifact } from '../../types/artifact.types'

export function ProjectResourcesSection({ projectId = '1' }: { projectId?: string }) {
  const { artifacts, removeArtifact, openDrawer } = useProjectArtifacts(projectId)
  const setActiveTab = useWorkflowStore((state) => state.setActiveTab)
  const { navigate } = useRouter()

  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false)
  const [selectedArtifact, setSelectedArtifact] = useState<ProjectArtifact | null>(null)

  const handleGoToWorkflow = () => {
    setActiveTab('workflow')
    openDrawer()
    navigate(`/project/${projectId}/workflow`)
  }

  const handleCopy = async (e: React.MouseEvent, artifact: ProjectArtifact) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(artifact.url)
      setCopiedId(artifact.id)
      setTimeout(() => {
        setCopiedId((curr) => (curr === artifact.id ? null : curr))
      }, 1500)
    } catch {
      // fallback
    }
  }

  const openRemoveModal = (artifact: ProjectArtifact, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedArtifact(artifact)
    setIsRemoveModalOpen(true)
  }

  const handleConfirmRemove = () => {
    if (!selectedArtifact) return
    removeArtifact(selectedArtifact.id)
    setIsRemoveModalOpen(false)
    setSelectedArtifact(null)
  }

  return (
    <>
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Banner notification: Artifacts now live on Workflow Canvas */}
        <div className="bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-transparent border-b border-blue-100/80 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-600 text-white shadow-xs">
              <FolderGit2 size={16} />
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-950">
                Artifacts are now managed directly on the Workflow Canvas.
              </p>
              <p className="text-[11px] text-blue-700/80">
                Use the Floating Island & Slide-over Drawer for quick deliverable submissions.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoToWorkflow}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-700"
          >
            <span>Open Canvas</span>
            <ArrowRight size={13} />
          </button>
        </div>

        {/* Section Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 pb-3 pt-4">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Project Resources & Deliverables</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Synced external links, pull requests, and artifacts associated with this pipeline.
            </p>
          </div>

          <button
            type="button"
            onClick={handleGoToWorkflow}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:border-blue-300"
          >
            <FolderGit2 size={14} className="text-blue-600" />
            <span>Manage on Canvas</span>
          </button>
        </div>

        {/* Synced Resources List */}
        <div className="overflow-y-auto max-h-[300px] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 hover:[&::-webkit-scrollbar-thumb]:bg-slate-400">
          <ul className="divide-y divide-slate-100">
            {artifacts.length === 0 && (
              <li className="p-6 text-center text-sm text-slate-500">
                No deliverables added yet. Use the Workflow Canvas to attach link artifacts.
              </li>
            )}
            {artifacts.map((res) => {
              const isCopied = copiedId === res.id

              return (
                <li
                  key={res.id}
                  className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-slate-50 group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                      <LinkIcon size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold text-slate-800">
                        {res.title}
                      </div>
                      <a
                        href={res.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate block text-[11px] text-slate-400 hover:text-blue-600 hover:underline transition-colors w-fit"
                      >
                        {res.url}
                      </a>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {res.createdAt && (
                      <span className="text-xs text-slate-400 hidden sm:block">
                        Added {res.createdAt}
                      </span>
                    )}
                    <div className="flex items-center gap-1.5">
                      {/* Copy Link */}
                      <button
                        type="button"
                        onClick={(e) => handleCopy(e, res)}
                        className={`rounded-lg border px-2 py-1 text-xs font-semibold shadow-2xs transition ${
                          isCopied
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                        title={isCopied ? 'Copied!' : 'Copy link'}
                      >
                        {isCopied ? <Check size={13} /> : <Copy size={13} />}
                      </button>

                      {/* Open Link */}
                      <a
                        href={res.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg border border-slate-200 bg-white p-1 text-slate-500 shadow-2xs transition hover:bg-slate-50 hover:text-blue-600"
                        title="Open external link"
                      >
                        <ExternalLink size={14} />
                      </a>

                      {/* Remove */}
                      <button
                        type="button"
                        onClick={(e) => openRemoveModal(res, e)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-red-600 shadow-2xs transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                        title="Remove resource"
                      >
                        <Trash2 size={13} />
                        <span className="hidden sm:inline">Remove</span>
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </section>

      {/* Remove Confirmation Modal */}
      {isRemoveModalOpen && selectedArtifact && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4 backdrop-blur-2xs"
          onClick={() => setIsRemoveModalOpen(false)}
        >
          <div
            className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-2xl animate-pop-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 border-b border-slate-100 pb-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-red-100 text-red-600">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Remove Resource</h3>
                <p className="text-xs text-slate-500">
                  Target resource: <strong className="text-slate-700">{selectedArtifact.title}</strong>
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-red-100 bg-red-50/60 p-3.5 text-xs leading-relaxed text-slate-700">
              <p>Are you sure you want to remove this resource? This will remove it from both the Canvas drawer and Settings.</p>
            </div>

            <div className="flex justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setIsRemoveModalOpen(false)}
                className="rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemove}
                className="rounded-lg bg-red-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default ProjectResourcesSection
