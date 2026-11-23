import { useEffect, useMemo, useState } from 'react'
import { workflowService } from '../services/container'
import type { IWorkflowService } from '../services/contracts/IWorkflowService'
import type { GuestReportDto } from '../types/guest.types'
import { buildGuestReport, type GuestReportModel } from '../domain/guestReport'

/**
 * Report dự án cho thành viên (GET /projects/{id}/report), dựng thành mô hình số liệu giống trang khách
 * để dùng lại các khối như Deadlines. Service không có getProjectReport (chế độ mock) hoặc lỗi thì model = null.
 * `refreshKey` đổi thì tải lại (ví dụ thời điểm cập nhật của Overview).
 */
export function useProjectReport(
  projectId: string,
  refreshKey?: string | number | null,
  service: IWorkflowService = workflowService,
): GuestReportModel | null {
  const [dto, setDto] = useState<GuestReportDto | null>(null)

  useEffect(() => {
    if (!service.getProjectReport) {
      setDto(null)
      return
    }
    let cancelled = false
    service
      .getProjectReport(projectId)
      .then((data) => {
        if (!cancelled) setDto(data ?? null)
      })
      .catch(() => {
        if (!cancelled) setDto(null)
      })
    return () => {
      cancelled = true
    }
  }, [projectId, refreshKey, service])

  return useMemo(() => {
    if (!dto) return null
    try {
      return buildGuestReport(dto)
    } catch {
      return null
    }
  }, [dto])
}
