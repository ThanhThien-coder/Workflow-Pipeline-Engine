// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { WorkflowArtifactsDrawer } from '../WorkflowArtifactsDrawer'
import { useWorkflowStore } from '../../../store/useWorkflowStore'

describe('WorkflowArtifactsDrawer: ô tìm', () => {
  beforeEach(async () => {
    localStorage.clear()
    await useWorkflowStore.getState().artifacts.loadArtifacts('1')
  })
  afterEach(() => cleanup())

  it('lọc theo tên, link và loại; không khớp thì báo trống', async () => {
    render(<WorkflowArtifactsDrawer isOpen projectId="1" />)
    await waitFor(() => expect(screen.getByText('Figma Design System')).toBeDefined())
    const search = screen.getByLabelText('Search deliverables')

    fireEvent.change(search, { target: { value: 'figma' } })
    expect(screen.getByText('Figma Design System')).toBeDefined()
    expect(screen.queryByText('API Documentation')).toBeNull()

    // theo link
    fireEvent.change(search, { target: { value: 'notion.so' } })
    expect(screen.getByText('Competitor Analysis')).toBeDefined()
    expect(screen.queryByText('Figma Design System')).toBeNull()

    // theo loại
    fireEvent.change(search, { target: { value: 'swagger' } })
    expect(screen.getByText('API Documentation')).toBeDefined()

    fireEvent.change(search, { target: { value: 'khong co gi' } })
    expect(screen.getByText('No deliverables match your search.')).toBeDefined()
  })
})
