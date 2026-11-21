// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { KanbanTask } from '../../../types/kanban.types'
import { SubmitArtifactModal } from '../SubmitArtifactModal'

const sampleTask: KanbanTask = {
  id: 't1',
  code: 'WPE-010',
  title: 'Implement login',
  description: '',
  status: 'IN_PROGRESS',
  assignedUserId: '1',
  phaseId: 'p1',
  phaseLabel: 'Phase 1',
  dueDate: '',
  isOverdue: false,
  joinPolicySummary: 'None',
  artifacts: [],
  version: 1,
}

describe('SubmitArtifactModal', () => {
  afterEach(() => cleanup())

  it('không có ô chọn loại, hiện SiteIcon + siteLabel khi dán link hợp lệ, và nộp không gửi type', async () => {
    const onSubmit = vi.fn().mockResolvedValue(true)

    render(
      <SubmitArtifactModal
        task={sampleTask}
        submitting={false}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    )

    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.queryByText(/Deliverable Type/i)).toBeNull()

    const urlInput = screen.getByPlaceholderText(/https:\/\/github\.com/i)
    fireEvent.change(urlInput, { target: { value: 'https://docs.google.com/spreadsheets/d/123' } })

    const preview = screen.getByTestId('submit-artifact-site-preview')
    expect(preview.textContent).toContain('Google Sheets')
    expect(preview.querySelector('svg')).not.toBeNull()

    const nameInput = screen.getByLabelText(/Deliverable name/i)
    fireEvent.change(nameInput, { target: { value: '  Budget sheet ' } })

    fireEvent.click(screen.getByRole('button', { name: /Submit for Review/i }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith({
      url: 'https://docs.google.com/spreadsheets/d/123',
      name: 'Budget sheet',
    })
  })
})

describe('SubmitArtifactModal — tên minh chứng (G36)', () => {
  afterEach(() => cleanup())

  it('ô là tên một dòng tối đa 200 ký tự, khóa khi chưa có link; nộp không link thì không gửi tên', () => {
    const onSubmit = vi.fn().mockResolvedValue(true)
    render(<SubmitArtifactModal task={sampleTask} submitting={false} onClose={vi.fn()} onSubmit={onSubmit} />)

    expect(screen.queryByText(/Handover Notes/i)).toBeNull()
    const nameInput = screen.getByLabelText(/Deliverable name/i) as HTMLInputElement
    expect(nameInput.tagName).toBe('INPUT')
    expect(nameInput.maxLength).toBe(200)
    expect(nameInput.disabled).toBe(true)
    expect(screen.getByText(/Artifact WPE-010/)).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: /Submit for Review/i }))
    expect(onSubmit).toHaveBeenCalledWith({ url: '', name: '' })
  })
})
