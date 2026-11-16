import type { GuestFeatures, IGuestService } from '../contracts/IGuestService'
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
import { fetchGuestOverview, submitGuestFeedback } from './http/guest'

const ANONYMOUS = 'Guest'

/** Tính năng chưa có API backend: trang khách không gọi tới (features tắt). */
const notAvailable = (what: string) => Promise.reject(new Error(`${what} is not available for guest links yet.`))

/**
 * D5 — HttpGuestService, chỉ dùng API backend thật (G25: không còn gọi MockGuestApi).
 *
 * - getLinkInfo: GET /guest/{token}/overview (backend chưa có /guest/{token} riêng; lỗi 403 = link hỏng / bị thu hồi / hết hạn)
 * - getOverview: GET /guest/{token}/overview
 * - submitFeedback: POST /guest/{token}/feedback
 * - createSession: chỉ lưu trên trình duyệt (backend không có phiên khách)
 * - listFeedback: backend chưa có API đọc lại góp ý của khách → []
 * - AI summary / AI report / evaluation: chưa có API → features tắt, trang khách ẩn các khối này
 */
export class HttpGuestService implements IGuestService {
  readonly features: GuestFeatures = { aiSummary: false, evaluation: false }

  private readonly sessionNames: Map<string, string> = new Map()

  async getLinkInfo(token: string): Promise<GuestLinkInfoDto> {
    const overview = await fetchGuestOverview(token)
    // Backend chưa trả tên chủ dự án cho khách: để rỗng, trang khách bỏ dòng "Shared by"
    return { projectName: overview.projectName, ownerName: '' }
  }

  async createSession(_token: string, displayName: string | null): Promise<GuestSessionDto> {
    const session: GuestSessionDto = {
      sessionId: `gs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      displayName: displayName?.trim() || null,
    }
    this.sessionNames.set(session.sessionId, session.displayName ?? ANONYMOUS)
    return session
  }

  /** GET /guest/{token}/overview */
  async getOverview(token: string): Promise<GuestOverviewDto> {
    return fetchGuestOverview(token)
  }

  /** POST /guest/{token}/feedback */
  async submitFeedback(token: string, cmd: SubmitGuestFeedbackCommand): Promise<GuestFeedbackDto> {
    const author =
      (cmd as any).reviewerName ||
      (cmd.sessionId ? this.sessionNames.get(cmd.sessionId) : undefined) ||
      ANONYMOUS

    return submitGuestFeedback(token, {
      reviewerName: author,
      reviewerRole: (cmd as any).reviewerRole || 'GUEST',
      content: (cmd as any).content ?? cmd.message ?? '',
      nodeId: (cmd as any).nodeId != null ? (cmd as any).nodeId : null,
    })
  }

  async listFeedback(_token: string, _sessionId: string): Promise<GuestFeedbackDto[]> {
    return []
  }

  getAiSummary(_token: string): Promise<GuestAiSummaryDto> {
    return notAvailable('AI summary')
  }

  generateAiReport(_token: string): Promise<GuestAiReportDto> {
    return notAvailable('AI report')
  }

  async getMyEvaluation(_token: string, _sessionId: string): Promise<GuestEvaluationDto | null> {
    return null
  }

  submitEvaluation(_token: string, _cmd: SubmitGuestEvaluationCommand): Promise<GuestEvaluationDto> {
    return notAvailable('Evaluation')
  }
}
