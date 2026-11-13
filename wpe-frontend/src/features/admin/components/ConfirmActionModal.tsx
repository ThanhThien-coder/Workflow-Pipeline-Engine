import { useState, useEffect, type FC } from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';

export interface ConfirmActionModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  tone: 'rose' | 'blue';
  onConfirm: () => Promise<unknown> | unknown;
  onClose: () => void;
}

export const ConfirmActionModal: FC<ConfirmActionModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel,
  tone,
  onConfirm,
  onClose,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const isRose = tone === 'rose';

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm transition-opacity"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-pop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmModalTitle"
      >
        <div className="flex items-start justify-between">
          <div>
            <div
              className={`mb-2 inline-flex rounded-lg p-2 ${
                isRose ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'
              }`}
            >
              {isRose ? <AlertTriangle className="h-5 w-5" /> : <Info className="h-5 w-5" />}
            </div>
            <h3 id="confirmModalTitle" className="text-lg font-extrabold text-slate-900">
              {title}
            </h3>
            <p id="confirmModalDescription" className="mt-1 text-sm text-slate-500">
              {message}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition disabled:opacity-50"
            aria-label="Đóng"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 flex justify-end gap-2.5">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleConfirm}
            className={`rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50 shadow-sm ${
              isRose ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isSubmitting ? 'Đang xử lý...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
