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
import { calculatePhaseLayout } from '../lib/graph/phaseLayout';

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

function computeSmartPhasePosition(
  existingPhases: PhaseDto[],
  sourcePhaseId?: string | null
): { x: number; y: number } {
  const STEP_X = 360; // Chiều rộng thẻ 260px + khoảng cách 100px
  const STEP_Y = 160; // Chiều cao thẻ 128px + khoảng cách 32px

  if (!existingPhases || existingPhases.length === 0) {
    return { x: 60, y: 80 };
  }

  // 1. Nếu có phase tiền đề (sourcePhaseId):
  if (sourcePhaseId) {
    const parent = existingPhases.find((p) => p.id === sourcePhaseId);
    if (parent) {
      const parentPos = parent.uiMetadata?.position || { x: 60, y: 80 };
      const rawPx = Number.isFinite(parentPos.x) ? parentPos.x : 60;
      const rawPy = Number.isFinite(parentPos.y) ? parentPos.y : 80;
      const targetX = rawPx + STEP_X;
      let targetY = rawPy;

      // Tìm tất cả phase đang nằm cùng cột X (sai số +- 160px)
      const phasesInColumn = existingPhases.filter((p) => {
        const px = p.uiMetadata?.position?.x;
        return Number.isFinite(px) && Math.abs(px! - targetX) < 160;
      });

      if (phasesInColumn.length > 0) {
        const validYs = phasesInColumn
          .map((p) => p.uiMetadata?.position?.y)
          .filter((y): y is number => Number.isFinite(y));
        const maxY = validYs.length > 0 ? Math.max(...validYs) : 80;
        targetY = maxY + STEP_Y;
      }

      return { x: targetX, y: targetY };
    }
  }

  // 2. Nếu tạo độc lập (nút "+ Add New Phase"):
  const lastPhase = existingPhases[existingPhases.length - 1];
  const lastPos = lastPhase?.uiMetadata?.position || { x: 60, y: 80 };
  const rawLastX = Number.isFinite(lastPos.x) ? lastPos.x : 60;
  const rawLastY = Number.isFinite(lastPos.y) ? lastPos.y : 80;
  const targetX = rawLastX + STEP_X;
  let targetY = rawLastY;

  const phasesInColumn = existingPhases.filter((p) => {
    const px = p.uiMetadata?.position?.x;
    return Number.isFinite(px) && Math.abs(px! - targetX) < 160;
  });

  if (phasesInColumn.length > 0) {
    const validYs = phasesInColumn
      .map((p) => p.uiMetadata?.position?.y)
      .filter((y): y is number => Number.isFinite(y));
    const maxY = validYs.length > 0 ? Math.max(...validYs) : 80;
    targetY = maxY + STEP_Y;
  }

  // Bảo đảm không bao giờ trùng tọa độ (x, y) với bất kỳ thẻ nào (có guard chống infinite loop)
  let loopGuard = 0;
  while (
    loopGuard < 50 &&
    existingPhases.some((p) => {
      const px = p.uiMetadata?.position?.x;
      const py = p.uiMetadata?.position?.y;
      return (
        Number.isFinite(px) &&
        Number.isFinite(py) &&
        Math.abs(px! - targetX) < 40 &&
        Math.abs(py! - targetY) < 40
      );
    })
  ) {
    targetY += STEP_Y;
    loopGuard++;
  }

  return { x: targetX, y: targetY };
}

