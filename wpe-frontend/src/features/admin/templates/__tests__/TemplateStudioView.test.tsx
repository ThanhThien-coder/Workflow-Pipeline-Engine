// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import {
  TemplateStudioView,
  describeSaveError,
} from '../TemplateStudioView';
import { container } from '../../../../services/container';
import { ApiError } from '../../../../services/http/ApiError';

describe('describeSaveError pure function', () => {
  it('handles 422 cycle error', () => {
    const err = new ApiError({
      status: 422,
      code: 'CYCLE_DETECTED',
      message: 'Cycle detected',
      cycleNodes: ['p1', 'n2'],
    });
    const result = describeSaveError(err);
    expect(result).toEqual({
      message: 'The graph has a cycle at: p1, n2',
      cycleIds: ['p1', 'n2'],
      keepOpen: true,
    });
  });

  it('handles 422 cycle error with custom nameOf mapper', () => {
    const err = new ApiError({
      status: 422,
      code: 'CYCLE_DETECTED',
      message: 'Cycle detected',
      cycleNodes: ['n1'],
    });
    const result = describeSaveError(err, (id) => (id === 'n1' ? 'Thiết kế' : undefined));
    expect(result.message).toContain('Thiết kế');
    expect(result.message).toBe('The graph has a cycle at: Thiết kế');
    expect(result.cycleIds).toEqual(['n1']);
    expect(result.keepOpen).toBe(true);
  });

  it('handles 422 cycle error without cycleNodes', () => {
    const err = new ApiError({
      status: 422,
      code: 'CYCLE_DETECTED',
      message: 'Cycle detected',
      cycleNodes: [],
    });
    const result = describeSaveError(err);
    expect(result).toEqual({
      message: 'The graph has a cycle. The steps in the loop are highlighted in red.',
      cycleIds: [],
      keepOpen: true,
    });
  });

  it('handles 403 access denied error', () => {
    const err = new ApiError({
      status: 403,
      code: 'ACCESS_DENIED',
      message: 'Forbidden',
    });
    const result = describeSaveError(err);
    expect(result).toEqual({
      message: 'Only admins can save templates.',
      cycleIds: [],
      keepOpen: true,
    });
  });

  it('handles network error (status 0)', () => {
    const err = new ApiError({
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'Network offline',
    });
    const result = describeSaveError(err);
    expect(result).toEqual({
      message: 'Lost connection to the server. Your draft is still here, so try saving again.',
      cycleIds: [],
      keepOpen: true,
    });
  });

  it('handles other HTTP error status', () => {
    const err = new ApiError({
      status: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal error occurred',
    });
    const result = describeSaveError(err);
    expect(result).toEqual({
      message: 'Internal error occurred',
      cycleIds: [],
      keepOpen: true,
    });
  });

  it('handles non-ApiError generic error', () => {
    const err = new Error('Something broke');
    const result = describeSaveError(err);
    expect(result).toEqual({
      message: 'Something broke',
      cycleIds: [],
      keepOpen: true,
    });
  });
});

describe('TemplateStudioView Component', () => {
  const onToast = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(container.templateService, 'validateGraph').mockResolvedValue({
      valid: true,
      visitedCount: 3,
      totalCount: 3,
      violations: [],
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('khi save ném ApiError 403 → gọi onToast với "Chỉ quản trị viên mới lưu được template" và Studio KHÔNG gọi onClose', async () => {
    vi.spyOn(container.templateService, 'getTemplates').mockResolvedValue([]);
    vi.spyOn(container.templateService, 'createTemplate').mockRejectedValue(
      new ApiError({
        status: 403,
        code: 'ACCESS_DENIED',
        message: 'Chỉ quản trị viên mới có quyền sửa template',
      })
    );

    render(
      <TemplateStudioView
        templateId={null}
        onClose={onClose}
        onToast={onToast}
      />
    );

    const saveBtn = await screen.findByRole('button', { name: /Save & Publish Template/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(onToast).toHaveBeenCalledWith(
        'Only admins can save templates.',
        'rose'
      );
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('khi save ném ApiError 422 → gọi onToast với thông báo chu trình và Studio KHÔNG gọi onClose', async () => {
    vi.spyOn(container.templateService, 'getTemplates').mockResolvedValue([]);
    vi.spyOn(container.templateService, 'createTemplate').mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'CYCLE_DETECTED',
        message: 'Cycle detected',
        cycleNodes: ['n1', 'n2'],
      })
    );

    render(
      <TemplateStudioView
        templateId={null}
        onClose={onClose}
        onToast={onToast}
      />
    );

    const saveBtn = await screen.findByRole('button', { name: /Save & Publish Template/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(onToast).toHaveBeenCalledWith(
        'The graph has a cycle at: n1, n2',
        'rose'
      );
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('khi save ném ApiError status 0 (mất kết nối) → gọi onToast và Studio KHÔNG gọi onClose', async () => {
    vi.spyOn(container.templateService, 'getTemplates').mockResolvedValue([]);
    vi.spyOn(container.templateService, 'createTemplate').mockRejectedValue(
      new ApiError({
        status: 0,
        code: 'NETWORK_ERROR',
        message: 'Network offline',
      })
    );

    render(
      <TemplateStudioView
        templateId={null}
        onClose={onClose}
        onToast={onToast}
      />
    );

    const saveBtn = await screen.findByRole('button', { name: /Save & Publish Template/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(onToast).toHaveBeenCalledWith(
        'Lost connection to the server. Your draft is still here, so try saving again.',
        'rose'
      );
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('khi validateGraph trả invalid (chu trình local) → gọi onToast và Studio KHÔNG gọi onClose', async () => {
    vi.spyOn(container.templateService, 'validateGraph').mockResolvedValue({
      valid: false,
      visitedCount: 1,
      totalCount: 3,
      violations: [{ scope: 'PHASE', phaseId: 'ph-1', nodeIds: ['ph-1', 'ph-2'] }],
    });
    const createSpy = vi.spyOn(container.templateService, 'createTemplate');

    render(
      <TemplateStudioView
        templateId={null}
        onClose={onClose}
        onToast={onToast}
      />
    );

    const saveBtn = await screen.findByRole('button', { name: /Save & Publish Template/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(onToast).toHaveBeenCalledWith(
        'Không thể lưu: phát hiện chu trình lặp trong đồ thị template',
        'rose'
      );
    });

    expect(onClose).not.toHaveBeenCalled();
    expect(createSpy).not.toHaveBeenCalled();
  });
});
