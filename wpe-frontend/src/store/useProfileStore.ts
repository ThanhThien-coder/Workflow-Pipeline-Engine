import { create } from 'zustand'
import { profileService } from '../services/container'
import type {
  ChangePasswordCommand,
  DeleteAccountCommand,
  ProfileDto,
  ProfilePrivacyDto,
  ProfileProjectDto,
  UpdateProfileCommand,
} from '../types/profile.types'

interface ProfileState {
  profile: ProfileDto | null
  loading: boolean
  error: unknown
  loadProfile: () => Promise<ProfileDto>
  updateAvatar: (url: string | null) => void
  uploadAvatar: (file: File) => Promise<ProfileDto>
  removeAvatar: () => Promise<ProfileDto>
  updateProfileData: (data: UpdateProfileCommand) => Promise<ProfileDto>
  setProjectPublic: (projectId: string, isPublic: boolean) => Promise<ProfileProjectDto>
  updatePrivacy: (data: ProfilePrivacyDto) => Promise<ProfilePrivacyDto>
  changePassword: (cmd: ChangePasswordCommand) => Promise<void>
  deactivateAccount: () => Promise<void>
  deleteAccount: (cmd: DeleteAccountCommand) => Promise<void>
  reset: () => void
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: null,
  loading: false,
  error: null,
  reset: () => {
    set({ profile: null, loading: false, error: null })
  },
  loadProfile: async () => {
    set({ loading: true, error: null })
    try {
      const profile = await profileService.getMyProfile()
      set({ profile, loading: false })
      return profile
    } catch (error) {
      set({ loading: false, error })
      throw error
    }
  },
  updateAvatar: (url) => {
    const profile = get().profile
    if (profile) set({ profile: { ...profile, avatarUrl: url } })
  },
  uploadAvatar: async (file) => {
    try {
      const profile = await profileService.uploadAvatar(file)
      set({ profile, error: null })
      return profile
    } catch (error) {
      set({ error })
      throw error
    }
  },
  removeAvatar: async () => {
    try {
      const profile = await profileService.removeAvatar()
      set({ profile, error: null })
      return profile
    } catch (error) {
      set({ error })
      throw error
    }
  },
  updateProfileData: async (data) => {
    try {
      const profile = await profileService.updateProfile(data)
      set({ profile, error: null })
      return profile
    } catch (error) {
      set({ error })
      throw error
    }
  },
  setProjectPublic: async (projectId, isPublic) => {
    try {
      const project = await profileService.setProjectPublic(projectId, isPublic)
      const profile = get().profile
      if (profile) {
        set({
          profile: {
            ...profile,
            projects: profile.projects.map((item) => item.projectId === projectId ? project : item),
          },
          error: null,
        })
      }
      return project
    } catch (error) {
      set({ error })
      throw error
    }
  },
  updatePrivacy: async (data) => {
    try {
      const privacy = await profileService.updatePrivacy(data)
      const profile = get().profile
      if (profile) set({ profile: { ...profile, privacy }, error: null })
      return privacy
    } catch (error) {
      set({ error })
      throw error
    }
  },
  changePassword: async (cmd) => {
    try {
      await profileService.changePassword(cmd)
    } catch (error) {
      set({ error })
      throw error
    }
  },
  deactivateAccount: async () => {
    try {
      await profileService.deactivateAccount()
    } catch (error) {
      set({ error })
      throw error
    }
  },
  deleteAccount: async (cmd) => {
    try {
      await profileService.deleteAccount(cmd)
    } catch (error) {
      set({ error })
      throw error
    }
  },
}))
