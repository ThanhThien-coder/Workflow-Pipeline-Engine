import { useState } from 'react'
import { Plus, Link as LinkIcon, Trash2, AlertTriangle } from 'lucide-react'
import { useWorkflowStore } from '../../store/useWorkflowStore'

interface ResourceItem {
  id: string
  title: string
  url: string
  addedAt: string
}

const INITIAL_RESOURCES: ResourceItem[] = [
  { id: '1', title: 'Figma Design System', url: 'https://figma.com/file/123/design-system', addedAt: 'Sep 12, 2026' },
  { id: '2', title: 'API Documentation', url: 'https://api.pipeline.engine/docs/v2', addedAt: 'Sep 15, 2026' },
  { id: '3', title: 'Marketing Assets Drive', url: 'https://drive.google.com/drive/folders/marketing-q4', addedAt: 'Oct 01, 2026' },
  { id: '4', title: 'Competitor Analysis', url: 'https://notion.so/pipeline/competitor-analysis', addedAt: 'Oct 05, 2026' },
  { id: '5', title: 'Launch Checklist', url: 'https://docs.google.com/spreadsheets/launch', addedAt: 'Oct 08, 2026' }
]

export function ProjectResourcesSection() {
  const [resources, setResources] = useState<ResourceItem[]>(INITIAL_RESOURCES)
  const addMockAuditLog = useWorkflowStore((state) => state.settings.addMockAuditLog)
  
  // Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false)
  const [selectedResource, setSelectedResource] = useState<ResourceItem | null>(null)
  
  // Form states
  const [formTitle, setFormTitle] = useState('')
  const [formUrl, setFormUrl] = useState('')

  const openAddModal = () => {
    setSelectedResource(null)
    setFormTitle('')
    setFormUrl('')
    setIsEditModalOpen(true)
  }

  const openEditModal = (res: ResourceItem) => {
    setSelectedResource(res)
    setFormTitle(res.title)
    setFormUrl(res.url)
    setIsEditModalOpen(true)
  }

  const openRemoveModal = (res: ResourceItem, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedResource(res)
    setIsRemoveModalOpen(true)
  }

  const handleSaveResource = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formTitle.trim() || !formUrl.trim()) return

    if (selectedResource) {
      if (formTitle.trim() === selectedResource.title && formUrl.trim() === selectedResource.url) {
        setIsEditModalOpen(false)
        return
      }

      // Edit mode
      setResources(resources.map(r => 
        r.id === selectedResource.id 
          ? { ...r, title: formTitle.trim(), url: formUrl.trim() } 
          : r
      ))
      addMockAuditLog({
        action: 'RESOURCE_UPDATED',
        details: `Updated project resource: ${selectedResource.title}`,
        scope: 'Governance'
      })
    } else {
      // Add mode
      const newResource: ResourceItem = {
        id: Math.random().toString(36).substr(2, 9),
        title: formTitle.trim(),
        url: formUrl.trim(),
        addedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
      }
      setResources([...resources, newResource])
      addMockAuditLog({
        action: 'RESOURCE_ADDED',
        details: `Added new project resource: ${formTitle.trim()}`,
        scope: 'Governance'
      })
    }
    setIsEditModalOpen(false)
  }

  const handleRemoveResource = () => {
    if (!selectedResource) return
    setResources(resources.filter(r => r.id !== selectedResource.id))
    addMockAuditLog({
      action: 'RESOURCE_REMOVED',
      details: `Removed project resource: ${selectedResource.title}`,
      scope: 'Governance'
    })
    setIsRemoveModalOpen(false)
    setSelectedResource(null)
  }

  const inputCls = 'w-full text-sm py-2 px-3 rounded-lg border border-slate-200 bg-white outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'

  return (
    <>
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 pb-3 pt-4">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Project Resources</h2>
            <p className="mt-0.5 text-xs text-slate-500">Manage external links, references, and artifacts associated with this pipeline.</p>
          </div>

          <button
            type="button"
            onClick={openAddModal}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            <Plus size={14} />
            <span>Add Resource</span>
          </button>
        </div>

        <div className="overflow-y-auto max-h-[300px] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 hover:[&::-webkit-scrollbar-thumb]:bg-slate-400">
          <ul className="divide-y divide-slate-100">
            {resources.length === 0 && (
              <li className="p-6 text-center text-sm text-slate-500">No resources added yet.</li>
            )}
            {resources.map((res) => (
              <li 
                key={res.id} 
                onClick={() => openEditModal(res)}
                className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-slate-50 cursor-pointer active:bg-slate-100 group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                    <LinkIcon size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-slate-800">{res.title}</div>
                    <a 
                      href={res.url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      onClick={(e) => e.stopPropagation()} 
                      className="truncate block text-[11px] text-slate-400 hover:text-indigo-600 hover:underline transition-colors w-fit"
                    >
                      {res.url}
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <span className="text-xs text-slate-400 hidden sm:block">Added {res.addedAt}</span>
                  <div className="flex items-center gap-2">
                    <button 
                      type="button" 
                      onClick={(e) => openRemoveModal(res, e)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-600 shadow-2xs transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 size={13} />
                      <span className="hidden sm:inline">Remove</span>
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Add/Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4 backdrop-blur-2xs" onClick={() => setIsEditModalOpen(false)}>
          <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-2xl animate-pop-in" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-slate-100 pb-2.5">
              <h3 className="text-base font-bold text-slate-800">{selectedResource ? 'Edit Resource' : 'Add Resource'}</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                {selectedResource ? 'Update the details for this resource link.' : 'Add a new external link or document to this project.'}
              </p>
            </div>

            <form onSubmit={handleSaveResource} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-600">Resource Name</label>
                <input
                  autoFocus
                  className={`${inputCls} mt-1`}
                  placeholder="e.g. Figma Design System"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600">URL</label>
                <input
                  type="url"
                  className={`${inputCls} mt-1`}
                  placeholder="https://..."
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!formTitle.trim() || !formUrl.trim()}
                  className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:pointer-events-none disabled:opacity-40"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remove Modal */}
      {isRemoveModalOpen && selectedResource && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4 backdrop-blur-2xs" onClick={() => setIsRemoveModalOpen(false)}>
          <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-2xl animate-pop-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3 border-b border-slate-100 pb-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-red-100 text-red-600">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Remove Resource</h3>
                <p className="text-xs text-slate-500">
                  Target resource: <strong className="text-slate-700">{selectedResource.title}</strong>
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-red-100 bg-red-50/60 p-3.5 text-xs leading-relaxed text-slate-700">
              <p>Are you sure you want to remove this resource? This action cannot be undone.</p>
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
                onClick={handleRemoveResource}
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
