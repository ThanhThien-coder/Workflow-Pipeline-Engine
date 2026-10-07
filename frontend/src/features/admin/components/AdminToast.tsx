import type { FC } from 'react';
import type { AdminToastItem } from '../../../hooks/useAdminPortal';
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';

interface AdminToastProps {
  toasts: AdminToastItem[];
  onDismiss: (id: string) => void;
}

export const AdminToast: FC<AdminToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      id="toastHost"
      className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 flex-col gap-2 pointer-events-none"
    >
      {toasts.map((toast) => {
        const isRose = toast.tone === 'rose';
        const isEmerald = toast.tone === 'emerald';

        const colorClasses = isRose
          ? 'border-rose-200 bg-white text-rose-700 shadow-rose-100'
          : isEmerald
          ? 'border-emerald-200 bg-white text-emerald-700 shadow-emerald-100'
          : 'border-blue-200 bg-white text-blue-700 shadow-blue-100';

        const Icon = isRose ? AlertTriangle : isEmerald ? CheckCircle2 : Info;

        return (
          <div
            key={toast.id}
            onClick={() => onDismiss(toast.id)}
            className={`pointer-events-auto flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-semibold shadow-lg transition-all cursor-pointer animate-pop hover:scale-[1.02] ${colorClasses}`}
            role="status"
            aria-live="polite"
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{toast.message}</span>
          </div>
        );
      })}
    </div>
  );
};
