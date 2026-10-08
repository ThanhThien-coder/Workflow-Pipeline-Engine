import { describe, it, expect } from 'vitest';
import { validateDag, validateTemplateGraph } from '../kahn';
import { calculateTreeLayout, calculateTreeLayoutWithBounds, NODE_W, NODE_H } from '../treeLayout';
import type { GraphDataPayload, TemplateNodeDto } from '../../../types/template.types';

describe('Graph Engine: Kahn Algorithm', () => {
  it('should validate a linear DAG without cycles', () => {
    const vertices = ['A', 'B', 'C'];
    const edges: [string, string][] = [
      ['A', 'B'],
      ['B', 'C'],
    ];
    const res = validateDag(vertices, edges);
    expect(res.valid).toBe(true);
    expect(res.violations).toHaveLength(0);
  });

  it('should detect a simple 2-node cycle', () => {
    const vertices = ['A', 'B'];
    const edges: [string, string][] = [
      ['A', 'B'],
      ['B', 'A'],
    ];
    const res = validateDag(vertices, edges);
    expect(res.valid).toBe(false);
    expect(res.violations).toContain('A');
    expect(res.violations).toContain('B');
  });

  it('should detect a cycle in a larger graph and isolate offending nodes', () => {
    const vertices = ['A', 'B', 'C', 'D'];
    const edges: [string, string][] = [
      ['A', 'B'],
      ['B', 'C'],
      ['C', 'B'], // Cycle B <-> C
      ['C', 'D'],
    ];
    const res = validateDag(vertices, edges);
    expect(res.valid).toBe(false);
    expect(res.violations).toContain('B');
    expect(res.violations).toContain('C');
    expect(res.violations).not.toContain('A');
  });

  it('should validate 2-level template graph: phase cycle detected', () => {
    const payload: GraphDataPayload = {
      schemaVersion: 2,
      phases: [
        { id: 'p1', name: 'Phase 1', order: 0, rootNodeId: 'n1', uiMetadata: { position: { x: 0, y: 0 } } },
        { id: 'p2', name: 'Phase 2', order: 1, rootNodeId: 'n2', uiMetadata: { position: { x: 0, y: 0 } } },
      ],
      phaseEdges: [
        { parentPhaseId: 'p1', childPhaseId: 'p2' },
        { parentPhaseId: 'p2', childPhaseId: 'p1' }, // cycle!
      ],
      nodes: [
        { id: 'n1', phaseId: 'p1', parentId: null, trackId: null, title: 'R1', description: '', level: 0, joinPolicy: 'ALL_COMPLETED', uiMetadata: { position: { x: 0, y: 0 } } },
        { id: 'n2', phaseId: 'p2', parentId: null, trackId: null, title: 'R2', description: '', level: 0, joinPolicy: 'ALL_COMPLETED', uiMetadata: { position: { x: 0, y: 0 } } },
      ],
      edges: [],
      metadata: { version: '1.0' },
    };

    const res = validateTemplateGraph(payload);
    expect(res.valid).toBe(false);
    expect(res.violations).toHaveLength(1);
    expect(res.violations[0].scope).toBe('PHASE');
    expect(res.violations[0].nodeIds).toContain('p1');
    expect(res.violations[0].nodeIds).toContain('p2');
  });

  it('should validate 2-level template graph: node cycle via tree + dependency edge', () => {
    const payload: GraphDataPayload = {
      schemaVersion: 2,
      phases: [
        { id: 'p1', name: 'Phase 1', order: 0, rootNodeId: 'n1', uiMetadata: { position: { x: 0, y: 0 } } },
      ],
      phaseEdges: [],
      nodes: [
        { id: 'n1', phaseId: 'p1', parentId: null, trackId: null, title: 'Root', description: '', level: 0, joinPolicy: 'ALL_COMPLETED', uiMetadata: { position: { x: 0, y: 0 } } },
        { id: 'n2', phaseId: 'p1', parentId: 'n1', trackId: 'n2', title: 'Track', description: '', level: 1, joinPolicy: 'ALL_COMPLETED', uiMetadata: { position: { x: 0, y: 0 } } },
        { id: 'n3', phaseId: 'p1', parentId: 'n2', trackId: 'n2', title: 'Task', description: '', level: 2, joinPolicy: 'ALL_COMPLETED', uiMetadata: { position: { x: 0, y: 0 } } },
      ],
      edges: [
        // Backward cross dependency from child n3 to ancestor n1
        { id: 'e1', parentId: 'n3', childId: 'n1', kind: 'DEPENDENCY' },
      ],
      metadata: { version: '1.0' },
    };

    const res = validateTemplateGraph(payload);
    expect(res.valid).toBe(false);
    expect(res.violations).toHaveLength(1);
    expect(res.violations[0].scope).toBe('NODE');
    expect(res.violations[0].phaseId).toBe('p1');
    expect(res.violations[0].nodeIds).toEqual(expect.arrayContaining(['n1', 'n2', 'n3']));
  });
});

