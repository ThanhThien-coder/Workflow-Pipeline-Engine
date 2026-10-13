import { useState, useEffect, type FC } from 'react';
import type { AdminUserDto, SuspendUserRequestDto } from '../../../types/admin.types';
import { AlertTriangle, X } from 'lucide-react';

interface BanConfirmModalProps {
  isOpen: boolean;
  user: AdminUserDto | null;
  reason: SuspendUserRequestDto['reason'];
  onReasonChange: (reason: SuspendUserRequestDto['reason']) => void;
  onConfirm: (userId: string, reason: SuspendUserRequestDto['reason']) => void;
  onClose: () => void;
}

const REASON_OPTIONS: { value: SuspendUserRequestDto['reason']; label: string }[] = [
  { value: 'TERMS_VIOLATION', label: 'Vi phạm chính sách' },
  { value: 'SECURITY_RISK', label: 'Rủi ro bảo mật' },
  { value: 'BILLING_OVERDUE', label: 'Quá hạn thanh toán' },
  { value: 'OTHER', label: 'Spam hoặc lạm dụng' },
];

export const BanConfirmModal: FC<BanConfirmModalProps> = ({
  isOpen,
  user,
  reason,
  onReasonChange,
  onConfirm,
  onClose,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen || !user) return null;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm(user.id, reason);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="banModal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm transition-opacity"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-pop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modalTitle"
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="mb-2 inline-flex rounded-lg bg-rose-50 p-2 text-rose-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h3 id="modalTitle" className="text-lg font-extrabold text-slate-900">
              Suspend account?
            </h3>
            <p id="modalDescription" className="mt-1 text-sm text-slate-500">
              You are about to suspend <span className="font-semibold text-slate-800">{user.name}</span>{' '}
              <span className="font-mono text-xs text-slate-400">({user.id})</span>.
            </p>
          </div>
          <button
            id="closeModal"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="mt-5 block text-sm font-semibold text-slate-700">
          Reason for suspension
          <select
            id="banReason"
            value={reason}
            onChange={(e) => onReasonChange(e.target.value as SuspendUserRequestDto['reason'])}
            className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-rose-400 focus:bg-white focus:ring-2 focus:ring-rose-100"
          >
            {REASON_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-6 flex justify-end gap-2.5">
          <button
            id="cancelBan"
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            id="confirmBan"
            type="button"
            disabled={isSubmitting}
            onClick={handleConfirm}
            className="rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50 shadow-sm"
          >
            {isSubmitting ? 'Suspending...' : 'Confirm Ban'}
          </button>
        </div>
      </div>
    </div>
  );
};
