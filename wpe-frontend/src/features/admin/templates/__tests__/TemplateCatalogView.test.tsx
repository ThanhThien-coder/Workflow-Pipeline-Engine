// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
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

  it('gọi getTemplates({ visibility: "PUBLIC", includeHidden: true }) và hiển thị tên template', async () => {
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
      expect(getTemplatesSpy).toHaveBeenCalledWith({ visibility: 'PUBLIC', includeHidden: true });
    });

    expect(
      await screen.findByText('Standard Software Development (SDLC)')
    ).toBeTruthy();
  });

  it('xóa template mẫu hệ thống (isSystemStandard=true) -> ConfirmDialog hiện thông điệp cảnh báo template mẫu hệ thống', async () => {
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

    vi.spyOn(container.templateService, 'getTemplates').mockResolvedValue(mockTemplates);
    const deleteTemplateSpy = vi
      .spyOn(container.templateService, 'deleteTemplate')
      .mockResolvedValue(undefined);

    render(<TemplateCatalogView onOpenStudio={onOpenStudio} onToast={onToast} />);

    expect(await screen.findByText('Standard Software Development (SDLC)')).toBeTruthy();

    const deleteBtn = screen.getByTitle('Delete template');
    fireEvent.click(deleteBtn);

    expect(
      await screen.findByText(
        '"Standard Software Development (SDLC)" là template mẫu của hệ thống. Xóa vĩnh viễn thì người dùng không chọn được mẫu này khi tạo dự án nữa. Các dự án đã tạo trước đó không bị ảnh hưởng.'
      )
    ).toBeTruthy();

    const confirmBtn = screen.getByRole('button', { name: 'Delete' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(deleteTemplateSpy).toHaveBeenCalledWith('tpl-sdlc');
      expect(onToast).toHaveBeenCalledWith('Đã xóa template', 'blue');
    });
  });

  it('xóa template thường (isSystemStandard=false) -> ConfirmDialog giữ thông điệp cũ', async () => {
    const mockTemplates: TemplateSummaryDto[] = [
      {
        id: 'tpl-custom',
        name: 'Custom Team Workflow',
        description: 'Quy trình nội bộ',
        category: 'General',
        isSystemStandard: false,
        phaseCount: 2,
        nodeCount: 5,
        cloneCount: 1,
        createdBy: 'Admin',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        visibility: 'PUBLIC',
      },
    ];

    vi.spyOn(container.templateService, 'getTemplates').mockResolvedValue(mockTemplates);

    render(<TemplateCatalogView onOpenStudio={onOpenStudio} onToast={onToast} />);

    expect(await screen.findByText('Custom Team Workflow')).toBeTruthy();

    const deleteBtn = screen.getByTitle('Delete template');
    fireEvent.click(deleteBtn);

    expect(
      await screen.findByText(
        '"Custom Team Workflow" sẽ bị xóa khỏi kho mẫu. Các dự án đã clone trước đó không bị ảnh hưởng.'
      )
    ).toBeTruthy();
  });

  it('thẻ ẩn có chữ "Đang ẩn" và nút "Hiện", thẻ hiện có nút "Ẩn"; bấm "Ẩn" gọi setTemplateHidden(id, true); không còn chữ PUBLIC trong catalog', async () => {
    const mockTemplates: TemplateSummaryDto[] = [
      {
        id: 'tpl-visible',
        name: 'Visible Template',
        description: 'Mô tả visible',
        category: 'Software Engineering',
        isSystemStandard: true,
        phaseCount: 1,
        nodeCount: 2,
        cloneCount: 0,
        createdBy: 'Admin',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        visibility: 'PUBLIC',
        isHidden: false,
      },
      {
        id: 'tpl-hidden',
        name: 'Hidden Template',
        description: 'Mô tả hidden',
        category: 'General',
        isSystemStandard: false,
        phaseCount: 1,
        nodeCount: 2,
        cloneCount: 0,
        createdBy: 'Admin',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        visibility: 'PUBLIC',
        isHidden: true,
      },
    ];

    vi.spyOn(container.templateService, 'getTemplates').mockResolvedValue(mockTemplates);
    const setHiddenSpy = vi
      .spyOn(container.templateService, 'setTemplateHidden')
      .mockResolvedValue({ ...mockTemplates[0], isHidden: true });

    render(<TemplateCatalogView onOpenStudio={onOpenStudio} onToast={onToast} />);

    expect(await screen.findByText('Visible Template')).toBeTruthy();
    expect(await screen.findByText('Hidden Template')).toBeTruthy();

    // Thẻ ẩn có chữ "Đang ẩn"
    expect(screen.getByText('Đang ẩn')).toBeTruthy();

    // Không còn chữ "PUBLIC" trong catalog
    expect(screen.queryByText(/PUBLIC/)).toBeNull();

    // Thẻ ẩn có nút "Hiện", thẻ hiện có nút "Ẩn"
    const hideBtn = screen.getByRole('button', { name: 'Ẩn' });
    const showBtn = screen.getByRole('button', { name: 'Hiện' });
    expect(hideBtn).toBeTruthy();
    expect(showBtn).toBeTruthy();

    // Bấm nút "Ẩn" gọi setTemplateHidden(id, true)
    fireEvent.click(hideBtn);
    await waitFor(() => {
      expect(setHiddenSpy).toHaveBeenCalledWith('tpl-visible', true);
      expect(onToast).toHaveBeenCalledWith('Đã ẩn template', 'blue');
    });
  });
});
