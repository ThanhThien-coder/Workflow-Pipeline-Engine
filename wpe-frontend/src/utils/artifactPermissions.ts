import type { ProjectArtifact } from '../types/artifact.types'

/**
 * Được sửa artifact không (khớp ArtifactService.updateArtifact ở backend):
 * Owner / Manager sửa mọi artifact, Collaborator chỉ sửa artifact mình đăng, Viewer không.
 * Chưa biết vai trò thì không khóa, backend vẫn chặn bằng 403.
 */
export function canEditArtifact(
  myRole: string | null | undefined,
  currentUserId: string | number | null | undefined,
  artifact: Pick<ProjectArtifact, 'uploadedBy'>,
): boolean {
  if (!myRole) return true
  if (myRole === 'OWNER' || myRole === 'MANAGER') return true
  if (myRole === 'COLLABORATOR') {
    return currentUserId != null && artifact.uploadedBy != null && String(artifact.uploadedBy) === String(currentUserId)
  }
  return false
}
