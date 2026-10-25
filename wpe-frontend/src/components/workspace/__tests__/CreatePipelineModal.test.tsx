// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { CreatePipelineModal } from '../CreatePipelineModal'
import { container } from '../../../services/container'

describe('CreatePipelineModal Component', () => {
  const mockClose = vi.fn()
  const mockCreate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(container.templateService, 'getAllTemplates').mockResolvedValue([
      {
        id: 'tpl-1',
        name: 'Standard SDLC Pipeline',
        description: 'Standard software development life cycle',
        category: 'Software Engineering',
        isSystemStandard: true,
        phaseCount: 3,
        nodeCount: 12,
        cloneCount: 42,
        createdBy: 'usr-admin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ])
  })

  afterEach(() => {
    cleanup()
  })

  it('renders modal when isOpen is true and loads templates', async () => {
    render(
      <CreatePipelineModal
        isOpen={true}
        onClose={mockClose}
        onCreate={mockCreate}
      />
    )

    expect(screen.getByText('Create New Pipeline')).toBeDefined()
    expect(screen.getByPlaceholderText('e.g. Authentication Service V2')).toBeDefined()

    await waitFor(() => {
      expect(screen.getByText(/Standard SDLC Pipeline/)).toBeDefined()
    })
  })

  it('shows validation error when submitting with empty pipeline name', async () => {
    render(
      <CreatePipelineModal
        isOpen={true}
        onClose={mockClose}
        onCreate={mockCreate}
      />
    )

    const submitBtn = screen.getByText('Create Pipeline ➔')
    fireEvent.click(submitBtn)

    expect(screen.getByText('Pipeline name is required.')).toBeDefined()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('submits form with templateId, visibility, and invokes onCreate', async () => {
    mockCreate.mockResolvedValueOnce(undefined)

    render(
      <CreatePipelineModal
        isOpen={true}
        onClose={mockClose}
        onCreate={mockCreate}
        initialTemplateId="tpl-1"
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Nhân bản quy trình từ Template')).toBeDefined()
    })

    const nameInput = screen.getByPlaceholderText('e.g. Authentication Service V2')
    fireEvent.change(nameInput, { target: { value: 'My Fintech Core Pipeline' } })

    const cloneBtn = screen.getByText('Nhân bản quy trình ➔')
    fireEvent.click(cloneBtn)

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith({
        name: 'My Fintech Core Pipeline',
        desc: expect.any(String),
        templateId: 'tpl-1',
        visibility: 'PRIVATE',
      })
    })
  })

  it('handles error in onCreate and resets submitting state in finally', async () => {
    let rejectPromise!: (err: Error) => void
    const pendingPromise = new Promise<void>((_, reject) => {
      rejectPromise = reject
    })
    mockCreate.mockReturnValueOnce(pendingPromise)

    render(
      <CreatePipelineModal
        isOpen={true}
        onClose={mockClose}
        onCreate={mockCreate}
      />
    )

    const nameInput = screen.getByPlaceholderText('e.g. Authentication Service V2')
    fireEvent.change(nameInput, { target: { value: 'Error Test Pipeline' } })

    const submitBtn = screen.getByText('Create Pipeline ➔')
    fireEvent.click(submitBtn)

    // Submitting state: button disabled, text 'Creating...'
    await waitFor(() => {
      expect(screen.getByText('Creating...')).toBeDefined()
    })

    // Reject the promise
    rejectPromise(new Error('Network error during pipeline creation'))

    await waitFor(() => {
      expect(screen.getByText('Network error during pipeline creation')).toBeDefined()
      expect(screen.getByText('Create Pipeline ➔')).toBeDefined()
    })
  })
})
