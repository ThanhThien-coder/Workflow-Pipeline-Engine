import type {
  GuestAiReportDto,
  GuestEvaluationDto,
  SubmitGuestEvaluationCommand,
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
  /** GET  /guest/{token}/feedback?sessionId=  (this guest's own feedback, newest first) */
  listFeedback(token: string, sessionId: string): Promise<GuestFeedbackDto[]>
  /** POST /guest/{token}/ai-report  (on-demand full report, may take a few seconds) */
  generateAiReport(token: string): Promise<GuestAiReportDto>
  /** GET  /guest/{token}/evaluation?sessionId=  (null when not submitted yet) */
  getMyEvaluation(token: string, sessionId: string): Promise<GuestEvaluationDto | null>
  /** PUT  /guest/{token}/evaluation  (create or replace this guest's evaluation) */
  submitEvaluation(token: string, cmd: SubmitGuestEvaluationCommand): Promise<GuestEvaluationDto>
}
