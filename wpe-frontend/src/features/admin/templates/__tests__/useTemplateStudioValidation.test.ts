// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useTemplateStudio } from '../../../../hooks/useTemplateStudio';
import { container } from '../../../../services/container';
import { MockTemplateService } from '../../../../services/template/MockTemplateService';
import type { DagValidationResult } from '../../../../types/template.types';

describe('useTemplateStudio validation before save', () => {
  beforeEach(() => {
    container.templateService = new MockTemplateService();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('save khi validateGraph tra invalid -> nem loi va validation duoc set', async () => {
    const invalidResult: DagValidationResult = {
      valid: false,
      visitedCount: 1,
      totalCount: 3,
      violations: [
        {
          scope: 'PHASE',
          phaseId: 'ph-1',
          nodeIds: ['ph-1', 'ph-2'],
        },
      ],
    };

    vi.spyOn(container.templateService, 'validateGraph').mockResolvedValue(invalidResult);
    const createSpy = vi.spyOn(container.templateService, 'createTemplate');
    const updateSpy = vi.spyOn(container.templateService, 'updateTemplate');

    const { result } = renderHook(() => useTemplateStudio());

    await act(async () => {
      await result.current.loadTemplate(null);
    });

    expect(result.current.draft).not.toBeNull();
    const draftBefore = result.current.draft;

    await act(async () => {
      await expect(result.current.save()).rejects.toThrow(
        'Không thể lưu: phát hiện chu trình lặp trong đồ thị template'
      );
    });

    // Validation state is set in hook
    expect(result.current.validation).toEqual(invalidResult);
    // Status is set to error
    expect(result.current.status).toBe('error');
    // Error message is set
    expect(result.current.errorMessage).toBe(
      'Không thể lưu: phát hiện chu trình lặp trong đồ thị template'
    );
    // Services were not called
    expect(createSpy).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
    // Draft is kept intact
    expect(result.current.draft).toBe(draftBefore);
  });
});
