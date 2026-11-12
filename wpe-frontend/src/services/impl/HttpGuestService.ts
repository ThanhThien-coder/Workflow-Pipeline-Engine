import type { IGuestService } from '../contracts/IGuestService'
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
import { MockGuestApi } from '../mock/MockWorkflowService.guest'
import { fetchGuestOverview, submitGuestFeedback } from './http/guest'

/**
 * D5 — HttpGuestService:
 *
 * Phương thức gọi API backend thật:
 * - getOverview: GET /guest/{token}/overview
 * - submitFeedback: POST /guest/{token}/feedback
 *
 * Các phương thức CHƯA CÓ trong SSOT nên vẫn gọi MockGuestApi (còn mock):
 * - getLinkInfo
 * - createSession
 * - getAiSummary
 * - listFeedback
 * - generateAiReport
 * - getMyEvaluation
 * - submitEvaluation
 */
export class HttpGuestService implements IGuestService {
  private readonly mock: MockGuestApi
  private readonly sessionNames: Map<string, string> = new Map()

  constructor(mock?: MockGuestApi) {
    this.mock = mock || new MockGuestApi()
  }

  // ───────────────────────── API Thật (D5) ─────────────────────────

  /** GET /guest/{token}/overview */
  async getOverview(token: string): Promise<GuestOverviewDto> {
    return fetchGuestOverview(token)
  }

  /** POST /guest/{token}/feedback */
  async submitFeedback(token: string, cmd: SubmitGuestFeedbackCommand): Promise<GuestFeedbackDto> {
    const author =
      (cmd as any).reviewerName ||
      (cmd.sessionId ? this.sessionNames.get(cmd.sessionId) : undefined) ||
      'Khách truy cập'

    return submitGuestFeedback(token, {
      reviewerName: author,
      reviewerRole: (cmd as any).reviewerRole || 'GUEST',
      content: (cmd as any).content ?? cmd.message ?? '',
      nodeId: (cmd as any).nodeId != null ? (cmd as any).nodeId : null,
    })
  }

  // ───────────────────────── Còn Mock (Chưa có trong SSOT) ─────────────────────────

  getLinkInfo(token: string): Promise<GuestLinkInfoDto> {
    return this.mock.getLinkInfo(token)
  }

  async createSession(token: string, displayName: string | null): Promise<GuestSessionDto> {
    const session = await this.mock.createSession(token, displayName)
    if (session?.sessionId) {
      this.sessionNames.set(session.sessionId, session.displayName ?? 'Khách truy cập')
    }
    return session
  }

  getAiSummary(token: string): Promise<GuestAiSummaryDto> {
    return this.mock.getAiSummary(token)
  }

  listFeedback(token: string, sessionId: string): Promise<GuestFeedbackDto[]> {
    return this.mock.listFeedback(token, sessionId)
  }

  generateAiReport(token: string): Promise<GuestAiReportDto> {
    return this.mock.generateAiReport(token)
  }

  getMyEvaluation(token: string, sessionId: string): Promise<GuestEvaluationDto | null> {
    return this.mock.getMyEvaluation(token, sessionId)
  }

  submitEvaluation(token: string, cmd: SubmitGuestEvaluationCommand): Promise<GuestEvaluationDto> {
    return this.mock.submitEvaluation(token, cmd)
  }
}
