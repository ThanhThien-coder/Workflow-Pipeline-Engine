import type { FC } from 'react'
import { useWorkflowStore } from '../../store/useWorkflowStore'

export const ToastHost: FC = () => {
  const toast = useWorkflowStore((state) => state.ui.toast)
  const dismissToast = useWorkflowStore((state) => state.ui.dismissToast)

  if (!toast) return null

  return (
    <div
      role="status"
      aria-live="polite"
      onClick={dismissToast}
      className="pop fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] max-w-[92vw] cursor-pointer rounded-full bg-slate-900 px-4 py-2.5 text-xs font-medium text-white shadow-xl hover:bg-slate-800 transition-colors flex items-center gap-2"
    >
      <span>{toast.message}</span>
    </div>
  )
}
