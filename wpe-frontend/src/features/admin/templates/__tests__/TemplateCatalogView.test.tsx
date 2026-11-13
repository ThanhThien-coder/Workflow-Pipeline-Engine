// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { TemplateCatalogView } from '../TemplateCatalogView';
import { container } from '../../../../services/container';
import type { TemplateSummaryDto } from '../../../../types/template.types';

describe('TemplateCatalogView Component', () => {
  const onOpenStudio = vi.fn();
  const onToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('gọi getTemplates({ visibility: "PUBLIC" }) và hiển thị tên template PUBLIC', async () => {
    const mockTemplates: TemplateSummaryDto[] = [
      {
        id: 'tpl-sdlc',
        name: 'Standard Software Development (SDLC)',
        description: 'Quy trình phần mềm chuẩn',
        category: 'Software Engineering',
        isSystemStandard: true,
        phaseCount: 3,
        nodeCount: 12,
        cloneCount: 42,
        createdBy: 'Administrator',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        visibility: 'PUBLIC',
      },
    ];

    const getTemplatesSpy = vi
      .spyOn(container.templateService, 'getTemplates')
      .mockResolvedValue(mockTemplates);

    render(<TemplateCatalogView onOpenStudio={onOpenStudio} onToast={onToast} />);

    await waitFor(() => {
      expect(getTemplatesSpy).toHaveBeenCalledWith({ visibility: 'PUBLIC' });
    });

    expect(
      await screen.findByText('Standard Software Development (SDLC)')
    ).toBeTruthy();
  });
});