describe('Graph Engine: Tree Layout (Recursive Subtree Spacing)', () => {
  it('should calculate positions without overlap', () => {
    const nodes: TemplateNodeDto[] = [
      { id: 'root', phaseId: 'p1', parentId: null, trackId: null, title: 'Root', description: '', level: 0, joinPolicy: 'ALL_COMPLETED', uiMetadata: { position: { x: 0, y: 0 } } },
      { id: 't1', phaseId: 'p1', parentId: 'root', trackId: 't1', title: 'Track 1', description: '', level: 1, joinPolicy: 'ALL_COMPLETED', uiMetadata: { position: { x: 0, y: 0 } } },
      { id: 't2', phaseId: 'p1', parentId: 'root', trackId: 't2', title: 'Track 2', description: '', level: 1, joinPolicy: 'ALL_COMPLETED', uiMetadata: { position: { x: 0, y: 0 } } },
      { id: 'task1_1', phaseId: 'p1', parentId: 't1', trackId: 't1', title: 'Task 1.1', description: '', level: 2, joinPolicy: 'ALL_COMPLETED', uiMetadata: { position: { x: 0, y: 0 } } },
      { id: 'task1_2', phaseId: 'p1', parentId: 't1', trackId: 't1', title: 'Task 1.2', description: '', level: 2, joinPolicy: 'ALL_COMPLETED', uiMetadata: { position: { x: 0, y: 0 } } },
      { id: 'task2_1', phaseId: 'p1', parentId: 't2', trackId: 't2', title: 'Task 2.1', description: '', level: 2, joinPolicy: 'ALL_COMPLETED', uiMetadata: { position: { x: 0, y: 0 } } },
    ];

    const bounds = calculateTreeLayoutWithBounds(nodes);
    expect(bounds.width).toBeGreaterThan(0);
    expect(bounds.height).toBeGreaterThan(0);

    const positions = calculateTreeLayout(nodes);
    expect(positions.size).toBe(6);

    const pRoot = positions.get('root')!;
    const pT1 = positions.get('t1')!;
    const pT2 = positions.get('t2')!;
    const pTask11 = positions.get('task1_1')!;
    const pTask12 = positions.get('task1_2')!;
    const pTask21 = positions.get('task2_1')!;

    // Level 0 is at X = 0
    expect(pRoot.x).toBe(0);
    // Level 1 is at X > 0
    expect(pT1.x).toBeGreaterThan(pRoot.x);
    expect(pT2.x).toBe(pT1.x);
    // Level 2 is at X > Level 1
    expect(pTask11.x).toBeGreaterThan(pT1.x);

    // Vertical spacing: Task1.2 must be strictly below Task1.1 by at least NODE_H
    expect(pTask12.y).toBeGreaterThanOrEqual(pTask11.y + NODE_H);

    // Track 2 subtree must be below Track 1 subtree without overlap
    expect(pTask21.y).toBeGreaterThanOrEqual(pTask12.y + NODE_H);
  });
});
