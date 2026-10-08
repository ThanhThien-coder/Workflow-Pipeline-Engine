// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTemplateStudio } from '../useTemplateStudio';
import { container } from '../../services/container';
import { MockTemplateService } from '../../services/template/MockTemplateService';

describe('useTemplateStudio Hook Business Logic & Graph Actions', () => {
  beforeEach(() => {
    // Reset container with fresh instance
    container.templateService = new MockTemplateService();
  });

  it('should initialize a new template with default phase and nodes', async () => {
    const { result } = renderHook(() => useTemplateStudio());

    await act(async () => {
      await result.current.loadTemplate(null);
    });

    expect(result.current.draft).not.toBeNull();
    expect(result.current.draft?.name).toBe('Untitled Template');
    expect(result.current.draft?.graphData.phases).toHaveLength(1);
    expect(result.current.draft?.graphData.nodes).toHaveLength(3);
    expect(result.current.isDirty).toBe(false);
  });

  it('should add a phase and automatically link sequential edge', async () => {
    const { result } = renderHook(() => useTemplateStudio());

    await act(async () => {
      await result.current.loadTemplate(null);
    });

    const initialPhaseId = result.current.draft!.graphData.phases[0].id;

    act(() => {
      result.current.addPhase();
    });

    expect(result.current.draft?.graphData.phases).toHaveLength(2);
    expect(result.current.isDirty).toBe(true);

    const secondPhaseId = result.current.draft!.graphData.phases[1].id;
    const edge = result.current.draft!.graphData.phaseEdges.find(
      (e) => e.parentPhaseId === initialPhaseId && e.childPhaseId === secondPhaseId
    );
    expect(edge).toBeDefined();
  });

  it('should add child nodes and sync root node title with phase name', async () => {
    const { result } = renderHook(() => useTemplateStudio());

    await act(async () => {
      await result.current.loadTemplate(null);
    });

    const rootNode = result.current.draft!.graphData.nodes.find((n) => n.level === 0)!;

    // Update root node title
    act(() => {
      result.current.updateNode(rootNode.id, { title: 'Renamed Phase 1' });
    });

    expect(result.current.draft?.graphData.phases[0].name).toBe('Renamed Phase 1');

    // Add child to root
    let newChildId = '';
    act(() => {
      newChildId = result.current.addChildNode(rootNode.id);
    });

    expect(newChildId).toBeTruthy();
    const createdNode = result.current.draft!.graphData.nodes.find((n) => n.id === newChildId);
    expect(createdNode?.parentId).toBe(rootNode.id);
    expect(createdNode?.level).toBe(1);
  });

  it('should validate DAG and save template to service', async () => {
    const { result } = renderHook(() => useTemplateStudio());

    await act(async () => {
      await result.current.loadTemplate(null);
    });

    act(() => {
      result.current.updateMeta({ name: 'Automated Test Workflow' });
    });

    await act(async () => {
      const val = await result.current.validate();
      expect(val.valid).toBe(true);
    });

    await act(async () => {
      const saved = await result.current.save();
      expect(saved.id).toBeDefined();
      expect(saved.name).toBe('Automated Test Workflow');
    });

    expect(result.current.isDirty).toBe(false);

    // Verify it exists in container service
    const all = await container.templateService.getTemplates();
    expect(all.some((t) => t.name === 'Automated Test Workflow')).toBe(true);
  });
});
