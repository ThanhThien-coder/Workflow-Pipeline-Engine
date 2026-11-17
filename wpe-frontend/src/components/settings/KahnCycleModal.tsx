import { AlertCircle, RotateCcw } from 'lucide-react'

interface KahnCycleModalProps {
  /**
   * Mã các công việc nằm trên vòng lặp (`cycleNodes` của lỗi 422 CYCLE_DETECTED).
   * null: modal đóng. Mảng rỗng: vẫn mở, báo là máy chủ không gửi danh sách.
   */
  violatingNodeIds: string[] | null
  onClose: () => void
}

/**
 * Báo lỗi vòng lặp phụ thuộc (HTTP 422 CYCLE_DETECTED). Dùng cho cả xuất bản dự án (Settings)
 * lẫn nối giai đoạn, nối công việc trên canvas.
 * Danh sách là các công việc nằm trên vòng, xếp theo id, không phải thứ tự đi theo vòng,
 * nên hiển thị thành từng thẻ chứ không nối bằng mũi tên.
 */
export function KahnCycleModal({ violatingNodeIds, onClose }: KahnCycleModalProps) {
  if (!violatingNodeIds) return null

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4 backdrop-blur-2xs"
      onClick={onClose}
    >
      <div
        role="alertdialog"
        aria-labelledby="kahn-cycle-title"
        className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-2xl animate-pop-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-slate-100 pb-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-red-100 text-red-600">
            <AlertCircle size={20} />
          </div>
          <div>
            <h3 id="kahn-cycle-title" className="text-base font-bold text-slate-800">
              Dependency cycle detected
            </h3>
            <p className="text-xs text-slate-500">HTTP 422 CYCLE_DETECTED</p>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-red-100 bg-red-50/70 p-4 text-xs text-slate-700">
          <p className="leading-relaxed">
            The Kahn algorithm found tasks that depend on each other in a loop, so there is no valid order to
            complete them all. Your changes have not been saved.
          </p>

          {violatingNodeIds.length > 0 ? (
            <div>
              <p className="mb-1.5 font-semibold text-slate-800">Tasks on the cycle:</p>
              <ul className="flex flex-wrap gap-1.5">
                {violatingNodeIds.map((code, idx) => (
                  <li
                    key={`${code}-${idx}`}
                    className="rounded-md border border-red-200 bg-white px-2 py-0.5 font-mono text-[12px] font-bold text-red-700 shadow-2xs"
                  >
                    {code}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="font-semibold text-slate-800">The server did not send the list of tasks on the cycle.</p>
          )}

          <p className="text-[11px] text-slate-500">
            Remove at least one dependency between the tasks above, then try again.
          </p>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            <RotateCcw size={14} />
            <span>Back to graph</span>
          </button>
        </div>
      </div>
    </div>
  )
}
