import { useEffect } from 'react'
import { useWorkflowStore } from '../store/useWorkflowStore'
import type { ProjectArtifact } from '../types/artifact.types'

/** Artifact của một dự án (Settings → Resources). Tải khi mở, thêm / xóa qua service. */
export function useProjectArtifacts(projectId: string) {
  const artifacts = useWorkflowStore((state) => state.artifacts.items)
  const status = useWorkflowStore((state) => state.artifacts.status)
  const error = useWorkflowStore((state) => state.artifacts.error)
  const isDrawerOpen = useWorkflowStore((state) => state.artifacts.isDrawerOpen)
  const openDrawer = useWorkflowStore((state) => state.artifacts.openDrawer)
  const closeDrawer = useWorkflowStore((state) => state.artifacts.closeDrawer)
  const toggleDrawer = useWorkflowStore((state) => state.artifacts.toggleDrawer)
  const addArtifactStore = useWorkflowStore((state) => state.artifacts.addArtifact)
  const removeArtifactStore = useWorkflowStore((state) => state.artifacts.removeArtifact)
  const loadArtifacts = useWorkflowStore((state) => state.artifacts.loadArtifacts)

  useEffect(() => {
    void loadArtifacts(projectId)
  }, [projectId, loadArtifacts])

  return {
    artifacts,
    count: artifacts.length,
    status,
    error,
    isDrawerOpen,
    openDrawer,
    closeDrawer,
    toggleDrawer,
    addArtifact: (input: { name: string; url: string }): Promise<ProjectArtifact> => addArtifactStore(projectId, input),
    removeArtifact: (id: string): Promise<void> => removeArtifactStore(projectId, id),
    loadArtifacts: () => loadArtifacts(projectId),
  }
}
