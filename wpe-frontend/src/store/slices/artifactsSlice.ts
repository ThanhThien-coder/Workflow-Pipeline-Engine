import type { IWorkflowService } from '../../services/contracts/IWorkflowService'
import { workflowService } from '../../services/container'
import { isApiError } from '../../services/http/ApiError'
import type { ProjectArtifact } from '../../types/artifact.types'
import type { LoadStatus } from './overviewSlice'

/**
 * Artifact (tài nguyên) của dự án đang mở: nút Artifacts trên Workflow, drawer, Settings → Resources.
 * Dữ liệu chỉ lấy từ service (chế độ API: backend; chế độ mock: MockWorkflowService).
 * Ghi xong ở service mới đổi danh sách; lỗi thì ném để giao diện báo.
 */
export interface ArtifactsSlice {
  artifacts: {
    projectId: string | null
    items: ProjectArtifact[]
    status: LoadStatus
    error: string | null
    isDrawerOpen: boolean
    loadArtifacts: (projectId: string) => Promise<void>
    addArtifact: (projectId: string, input: { name: string; url: string }) => Promise<ProjectArtifact>
    /** Sửa tên và link. Ghi xong ở service mới thay bản trong danh sách. */
    updateArtifact: (projectId: string, artifactId: string, input: { name: string; url: string }) => Promise<ProjectArtifact>
    removeArtifact: (projectId: string, artifactId: string) => Promise<void>
    setGuestVisibility: (projectId: string, artifactId: string, visible: boolean) => Promise<void>
    openDrawer: () => void
    closeDrawer: () => void
    toggleDrawer: () => void
  }
}

type ArtifactsSetter = (update: (state: ArtifactsSlice) => Partial<ArtifactsSlice>) => void

function errorMessage(error: unknown, fallback: string): string {
  return isApiError(error) || error instanceof Error ? error.message : fallback
}

export const createArtifactsSlice = (
  set: ArtifactsSetter,
  get: () => ArtifactsSlice,
  service: IWorkflowService = workflowService,
): ArtifactsSlice => {
  const patch = (
    changes: Partial<Pick<ArtifactsSlice['artifacts'], 'projectId' | 'items' | 'status' | 'error' | 'isDrawerOpen'>>,
  ) => set((state) => ({ artifacts: { ...state.artifacts, ...changes } }))
  const isCurrent = (projectId: string) => get().artifacts.projectId === projectId

  return {
    artifacts: {
      projectId: null,
      items: [],
      status: 'idle',
      error: null,
      isDrawerOpen: false,

      loadArtifacts: async (projectId) => {
        const switching = !isCurrent(projectId)
        patch({ projectId, status: 'loading', error: null, ...(switching ? { items: [] } : {}) })
        try {
          const items = await service.getProjectArtifacts(projectId)
          if (!isCurrent(projectId)) return
          patch({ items, status: 'ready' })
        } catch (error) {
          if (!isCurrent(projectId)) return
          patch({ items: [], status: 'error', error: errorMessage(error, 'Could not load resources') })
        }
      },

      addArtifact: async (projectId, input) => {
        const created = await service.createArtifact(projectId, {
          name: input.name.trim(),
          url: input.url.trim(),
          isInRepository: true,
        })
        if (isCurrent(projectId)) {
          patch({ items: [created, ...get().artifacts.items.filter((a) => String(a.id) !== String(created.id))] })
        }
        return created
      },

      updateArtifact: async (projectId, artifactId, input) => {
        const updated = await service.updateArtifact(projectId, artifactId, {
          name: input.name.trim(),
          url: input.url.trim(),
        })
        if (isCurrent(projectId)) {
          patch({
            items: get().artifacts.items.map((a) => (String(a.id) === String(artifactId) ? updated : a)),
          })
        }
        return updated
      },

      removeArtifact: async (projectId, artifactId) => {
        await service.deleteArtifact(projectId, artifactId)
        if (isCurrent(projectId)) {
          patch({ items: get().artifacts.items.filter((a) => String(a.id) !== String(artifactId)) })
        }
      },

      setGuestVisibility: async (projectId, artifactId, visible) => {
        const previous = get().artifacts.items.find((a) => String(a.id) === String(artifactId))
        const prevVisible = previous?.isPublicForGuest
        if (isCurrent(projectId) && previous) {
          patch({
            items: get().artifacts.items.map((a) =>
              String(a.id) === String(artifactId) ? { ...a, isPublicForGuest: visible } : a,
            ),
          })
        }
        try {
          const updated = await service.setArtifactGuestVisibility(projectId, artifactId, visible)
          if (isCurrent(projectId) && updated) {
            patch({
              items: get().artifacts.items.map((a) =>
                String(a.id) === String(artifactId) ? updated : a,
              ),
            })
          }
        } catch (error) {
          if (isCurrent(projectId) && prevVisible !== undefined) {
            patch({
              items: get().artifacts.items.map((a) =>
                String(a.id) === String(artifactId) ? { ...a, isPublicForGuest: prevVisible } : a,
              ),
            })
          }
          throw error
        }
      },

      openDrawer: () => set((state) => ({ artifacts: { ...state.artifacts, isDrawerOpen: true } })),
      closeDrawer: () => set((state) => ({ artifacts: { ...state.artifacts, isDrawerOpen: false } })),
      toggleDrawer: () => set((state) => ({ artifacts: { ...state.artifacts, isDrawerOpen: !state.artifacts.isDrawerOpen } })),
    },
  }
}
