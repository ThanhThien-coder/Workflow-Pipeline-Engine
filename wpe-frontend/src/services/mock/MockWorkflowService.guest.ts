import type { IGuestService } from '../contracts/IGuestService'
import { GuestLinkError } from '../../types/guest.types'
import type {
  GuestAiReportDto,
  GuestAiSummaryDto,
  GuestEvaluationDto,
  GuestFeedbackDto,
  GuestLinkInfoDto,
  GuestOverviewDto,
  GuestSessionDto,
  SubmitGuestEvaluationCommand,
  SubmitGuestFeedbackCommand,
} from '../../types/guest.types'
import { MockConfig } from './MockConfig'
import { guestAccessStore } from './guestAccessStore'

const DATA_KEY = 'wpe_mock_guest_data'

interface MockGuestData {
  names: Record<string, string>
  feedback: Record<string, GuestFeedbackDto[]>
  evaluations: Record<string, GuestEvaluationDto>
}

const wait = () => new Promise<void>((resolve) => setTimeout(resolve, MockConfig.latencyMs))

/**
 * Test tokens:  gst_sec_4242cf (valid) · gst_expired · gst_revoked · anything else → INVALID
 */
export class MockGuestApi implements IGuestService {
  private async guard(token: string): Promise<void> {
    await wait()
    if (MockConfig.fakeError500) throw new Error('500 Internal Server Error')
    if (token === 'gst_expired') throw new GuestLinkError('EXPIRED')
    if (token === 'gst_revoked') throw new GuestLinkError('REVOKED')
    if (!token.startsWith('gst_')) throw new GuestLinkError('INVALID')
    const status = guestAccessStore.get(token)
    if (status === 'revoked') throw new GuestLinkError('REVOKED')
    if (status === 'expired') throw new GuestLinkError('EXPIRED')
  }

  async getLinkInfo(token: string): Promise<GuestLinkInfoDto> {
    await this.guard(token)
    return { projectName: 'Marketing Campaign Q4', ownerName: 'Sarah Chen' }
  }

  private async createSessionBase(token: string, displayName: string | null): Promise<GuestSessionDto> {
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

  private data(): MockGuestData {
    try {
      const raw = JSON.parse(localStorage.getItem(DATA_KEY) || 'null') as Partial<MockGuestData> | null
      if (raw) return { names: raw.names ?? {}, feedback: raw.feedback ?? {}, evaluations: raw.evaluations ?? {} }
    } catch {
      /* ignore */
    }
    return { names: {}, feedback: {}, evaluations: {} }
  }

  private save(d: MockGuestData): void {
    try {
      localStorage.setItem(DATA_KEY, JSON.stringify(d))
    } catch {
      /* ignore */
    }
  }

  async createSession(token: string, displayName: string | null): Promise<GuestSessionDto> {
    const session = await this.createSessionBase(token, displayName)
    const d = this.data()
    d.names[session.sessionId] = session.displayName ?? 'Anonymous'
    this.save(d)
    return session
  }

  async submitFeedback(token: string, cmd: SubmitGuestFeedbackCommand): Promise<GuestFeedbackDto> {
    await this.guard(token)
    const d = this.data()
    // sessionId tuy chon (HttpGuestService gui reviewerName thay cho session); mock dung khoa mac dinh
    const sid = cmd.sessionId ?? 'anonymous'
    const item: GuestFeedbackDto = {
      id: `fb_${Date.now()}`,
      author: d.names[sid] ?? cmd.reviewerName ?? 'Anonymous',
      message: cmd.message,
      createdAt: new Date().toISOString(),
    }
    d.feedback[sid] = [item, ...(d.feedback[sid] ?? [])]
    this.save(d)
    return item
  }

  async listFeedback(token: string, sessionId: string): Promise<GuestFeedbackDto[]> {
    await this.guard(token)
    return this.data().feedback[sessionId] ?? []
  }

  async generateAiReport(token: string): Promise<GuestAiReportDto> {
    await this.guard(token)
    await new Promise((resolve) => setTimeout(resolve, 1800))
    return {
      title: 'Project Progress Report: Marketing Campaign Q4',
      generatedAt: new Date().toISOString(),
      sections: [
        { heading: 'Executive summary', body: 'The project is 72% complete (17 of 24 nodes). Phase 1 is delivered and Phase 2A (Auth) is the main active workstream.', bullets: [] },
        { heading: 'Progress analysis', body: 'Weekly velocity is steady, peaking at 11 tasks on Wednesday and Friday and dropping at the weekend.', bullets: ['23 of 51 tasks are done (45%)', '13 tasks are in progress, 9 are not started', '6 tasks are blocked by upstream work'] },
        { heading: 'Risks and blockers', body: 'Four tasks are overdue and two of them block the release.', bullets: ['JWT refresh flow waits on the /register API', 'E2E tests are locked until JWT flow and Login Form are done'] },
        { heading: 'Recommendations', body: 'Focus the next sprint on unblocking the critical path.', bullets: ['Finish the /register API review first', 'Re-plan the two overdue release blockers', 'Add buffer before the Phase 3 integration'] },
      ],
    }
  }

  async getMyEvaluation(token: string, sessionId: string): Promise<GuestEvaluationDto | null> {
    await this.guard(token)
    return this.data().evaluations[sessionId] ?? null
  }

  async submitEvaluation(token: string, cmd: SubmitGuestEvaluationCommand): Promise<GuestEvaluationDto> {
    await this.guard(token)
    const values = Object.values(cmd.scores)
    if (values.length !== 4 || values.some((v) => !Number.isInteger(v) || v < 1 || v > 5) || cmd.comment.length > 1000) {
      throw new Error('VALIDATION')
    }
    const d = this.data()
    const average = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
    const evaluation: GuestEvaluationDto = {
      id: d.evaluations[cmd.sessionId]?.id ?? `ev_${Date.now()}`,
      author: d.names[cmd.sessionId] ?? 'Anonymous',
      scores: { ...cmd.scores },
      average,
      comment: cmd.comment,
      createdAt: new Date().toISOString(),
    }
    d.evaluations[cmd.sessionId] = evaluation
    this.save(d)
    return evaluation
  }
}
