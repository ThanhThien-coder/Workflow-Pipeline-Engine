import { MockWorkflowService } from './mockWorkflowService'
import type { IWorkflowService } from './contracts/IWorkflowService'
import { MockGuestApi } from './mock/MockWorkflowService.guest'
import type { IGuestService } from './contracts/IGuestService'

export const workflowService: IWorkflowService = new MockWorkflowService()
export const guestService: IGuestService = new MockGuestApi()