export type ProfileErrorCode =
  | 'VALIDATION'
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_TYPE'
  | 'INVALID_PASSWORD'
  | 'WEAK_PASSWORD'
  | 'INVALID_LINK'
  | 'CONFIRMATION_MISMATCH'
  /** A5: email đã thuộc tài khoản khác (backend 409 EMAIL_TAKEN) */
  | 'EMAIL_TAKEN'

export class ProfileError extends Error {
  constructor(public readonly code: ProfileErrorCode) {
    super(code)
    this.name = 'ProfileError'
  }
}

export type ProfileVisibility = 'private' | 'members' | 'public'

export interface ProfileLinksDto {
  /** '' = not set. Must be http(s) URLs; github/linkedin must use their own domain */
  github: string
  linkedin: string
  website: string
}

export interface ProfilePrivacyDto {
  visibility: ProfileVisibility
  showEmail: boolean
  showStats: boolean
}

export interface ProfileProjectStats {
  tasksDone: number
  tasksTotal: number
  onTimePct: number
}

export interface ProfileProjectDto {
  projectId: string
  name: string
  phaseLabel: string
  role: string
  contribution: string
  /** Only public projects are shown on the public profile */
  isPublic: boolean
  stats: ProfileProjectStats
}

export interface ProfileActivityDto {
  id: string
  text: string
  ago: string
}

export interface ProfileDto {
  userId: string
  displayName: string
  email: string
  title: string
  bio: string
  /** null = no photo, UI shows initials */
  avatarUrl: string | null
  skills: readonly string[]
  links: ProfileLinksDto
  privacy: ProfilePrivacyDto
  projects: readonly ProfileProjectDto[]
  recentActivity: readonly ProfileActivityDto[]
}

export interface UpdateProfileCommand {
  displayName: string
  email: string
  title: string
  bio: string
  skills: readonly string[]
  links: ProfileLinksDto
}

export interface DeleteAccountCommand {
  /** Must equal the word DELETE */
  confirmation: string
}

export interface ChangePasswordCommand {
  currentPassword: string
  newPassword: string
}
