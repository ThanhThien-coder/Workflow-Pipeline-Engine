import { MockWorkflowService } from './MockWorkflowService'
import { HttpWorkflowService } from './impl/HttpWorkflowService'
import type { IWorkflowService } from './contracts/IWorkflowService'
import { MockGuestApi } from './mock/MockWorkflowService.guest'
import { HttpGuestService } from './impl/HttpGuestService'
import type { IGuestService } from './contracts/IGuestService'
import type { IProfileService } from './contracts/IProfileService'
import { MockProfileApi } from './mock/MockWorkflowService.profile'
import { HttpProfileService } from './impl/HttpProfileService'
import type { IAdminService } from './admin/IAdminService'
import { MockAdminService } from './admin/MockAdminService'
import type { ITemplateService } from './template/ITemplateService'
import { MockTemplateService } from './template/MockTemplateService'
import type { INotificationService } from './contracts/INotificationService'
import { MockNotificationApi } from './mock/MockWorkflowService.notification'
import { HttpNotificationService } from './impl/HttpNotificationService'

import { HttpTemplateService } from './template/HttpTemplateService'
import { isMockMode } from './env'

export interface ServiceContainer {
  workflowService: IWorkflowService
  guestService: IGuestService
  profileService: IProfileService
  adminService: IAdminService
  templateService: ITemplateService
  notificationService: INotificationService
}

const isMock = isMockMode

export const container: ServiceContainer = {
  workflowService: isMock ? new MockWorkflowService() : new HttpWorkflowService(),
  guestService: isMock ? new MockGuestApi() : new HttpGuestService(),
  profileService: isMock ? new MockProfileApi() : new HttpProfileService(),
  adminService: new MockAdminService(),
  templateService: isMock ? new MockTemplateService() : new HttpTemplateService(),
  notificationService: isMock ? new MockNotificationApi() : new HttpNotificationService(),
}

export const workflowService = container.workflowService
export const guestService = container.guestService
export const profileService = container.profileService
export const adminService = container.adminService
export const templateService = container.templateService
export const notificationService = container.notificationService