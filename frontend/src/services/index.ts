import type { IWorkflowService } from '../types/services'
import { ApiWorkflowService } from './apiWorkflowService'
import { MockWorkflowService } from './mockWorkflowService'
const useMock = import.meta.env.VITE_USE_MOCK !== 'false'
export const workflowService: IWorkflowService = useMock ? new MockWorkflowService() : new ApiWorkflowService()
