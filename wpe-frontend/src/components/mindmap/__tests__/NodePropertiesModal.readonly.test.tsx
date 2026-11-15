// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { NodePropertiesModal } from '../NodePropertiesModal'
import type { BranchGraphNode } from '../../../types/workflow.types'

/** T3 (G8, G11) — không còn ô sửa trạng thái; chỉ xem thì mọi ô nhập bị khóa. */

const NODE: BranchGraphNode = {
  kind: 'branch', id: '152', code: 'WPE-152', title: 'Subtask 1', description: 'Mô tả', isTrack: false,
  status: 'LOCKED', assignee: null, due: '2026-11-20', blocker: null, joinPolicy: 'ALL_COMPLETED', parentIds: ['root'],
}

describe('NodePropertiesModal — trạng thái và chế độ chỉ xem', () => {
  afterEach(() => cleanup())

  it('trạng thái chỉ hiện nhãn, không có ô chọn trạng thái; lưu không gửi status', () => {
    const onSave = vi.fn()
    render(<NodePropertiesModal node={NODE} onClose={() => {}} onDelete={() => {}} onSave={onSave} />)

    expect(screen.getByTestId('node-status').textContent).toBe('🔒 Locked')
    expect(screen.queryByRole('option', { name: 'DONE' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0][0]).not.toHaveProperty('status')
    expect(onSave.mock.calls[0][0]).not.toHaveProperty('progress')
  })

  it('chỉ xem: mọi ô nhập bị khóa, không có nút lưu và xóa, có dòng báo ở đầu', () => {
    render(<NodePropertiesModal node={NODE} onClose={() => {}} onDelete={() => {}} readOnly />)

    const fields = [
      ...screen.getAllByRole('textbox'),
      ...screen.getAllByRole('combobox'),
      document.querySelector('input[type="date"]') as HTMLInputElement,
    ]
    expect(fields.length).toBeGreaterThanOrEqual(4)
    fields.forEach((field) => expect((field as HTMLInputElement).matches(':disabled')).toBe(true))

    expect(screen.queryByRole('button', { name: /save changes/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /delete task/i })).toBeNull()
    expect(screen.getByText('Only the project owner can edit the graph')).toBeTruthy()
    expect(screen.getByText('Task Details')).toBeTruthy()
  })
})
