// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { FeedbackQueueCard } from '../FeedbackQueueCard'
import { useWorkflowStore } from '../../../store/useWorkflowStore'
import type { FeedbackItem } from '../../../types/overview.types'

const envMock = vi.hoisted(() => ({ isMock: false }))
vi.mock('../../../services/env', () => ({
  get isMockMode() {
    return envMock.isMock
  },
}))

const sampleItems: FeedbackItem[] = [
  {
    id: 'fb-1',
    reviewerName: 'John Reviewer',
    reviewerRole: 'GUEST',
    nodeRef: null,
    content: 'Need to clarify the error responses.',
    status: 'OPEN',
    createdAt: new Date().toISOString(),
  },
]

describe('FeedbackQueueCard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    envMock.isMock = false
  })

  afterEach(() => {
    cleanup()
  })

  it('chế độ thật (!isMockMode): overviewRole = "COLLABORATOR" thì không hiện nút xử lý dù simulatedRole = "OWNER"', () => {
    envMock.isMock = false
    useWorkflowStore.setState((s) => ({
      settings: {
        ...s.settings,
        simulatedRole: 'OWNER',
      },
      overview: {
        ...s.overview,
        data: {
          project: { id: '1', name: 'P1', role: 'COLLABORATOR', phaseLabel: '', lastUpdatedAt: '' },
          metrics: {} as any,
          velocity: {} as any,
          statusBreakdown: {} as any,
          aiReport: {} as any,
          guestAccess: {} as any,
          feedbackQueue: sampleItems,
          recentActivity: [],
        },
      },
    }))

    render(<FeedbackQueueCard items={sampleItems} onResolve={vi.fn()} />)

    expect(screen.queryByRole('button', { name: /Mark Resolved/i })).toBeNull()
  })

  it('chế độ thật (!isMockMode): overviewRole = "OWNER" thì hiện nút xử lý', () => {
    envMock.isMock = false
    useWorkflowStore.setState((s) => ({
      settings: {
        ...s.settings,
        simulatedRole: 'COLLABORATOR',
      },
      overview: {
        ...s.overview,
        data: {
          project: { id: '1', name: 'P1', role: 'OWNER', phaseLabel: '', lastUpdatedAt: '' },
          metrics: {} as any,
          velocity: {} as any,
          statusBreakdown: {} as any,
          aiReport: {} as any,
          guestAccess: {} as any,
          feedbackQueue: sampleItems,
          recentActivity: [],
        },
      },
    }))

    render(<FeedbackQueueCard items={sampleItems} onResolve={vi.fn()} />)

    expect(screen.getByRole('button', { name: /Mark Resolved/i })).toBeTruthy()
  })

  it('chế độ mock (isMockMode): simulatedRole = "OWNER" thì hiện nút xử lý', () => {
    envMock.isMock = true
    useWorkflowStore.setState((s) => ({
      settings: {
        ...s.settings,
        simulatedRole: 'OWNER',
      },
      overview: {
        ...s.overview,
        data: null,
      },
    }))

    render(<FeedbackQueueCard items={sampleItems} onResolve={vi.fn()} />)

    expect(screen.getByRole('button', { name: /Mark Resolved/i })).toBeTruthy()
  })
})
