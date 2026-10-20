import React, { useState, useCallback } from 'react'
import type { GraphNodeMap } from '../../types/workflow.types'
import { MindmapTree } from './MindmapTree'
import { AddGhostModal } from './AddGhostModal'
import { AddRootTaskModal } from './AddRootTaskModal'
import { useWorkflowStore } from '../../store/useWorkflowStore'
import { useWorkflowService } from '../../services/workflow/WorkflowContext'

export interface MicroGraphTreeProps {
  phaseId: string
  nodes?: GraphNodeMap
  selectedId?: string | null
  onSelect?: (id: string) => void
  onDeleteNode?: (id: string) => void
  onUpdateNodes?: (update: (nodes: GraphNodeMap) => GraphNodeMap) => void
}

export function MicroGraphTree({
  phaseId,
  nodes: externalNodes,
  selectedId: externalSelectedId,
  onSelect: externalOnSelect,
  onDeleteNode,
  onUpdateNodes,
}: MicroGraphTreeProps) {
  const store = useWorkflowStore()
  const workflowService = useWorkflowService()

  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null)
  const [isGhostModalOpen, setIsGhostModalOpen] = useState(false)
  const [isRootTaskModalOpen, setIsRootTaskModalOpen] = useState(false)
  const [targetAnchorId, setTargetAnchorId] = useState<string | undefined>(undefined)

  const selectedId = externalSelectedId !== undefined ? externalSelectedId : internalSelectedId
  const handleSelect = externalOnSelect || setInternalSelectedId

  const currentNodes = externalNodes || store.trees[phaseId] || {}

  const handleOpenAddGhost = useCallback((anchorId?: string) => {
    setTargetAnchorId(anchorId || selectedId || undefined)
    setIsGhostModalOpen(true)
  }, [selectedId])

  const handleOpenAddRootTask = useCallback(() => {
    setIsRootTaskModalOpen(true)
  }, [])

  const handleAttachGhost = useCallback(
    async (payload: { sourcePhaseId: string; sourceTaskId: string; targetTaskId: string }) => {
      await workflowService.attachGhostNode(phaseId, payload)
      setIsGhostModalOpen(false)
    },
    [workflowService, phaseId]
  )

  const handleCreateRootTask = useCallback(
    async (title: string) => {
      await workflowService.addRootTask(phaseId, { title })
      setIsRootTaskModalOpen(false)
    },
    [workflowService, phaseId]
  )

  const handleUpdateNodes = useCallback(
    (update: (nodes: GraphNodeMap) => GraphNodeMap) => {
      if (onUpdateNodes) {
        onUpdateNodes(update)
      } else {
        store.updateTree(phaseId, update)
      }
    },
    [onUpdateNodes, store, phaseId]
  )

  const handleDelete = useCallback(
    (id: string) => {
      if (onDeleteNode) {
        onDeleteNode(id)
      } else {
        store.deleteNode(phaseId, id)
      }
      if (selectedId === id) {
        handleSelect('')
      }
    },
    [onDeleteNode, store, phaseId, selectedId, handleSelect]
  )

  return (
    <div className="relative w-full h-full min-h-[400px] overflow-hidden select-none bg-slate-50/50 dark:bg-slate-950/20">
      <MindmapTree
        nodes={currentNodes}
        selectedId={selectedId}
        onSelect={handleSelect}
        onDelete={handleDelete}
        onUpdateNodes={handleUpdateNodes}
        onAddGhost={(pos) => handleOpenAddGhost(pos?.anchorId)}
        onAddRootTask={handleOpenAddRootTask}
        phaseId={phaseId}
      />

      {/* Redesigned 3-Step Add Ghost Node Modal */}
      <AddGhostModal
        isOpen={isGhostModalOpen}
        onClose={() => setIsGhostModalOpen(false)}
        currentPhaseId={phaseId}
        anchorTaskId={targetAnchorId}
        onAttach={handleAttachGhost}
      />

      {/* Add Root Task Modal */}
      <AddRootTaskModal
        isOpen={isRootTaskModalOpen}
        onClose={() => setIsRootTaskModalOpen(false)}
        phaseId={phaseId}
        onCreated={handleCreateRootTask}
      />
    </div>
  )
}
