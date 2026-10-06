import type { IGuestService } from '../contracts/IGuestService'
import { GuestLinkError } from '../../types/guest.types'
import type {
  GuestAiSummaryDto,
  GuestFeedbackDto,
  GuestLinkInfoDto,
  GuestOverviewDto,
  GuestSessionDto,
  SubmitGuestFeedbackCommand,
} from '../../types/guest.types'
import { MockConfig } from './MockConfig'

const wait = () => new Promise<void>((resolve) => setTimeout(resolve, MockConfig.latencyMs))

/**
 * Test tokens:  gst_sec_4242cf (valid) · gst_expired · gst_revoked · anything else → INVALID
 */
export class MockGuestApi implements IGuestService {
  private feedback: GuestFeedbackDto[] = []

  private async guard(token: string): Promise<void> {
    await wait()
    if (MockConfig.fakeError500) throw new Error('500 Internal Server Error')
    if (token === 'gst_expired') throw new GuestLinkError('EXPIRED')
    if (token === 'gst_revoked') throw new GuestLinkError('REVOKED')
    if (!token.startsWith('gst_')) throw new GuestLinkError('INVALID')
  }

  async getLinkInfo(token: string): Promise<GuestLinkInfoDto> {
    await this.guard(token)
    return { projectName: 'Marketing Campaign Q4', ownerName: 'Sarah Chen' }
  }

  async createSession(token: string, displayName: string | null): Promise<GuestSessionDto> {
    await this.guard(token)
    return { sessionId: `gs_${Date.now()}`, displayName: displayName?.trim() || null }
  }

  async getOverview(token: string): Promise<GuestOverviewDto> {
    await this.guard(token)
    return {
      projectName: 'Marketing Campaign Q4',
      phaseLabel: 'Phase 2 · Published',
      lastUpdated: '3 days ago',
      totalNodes: 24,
      criticalNodes: 8,
      completedNodes: 17,
      completionPct: 72,
      overdueCount: 4,
      blockingCount: 2,
      totalTasks: 51,
      velocity: [
        { day: 'Mon', value: 8 }, { day: 'Tue', value: 10 }, { day: 'Wed', value: 11 },
        { day: 'Thu', value: 9 }, { day: 'Fri', value: 11 }, { day: 'Sat', value: 5 }, { day: 'Sun', value: 4 },
      ],
      statusBreakdown: [
        { key: 'done', label: 'Done', count: 23 },
        { key: 'inProgress', label: 'In Progress', count: 13 },
        { key: 'todo', label: 'To Do', count: 9 },
        { key: 'blocked', label: 'Blocked', count: 6 },
      ],
      recentActivity: [
        { id: 'a1', initials: 'SC', actor: 'SC', text: 'submitted PR for WPE-012', ago: '3 days ago' },
        { id: 'a2', initials: 'AK', actor: 'AK', text: 'approved schema for WPE-009', ago: '3 days ago' },
        { id: 'a3', initials: 'ML', actor: 'ML', text: 'flagged overdue warning on WPE-014', ago: '3 days ago' },
      ],
    }
  }

  async getAiSummary(token: string): Promise<GuestAiSummaryDto> {
    await this.guard(token)
    await wait()
    return {
      content:
        'The project is 72% complete (17 of 24 nodes). Phase 2A (Auth) is progressing, with the login API done and the register API at 80%. Delivery pace was steady mid-week and dropped at the weekend.',
      highlights: ['Session schema and POST /login are done', 'Velocity peaked on Wednesday and Friday (11 tasks)'],
      risks: ['4 overdue tasks, 2 of them blocking the release', 'JWT refresh flow waits on /register; E2E tests are locked behind it'],
      generatedAt: new Date().toISOString(),
    }
  }

  async submitFeedback(token: string, cmd: SubmitGuestFeedbackCommand): Promise<GuestFeedbackDto> {
    await this.guard(token)
    const item: GuestFeedbackDto = {
      id: `fb_${Date.now()}`,
      author: 'Guest',
      message: cmd.message,
      createdAt: new Date().toISOString(),
    }
    this.feedback = [item, ...this.feedback]
    return item
  }
}
