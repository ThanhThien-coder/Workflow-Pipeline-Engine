import { useState, useEffect, type FC } from 'react';
import type { AdminWorkspaceDetailDto } from '../../../types/admin.types';
import { X, Archive, Loader2, UserCheck, ShieldCheck, Clock, Share2, Layers } from 'lucide-react';

export interface WorkspaceDetailDrawerProps {
  projectId: string | null;
  detail: AdminWorkspaceDetailDto | null;
  loading: boolean;
  onClose: () => void;
  onArchive: (id: string) => Promise<void> | void;
  onTransfer: (projectId: string, newOwnerId: string) => Promise<unknown> | unknown;
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Nháp',
  PLANNING: 'Lập kế hoạch',
  ACTIVE: 'Đang chạy',
  PAUSED: 'Tạm dừng',
  COMPLETED: 'Hoàn thành',
  INACTIVE: 'Không hoạt động',
  ARCHIVED: 'Lưu trữ',
};

export const WorkspaceDetailDrawer: FC<WorkspaceDetailDrawerProps> = ({
  projectId,
  detail,
  loading,
  onClose,
  onArchive,
  onTransfer,
}) => {
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('');
  const [isTransferring, setIsTransferring] = useState<boolean>(false);
  const [isArchiving, setIsArchiving] = useState<boolean>(false);

  useEffect(() => {
    setSelectedOwnerId('');
    setIsTransferring(false);
    setIsArchiving(false);
  }, [projectId, detail]);

  if (!projectId) return null;

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return '—';
    try {
      return new Date(isoString).toLocaleString('vi-VN');
    } catch {
      return isoString;
    }
  };

  const handleTransferClick = async () => {
    if (!projectId || !selectedOwnerId) return;
    setIsTransferring(true);
    try {
      await onTransfer(projectId, selectedOwnerId);
      setSelectedOwnerId('');
    } finally {
      setIsTransferring(false);
    }
  };

  const handleArchiveClick = async () => {
    if (!detail) return;
    setIsArchiving(true);
    try {
      await onArchive(detail.id);
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm transition-opacity">
      <div
        className="fixed inset-0 -z-10"
        onClick={() => {
          if (!isTransferring && !isArchiving) onClose();
        }}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Chi tiết dự án"
        className="flex h-full w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-2xl animate-fade"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Chi tiết dự án
              </h2>
              <p className="text-xs text-slate-400">ID: {projectId}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && !detail ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-2" />
              <p className="text-xs">Đang tải thông tin chi tiết...</p>
            </div>
          ) : detail ? (
            <>
              {/* Nhóm 1: Tổng quan */}
              <section className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-200/60 pb-2">
                  <ShieldCheck className="h-4 w-4 text-blue-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Tổng quan
                  </h3>
                </div>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-slate-400">Tên dự án:</span>
                    <p className="font-bold text-slate-800 text-sm">{detail.name}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Mô tả:</span>
                    <p className="text-slate-600">{detail.description || 'Không có mô tả'}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Trạng thái:</span>
                    <span className="inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-bold text-slate-700">
                      {STATUS_LABELS[detail.status] || detail.status}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Chủ dự án:</span>
                    <p className="font-semibold text-slate-800">
                      {detail.owner.ownerName}{' '}
                      <span className="font-mono text-slate-500 font-normal">
                        ({detail.owner.ownerMaskedEmail})
                      </span>
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 text-[11px] text-slate-500">
                    <div>
                      <span className="text-slate-400 block">Ngày tạo:</span>
                      {formatDate(detail.createdAt)}
                    </div>
                    <div>
                      <span className="text-slate-400 block">Cập nhật:</span>
                      {formatDate(detail.updatedAt)}
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    <span className="text-slate-400">Hoạt động gần nhất:</span>{' '}
                    {formatDate(detail.lastActivityAt)}
                  </div>
                </div>
              </section>

              {/* Nhóm 2: Thành viên */}
              <section className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-200/60 pb-2">
                  <UserCheck className="h-4 w-4 text-indigo-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Thành viên
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg bg-white p-2.5 border border-slate-200/60">
                    <span className="text-slate-400 text-[11px] block">Owner</span>
                    <b className="text-base text-slate-800">{detail.membersByRole?.OWNER ?? 0}</b>
                  </div>
                  <div className="rounded-lg bg-white p-2.5 border border-slate-200/60">
                    <span className="text-slate-400 text-[11px] block">Manager</span>
                    <b className="text-base text-slate-800">{detail.membersByRole?.MANAGER ?? 0}</b>
                  </div>
                  <div className="rounded-lg bg-white p-2.5 border border-slate-200/60">
                    <span className="text-slate-400 text-[11px] block">Collaborator</span>
                    <b className="text-base text-slate-800">{detail.membersByRole?.COLLABORATOR ?? 0}</b>
                  </div>
                  <div className="rounded-lg bg-white p-2.5 border border-slate-200/60">
                    <span className="text-slate-400 text-[11px] block">Viewer</span>
                    <b className="text-base text-slate-800">{detail.membersByRole?.VIEWER ?? 0}</b>
                  </div>
                </div>
                <div className="text-xs text-slate-500 pt-1">
                  Lời mời đang chờ: <b className="text-slate-700">{detail.pendingInvitationCount}</b>
                </div>
              </section>

              {/* Nhóm 3: Tiến độ */}
              <section className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-200/60 pb-2">
                  <Clock className="h-4 w-4 text-emerald-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Tiến độ
                  </h3>
                </div>
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Số phase / Tổng task:</span>
                    <span className="font-bold text-slate-800">
                      {detail.phaseCount} phases · {detail.nodeCount} tasks
                    </span>
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-slate-500">Tiến độ hoàn thành:</span>
                      <b className="text-emerald-600">{detail.progressPercentage}%</b>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.max(0, detail.progressPercentage))}%` }}
                      />
                    </div>
                  </div>
                  <div className="rounded-lg bg-white p-2.5 border border-slate-200/60">
                    <span className="text-slate-400 text-[11px] block mb-1.5 font-medium">
                      Task theo trạng thái:
                    </span>
                    <div className="grid grid-cols-5 gap-1 text-center text-[11px]">
                      <div className="bg-slate-50 p-1 rounded">
                        <div className="text-slate-400">LOCKED</div>
                        <div className="font-bold text-slate-700">{detail.nodesByStatus?.LOCKED ?? 0}</div>
                      </div>
                      <div className="bg-slate-50 p-1 rounded">
                        <div className="text-slate-400">TODO</div>
                        <div className="font-bold text-slate-700">{detail.nodesByStatus?.TODO ?? 0}</div>
                      </div>
                      <div className="bg-blue-50 p-1 rounded">
                        <div className="text-blue-500">DOING</div>
                        <div className="font-bold text-blue-700">{detail.nodesByStatus?.IN_PROGRESS ?? 0}</div>
                      </div>
                      <div className="bg-amber-50 p-1 rounded">
                        <div className="text-amber-500">REVIEW</div>
                        <div className="font-bold text-amber-700">{detail.nodesByStatus?.REVIEW ?? 0}</div>
                      </div>
                      <div className="bg-emerald-50 p-1 rounded">
                        <div className="text-emerald-500">DONE</div>
                        <div className="font-bold text-emerald-700">{detail.nodesByStatus?.DONE ?? 0}</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-rose-600 font-medium">
                    <span>Task trễ hạn:</span>
                    <b>{detail.overdueCount} task</b>
                  </div>
                </div>
              </section>

              {/* Nhóm 4: Chia sẻ */}
              <section className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 space-y-2">
                <div className="flex items-center gap-2 border-b border-slate-200/60 pb-2">
                  <Share2 className="h-4 w-4 text-purple-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Chia sẻ
                  </h3>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Link khách:</span>
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold ${
                        detail.guestLinkActive
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-slate-200 bg-slate-100 text-slate-500'
                      }`}
                    >
                      {detail.guestLinkActive ? 'Đang bật' : 'Đang tắt'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="text-slate-400">Hạn link khách:</span>
                    <span>{formatDate(detail.guestLinkExpiresAt)}</span>
                  </div>
                </div>
              </section>

              {/* Thao tác cuối Drawer */}
              <section className="space-y-4 pt-2">
                {/* Chuyển chủ dự án */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2.5">
                  <h4 className="text-xs font-bold text-slate-800">Chuyển chủ dự án</h4>
                  {detail.ownerCandidates && detail.ownerCandidates.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <select
                          aria-label="Chủ mới"
                          value={selectedOwnerId}
                          onChange={(e) => setSelectedOwnerId(e.target.value)}
                          className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:border-blue-500 focus:outline-none"
                        >
                          <option value="">-- Chọn thành viên nhận quyền sở hữu --</option>
                          {detail.ownerCandidates.map((c) => (
                            <option key={c.userId} value={c.userId}>
                              {c.name} ({c.username})
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={!selectedOwnerId || isTransferring}
                          onClick={handleTransferClick}
                          className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                        >
                          {isTransferring ? 'Đang chuyển...' : 'Chuyển'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">
                      Dự án chỉ có một người, không chuyển được. Chỉ có thể lưu trữ.
                    </p>
                  )}
                </div>

                {/* Lưu trữ dự án */}
                {detail.status !== 'ARCHIVED' && (
                  <button
                    type="button"
                    disabled={isArchiving}
                    onClick={handleArchiveClick}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 disabled:opacity-50 cursor-pointer"
                  >
                    <Archive className="h-4 w-4" />
                    <span>{isArchiving ? 'Đang lưu trữ...' : 'Lưu trữ dự án'}</span>
                  </button>
                )}
              </section>
            </>
          ) : (
            <div className="py-12 text-center text-xs text-slate-500">
              Không tìm thấy thông tin dự án.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
