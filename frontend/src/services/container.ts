import { MockWorkflowService } from './MockWorkflowService'
import type { IWorkflowService } from './contracts/IWorkflowService'
import { MockGuestApi } from './mock/MockWorkflowService.guest'
import type { IGuestService } from './contracts/IGuestService'
import type { IAdminService } from './admin/IAdminService'
import { MockAdminService } from './admin/MockAdminService'

export interface ServiceContainer {
  workflowService: IWorkflowService
  guestService: IGuestService
  adminService: IAdminService
}

export const container: ServiceContainer = {
  workflowService: new MockWorkflowService(),
  guestService: new MockGuestApi(),
  adminService: new MockAdminService(),
}

export const workflowService = container.workflowService
export const guestService = container.guestService
export const adminService = container.adminService