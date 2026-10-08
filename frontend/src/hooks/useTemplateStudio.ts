import { useState, useCallback, useRef } from 'react';
import { container } from '../services/container';
import type {
  TemplateDetailDto,
  TemplateNodeDto,
  PhaseDto,
  PhaseEdgeDto,
  DagValidationResult,
  CreateTemplateRequestDto,
  UpdateTemplateRequestDto,
} from '../types/template.types';

function generateUid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export interface UseTemplateStudioState {
  draft: TemplateDetailDto | null;
  isDirty: boolean;
  status: 'idle' | 'loading' | 'saving' | 'error';
  errorMessage: string | null;
  selection: {
    phaseId: string | null;
    nodeId: string | null;
  };
  validation: DagValidationResult | null;
}

export function useTemplateStudio(initialTemplateId?: string | null) {
  const [draft, setDraft] = useState<TemplateDetailDto | null>(null);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'saving' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selection, setSelection] = useState<{ phaseId: string | null; nodeId: string | null }>({
    phaseId: null,
    nodeId: null,
  });
  const [validation, setValidation] = useState<DagValidationResult | null>(null);

  // Keep a ref of draft for synchronous operations
  const draftRef = useRef<TemplateDetailDto | null>(draft);
  draftRef.current = draft;

  const initNewTemplate = useCallback((): TemplateDetailDto => {
    const phaseId = generateUid('ph');
    const rootNodeId = generateUid('nd');
    const trackNodeId = generateUid('nd');
    const taskNodeId = generateUid('nd');

    const initialPhase: PhaseDto = {
      id: phaseId,
      name: 'Phase 1',
      order: 0,
      rootNodeId,
      uiMetadata: { position: { x: 0, y: 0 } },
    };

    const initialNodes: TemplateNodeDto[] = [
      {
        id: rootNodeId,
        phaseId,
        parentId: null,
        trackId: null,
        title: 'Phase 1',
        description: '',
        level: 0,
        joinPolicy: 'ALL_COMPLETED',
        uiMetadata: { position: { x: 0, y: 0 } },
      },
      {
        id: trackNodeId,
        phaseId,
        parentId: rootNodeId,
        trackId: trackNodeId,
        title: 'Track A',
        description: '',
        level: 1,
        joinPolicy: 'ALL_COMPLETED',
        uiMetadata: { position: { x: 280, y: 0 } },
      },
      {
        id: taskNodeId,
        phaseId,
        parentId: trackNodeId,
        trackId: trackNodeId,
        title: 'First task',
        description: '',
        level: 2,
        joinPolicy: 'ALL_COMPLETED',
        uiMetadata: { position: { x: 560, y: 0 } },
      },
    ];

    const now = new Date().toISOString();

    return {
      id: generateUid('tpl'),
      name: 'Untitled Template',
      description: '',
      category: 'General',
      isSystemStandard: false,
      phaseCount: 1,
      nodeCount: 3,
      cloneCount: 0,
      createdBy: 'Super Admin',
      createdAt: now,
      updatedAt: now,
      graphData: {
        schemaVersion: 2,
        phases: [initialPhase],
        phaseEdges: [],
        nodes: initialNodes,
        edges: [],
        metadata: { version: '1.0' },
      },
    };
  }, []);

  const loadTemplate = useCallback(
    async (id?: string | null) => {
      setStatus('loading');
      setErrorMessage(null);
      try {
        if (id) {
          const data = await container.templateService.getTemplateById(id);
          setDraft(data);
          setIsDirty(false);
          setValidation(null);
          setSelection({ phaseId: null, nodeId: null });
        } else {
          const fresh = initNewTemplate();
          setDraft(fresh);
          setIsDirty(false);
          setValidation(null);
          setSelection({ phaseId: null, nodeId: null });
        }
        setStatus('idle');
      } catch (err: unknown) {
        setStatus('error');
        const msg = err instanceof Error ? err.message : 'Failed to load template';
        setErrorMessage(msg);
      }
    },
    [initNewTemplate]
  );

  const selectPhase = useCallback((phaseId: string | null) => {
    setSelection((prev) => ({
      phaseId,
      nodeId: null,
    }));
  }, []);

  const selectNode = useCallback((nodeId: string | null) => {
    setSelection((prev) => ({
      ...prev,
      nodeId,
    }));
  }, []);

  const resetDirty = useCallback(() => {
    setIsDirty(false);
  }, []);

  const updateMeta = useCallback(
    (patch: Partial<Pick<TemplateDetailDto, 'name' | 'description' | 'category' | 'isSystemStandard'>>) => {
      setDraft((curr) => {
        if (!curr) return null;
        return {
          ...curr,
          ...patch,
        };
      });
      setIsDirty(true);
    },
    []
  );

  const addPhase = useCallback(() => {
    setDraft((curr) => {
      if (!curr) return null;
      const phases = [...curr.graphData.phases];
      const phaseEdges = [...curr.graphData.phaseEdges];
      const nodes = [...curr.graphData.nodes];

      const phaseNum = phases.length + 1;
      const phaseId = generateUid('ph');
      const rootNodeId = generateUid('nd');
      const trackNodeId = generateUid('nd');
      const taskNodeId = generateUid('nd');

      const newPhase: PhaseDto = {
        id: phaseId,
        name: `Phase ${phaseNum}`,
        order: phases.length,
        rootNodeId,
        uiMetadata: { position: { x: phases.length * 370, y: 0 } },
      };

      const lastPhase = phases[phases.length - 1];
      if (lastPhase) {
        phaseEdges.push({
          parentPhaseId: lastPhase.id,
          childPhaseId: phaseId,
        });
      }

      phases.push(newPhase);

      nodes.push(
        {
          id: rootNodeId,
          phaseId,
          parentId: null,
          trackId: null,
          title: `Phase ${phaseNum}`,
          description: '',
          level: 0,
          joinPolicy: 'ALL_COMPLETED',
          uiMetadata: { position: { x: 0, y: 0 } },
        },
        {
          id: trackNodeId,
          phaseId,
          parentId: rootNodeId,
          trackId: trackNodeId,
          title: 'New Track',
          description: '',
          level: 1,
          joinPolicy: 'ALL_COMPLETED',
          uiMetadata: { position: { x: 280, y: 0 } },
        },
        {
          id: taskNodeId,
          phaseId,
          parentId: trackNodeId,
          trackId: trackNodeId,
          title: 'New Task',
          description: '',
          level: 2,
          joinPolicy: 'ALL_COMPLETED',
          uiMetadata: { position: { x: 560, y: 0 } },
        }
      );

      return {
        ...curr,
        phaseCount: phases.length,
        nodeCount: nodes.length,
        graphData: {
          ...curr.graphData,
          phases,
          phaseEdges,
          nodes,
        },
      };
    });
    setIsDirty(true);
    setValidation(null);
  }, []);

  const removePhase = useCallback((phaseId: string) => {
    setDraft((curr) => {
      if (!curr) return null;
      if (curr.graphData.phases.length <= 1) {
        return curr; // Rule R2: Must have at least 1 Phase
      }

      const preds = curr.graphData.phaseEdges
        .filter((e) => e.childPhaseId === phaseId)
        .map((e) => e.parentPhaseId);
      const succs = curr.graphData.phaseEdges
        .filter((e) => e.parentPhaseId === phaseId)
        .map((e) => e.childPhaseId);

      let phaseEdges = curr.graphData.phaseEdges.filter(
        (e) => e.parentPhaseId !== phaseId && e.childPhaseId !== phaseId
      );

      // Reconnect predecessors to successors (Rule R3 shortcut)
      for (const pred of preds) {
        for (const succ of succs) {
          if (
            pred !== succ &&
            !phaseEdges.some((e) => e.parentPhaseId === pred && e.childPhaseId === succ)
          ) {
            phaseEdges.push({ parentPhaseId: pred, childPhaseId: succ });
          }
        }
      }

      const phases = curr.graphData.phases
        .filter((p) => p.id !== phaseId)
        .map((p, idx) => ({ ...p, order: idx }));

      const nodes = curr.graphData.nodes.filter((n) => n.phaseId !== phaseId);
      const remainingNodeIds = new Set(nodes.map((n) => n.id));
      const edges = curr.graphData.edges.filter(
        (e) => remainingNodeIds.has(e.parentId) && remainingNodeIds.has(e.childId)
      );

      return {
        ...curr,
        phaseCount: phases.length,
        nodeCount: nodes.length,
        graphData: {
          ...curr.graphData,
          phases,
          phaseEdges,
          nodes,
          edges,
        },
      };
    });

    setSelection((prev) => (prev.phaseId === phaseId ? { phaseId: null, nodeId: null } : prev));
    setIsDirty(true);
    setValidation(null);
  }, []);

  const setPhaseDeps = useCallback((phaseId: string, parents: string[]) => {
    setDraft((curr) => {
      if (!curr) return null;
      let edges = curr.graphData.phaseEdges.filter((e) => e.childPhaseId !== phaseId);
      for (const parent of parents) {
        edges.push({ parentPhaseId: parent, childPhaseId: phaseId });
      }
      return {
        ...curr,
        graphData: {
          ...curr.graphData,
          phaseEdges: edges,
        },
      };
    });
    setIsDirty(true);
    setValidation(null);
  }, []);

  const togglePhaseDep = useCallback((sourcePhaseId: string, targetPhaseId: string) => {
    setDraft((curr) => {
      if (!curr) return null;
      const existsIndex = curr.graphData.phaseEdges.findIndex(
        (e) => e.parentPhaseId === sourcePhaseId && e.childPhaseId === targetPhaseId
      );

      let updatedEdges = [...curr.graphData.phaseEdges];
      if (existsIndex >= 0) {
        updatedEdges.splice(existsIndex, 1);
      } else {
        updatedEdges.push({ parentPhaseId: sourcePhaseId, childPhaseId: targetPhaseId });
      }

      return {
        ...curr,
        graphData: {
          ...curr.graphData,
          phaseEdges: updatedEdges,
        },
      };
    });
    setIsDirty(true);
    setValidation(null);
  }, []);

  const addChildNode = useCallback((parentId: string): string => {
    const newId = generateUid('nd');
    setDraft((curr) => {
      if (!curr) return null;
      const parent = curr.graphData.nodes.find((n) => n.id === parentId);
      if (!parent) return curr;

      const level = parent.level + 1;
      const trackId = level === 1 ? newId : parent.trackId;
      const typeLabel = level === 1 ? 'Track' : level === 2 ? 'Task' : 'Sub-task';

      const newNode: TemplateNodeDto = {
        id: newId,
        phaseId: parent.phaseId,
        parentId: parent.id,
        trackId,
        title: `New ${typeLabel}`,
        description: '',
        level,
        joinPolicy: 'ALL_COMPLETED',
        uiMetadata: { position: { x: level * 280, y: 0 } },
      };

      const nodes = [...curr.graphData.nodes, newNode];

      return {
        ...curr,
        nodeCount: nodes.length,
        graphData: {
          ...curr.graphData,
          nodes,
        },
      };
    });

    setSelection((prev) => ({ ...prev, nodeId: newId }));
    setIsDirty(true);
    setValidation(null);
    return newId;
  }, []);

  const updateNode = useCallback(
    (
      id: string,
      patch: Partial<Pick<TemplateNodeDto, 'title' | 'description' | 'joinPolicy'>>
    ) => {
      setDraft((curr) => {
        if (!curr) return null;
        let phaseUpdated = curr.graphData.phases;
        const nodes = curr.graphData.nodes.map((n) => {
          if (n.id !== id) return n;
          const updated = { ...n, ...patch };

          // Rule R1: If updating Root node title, sync Phase name
          if (n.level === 0 && patch.title !== undefined) {
            phaseUpdated = phaseUpdated.map((p) =>
              p.id === n.phaseId ? { ...p, name: patch.title! } : p
            );
          }

          return updated;
        });

        return {
          ...curr,
          graphData: {
            ...curr.graphData,
            phases: phaseUpdated,
            nodes,
          },
        };
      });
      setIsDirty(true);
    },
    []
  );

  const removeNode = useCallback((id: string) => {
    setDraft((curr) => {
      if (!curr) return null;
      const target = curr.graphData.nodes.find((n) => n.id === id);
      if (!target || target.level === 0) {
        return curr; // Rule R1: Root cannot be deleted
      }

      // Collect all descendants recursively
      const toDelete = new Set<string>([id]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const n of curr.graphData.nodes) {
          if (n.parentId && toDelete.has(n.parentId) && !toDelete.has(n.id)) {
            toDelete.add(n.id);
            changed = true;
          }
        }
      }

      const nodes = curr.graphData.nodes.filter((n) => !toDelete.has(n.id));
      const edges = curr.graphData.edges.filter(
        (e) => !toDelete.has(e.parentId) && !toDelete.has(e.childId)
      );

      return {
        ...curr,
        nodeCount: nodes.length,
        graphData: {
          ...curr.graphData,
          nodes,
          edges,
        },
      };
    });

    setSelection((prev) => (prev.nodeId === id ? { ...prev, nodeId: null } : prev));
    setIsDirty(true);
    setValidation(null);
  }, []);

  const validate = useCallback(async (): Promise<DagValidationResult> => {
    const currentDraft = draftRef.current;
    if (!currentDraft) {
      const emptyResult: DagValidationResult = {
        valid: true,
        visitedCount: 0,
        totalCount: 0,
        violations: [],
      };
      setValidation(emptyResult);
      return emptyResult;
    }

    const res = await container.templateService.validateGraph(currentDraft.graphData);
    setValidation(res);
    return res;
  }, []);

  const save = useCallback(async (): Promise<TemplateDetailDto> => {
    const currentDraft = draftRef.current;
    if (!currentDraft) {
      throw new Error('No draft to save');
    }

    const trimmedName = currentDraft.name.trim();
    if (!trimmedName) {
      throw new Error('Vui lòng nhập tên template');
    }

    // Mandatory DAG Validation before save
    const validationResult = await container.templateService.validateGraph(
      currentDraft.graphData
    );
    setValidation(validationResult);

    if (!validationResult.valid) {
      throw new Error('Không thể lưu: phát hiện chu trình lặp trong đồ thị template');
    }

    setStatus('saving');
    try {
      let saved: TemplateDetailDto;
      const requestDto: CreateTemplateRequestDto = {
        name: trimmedName,
        description: currentDraft.description || '',
        category: currentDraft.category,
        isSystemStandard: currentDraft.isSystemStandard,
        graphData: currentDraft.graphData,
      };

      // Check if updating existing template
      const existingList = await container.templateService.getTemplates();
      const exists = existingList.some((t) => t.id === currentDraft.id);

      if (exists) {
        saved = await container.templateService.updateTemplate(
          currentDraft.id,
          requestDto as UpdateTemplateRequestDto
        );
      } else {
        saved = await container.templateService.createTemplate(requestDto);
      }

      setDraft(saved);
      setIsDirty(false);
      setStatus('idle');
      return saved;
    } catch (err: unknown) {
      setStatus('error');
      const msg = err instanceof Error ? err.message : 'Lỗi khi lưu template';
      setErrorMessage(msg);
      throw err;
    }
  }, []);

  return {
    draft,
    isDirty,
    status,
    errorMessage,
    selection,
    validation,
    loadTemplate,
    selectPhase,
    selectNode,
    resetDirty,
    updateMeta,
    addPhase,
    removePhase,
    setPhaseDeps,
    togglePhaseDep,
    addChildNode,
    updateNode,
    removeNode,
    validate,
    save,
  };
}
