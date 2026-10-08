import React, { useEffect, useState, useMemo } from 'react';
import { useTemplateStudio } from '../../../hooks/useTemplateStudio';
import { StudioTopbar } from './components/StudioTopbar';
import { PhaseCanvas } from './components/PhaseCanvas';
import { PhaseDetailDrawer } from './components/PhaseDetailDrawer';
import { ConfirmDialog } from './components/ConfirmDialog';
import { Loader2 } from 'lucide-react';

interface TemplateStudioViewProps {
  templateId: string | null;
  onClose: () => void;
  onToast: (msg: string, tone?: 'blue' | 'rose' | 'emerald') => void;
}

export const TemplateStudioView: React.FC<TemplateStudioViewProps> = ({
  templateId,
  onClose,
  onToast,
}) => {
  const {
    draft,
    isDirty,
    status,
    errorMessage,
    selection,
    validation,
    loadTemplate,
    selectPhase,
    selectNode,
    updateMeta,
    addPhase,
    removePhase,
    togglePhaseDep,
    updatePhasePosition,
    connectPhases,
    spawnChildPhase,
    addChildNode,
    updateNode,
    removeNode,
    validate,
    save,
  } = useTemplateStudio();

  // Dialog states
  const [isDiscardDialogOpen, setIsDiscardDialogOpen] = useState(false);
  const [phaseToDelete, setPhaseToDelete] = useState<string | null>(null);

  // Load template on mount or ID change
  useEffect(() => {
    loadTemplate(templateId);
  }, [templateId, loadTemplate]);

  // Back button handler
  const handleBack = () => {
    if (isDirty) {
      setIsDiscardDialogOpen(true);
    } else {
      onClose();
    }
  };

  // Validate handler
  const handleValidate = async () => {
    const res = await validate();
    if (res.valid) {
      onToast('Đồ thị hợp lệ: không có chu trình lặp (0 Cycles)', 'emerald');
    } else {
      onToast('Phát hiện chu trình lặp trong đồ thị', 'rose');
    }
  };

  // Save handler
  const handleSave = async () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      onToast('Vui lòng nhập tên template', 'rose');
      return;
    }

    try {
      const saved = await save();
      const msg = saved.isSystemStandard
        ? 'Mẫu quy trình đã được lưu và công khai cho toàn bộ người dùng thành công!'
        : 'Mẫu quy trình đã được lưu dưới dạng bản nháp thành công!';
      onToast(msg, 'emerald');
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi lưu template';
      onToast(msg, 'rose');
    }
  };

  // Derive cycle violation sets for visual indicators
  const { cyclePhaseIds, cycleNodeIds } = useMemo(() => {
    const phaseSet = new Set<string>();
    const nodeSet = new Set<string>();

    if (validation && !validation.valid) {
      for (const v of validation.violations) {
        if (v.scope === 'PHASE') {
          for (const id of v.nodeIds) {
            phaseSet.add(id);
          }
        } else if (v.scope === 'NODE') {
          for (const id of v.nodeIds) {
            nodeSet.add(id);
          }
        }
      }
    }

    return { cyclePhaseIds: phaseSet, cycleNodeIds: nodeSet };
  }, [validation]);

  // Current selected phase
  const selectedPhase = useMemo(() => {
    if (!draft || !selection.phaseId) return null;
    return draft.graphData.phases.find((p) => p.id === selection.phaseId) || null;
  }, [draft, selection.phaseId]);

  if (status === 'loading' || !draft) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="mt-3 text-sm font-semibold text-slate-600">
          Đang khởi tạo Studio...
        </span>
      </div>
    );
  }

  const phaseToDeleteObj = draft.graphData.phases.find((p) => p.id === phaseToDelete);

  return (
    <div className="fixed inset-0 z-40 flex flex-col admin-grid-bg animate-fade">
      {/* 1. Studio Topbar */}
      <StudioTopbar
        draft={draft}
        isSaving={status === 'saving'}
        validation={validation}
        onBack={handleBack}
        onUpdateMeta={updateMeta}
        onValidate={handleValidate}
        onSave={handleSave}
      />

      {/* 2. Macro Phase Canvas */}
      <PhaseCanvas
        phases={draft.graphData.phases}
        phaseEdges={draft.graphData.phaseEdges}
        nodes={draft.graphData.nodes}
        cyclePhaseIds={cyclePhaseIds}
        onOpenPhase={(id) => selectPhase(id)}
        onDeletePhase={(id) => setPhaseToDelete(id)}
        onAddPhase={addPhase}
        onUpdatePhasePosition={updatePhasePosition}
        onConnectPhases={connectPhases}
        onSpawnChildPhase={spawnChildPhase}
      />

      {/* 3. Phase Detail Drawer */}
      <PhaseDetailDrawer
        phase={selectedPhase}
        allPhases={draft.graphData.phases}
        phaseEdges={draft.graphData.phaseEdges}
        nodes={draft.graphData.nodes}
        selectedNodeId={selection.nodeId}
        cycleNodeIds={cycleNodeIds}
        isOpen={selection.phaseId !== null}
        onClose={() => selectPhase(null)}
        onUpdatePhaseName={(name) => {
          if (selectedPhase) {
            const root = draft.graphData.nodes.find(
              (n) => n.phaseId === selectedPhase.id && n.level === 0
            );
            if (root) {
              updateNode(root.id, { title: name });
            }
          }
        }}
        onTogglePhaseDep={(srcId) => {
          if (selectedPhase) {
            togglePhaseDep(srcId, selectedPhase.id);
          }
        }}
        onSelectNode={selectNode}
        onAddChild={addChildNode}
        onUpdateNode={updateNode}
        onDeleteNode={removeNode}
      />

      {/* Confirm Discard Modal */}
      <ConfirmDialog
        isOpen={isDiscardDialogOpen}
        title="Discard changes?"
        message="Các thay đổi chưa lưu trong Studio sẽ bị mất."
        confirmLabel="Discard"
        isDanger={true}
        onConfirm={() => {
          setIsDiscardDialogOpen(false);
          onClose();
        }}
        onCancel={() => setIsDiscardDialogOpen(false)}
      />

      {/* Confirm Delete Phase Modal */}
      <ConfirmDialog
        isOpen={phaseToDelete !== null}
        title="Delete phase?"
        message={`Phase "${phaseToDeleteObj?.name}" cùng toàn bộ cây công việc bên trong sẽ bị xóa.`}
        confirmLabel="Delete"
        isDanger={true}
        onConfirm={() => {
          if (phaseToDelete) {
            removePhase(phaseToDelete);
            setPhaseToDelete(null);
            onToast('Đã xóa Phase', 'blue');
          }
        }}
        onCancel={() => setPhaseToDelete(null)}
      />
    </div>
  );
};
