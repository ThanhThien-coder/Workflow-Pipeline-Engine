import { MockWorkflowService } from './MockWorkflowService'
import type { IWorkflowService } from './contracts/IWorkflowService'
import { MockGuestApi } from './mock/MockWorkflowService.guest'
import type { IGuestService } from './contracts/IGuestService'
import type { IAdminService } from './admin/IAdminService'
import { MockAdminService } from './admin/MockAdminService'
import type { ITemplateService } from './template/ITemplateService'
import { MockTemplateService } from './template/MockTemplateService'

export interface ServiceContainer {
  workflowService: IWorkflowService
  guestService: IGuestService
  adminService: IAdminService
  templateService: ITemplateService
}

export const container: ServiceContainer = {
  workflowService: new MockWorkflowService(),
  guestService: new MockGuestApi(),
  adminService: new MockAdminService(),
  templateService: new MockTemplateService(),
}

export const workflowService = container.workflowService
export const guestService = container.guestService
export const adminService = container.adminService
export const templateService = container.templateService