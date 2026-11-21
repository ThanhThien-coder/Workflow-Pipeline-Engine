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

    const noteInput = screen.getByPlaceholderText(/Summary of completed deliverables/i)
    fireEvent.change(noteInput, { target: { value: 'Ready for check' } })

    fireEvent.click(screen.getByRole('button', { name: /Submit for Review/i }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith({
      url: 'https://docs.google.com/spreadsheets/d/123',
      note: 'Ready for check',
    })
  })
})
