import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Plus,
  Copy,
  Check,
  ExternalLink,
  Trash2,
  FileText,
  BookOpen,
  FolderOpen,
  Link2,
} from 'lucide-react'
import { useWorkflowStore } from '../../store/useWorkflowStore'
import { workflowService } from '../../services/container'
import type { ProjectArtifact } from '../../types/artifact.types'

// Brand Icons
const GithubIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
    />
  </svg>
)

const FigmaIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 5.5A3.5 3.5 0 0 1 8.5 2H12v7H8.5A3.5 3.5 0 0 1 5 5.5z" />
    <path d="M12 2h3.5a3.5 3.5 0 1 1 0 7H12V2z" />
    <path d="M12 12.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 1 1-7 0z" />
    <path d="M5 19.5A3.5 3.5 0 0 1 8.5 16H12v3.5a3.5 3.5 0 1 1-7 0z" />
    <path d="M5 12.5A3.5 3.5 0 0 1 8.5 9H12v7H8.5A3.5 3.5 0 0 1 5 12.5z" />
  </svg>
)

function getDomainMeta(url: string) {
  try {
    const raw = url.trim()
    const parsed = new URL(raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`)
    const host = parsed.hostname.toLowerCase()
    const cleanHost = host.replace(/^www\./, '')

    // 1. GitHub / Code PR
    if (cleanHost.includes('github.com') || cleanHost.includes('gitlab.com')) {
      return {
        icon: GithubIcon,
        domain: cleanHost,
        iconWrapperClass: 'bg-slate-900 text-white',
      }
    }

    // 2. Figma / Design Specs
    if (cleanHost.includes('figma.com')) {
      return {
        icon: FigmaIcon,
        domain: cleanHost,
        iconWrapperClass: 'bg-orange-50 text-orange-600 border border-orange-200/60',
      }
    }

    // 3. Google Drive / Docs / Sheets
    if (
      cleanHost.includes('docs.google.com') ||
      cleanHost.includes('drive.google.com') ||
      cleanHost.includes('spreadsheets')
    ) {
      return {
        icon: FileText,
        domain: cleanHost,
        iconWrapperClass: 'bg-emerald-50 text-emerald-600 border border-emerald-200/60',
      }
    }

    // 4. Notion / Wiki / Research
    if (cleanHost.includes('notion.so') || cleanHost.includes('notion.site') || cleanHost.includes('wiki')) {
      return {
        icon: BookOpen,
        domain: cleanHost,
        iconWrapperClass: 'bg-amber-50 text-amber-700 border border-amber-200/60',
      }
    }

    // 5. API Docs / Swagger / Backend
    if (
      cleanHost.includes('api') ||
      cleanHost.includes('swagger') ||
      cleanHost.includes('backend') ||
      (cleanHost.includes('docs.') && !cleanHost.includes('google'))
    ) {
      return {
        icon: FileText,
        domain: cleanHost,
        iconWrapperClass: 'bg-purple-50 text-mp-purple-700 border border-purple-200/60',
      }
    }

    return {
      icon: ExternalLink,
      domain: cleanHost,
      iconWrapperClass: 'bg-mp-purple-50 text-mp-purple-700 border border-mp-purple-200/60',
    }
  } catch {
    return {
      icon: Link2,
      domain: url,
      iconWrapperClass: 'bg-mp-n-100 text-mp-n-600 border border-mp-n-200',
    }
  }
}

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
  const addArtifact = useWorkflowStore((state) => state.artifacts.addArtifact)
  const removeArtifact = useWorkflowStore((state) => state.artifacts.removeArtifact)
  const showToast = useWorkflowStore((state) => state.ui?.showToast)
  const currentPersona = useWorkflowStore(
    (state) => state.auth.currentUser?.username || 'Owner',
  )

  const isOpen = propIsOpen !== undefined ? propIsOpen : storeIsOpen
  const handleClose = () => {
    if (propOnClose) {
      propOnClose()
    } else {
      storeCloseDrawer()
    }
  }

  const [isLoading, setIsLoading] = useState(false)

  // Load deliverables from backend service when opened or project changes
  useEffect(() => {
    let isMounted = true
    const fetchArtifacts = async () => {
      if (artifacts.length === 0) {
        setIsLoading(true)
      }
      try {
        if (workflowService && workflowService.getProjectArtifacts) {
          const items = await workflowService.getProjectArtifacts(projectId)
          if (isMounted && Array.isArray(items)) {
            useWorkflowStore.setState((state) => ({
              artifacts: {
                ...state.artifacts,
                items,
              },
            }))
          }
        }
      } catch (err) {
        console.warn('Failed to fetch deliverables from backend:', err)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    if (isOpen) {
      void fetchArtifacts()
    }

    return () => {
      isMounted = false
    }
  }, [projectId, isOpen])

  // Quick Add Form State
  const [formTitle, setFormTitle] = useState('')
  const [formUrl, setFormUrl] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    const trimmedTitle = formTitle.trim()
    const trimmedUrl = formUrl.trim()

    if (!trimmedTitle) {
      setErrorMessage('Vui lòng nhập tên link gợi nhớ.')
      return
    }

    if (!trimmedUrl) {
      setErrorMessage('Vui lòng nhập đường dẫn URL.')
      return
    }

    if (!isValidUrl(trimmedUrl)) {
      setErrorMessage('Đường dẫn URL không hợp lệ. Vui lòng nhập link dạng https://...')
      return
    }

    const normalizedUrl =
      trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')
        ? trimmedUrl
        : `https://${trimmedUrl}`

    setSubmitting(true)
    try {
      if (workflowService && workflowService.createArtifact) {
        const created = await workflowService.createArtifact(projectId, {
          name: trimmedTitle,
          url: normalizedUrl,
          isInRepository: true,
        })
        useWorkflowStore.setState((state) => ({
          artifacts: {
            ...state.artifacts,
            items: [created, ...state.artifacts.items.filter((i) => String(i.id) !== String(created.id))],
          },
        }))
        showToast?.('Đã thêm liên kết tài nguyên thành công.')
      } else {
        addArtifact(
          {
            title: trimmedTitle,
            name: trimmedTitle,
            url: normalizedUrl,
            createdBy: currentPersona,
          },
          projectId,
        )
      }

      setFormTitle('')
      setFormUrl('')
      setErrorMessage(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Thêm tài nguyên thất bại.'
      setErrorMessage(msg)
      showToast?.(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteLink = async (artifact: ProjectArtifact) => {
    try {
      if (workflowService && workflowService.deleteArtifact) {
        await workflowService.deleteArtifact(projectId, String(artifact.id))
      }
      removeArtifact(String(artifact.id), projectId)
      useWorkflowStore.setState((state) => ({
        artifacts: {
          ...state.artifacts,
          items: state.artifacts.items.filter((i) => String(i.id) !== String(artifact.id)),
        },
      }))
      showToast?.('Đã xóa liên kết tài nguyên.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Xóa tài nguyên thất bại.'
      console.warn('Failed to delete artifact:', err)
      showToast?.(msg)
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
            className={`fixed top-20 bottom-20 right-6 z-50 w-[380px] max-w-[calc(100vw-48px)] flex flex-col rounded-3xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-mp-n-200 dark:border-slate-800 shadow-2xl overflow-hidden select-text ${className}`}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Tầng 1: Header (Không co, không giãn) */}
            <header className="flex-shrink-0 p-4 pb-3 border-b border-mp-n-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-b from-mp-purple-50/60 to-transparent">
              <div className="flex items-center gap-2">
                <h2 className="text-mp-ink dark:text-slate-100 font-semibold text-base flex items-center gap-2">
                  Project Deliverables
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-mp-purple-100/70 text-mp-purple-700 dark:bg-mp-purple-900/50 dark:text-mp-purple-300 border border-mp-purple-200/50 dark:border-mp-purple-700/50">
                  {artifacts.length}
                </span>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="w-7 h-7 rounded-full bg-mp-n-100/70 hover:bg-mp-n-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-mp-n-600 dark:text-slate-300 transition-colors flex items-center justify-center shrink-0 cursor-pointer"
                aria-label="Close panel"
              >
                <X size={15} />
              </button>
            </header>

            {/* Tầng 2: Form Thêm Link (Không co, không giãn) */}
            <section className="flex-shrink-0 p-3 bg-gradient-to-b from-mp-n-50/80 to-white dark:from-slate-800/50 dark:to-slate-900 border-b border-mp-n-200/80 dark:border-slate-800">
              <form
                onSubmit={handleAddLink}
                className="space-y-2"
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold text-mp-ink dark:text-slate-200">
                  <Plus size={13} className="text-mp-purple-700 dark:text-mp-purple-400" />
                  <span>Quick Add Link</span>
                </div>

                <div className="space-y-1.5">
                  <input
                    type="text"
                    disabled={submitting}
                    className="w-full bg-white dark:bg-slate-800 border border-mp-n-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-mp-ink dark:text-slate-100 placeholder:text-mp-n-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-mp-purple-400/50 focus:border-mp-purple-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="Tên link (ví dụ: Figma Design, PR GitHub...)"
                    value={formTitle}
                    onChange={(e) => {
                      setFormTitle(e.target.value)
                      if (errorMessage) setErrorMessage(null)
                    }}
                  />

                  <input
                    type="text"
                    disabled={submitting}
                    className="w-full bg-white dark:bg-slate-800 border border-mp-n-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-mp-ink dark:text-slate-100 placeholder:text-mp-n-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-mp-purple-400/50 focus:border-mp-purple-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="https://..."
                    value={formUrl}
                    onChange={(e) => {
                      setFormUrl(e.target.value)
                      if (errorMessage) setErrorMessage(null)
                    }}
                  />
                </div>

                {errorMessage && (
                  <div className="text-[11px] font-medium text-red-600 dark:text-red-400 px-1">
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
                      <span>Đang thêm link...</span>
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

            {/* Tầng 3: Danh sách Deliverables (BẮT BUỘC CO GIÃN VÀ CUỘN ĐỘC LẬP) */}
            <div
              className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-2.5 overscroll-contain [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-mp-n-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700"
              data-lenis-prevent="true"
            >
              {isLoading && artifacts.length === 0 ? (
                /* Skeleton Loading State (Chống giật layout khi fetch) */
                <div className="space-y-2.5 py-1" role="status" aria-label="Đang tải danh sách tài nguyên">
                  {[1, 2, 3].map((n) => (
                    <div
                      key={n}
                      className="rounded-2xl border border-mp-n-200/80 bg-white dark:bg-slate-800/80 p-3 flex items-center justify-between animate-pulse"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-xl bg-mp-n-200/70 dark:bg-slate-700 shrink-0" />
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="h-3.5 bg-mp-n-200/80 dark:bg-slate-700 rounded w-2/3" />
                          <div className="h-2.5 bg-mp-n-200/50 dark:bg-slate-700/60 rounded w-1/3" />
                        </div>
                      </div>
                      <div className="w-6 h-6 rounded-lg bg-mp-n-100 dark:bg-slate-700/50 shrink-0 ml-2" />
                    </div>
                  ))}
                </div>
              ) : artifacts.length === 0 ? (
                /* Empty State thân thiện */
                <div className="grid place-items-center p-7 text-center bg-mp-n-50/70 dark:bg-slate-800/40 rounded-2xl border border-dashed border-mp-n-200 dark:border-slate-700 my-2">
                  <div className="grid h-11 w-11 place-items-center rounded-full bg-mp-purple-50 dark:bg-mp-purple-900/30 text-mp-purple-700 dark:text-mp-purple-300 mb-2.5 border border-mp-purple-200/50 dark:border-mp-purple-800/50">
                    <FolderOpen size={20} />
                  </div>
                  <h3 className="text-sm font-semibold text-mp-ink dark:text-slate-100">
                    Chưa có tài nguyên nào.
                  </h3>
                  <p className="text-xs text-mp-n-500 dark:text-slate-400 mt-1 max-w-[260px] leading-relaxed">
                    Hãy dán link Figma, PR hoặc tài liệu đầu tiên ở trên để nhóm cùng truy cập.
                  </p>
                </div>
              ) : (
                artifacts.map((artifact) => {
                  const meta = getDomainMeta(artifact.url)
                  const IconComponent = meta.icon
                  const isCopied = copiedId === artifact.id

                  return (
                    <div
                      key={artifact.id}
                      className="rounded-2xl border border-mp-n-200/80 bg-white hover:border-mp-purple-200 hover:shadow-mp-card transition-all p-3 flex items-center justify-between group"
                    >
                      {/* Left Info */}
                      <div className="flex items-center gap-3 min-w-0 pr-2">
                        <div
                          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${meta.iconWrapperClass} transition-transform group-hover:scale-105 shadow-2xs`}
                        >
                          <IconComponent className="w-4 h-4" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-mp-ink group-hover:text-mp-purple-700 transition-colors">
                            {artifact.name || artifact.title}
                          </div>
                          <div className="text-xs text-mp-n-400 flex items-center gap-1.5 mt-0.5">
                            <span className="truncate max-w-[160px]">
                              {meta.domain}
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
