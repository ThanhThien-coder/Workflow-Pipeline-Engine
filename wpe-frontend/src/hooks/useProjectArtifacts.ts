import { useEffect } from 'react'
import { useWorkflowStore } from '../store/useWorkflowStore'
import type { ProjectArtifact } from '../types/artifact.types'

export function useProjectArtifacts(projectId = '1') {
  const artifacts = useWorkflowStore((state) => state.artifacts.items)
  const isDrawerOpen = useWorkflowStore((state) => state.artifacts.isDrawerOpen)
  const openDrawer = useWorkflowStore((state) => state.artifacts.openDrawer)
  const closeDrawer = useWorkflowStore((state) => state.artifacts.closeDrawer)
  const toggleDrawer = useWorkflowStore((state) => state.artifacts.toggleDrawer)
  const addArtifactStore = useWorkflowStore((state) => state.artifacts.addArtifact)
  const removeArtifactStore = useWorkflowStore((state) => state.artifacts.removeArtifact)
  const loadArtifacts = useWorkflowStore((state) => state.artifacts.loadArtifacts)

  useEffect(() => {
    loadArtifacts(projectId)
  }, [projectId, loadArtifacts])

  const addArtifact = (data: { title: string; url: string; createdBy?: string }): ProjectArtifact => {
    return addArtifactStore(data, projectId)
  }

  const removeArtifact = (id: string) => {
    removeArtifactStore(id, projectId)
  }

  return {
    artifacts,
    count: artifacts.length,
    isDrawerOpen,
    openDrawer,
    closeDrawer,
    toggleDrawer,
    addArtifact,
    removeArtifact,
    loadArtifacts: () => loadArtifacts(projectId),
  }
}
