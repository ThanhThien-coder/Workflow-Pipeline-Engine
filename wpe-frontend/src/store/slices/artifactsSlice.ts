import { produce } from 'immer'
import {
  type ProjectArtifact,
  INITIAL_PROJECT_ARTIFACTS,
} from '../../types/artifact.types'
import type { SettingsSlice } from './settingsSlice'

export interface ArtifactsSlice {
  artifacts: {
    items: ProjectArtifact[]
    isDrawerOpen: boolean
    loadArtifacts: (projectId?: string) => void
    addArtifact: (
      artifact: { title: string; url: string; createdBy?: string },
      projectId?: string,
    ) => ProjectArtifact
    removeArtifact: (id: string, projectId?: string) => void
    openDrawer: () => void
    closeDrawer: () => void
    toggleDrawer: () => void
  }
}

const getStorageKey = (projectId = '1') => `wpe_artifacts_${projectId}`

const getInitialItems = (projectId = '1'): ProjectArtifact[] => {
  if (typeof window === 'undefined') return INITIAL_PROJECT_ARTIFACTS
  try {
    const raw = localStorage.getItem(getStorageKey(projectId))
    if (raw) {
      const parsed = JSON.parse(raw) as ProjectArtifact[]
      if (Array.isArray(parsed)) return parsed
    }
  } catch (err) {
    console.warn('Failed to parse artifacts from localStorage:', err)
  }
  return INITIAL_PROJECT_ARTIFACTS
}

export const createArtifactsSlice = (
  set: (update: (state: ArtifactsSlice & Partial<SettingsSlice>) => ArtifactsSlice & Partial<SettingsSlice>) => void,
  get: () => ArtifactsSlice & Partial<SettingsSlice>,
): ArtifactsSlice => {
  return {
    artifacts: {
      items: getInitialItems('1'),
      isDrawerOpen: false,

      loadArtifacts: (projectId = '1') => {
        const items = getInitialItems(projectId)
        set((state) =>
          produce(state, (draft) => {
            draft.artifacts.items = items
          }),
        )
      },

      addArtifact: ({ title, url, createdBy }, projectId = '1') => {
        const newArtifact: ProjectArtifact = {
          id: Math.random().toString(36).substring(2, 9),
          title: title.trim(),
          url: url.trim(),
          createdAt: new Date().toLocaleDateString('en-US', {
            month: 'short',
            day: '2-digit',
            year: 'numeric',
          }),
          createdBy: createdBy || 'Owner',
        }

        set((state) =>
          produce(state, (draft) => {
            draft.artifacts.items.unshift(newArtifact)
            try {
              localStorage.setItem(
                getStorageKey(projectId),
                JSON.stringify(draft.artifacts.items),
              )
            } catch {
              // ignore storage errors
            }
          }),
        )

        // Audit log integration
        const addAudit = get().settings?.addMockAuditLog
        if (typeof addAudit === 'function') {
          addAudit({
            action: 'RESOURCE_ADDED',
            details: `Added new project resource: ${newArtifact.title}`,
            scope: 'Governance',
          })
        }

        return newArtifact
      },

      removeArtifact: (id: string, projectId = '1') => {
        const target = get().artifacts.items.find((item) => item.id === id)
        set((state) =>
          produce(state, (draft) => {
            draft.artifacts.items = draft.artifacts.items.filter(
              (item) => item.id !== id,
            )
            try {
              localStorage.setItem(
                getStorageKey(projectId),
                JSON.stringify(draft.artifacts.items),
              )
            } catch {
              // ignore storage errors
            }
          }),
        )

        if (target) {
          const addAudit = get().settings?.addMockAuditLog
          if (typeof addAudit === 'function') {
            addAudit({
              action: 'RESOURCE_REMOVED',
              details: `Removed project resource: ${target.title}`,
              scope: 'Governance',
            })
          }
        }
      },

      openDrawer: () => {
        set((state) =>
          produce(state, (draft) => {
            draft.artifacts.isDrawerOpen = true
          }),
        )
      },

      closeDrawer: () => {
        set((state) =>
          produce(state, (draft) => {
            draft.artifacts.isDrawerOpen = false
          }),
        )
      },

      toggleDrawer: () => {
        set((state) =>
          produce(state, (draft) => {
            draft.artifacts.isDrawerOpen = !draft.artifacts.isDrawerOpen
          }),
        )
      },
    },
  }
}