function syncPhaseRunsAfter(phases: PhaseDto[], edges: PhaseEdgeDto[]): PhaseDto[] {
  return phases.map((p) => {
    const parents = edges
      .filter((e) => e.childPhaseId === p.id)
      .map((e) => e.parentPhaseId);
    return {
      ...p,
      runsAfter: parents,
    };
  });
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
      name: 'Foundation',
      order: 0,
      rootNodeId,
      uiMetadata: { position: { x: 60, y: 80 } },
      runsAfter: [],
    };

    const initialNodes: TemplateNodeDto[] = [
      {
        id: rootNodeId,
        phaseId,
        parentId: null,
        trackId: null,
        title: 'Foundation',
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
          // Đồng bộ runsAfter cho tất cả các phase
          const syncedPhases = syncPhaseRunsAfter(data.graphData.phases, data.graphData.phaseEdges);
          setDraft({
            ...data,
            graphData: {
              ...data.graphData,
              phases: syncedPhases,
            },
          });
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

  const addPhase = useCallback((semanticName?: string) => {
    setDraft((curr) => {
      if (!curr) return null;
      const phases = [...curr.graphData.phases];
      const phaseEdges = [...curr.graphData.phaseEdges];
      const nodes = [...curr.graphData.nodes];

      const phaseId = generateUid('ph');
      const rootNodeId = generateUid('nd');
      const trackNodeId = generateUid('nd');
      const taskNodeId = generateUid('nd');

      const name = typeof semanticName === 'string' && semanticName.trim()
        ? semanticName.trim()
        : `Phase ${phases.length + 1}`;

      const lastPhase = phases[phases.length - 1];
      const nextPos = computeSmartPhasePosition(phases, lastPhase ? lastPhase.id : null);

      const newPhase: PhaseDto = {
        id: phaseId,
        name,
        order: phases.length,
        rootNodeId,
        uiMetadata: { position: nextPos },
        runsAfter: lastPhase ? [lastPhase.id] : [],
      };

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
          title: name,
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
          title: 'First Task',
          description: '',
          level: 2,
          joinPolicy: 'ALL_COMPLETED',
          uiMetadata: { position: { x: 560, y: 0 } },
        }
      );

      const syncedPhases = syncPhaseRunsAfter(phases, phaseEdges);

      return {
        ...curr,
        phaseCount: syncedPhases.length,
        nodeCount: nodes.length,
        graphData: {
          ...curr.graphData,
          phases: syncedPhases,
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

      const filteredPhases = curr.graphData.phases
        .filter((p) => p.id !== phaseId)
        .map((p, idx) => ({ ...p, order: idx }));

      const phases = syncPhaseRunsAfter(filteredPhases, phaseEdges);

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
      const phases = syncPhaseRunsAfter(curr.graphData.phases, edges);
      return {
        ...curr,
        graphData: {
          ...curr.graphData,
          phases,
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

      const phases = syncPhaseRunsAfter(curr.graphData.phases, updatedEdges);

      return {
        ...curr,
        graphData: {
          ...curr.graphData,
          phases,
          phaseEdges: updatedEdges,
        },
      };
    });
    setIsDirty(true);
    setValidation(null);
  }, []);

  const updatePhasePosition = useCallback(
    (phaseId: string, position: { x: number; y: number }) => {
      setDraft((curr) => {
        if (!curr || !curr.graphData) return curr;
        const validX = position && Number.isFinite(position.x) ? Math.max(0, position.x) : 60;
        const validY = position && Number.isFinite(position.y) ? Math.max(0, position.y) : 80;
        const currentPhases = curr.graphData.phases || [];
        const phases = currentPhases.map((p) => {
          if (p && p.id === phaseId) {
            return {
              ...p,
              uiMetadata: {
                ...p.uiMetadata,
                position: { x: validX, y: validY },
              },
            };
          }
          return p;
        });
        return {
          ...curr,
          graphData: {
            ...curr.graphData,
            phases,
          },
        };
      });
      setIsDirty(true);
    },
    []
  );

  const autoLayoutPhases = useCallback(() => {
    setDraft((curr) => {
      if (!curr || !curr.graphData) return curr;
      const currentPhases = curr.graphData.phases || [];
      const currentEdges = curr.graphData.phaseEdges || [];
      const layout = calculatePhaseLayout(currentPhases, currentEdges);
      const phases = currentPhases.map((p) => {
        if (!p || !p.id) return p;
        const pos = layout.positions.get(p.id);
        if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
          return {
            ...p,
            uiMetadata: {
              ...p.uiMetadata,
              position: { x: pos.x, y: pos.y },
            },
          };
        }
        return p;
      });
      return {
        ...curr,
        graphData: {
          ...curr.graphData,
          phases,
        },
      };
    });
    setIsDirty(true);
  }, []);

  const connectPhases = useCallback((sourceId: string, targetId: string) => {
    setDraft((curr) => {
      if (!curr) return null;
      if (sourceId === targetId) return curr;
      const alreadyConnected = curr.graphData.phaseEdges.some(
        (e) => e.parentPhaseId === sourceId && e.childPhaseId === targetId
      );
      if (alreadyConnected) return curr;

      const phaseEdges = [
        ...curr.graphData.phaseEdges,
        { parentPhaseId: sourceId, childPhaseId: targetId },
      ];
      const phases = syncPhaseRunsAfter(curr.graphData.phases, phaseEdges);
      return {
        ...curr,
        graphData: {
          ...curr.graphData,
          phases,
          phaseEdges,
        },
      };
    });
    setIsDirty(true);
    setValidation(null);
  }, []);

  const disconnectPhases = useCallback((sourceId: string, targetId: string) => {
    setDraft((curr) => {
      if (!curr) return null;
      const phaseEdges = curr.graphData.phaseEdges.filter(
        (e) => !(e.parentPhaseId === sourceId && e.childPhaseId === targetId)
      );
      const phases = syncPhaseRunsAfter(curr.graphData.phases, phaseEdges);
      return {
        ...curr,
        graphData: {
          ...curr.graphData,
          phases,
          phaseEdges,
        },
      };
    });
    setIsDirty(true);
    setValidation(null);
  }, []);

  const spawnChildPhase = useCallback((sourceId: string, semanticName?: string) => {
    setDraft((curr) => {
      if (!curr) return null;
      const phases = [...curr.graphData.phases];
      const phaseEdges = [...curr.graphData.phaseEdges];
      const nodes = [...curr.graphData.nodes];

      const phaseId = generateUid('ph');
      const rootNodeId = generateUid('nd');
      const trackNodeId = generateUid('nd');
      const taskNodeId = generateUid('nd');

      const name = typeof semanticName === 'string' && semanticName.trim()
        ? semanticName.trim()
        : `Phase ${phases.length + 1}`;

      const nextPos = computeSmartPhasePosition(phases, sourceId);

      const newPhase: PhaseDto = {
        id: phaseId,
        name,
        order: phases.length,
        rootNodeId,
        uiMetadata: { position: nextPos },
        runsAfter: [sourceId],
      };

      phaseEdges.push({
        parentPhaseId: sourceId,
        childPhaseId: phaseId,
      });

      phases.push(newPhase);

      nodes.push(
        {
          id: rootNodeId,
          phaseId,
          parentId: null,
          trackId: null,
          title: name,
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
          title: 'First Task',
          description: '',
          level: 2,
          joinPolicy: 'ALL_COMPLETED',
          uiMetadata: { position: { x: 560, y: 0 } },
        }
      );

      const syncedPhases = syncPhaseRunsAfter(phases, phaseEdges);

      return {
        ...curr,
        phaseCount: syncedPhases.length,
        nodeCount: nodes.length,
        graphData: {
          ...curr.graphData,
          phases: syncedPhases,
          phaseEdges,
          nodes,
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
      const typeLabel = level === 1 ? 'Track' : 'Task';

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
    if (status === 'saving' && draftRef.current) {
      return draftRef.current;
    }

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
        saved = await container.templateService.createTemplate({
          ...requestDto,
          id: currentDraft.id,
        } as any);
      }

      setDraft(saved);
      setIsDirty(false);
      setStatus('idle');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('wpe_template_updated'));
      }
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
  };
}
