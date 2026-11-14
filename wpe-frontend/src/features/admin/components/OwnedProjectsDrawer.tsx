import { useState, useEffect, type FC } from 'react';
import type { AdminUserDto, OwnedProjectDto } from '../../../types/admin.types';
import { X, FolderGit2, Users, Loader2 } from 'lucide-react';

export interface OwnedProjectsDrawerProps {
  user: AdminUserDto | null;
  onClose: () => void;
  loadOwnedProjects: (userId: string) => Promise<OwnedProjectDto[]>;
  onTransfer: (projectId: string, newOwnerId: string) => Promise<OwnedProjectDto | null>;
}

export const OwnedProjectsDrawer: FC<OwnedProjectsDrawerProps> = ({
  user,
  onClose,
  loadOwnedProjects,
  onTransfer,
}) => {
  const [projects, setProjects] = useState<OwnedProjectDto[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedOwners, setSelectedOwners] = useState<Record<string, string>>({});
  const [submittingProjectId, setSubmittingProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setLoading(true);
      setProjects([]);
      setSelectedOwners({});
      loadOwnedProjects(user.id)
        .then((data) => {
          setProjects(data || []);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [user, loadOwnedProjects]);

  if (!user) return null;

  const handleTransferClick = async (projectId: string) => {
    const newOwnerId = selectedOwners[projectId];
    if (!newOwnerId) return;

    setSubmittingProjectId(projectId);
    try {
      const updated = await onTransfer(projectId, newOwnerId);
      if (updated !== null) {
        setProjects((prev) => prev.filter((p) => p.projectId !== projectId));
      }
    } finally {
      setSubmittingProjectId(null);
    }
  };

  return (
    <div
      id="ownedProjectsDrawerBackdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submittingProjectId) onClose();
      }}
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm transition-opacity"
    >
      <div
        className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col p-6 overflow-y-auto animate-slide-left"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ownedProjectsDrawerTitle"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <FolderGit2 className="h-5 w-5 text-blue-600" />
              <h3 id="ownedProjectsDrawerTitle" className="text-lg font-extrabold text-slate-900">
                Dự án sở hữu: {user.name}
              </h3>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Chỉ hiện thông tin chung của dự án, không có nội dung task.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={!!submittingProjectId}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition disabled:opacity-50"
            aria-label="Đóng"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 py-4 space-y-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600 mb-2" />
              <p className="text-sm">Đang tải danh sách dự án...</p>
            </div>
          )}

          {!loading && projects.length === 0 && (
            <div className="text-center py-12 text-sm text-slate-500">
              <FolderGit2 className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="font-semibold text-slate-700">Người dùng này không sở hữu dự án nào.</p>
            </div>
          )}

          {!loading &&
            projects.map((proj) => {
              const hasCandidates = proj.candidates && proj.candidates.length > 0;
              const selectedCandidateId = selectedOwners[proj.projectId] || '';
              const isSubmitting = submittingProjectId === proj.projectId;

              return (
                <div
                  key={proj.projectId}
                  className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 transition hover:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">{proj.name}</h4>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="inline-flex rounded-full border border-slate-200 bg-white px-2 py-0.5 font-medium">
                          {proj.status}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3.5 w-3.5 text-slate-400" />
                          {proj.memberCount} thành viên
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Transfer Controls */}
                  <div className="mt-4 pt-3 border-t border-slate-200/60">
                    {proj.status === 'ARCHIVED' || proj.status === 'COMPLETED' ? (
                      <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2.5 border border-amber-200">
                        Dự án đã lưu trữ hoặc đã hoàn thành, không chuyển chủ được.
                      </p>
                    ) : hasCandidates ? (
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <select
                          aria-label="Chủ mới"
                          value={selectedCandidateId}
                          onChange={(e) =>
                            setSelectedOwners((prev) => ({
                              ...prev,
                              [proj.projectId]: e.target.value,
                            }))
                          }
                          className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none transition focus:border-blue-400"
                        >
                          <option value="">-- Chọn chủ mới --</option>
                          {proj.candidates.map((c) => (
                            <option key={c.userId} value={c.userId}>
                              {c.name} (@{c.username})
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={!selectedCandidateId || isSubmitting}
                          onClick={() => handleTransferClick(proj.projectId)}
                          className="rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
                        >
                          {isSubmitting ? 'Đang chuyển...' : 'Chuyển chủ'}
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2.5 border border-amber-200">
                        Dự án chỉ có một người, không chuyển được. Chỉ có thể lưu trữ.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};
