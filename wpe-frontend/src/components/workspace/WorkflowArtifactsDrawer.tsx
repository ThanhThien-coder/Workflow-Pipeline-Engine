import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Plus,
  Copy,
  Check,
  ExternalLink,
  Trash2,
  FolderOpen,
  Eye,
  EyeOff,
} from 'lucide-react'
import { selectCanEditGraph, useWorkflowStore } from '../../store/useWorkflowStore'
import type { ProjectArtifact } from '../../types/artifact.types'
import { normalizeText } from '../../utils/searchProject'
import { SiteIcon, hostOf } from '../common/SiteIcon'

function isValidUrl(str: string): boolean {
  try {
    const u = new URL(str.startsWith('http://') || str.startsWith('https://') ? str : `https://${str}`)
    return !!u.hostname && u.hostname.includes('.')
  } catch {
    return false
  }
}

export interface WorkflowArtifactsDrawerProps {
  projectId?: string
  isOpen?: boolean
  onClose?: () => void
  className?: string
}

export const WorkflowArtifactsDrawer: React.FC<WorkflowArtifactsDrawerProps> = ({
  projectId = '1',
  isOpen: propIsOpen,
  onClose: propOnClose,
  className = '',
}) => {
  const storeIsOpen = useWorkflowStore((state) => state.artifacts.isDrawerOpen)
  const storeCloseDrawer = useWorkflowStore((state) => state.artifacts.closeDrawer)
  const artifacts = useWorkflowStore((state) => state.artifacts.items)
  const status = useWorkflowStore((state) => state.artifacts.status)
  const loadError = useWorkflowStore((state) => state.artifacts.error)
  const loadArtifacts = useWorkflowStore((state) => state.artifacts.loadArtifacts)
  const addArtifact = useWorkflowStore((state) => state.artifacts.addArtifact)
  const removeArtifact = useWorkflowStore((state) => state.artifacts.removeArtifact)
  const setGuestVisibility = useWorkflowStore((state) => state.artifacts.setGuestVisibility)
  const canManageGuestVisibility = useWorkflowStore(selectCanEditGraph)
  const showToast = useWorkflowStore((state) => state.ui.showToast)

  const isOpen = propIsOpen !== undefined ? propIsOpen : storeIsOpen
  const handleClose = () => {
    if (propOnClose) {
      propOnClose()
    } else {
      storeCloseDrawer()
    }
  }

  // Mở drawer thì đọc lại danh sách để thấy artifact người khác vừa thêm
  useEffect(() => {
    if (isOpen) void loadArtifacts(projectId)
  }, [projectId, isOpen, loadArtifacts])

  // Esc đóng popover
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // handleClose đổi mỗi lần render nhưng chỉ gọi hàm đóng hiện hành
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, propOnClose, storeCloseDrawer])

  const isLoading = status === 'loading' || status === 'idle'

  // Quick Add Form State
  const [formTitle, setFormTitle] = useState('')
  const [formUrl, setFormUrl] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [togglingIds, setTogglingIds] = useState<Set<string>>(() => new Set())
  // Ô tìm: theo tên, link, loại (không phân biệt hoa thường và dấu)
  const [searchQuery, setSearchQuery] = useState('')
  const normalizedSearch = normalizeText(searchQuery)
  const visibleArtifacts = normalizedSearch
    ? artifacts.filter((artifact) =>
        [artifact.name || artifact.title, artifact.url, artifact.type].some((field) =>
          normalizeText(field).includes(normalizedSearch),
        ),
      )
    : artifacts

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    const trimmedTitle = formTitle.trim()
    const trimmedUrl = formUrl.trim()

    if (!trimmedTitle) {
      setErrorMessage('Enter a name for the link.')
      return
    }

    if (!trimmedUrl) {
      setErrorMessage('Enter a URL.')
      return
    }

    if (!isValidUrl(trimmedUrl)) {
      setErrorMessage('That URL isn\'t valid. Enter a link that starts with https://')
      return
    }

    const normalizedUrl =
      trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')
        ? trimmedUrl
        : `https://${trimmedUrl}`

    setSubmitting(true)
    try {
      await addArtifact(projectId, { name: trimmedTitle, url: normalizedUrl })
      showToast('Resource link added.')
      setFormTitle('')
      setFormUrl('')
      setErrorMessage(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Couldn\'t add the deliverable.'
      setErrorMessage(msg)
      showToast(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteLink = async (artifact: ProjectArtifact) => {
    try {
      await removeArtifact(projectId, String(artifact.id))
      showToast('Resource link removed.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete resource.')
    }
  }

  const handleToggleGuestVisibility = async (artifact: ProjectArtifact) => {
    const id = String(artifact.id)
    const nextVisible = !(artifact.isPublicForGuest !== false)
    setTogglingIds((prev) => new Set(prev).add(id))
    try {
      await setGuestVisibility(projectId, id, nextVisible)
      showToast(nextVisible ? 'Visible to guests.' : 'Hidden from guests.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update guest visibility.')
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const handleCopyLink = async (artifact: ProjectArtifact) => {
    try {
      await navigator.clipboard.writeText(artifact.url)
      setCopiedId(String(artifact.id))
      setTimeout(() => {
        setCopiedId((curr) => (curr === String(artifact.id) ? null : curr))
      }, 1500)
    } catch {
      // fallback
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Invisible click-outside backdrop to dismiss popover when clicking anywhere on canvas */}
          <div
            className="fixed inset-0 z-40"
            onClick={(e) => {
              e.stopPropagation()
              handleClose()
            }}
            onMouseDown={(e) => e.stopPropagation()}
            aria-hidden="true"
          />

          {/* Contextual Anchored Popover / Flyout Panel */}
          <motion.aside
            key="artifacts-flyout-panel"
            data-lenis-prevent="true"
            data-pan-zoom-ignore="true"
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            style={{ transformOrigin: 'top right' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className={`absolute right-0 top-full z-50 mt-2 w-[380px] sm:w-[440px] max-w-[calc(100vw-32px)] max-h-[70vh] flex flex-col rounded-3xl bg-white/95 backdrop-blur-xl border border-mp-n-200 shadow-2xl overflow-hidden select-text ${className}`}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Tầng 1: Header (Không co, không giãn) */}
            <header className="flex-shrink-0 p-4 pb-3 border-b border-mp-n-100 flex items-center justify-between bg-gradient-to-b from-mp-purple-50/60 to-transparent">
              <div className="flex items-center gap-2">
                <h2 className="text-mp-ink font-semibold text-base flex items-center gap-2">
                  Project Deliverables
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-mp-purple-100/70 text-mp-purple-700 border border-mp-purple-200/50">
                  {artifacts.length}
                </span>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="w-7 h-7 rounded-full bg-mp-n-100/70 hover:bg-mp-n-200 text-mp-n-600 transition-colors flex items-center justify-center shrink-0 cursor-pointer"
                aria-label="Close panel"
              >
                <X size={15} />
              </button>
            </header>

            {/* Tầng 2: Form Thêm Link (Không co, không giãn) */}
            <section className="flex-shrink-0 p-3 bg-gradient-to-b from-mp-n-50/80 to-white border-b border-mp-n-200/80">
              <form
                onSubmit={handleAddLink}
                className="space-y-2"
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold text-mp-ink">
                  <Plus size={13} className="text-mp-purple-700" />
                  <span>Quick Add Link</span>
                </div>

                <div className="space-y-1.5">
                  <input
                    type="text"
                    disabled={submitting}
                    className="w-full bg-white border border-mp-n-200 rounded-xl px-3 py-1.5 text-xs text-mp-ink placeholder:text-mp-n-400 focus:outline-none focus:ring-2 focus:ring-mp-purple-400/50 focus:border-mp-purple-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="Link name (for example: Figma design, GitHub PR...)"
                    value={formTitle}
                    onChange={(e) => {
                      setFormTitle(e.target.value)
                      if (errorMessage) setErrorMessage(null)
                    }}
                  />

                  <input
                    type="text"
                    disabled={submitting}
                    className="w-full bg-white border border-mp-n-200 rounded-xl px-3 py-1.5 text-xs text-mp-ink placeholder:text-mp-n-400 focus:outline-none focus:ring-2 focus:ring-mp-purple-400/50 focus:border-mp-purple-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="https://..."
                    value={formUrl}
                    onChange={(e) => {
                      setFormUrl(e.target.value)
                      if (errorMessage) setErrorMessage(null)
                    }}
                  />
                </div>

                {errorMessage && (
                  <div className="text-[11px] font-medium text-red-600 px-1">
                    {errorMessage}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || !formTitle.trim() || !formUrl.trim()}
                  className="w-full py-2 rounded-xl font-medium text-xs text-white bg-gradient-to-r from-mp-eggplant via-mp-purple-600 to-indigo-600 hover:opacity-95 shadow-mp-glow transition-all active:scale-[0.99] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:pointer-events-none disabled:shadow-none"
                >
                  {submitting ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-1" />
                      <span>Adding link...</span>
                    </>
                  ) : (
                    <>
                      <Plus size={14} />
                      <span>+ Add Link</span>
                    </>
                  )}
                </button>
              </form>
            </section>

            {/* Ô tìm deliverables (chỉ hiện khi đã có link) */}
            {artifacts.length > 0 && (
              <div className="flex-shrink-0 px-3.5 pt-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, link or type..."
                  aria-label="Search deliverables"
                  className="w-full bg-white border border-mp-n-200 rounded-xl px-3 py-1.5 text-xs text-mp-ink placeholder:text-mp-n-400 focus:outline-none focus:ring-2 focus:ring-mp-purple-400/50 focus:border-mp-purple-400 transition-all"
                />
              </div>
            )}

            {/* Tầng 3: Danh sách Deliverables (BẮT BUỘC CO GIÃN VÀ CUỘN ĐỘC LẬP) */}
            <div
              className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-2.5 overscroll-contain [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-mp-n-300"
              data-lenis-prevent="true"
            >
              {isLoading && artifacts.length === 0 ? (
                /* Skeleton Loading State (Chống giật layout khi fetch) */
                <div className="space-y-2.5 py-1" role="status" aria-label="Loading deliverables">
                  {[1, 2, 3].map((n) => (
                    <div
                      key={n}
                      className="rounded-2xl border border-mp-n-200/80 bg-white p-3 flex items-center justify-between animate-pulse"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-xl bg-mp-n-200/70 shrink-0" />
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="h-3.5 bg-mp-n-200/80 rounded w-2/3" />
                          <div className="h-2.5 bg-mp-n-200/50 rounded w-1/3" />
                        </div>
                      </div>
                      <div className="w-6 h-6 rounded-lg bg-mp-n-100 shrink-0 ml-2" />
                    </div>
                  ))}
                </div>
              ) : status === 'error' ? (
                <div className="grid place-items-center p-7 text-center bg-rose-50/70 rounded-2xl border border-rose-200 my-2" role="alert">
                  <h3 className="text-sm font-semibold text-rose-700">Could not load resources.</h3>
                  <p className="text-xs text-rose-600 mt-1 max-w-[260px] leading-relaxed">{loadError}</p>
                  <button
                    type="button"
                    onClick={() => void loadArtifacts(projectId)}
                    className="mt-3 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              ) : artifacts.length === 0 ? (
                /* Empty State thân thiện */
                <div className="grid place-items-center p-7 text-center bg-mp-n-50/70 rounded-2xl border border-dashed border-mp-n-200 my-2">
                  <div className="grid h-11 w-11 place-items-center rounded-full bg-mp-purple-50 text-mp-purple-700 mb-2.5 border border-mp-purple-200/50">
                    <FolderOpen size={20} />
                  </div>
                  <h3 className="text-sm font-semibold text-mp-ink">
                    No deliverables yet.
                  </h3>
                  <p className="text-xs text-mp-n-500 mt-1 max-w-[260px] leading-relaxed">
                    Paste your first Figma, PR, or document link above so your team can access it.
                  </p>
                </div>
              ) : visibleArtifacts.length === 0 ? (
                <div className="grid place-items-center p-6 text-center text-xs text-mp-n-500">
                  No deliverables match your search.
                </div>
              ) : (
                visibleArtifacts.map((artifact) => {
                  const domain = hostOf(artifact.url) ?? artifact.url
                  const isCopied = copiedId === artifact.id
                  const isPublicForGuest = artifact.isPublicForGuest !== false
                  const isToggling = togglingIds.has(String(artifact.id))

                  return (
                    <div
                      key={artifact.id}
                      className="rounded-2xl border border-mp-n-200/80 bg-white hover:border-mp-purple-200 hover:shadow-mp-card transition-all p-3 flex items-center justify-between gap-2 group"
                    >
                      {/* Left Info */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 border border-slate-200/70 transition-transform group-hover:scale-105 shadow-2xs">
                          <SiteIcon url={artifact.url} size={18} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-mp-ink group-hover:text-mp-purple-700 transition-colors">
                            {artifact.name || artifact.title}
                          </div>
                          <div className="text-xs text-mp-n-400 flex items-center gap-1.5 mt-0.5">
                            <span className="truncate max-w-[160px]">
                              {domain}
                            </span>
                            {artifact.createdAt && (
                              <>
                                <span>•</span>
                                <span className="shrink-0 text-[11px] text-mp-n-400">
                                  {artifact.createdAt}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right Action Toolbar */}
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Visible to guests (Owner / Manager only) */}
                        {canManageGuestVisibility && (
                          <button
                            type="button"
                            disabled={isToggling}
                            aria-pressed={isPublicForGuest}
                            aria-label={`Visible to guests: ${artifact.name || artifact.title}`}
                            title={isPublicForGuest ? 'Visible to guests — click to hide' : 'Hidden from guests — click to show'}
                            onClick={() => void handleToggleGuestVisibility(artifact)}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50 ${
                              isPublicForGuest
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                : 'border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {isPublicForGuest ? <Eye size={13} /> : <EyeOff size={13} />}
                            <span className="hidden sm:inline">
                              {isPublicForGuest ? 'Shown to guests' : 'Hidden from guests'}
                            </span>
                          </button>
                        )}

                        {/* Copy Link */}
                        <button
                          type="button"
                          onClick={() => handleCopyLink(artifact)}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                            isCopied
                              ? 'text-emerald-600 bg-emerald-50'
                              : 'text-mp-n-400 hover:text-mp-purple-600 hover:bg-mp-purple-50'
                          }`}
                          title={isCopied ? 'Copied!' : 'Copy link'}
                          aria-label={`Copy link for ${artifact.name || artifact.title}`}
                        >
                          {isCopied ? <Check size={14} /> : <Copy size={14} />}
                        </button>

                        {/* Open Link */}
                        <a
                          href={artifact.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg text-mp-n-400 hover:text-mp-purple-600 hover:bg-mp-purple-50 transition-colors"
                          title="Open link in new tab"
                          aria-label={`Open ${artifact.name || artifact.title} in new tab`}
                        >
                          <ExternalLink size={14} />
                        </a>

                        {/* Remove */}
                        <button
                          type="button"
                          onClick={() => handleDeleteLink(artifact)}
                          className="p-1.5 rounded-lg text-mp-n-400 hover:text-red-600 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
                          title="Remove artifact"
                          aria-label={`Remove ${artifact.name || artifact.title}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

export default WorkflowArtifactsDrawer
