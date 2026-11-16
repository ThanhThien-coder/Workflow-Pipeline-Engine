import { apiRequest } from '../../http/apiClient'

/** POST /projects/{id}/ai-diagnostics: chạy chẩn đoán AI mới. Lỗi (429 cooldown, 403...) ném ApiError, không nuốt lỗi. */
export async function triggerAiDiagnostics(projectId: string | number): Promise<unknown> {
  return apiRequest<unknown>('POST', `/projects/${projectId}/ai-diagnostics`)
}
