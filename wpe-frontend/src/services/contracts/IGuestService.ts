import type {
  GuestAiSummaryDto,
  GuestFeedbackDto,
  GuestLinkInfoDto,
  GuestOverviewDto,
  GuestSessionDto,
  SubmitGuestFeedbackCommand,
} from '../../types/guest.types'

/**
 * Every method rejects with GuestLinkError when the token is
 * invalid / expired / revoked.
 */
export interface IGuestService {
  /** GET  /guest/{token} */
  getLinkInfo(token: string): Promise<GuestLinkInfoDto>
  /** POST /guest/{token}/session  (displayName = null → anonymous) */
  createSession(token: string, displayName: string | null): Promise<GuestSessionDto>
  /** GET  /guest/{token}/overview */
  getOverview(token: string): Promise<GuestOverviewDto>
  /** GET  /guest/{token}/ai-summary */
  getAiSummary(token: string): Promise<GuestAiSummaryDto>
  /** POST /guest/{token}/feedback */
  submitFeedback(token: string, cmd: SubmitGuestFeedbackCommand): Promise<GuestFeedbackDto>
}
