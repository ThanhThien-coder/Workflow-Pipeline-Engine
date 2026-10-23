// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { WorkflowArtifactsIsland } from '../WorkflowArtifactsIsland'
import { WorkflowArtifactsDrawer } from '../WorkflowArtifactsDrawer'
import { useWorkflowStore } from '../../../store/useWorkflowStore'

describe('Workflow Artifacts Island & Drawer UI Components', () => {
  beforeEach(() => {
    localStorage.clear()
    useWorkflowStore.getState().artifacts.loadArtifacts('1')
    useWorkflowStore.getState().artifacts.closeDrawer()

    // Mock clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('renders WorkflowArtifactsIsland with count and triggers drawer open', () => {
    render(<WorkflowArtifactsIsland count={5} />)

    expect(screen.getByText('Artifacts')).toBeDefined()
    expect(screen.getByText('5')).toBeDefined()

    // Click island to open drawer
    const button = screen.getByRole('button', { name: /Open deliverables artifacts/i })
    fireEvent.click(button)

    expect(useWorkflowStore.getState().artifacts.isDrawerOpen).toBe(true)
  })

  it('renders WorkflowArtifactsDrawer with header, quick add box, and list of links', () => {
    render(<WorkflowArtifactsDrawer isOpen={true} />)

    expect(screen.getByText('Project Deliverables')).toBeDefined()
    expect(screen.getByPlaceholderText(/Tên link/i)).toBeDefined()
    expect(screen.getByPlaceholderText(/https:\/\//i)).toBeDefined()
    expect(screen.getByRole('button', { name: /\+ Add Link/i })).toBeDefined()

    // Default artifacts should be present
    expect(screen.getByText('Figma Design System')).toBeDefined()
    expect(screen.getByText('API Documentation')).toBeDefined()
  })

  it('validates Quick Add form inputs and blocks invalid submissions', () => {
    render(<WorkflowArtifactsDrawer isOpen={true} />)

    const addButton = screen.getByRole('button', { name: /Add Link/i }) as HTMLButtonElement
    expect(addButton.disabled).toBe(true)

    const nameInput = screen.getByPlaceholderText(/Tên link/i)
    const urlInput = screen.getByPlaceholderText(/https:\/\//i)

    // Type only name
    fireEvent.change(nameInput, { target: { value: 'Invalid Test' } })
    expect(addButton.disabled).toBe(true)

    // Type invalid url
    fireEvent.change(urlInput, { target: { value: 'not-a-valid-url' } })
    expect(addButton.disabled).toBe(false)
    fireEvent.click(addButton)

    expect(
      screen.getByText(/Đường dẫn URL không hợp lệ/i),
    ).toBeDefined()
  })

  it('adds a new link successfully and prepends to the list', async () => {
    render(<WorkflowArtifactsDrawer isOpen={true} projectId="1" />)

    const nameInput = screen.getByPlaceholderText(/Tên link/i)
    const urlInput = screen.getByPlaceholderText(/https:\/\//i)
    const addButton = screen.getByRole('button', { name: /Add Link/i })

    fireEvent.change(nameInput, { target: { value: 'Figma Mobile App Mockup' } })
    fireEvent.change(urlInput, { target: { value: 'https://figma.com/file/mobile-mockup' } })
    fireEvent.click(addButton)

    await waitFor(() => {
      expect(screen.getByText('Figma Mobile App Mockup')).toBeDefined()
    })
  })

  it('copies link to clipboard when clicking copy button', async () => {
    render(<WorkflowArtifactsDrawer isOpen={true} />)

    const copyButtons = screen.getAllByTitle(/Copy link/i)
    expect(copyButtons.length).toBeGreaterThan(0)

    fireEvent.click(copyButtons[0])

    expect(navigator.clipboard.writeText).toHaveBeenCalled()
  })

  it('removes an artifact from drawer when clicking trash icon', async () => {
    render(<WorkflowArtifactsDrawer isOpen={true} />)

    const initialCount = screen.getAllByTitle(/Remove artifact/i).length
    const firstTrash = screen.getAllByTitle(/Remove artifact/i)[0]

    fireEvent.click(firstTrash)

    await waitFor(() => {
      const newCount = screen.queryAllByTitle(/Remove artifact/i).length
      expect(newCount).toBe(initialCount - 1)
    })
  })

  it('adheres to strict 3-tier Dual-Anchor Viewport Bounding and responsive classes', () => {
    const { container } = render(<WorkflowArtifactsDrawer isOpen={true} />)

    const panel = container.querySelector('aside')
    expect(panel).not.toBeNull()
    expect(panel?.className).toContain('fixed')
    expect(panel?.className).toContain('top-20')
    expect(panel?.className).toContain('bottom-20')
    expect(panel?.className).toContain('right-6')
    expect(panel?.className).toContain('z-50')
    expect(panel?.className).toContain('w-[380px]')
    expect(panel?.className).toContain('max-w-[calc(100vw-48px)]')
    expect(panel?.className).toContain('flex-col')
    expect(panel?.className).toContain('overflow-hidden')

    // Tier 1: Header (flex-shrink-0)
    const header = container.querySelector('header')
    expect(header).not.toBeNull()
    expect(header?.className).toContain('flex-shrink-0')

    // Tier 2: Form (flex-shrink-0)
    const formSection = container.querySelector('section')
    expect(formSection).not.toBeNull()
    expect(formSection?.className).toContain('flex-shrink-0')

    // Tier 3: List (flex-1 min-h-0 overflow-y-auto overscroll-contain)
    const list = panel?.querySelector('[data-lenis-prevent="true"]')
    expect(list).not.toBeNull()
    expect(list?.className).toContain('flex-1')
    expect(list?.className).toContain('min-h-0')
    expect(list?.className).toContain('overflow-y-auto')
    expect(list?.className).toContain('overscroll-contain')
  })
})
