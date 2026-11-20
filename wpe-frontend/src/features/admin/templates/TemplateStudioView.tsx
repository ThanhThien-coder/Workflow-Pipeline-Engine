import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useTemplateStudio } from '../../../hooks/useTemplateStudio';
import { isApiError } from '../../../services/http/ApiError';
import { StudioTopbar } from './components/StudioTopbar';
import { PhaseCanvas } from './components/PhaseCanvas';
import { PhaseDetailDrawer } from './components/PhaseDetailDrawer';
import { ConfirmDialog } from './components/ConfirmDialog';
import { Loader2, AlertCircle } from 'lucide-react';

export interface SaveErrorDescription {
  message: string;
  cycleIds: string[];
  keepOpen: boolean;
}

export function describeSaveError(
  err: unknown,
  nameOf?: (id: string) => string | undefined
): SaveErrorDescription {
  if (isApiError(err)) {
    if (err.status === 422) {
      const cycleIds = err.cycleNodes ?? [];
      let message = 'The graph has a cycle. The steps in the loop are highlighted in red.';
      if (cycleIds.length > 0) {
        const names = cycleIds.map((id) => (nameOf ? nameOf(id) ?? id : id));
        message = 'The graph has a cycle at: ' + names.join(', ');
      }
      return {
        message,
        cycleIds,
        keepOpen: true,
      };
    }
    if (err.status === 403) {
      return {
        message: 'Only admins can save templates.',
        cycleIds: [],
        keepOpen: true,
      };
    }
    if (err.isNetworkError || err.status === 0) {
      return {
        message: 'Lost connection to the server. Your draft is still here, so try saving again.',
        cycleIds: [],
        keepOpen: true,
      };
    }
    return {
      message: err.message || 'Couldn\'t save the template',
      cycleIds: [],
      keepOpen: true,
    };
  }

  const msg = err instanceof Error ? err.message : 'Couldn\'t save the template';
  return {
    message: msg,
    cycleIds: [],
    keepOpen: true,
  };
}

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
    autoLayoutPhases,
    connectPhases,
    disconnectPhases,
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
  const [serverCycleIds, setServerCycleIds] = useState<string[]>([]);
  const draftAtErrorRef = useRef<unknown>(null);

  // Sửa đồ thị sau đó (draft thay đổi) thì xóa serverCycleIds
  useEffect(() => {
    if (serverCycleIds.length > 0 && draft !== draftAtErrorRef.current) {
      setServerCycleIds([]);
      draftAtErrorRef.current = null;
    }
  }, [draft, serverCycleIds]);

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
      onToast('The graph is valid: no cycles found (0 cycles)', 'emerald');
    } else {
      onToast('Cycle detected in the graph', 'rose');
    }
  };

  // Save handler
  const handleSave = async () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      onToast('Enter a template name', 'rose');
      return;
    }

    try {
      const saved = await save();
      const msg = saved.isHidden
        ? 'Template saved as a draft. Publish it in the Template Library to show it to users.'
        : 'Template saved. It is published to users.';
      onToast(msg, 'emerald');
      onClose();
    } catch (err: unknown) {
      const nameOf = (id: string): string | undefined => {
        const phase = draft.graphData?.phases?.find((p) => p && p.id === id);
        if (phase?.name) return phase.name;
        const node = draft.graphData?.nodes?.find((n) => n && n.id === id);
        if (node?.title) return node.title;
        return undefined;
      };
      const desc = describeSaveError(err, nameOf);
      if (desc.cycleIds.length > 0) {
        draftAtErrorRef.current = draft;
        setServerCycleIds(desc.cycleIds);
      }
      onToast(desc.message, 'rose');
      if (!desc.keepOpen) {
        onClose();
      }
    }
  };

  // Derive cycle violation sets for visual indicators
  const { cyclePhaseIds, cycleNodeIds } = useMemo(() => {
    const phaseSet = new Set<string>();
    const nodeSet = new Set<string>();

    if (validation && !validation.valid && Array.isArray(validation.violations)) {
      for (const v of validation.violations) {
        if (v && v.scope === 'PHASE' && Array.isArray(v.nodeIds)) {
          for (const id of v.nodeIds) {
            phaseSet.add(id);
          }
        } else if (v && v.scope === 'NODE' && Array.isArray(v.nodeIds)) {
          for (const id of v.nodeIds) {
            nodeSet.add(id);
          }
        }
      }
    }

    if (serverCycleIds.length > 0) {
      const knownPhaseIds = new Set(draft?.graphData?.phases?.map((p) => p.id) ?? []);
      const knownNodeIds = new Set(draft?.graphData?.nodes?.map((n) => n.id) ?? []);

      for (const id of serverCycleIds) {
        if (knownPhaseIds.has(id)) {
          phaseSet.add(id);
        }
        if (knownNodeIds.has(id)) {
          nodeSet.add(id);
        }
        if (!knownPhaseIds.has(id) && !knownNodeIds.has(id)) {
          phaseSet.add(id);
          nodeSet.add(id);
        }
      }
    }

    return { cyclePhaseIds: phaseSet, cycleNodeIds: nodeSet };
  }, [validation, serverCycleIds, draft]);

  // Current selected phase
  const selectedPhase = useMemo(() => {
    if (!draft || !draft.graphData || !Array.isArray(draft.graphData.phases) || !selection.phaseId) return null;
    return draft.graphData.phases.find((p) => p && p.id === selection.phaseId) || null;
  }, [draft, selection.phaseId]);

  if (status === 'loading' || (!draft && status !== 'error')) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="mt-3 text-sm font-semibold text-slate-600">
          Starting Studio...
        </span>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-slate-50 p-6 text-center animate-fade font-sans">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 mb-4 shadow-sm animate-pop">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">Template not found</h3>
        <p className="mt-1.5 max-w-md text-sm text-slate-500 leading-relaxed">
          {errorMessage || (templateId ? `Template "${templateId}" doesn't exist or has been deleted.` : 'Couldn\'t load the template.')}
        </p>
        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:border-slate-300 active:scale-95 cursor-pointer"
          >
            Back to list
          </button>
          <button
            type="button"
            onClick={() => loadTemplate(null)}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 active:scale-95 cursor-pointer"
          >
            Create new template
          </button>
        </div>
      </div>
    );
  }

  const phaseToDeleteObj = draft?.graphData?.phases?.find((p) => p && p.id === phaseToDelete) || null;

  return (
    <div className="fixed inset-0 z-40 flex flex-col admin-grid-bg animate-fade">
      {/* 1. Studio Topbar */}
      <StudioTopbar
        draft={draft}
        isSaving={status === 'saving'}
        validation={validation}
        onBack={handleBack}
        onUpdateMeta={updateMeta}
        onAutoLayout={autoLayoutPhases}
        onValidate={handleValidate}
        onSave={handleSave}
      />

      {/* 2. Macro Phase Canvas */}
      <PhaseCanvas
        phases={draft.graphData?.phases || []}
        phaseEdges={draft.graphData?.phaseEdges || []}
        nodes={draft.graphData?.nodes || []}
        cyclePhaseIds={cyclePhaseIds || new Set()}
        onOpenPhase={(id) => selectPhase(id)}
        onDeletePhase={(id) => setPhaseToDelete(id)}
        onAddPhase={addPhase}
        onAutoLayout={autoLayoutPhases}
        onUpdatePhasePosition={updatePhasePosition}
        onConnectPhases={connectPhases}
        onDisconnectPhases={disconnectPhases}
        onSpawnChildPhase={spawnChildPhase}
      />

      {/* 3. Phase Detail Drawer */}
      <PhaseDetailDrawer
        phase={selectedPhase}
        allPhases={draft.graphData?.phases || []}
        phaseEdges={draft.graphData?.phaseEdges || []}
        nodes={draft.graphData?.nodes || []}
        selectedNodeId={selection.nodeId}
        cycleNodeIds={cycleNodeIds || new Set()}
        isOpen={selection.phaseId !== null}
        onClose={() => selectPhase(null)}
        onUpdatePhaseName={(name) => {
          if (selectedPhase && draft?.graphData?.nodes) {
            const root = draft.graphData.nodes.find(
              (n) => n && n.phaseId === selectedPhase.id && n.level === 0
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
        message="Unsaved changes in Studio will be lost."
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
        message={`Phase "${phaseToDeleteObj?.name}" and all tasks inside it will be deleted.`}
        confirmLabel="Delete"
        isDanger={true}
        onConfirm={() => {
          if (phaseToDelete) {
            removePhase(phaseToDelete);
            setPhaseToDelete(null);
            onToast('Phase deleted', 'blue');
          }
        }}
        onCancel={() => setPhaseToDelete(null)}
      />
    </div>
  );
};
