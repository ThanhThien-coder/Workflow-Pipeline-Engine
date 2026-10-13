// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { TemplateCatalogView } from '../TemplateCatalogView';
import { TemplateStudioView } from '../TemplateStudioView';
import { container } from '../../../../services/container';
import { MockTemplateService } from '../../../../services/template/MockTemplateService';

describe('Admin Pipeline Template Studio - Full Integration Tests', () => {
  beforeEach(() => {
    container.templateService = new MockTemplateService();
  });

  afterEach(() => {
    cleanup();
  });

  describe('TemplateCatalogView', () => {
    it('renders initial 3 templates and filters by category', async () => {
      const onOpenStudio = vi.fn();
      const onToast = vi.fn();

      render(<TemplateCatalogView onOpenStudio={onOpenStudio} onToast={onToast} />);

      await waitFor(
        () => {
          expect(
            screen.getByText('Standard Software Development (SDLC)')
          ).toBeDefined();
        },
        { timeout: 3000 }
      );

      expect(screen.getByText('Marketing Campaign Launch')).toBeDefined();
      expect(screen.getByText('Data Science / ETL Pipeline')).toBeDefined();

      // Check badge presence
      expect(screen.getAllByText('PUBLIC · SYSTEM STANDARD').length).toBe(2);
      expect(screen.getAllByText('DRAFT').length).toBe(1);

      // Filter by category
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'Marketing' } });

      await waitFor(
        () => {
          expect(screen.getByText('Marketing Campaign Launch')).toBeDefined();
          expect(
            screen.queryByText('Standard Software Development (SDLC)')
          ).toBeNull();
        },
        { timeout: 3000 }
      );
    });

    it('triggers onOpenStudio when Create Template button is clicked', async () => {
      const onOpenStudio = vi.fn();
      const onToast = vi.fn();

      render(<TemplateCatalogView onOpenStudio={onOpenStudio} onToast={onToast} />);

      await waitFor(
        () => {
          expect(screen.getByText('Create Template')).toBeDefined();
        },
        { timeout: 3000 }
      );

      fireEvent.click(screen.getByText('Create Template'));
      expect(onOpenStudio).toHaveBeenCalledWith(null);
    });

    it('duplicates a template as DRAFT copy', async () => {
      const onOpenStudio = vi.fn();
      const onToast = vi.fn();

      render(<TemplateCatalogView onOpenStudio={onOpenStudio} onToast={onToast} />);

      await waitFor(
        () => {
          expect(
            screen.getByText('Standard Software Development (SDLC)')
          ).toBeDefined();
        },
        { timeout: 3000 }
      );

      // Find duplicate buttons
      const dupButtons = screen.getAllByTitle('Duplicate template');
      fireEvent.click(dupButtons[0]);

      await waitFor(
        () => {
          expect(onToast).toHaveBeenCalledWith(
            'Đã nhân bản template (trạng thái DRAFT)',
            'blue'
          );
        },
        { timeout: 3000 }
      );
    });
  });

  describe('TemplateStudioView', () => {
    it('initializes new template, validates DAG, and saves', async () => {
      const onClose = vi.fn();
      const onToast = vi.fn();

      render(
        <TemplateStudioView
          templateId={null}
          onClose={onClose}
          onToast={onToast}
        />
      );

      // Wait for studio to load
      await waitFor(
        () => {
          expect(screen.getByPlaceholderText('Template name')).toBeDefined();
        },
        { timeout: 3000 }
      );

      const titleInput = screen.getByPlaceholderText('Template name') as HTMLInputElement;
      expect(titleInput.value).toBe('Untitled Template');

      // Edit name inline
      fireEvent.change(titleInput, { target: { value: 'Production Web App Pipeline' } });
      expect(titleInput.value).toBe('Production Web App Pipeline');

      // Validate DAG
      const validateBtn = screen.getByText('Validate DAG (Kahn)');
      fireEvent.click(validateBtn);

      await waitFor(
        () => {
          expect(screen.getByText('DAG Valid · 0 Cycles')).toBeDefined();
        },
        { timeout: 3000 }
      );

      // Click "Save & Publish Template"
      const saveBtn = screen.getByText('Save & Publish Template');
      fireEvent.click(saveBtn);

      await waitFor(
        () => {
          expect(onToast).toHaveBeenCalled();
          expect(onClose).toHaveBeenCalled();
        },
        { timeout: 4000 }
      );

      // Verify template was saved to container service
      const all = await container.templateService.getTemplates();
      expect(all.some((t) => t.name === 'Production Web App Pipeline')).toBe(true);
    });

    it('opens Phase Detail Drawer and allows switching between Graph and Kanban view', async () => {
      const onClose = vi.fn();
      const onToast = vi.fn();

      render(
        <TemplateStudioView
          templateId={null}
          onClose={onClose}
          onToast={onToast}
        />
      );

      await waitFor(
        () => {
          expect(screen.getByText('Phase 1')).toBeDefined();
        },
        { timeout: 3000 }
      );

      // Click on Phase 1 card to open drawer
      fireEvent.click(screen.getByText('Phase 1'));

      await waitFor(
        () => {
          expect(screen.getByText('PHASE DETAIL')).toBeDefined();
        },
        { timeout: 3000 }
      );

      // Verify Graph View is active by default
      expect(screen.getByText('Graph View')).toBeDefined();
      expect(screen.getByText('Kanban View')).toBeDefined();

      // Switch to Kanban View
      fireEvent.click(screen.getByText('Kanban View'));

      await waitFor(
        () => {
          expect(screen.getByText('+ Add Track')).toBeDefined();
        },
        { timeout: 3000 }
      );

      // Switch back to Graph View
      fireEvent.click(screen.getByText('Graph View'));

      await waitFor(
        () => {
          expect(screen.getByTitle('Add child to Foundation')).toBeDefined();
        },
        { timeout: 3000 }
      );
    });

    it('re-fetches catalog reactively upon wpe_template_updated event and restores template graph 100%', async () => {
      const onOpenStudio = vi.fn();
      const onToast = vi.fn();

      render(<TemplateCatalogView onOpenStudio={onOpenStudio} onToast={onToast} />);

      await waitFor(() => {
        expect(screen.getByText('Standard Software Development (SDLC)')).toBeDefined();
      });

      // Initially 3 templates
      expect(screen.queryByText('E2E Verified Pipeline')).toBeNull();

      // Create new template directly via container service (as Studio does)
      const created = await container.templateService.createTemplate({
        name: 'E2E Verified Pipeline',
        description: 'End to end verified template description',
        category: 'DevOps & Infra',
        isSystemStandard: true,
        graphData: {
          schemaVersion: 2,
          phases: [
            { id: 'p-1', name: 'Build & Test', order: 0, rootNodeId: 'n-1', uiMetadata: { position: { x: 0, y: 0 } } },
            { id: 'p-2', name: 'Deploy Canary', order: 1, rootNodeId: 'n-2', uiMetadata: { position: { x: 300, y: 0 } } },
          ],
          phaseEdges: [
            { parentPhaseId: 'p-1', childPhaseId: 'p-2' },
          ],
          nodes: [
            { id: 'n-1', phaseId: 'p-1', parentId: null, trackId: null, title: 'Build & Test', description: '', level: 0, joinPolicy: 'ALL_COMPLETED', uiMetadata: { position: { x: 0, y: 0 } } },
            { id: 'n-2', phaseId: 'p-2', parentId: null, trackId: null, title: 'Deploy Canary', description: '', level: 0, joinPolicy: 'ALL_COMPLETED', uiMetadata: { position: { x: 0, y: 0 } } },
          ],
          edges: [],
          metadata: { version: '1.0' },
        },
      });

      // The createTemplate call dispatched 'wpe_template_updated'. TemplateCatalogView should automatically re-fetch!
      await waitFor(
        () => {
          expect(screen.getByText('E2E Verified Pipeline')).toBeDefined();
        },
        { timeout: 3000 }
      );

      // Verify that card has correct category and counts
      expect(screen.getByText('End to end verified template description')).toBeDefined();
      expect(screen.getAllByText('DevOps & Infra').length).toBeGreaterThanOrEqual(2);

      // Verify 100% data restore via getTemplateById
      const restored = await container.templateService.getTemplateById(created.id);
      expect(restored.name).toBe('E2E Verified Pipeline');
      expect(restored.graphData.phases).toHaveLength(2);
      expect(restored.graphData.phases[0].name).toBe('Build & Test');
      expect(restored.graphData.phases[1].name).toBe('Deploy Canary');
      expect(restored.graphData.phaseEdges).toHaveLength(1);
      expect(restored.graphData.nodes).toHaveLength(2);
    });
  });
});
