// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { DeleteProjectModal } from '../DeleteProjectModal'

describe('FC4: DeleteProjectModal', () => {
  afterEach(() => {
    cleanup()
  })

  it('không còn ô nhập tên dự án, hiện cảnh báo Không thể hoàn tác và tên dự án in đậm', () => {
    const { container } = render(
      <DeleteProjectModal
        isOpen={true}
        projectName="abcd"
        onClose={vi.fn()}
        onConfirmDelete={vi.fn().mockResolvedValue(true)}
      />,
    )

    expect(container.querySelector('input')).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
    const projectNameEl = screen.getByText('abcd')
    expect(projectNameEl).toBeTruthy()
    expect(['STRONG', 'B']).toContain(projectNameEl.tagName)
    expect(screen.getByText(/Không thể hoàn tác/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Hủy/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Xóa vĩnh viễn/i })).toBeTruthy()
  })

  it('bấm "Xóa vĩnh viễn" gọi ngay hàm xóa (API) mà không cần gõ tên và khóa nút khi đang xóa', async () => {
    let resolveDelete!: (val: boolean) => void
    const onConfirmDelete = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveDelete = resolve
        }),
    )
    const onClose = vi.fn()

    render(
      <DeleteProjectModal
        isOpen={true}
        projectName="abcd"
        onClose={onClose}
        onConfirmDelete={onConfirmDelete}
      />,
    )

    const deleteBtn = screen.getByRole('button', { name: /Xóa vĩnh viễn/i }) as HTMLButtonElement
    const cancelBtn = screen.getByRole('button', { name: /Hủy/i }) as HTMLButtonElement
    expect(deleteBtn.disabled).toBe(false)

    fireEvent.click(deleteBtn)

    await waitFor(() => {
      expect(onConfirmDelete).toHaveBeenCalledTimes(1)
    })
    expect(screen.getByRole('button', { name: /Đang xóa/i }).hasAttribute('disabled')).toBe(true)
    expect(cancelBtn.disabled).toBe(true)

    resolveDelete(true)
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  it('khi xóa bị lỗi thì hiện thông báo lỗi backend trong modal', async () => {
    const onConfirmDelete = vi.fn().mockRejectedValue(new Error('Chỉ Chủ dự án mới có quyền xóa'))
    const onClose = vi.fn()

    render(
      <DeleteProjectModal
        isOpen={true}
        projectName="abcd"
        onClose={onClose}
        onConfirmDelete={onConfirmDelete}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Xóa vĩnh viễn/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Chỉ Chủ dự án mới có quyền xóa')
    })
    expect(onClose).not.toHaveBeenCalled()
  })
})
