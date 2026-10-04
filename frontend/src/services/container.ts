import { MockWorkflowService } from './MockWorkflowService'
import type { IWorkflowService } from './contracts/IWorkflowService'

export const workflowService: IWorkflowService = new MockWorkflowService()
