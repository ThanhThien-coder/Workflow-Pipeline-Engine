import type {
  ChangePasswordCommand,
  DeleteAccountCommand,
  ProfileDto,
  ProfilePrivacyDto,
  ProfileProjectDto,
  UpdateProfileCommand,
} from '../../types/profile.types'

/** Rejects with ProfileError for validation / business errors. */
export interface IProfileService {
  /** GET    /users/me/profile */
  getMyProfile(): Promise<ProfileDto>
  /** PUT    /users/me/profile */
  updateProfile(cmd: UpdateProfileCommand): Promise<ProfileDto>
  /** POST   /users/me/avatar  (multipart/form-data, png|jpeg|webp, max 2 MB) */
  uploadAvatar(file: File): Promise<ProfileDto>
  /** DELETE /users/me/avatar */
  removeAvatar(): Promise<ProfileDto>
  /** POST   /users/me/password */
  changePassword(cmd: ChangePasswordCommand): Promise<void>
  /** PATCH  /users/me/projects/{projectId}  { isPublic } */
  setProjectPublic(projectId: string, isPublic: boolean): Promise<ProfileProjectDto>
  /** PUT    /users/me/privacy */
  updatePrivacy(cmd: ProfilePrivacyDto): Promise<ProfilePrivacyDto>
  /** POST   /users/me/deactivate  (reversible: signing in again reactivates) */
  deactivateAccount(): Promise<void>
  /** DELETE /users/me  { confirmation: "DELETE" }  (permanent) */
  deleteAccount(cmd: DeleteAccountCommand): Promise<void>
}
