import React, { createContext, useContext, useMemo } from 'react'
import type { IWorkflowService } from './IWorkflowGraphService'
import { WorkflowService } from './WorkflowService'

const defaultWorkflowService = new WorkflowService()

export const WorkflowServiceContext = createContext<IWorkflowService>(defaultWorkflowService)

export const WorkflowServiceProvider: React.FC<{
  service?: IWorkflowService
  children: React.ReactNode
}> = ({ service, children }) => {
  const currentService = useMemo(() => service || defaultWorkflowService, [service])

  return (
    <WorkflowServiceContext.Provider value={currentService}>
      {children}
    </WorkflowServiceContext.Provider>
  )
}

export const useWorkflowService = (): IWorkflowService => {
  return useContext(WorkflowServiceContext)
}
