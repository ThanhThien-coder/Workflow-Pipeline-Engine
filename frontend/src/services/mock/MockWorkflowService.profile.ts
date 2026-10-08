import type { IProfileService } from '../contracts/IProfileService'
import { ProfileError } from '../../types/profile.types'
import type {
  ChangePasswordCommand,
  DeleteAccountCommand,
  ProfileDto,
  ProfilePrivacyDto,
  ProfileProjectDto,
  UpdateProfileCommand,
} from '../../types/profile.types'
import { MockConfig } from './MockConfig'

const KEY = 'wpe_mock_profile_v2'
const MAX_AVATAR_BYTES = 2 * 1024 * 1024

const SEED: ProfileDto = {
  userId: 'u_sarah',
  displayName: 'Sarah Chen',
  email: 'sarah.chen@example.com',
  title: 'Project Lead',
  bio: 'Leading the Marketing Campaign Q4 pipeline. Interested in workflow design and API architecture.',
  avatarUrl: null,
  skills: ['Project Management', 'System Design', 'React'],
  links: { github: 'https://github.com/sarahchen', linkedin: '', website: '' },
  privacy: { visibility: 'members', showEmail: false, showStats: true },
  projects: [
    { projectId: '1', name: 'Marketing Campaign Q4', phaseLabel: 'Phase 2 · Published', role: 'Owner', contribution: 'Planned the pipeline and approved schema changes.', isPublic: true, stats: { tasksDone: 14, tasksTotal: 18, onTimePct: 86 } },
    { projectId: '2', name: 'E-commerce Revamp', phaseLabel: 'Phase 1 · Draft', role: 'Backend Developer', contribution: 'Designed the cart and payment schema.', isPublic: false, stats: { tasksDone: 6, tasksTotal: 9, onTimePct: 78 } },
    { projectId: '3', name: 'OOAD Library System', phaseLabel: 'Completed', role: 'Member', contribution: 'Wrote use cases and the class diagram.', isPublic: true, stats: { tasksDone: 11, tasksTotal: 11, onTimePct: 100 } },
  ],
  recentActivity: [
    { id: 'a1', text: 'Submitted PR for WPE-012', ago: '3 days ago' },
    { id: 'a2', text: 'Approved schema for WPE-009', ago: '3 days ago' },
    { id: 'a3', text: 'Made "OOAD Library System" public', ago: '1 week ago' },
    { id: 'a4', text: 'Flagged overdue warning on WPE-014', ago: '1 week ago' },
    { id: 'a5', text: 'Invited Jamie Doe to Marketing Campaign Q4', ago: '2 weeks ago' },
    { id: 'a6', text: 'Published the pipeline for Phase 2', ago: '2 weeks ago' },
    { id: 'a7', text: 'Created project E-commerce Revamp', ago: '3 weeks ago' },
  ],
}

const okLink = (v: string, host?: string): boolean => {
  if (!v) return true
  try {
    const u = new URL(v)
    return /^https?:$/.test(u.protocol) && v.length <= 200 && (!host || u.hostname === host || u.hostname.endsWith('.' + host))
  } catch {
    return false
  }
}

const readAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Cannot read file'))
    reader.readAsDataURL(file)
  })

export class MockProfileApi implements IProfileService {
  private state: ProfileDto = this.restore()

  private restore(): ProfileDto {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) return { ...SEED, ...(JSON.parse(raw) as Partial<ProfileDto>) }
    } catch {
      /* ignore */
    }
    return JSON.parse(JSON.stringify(SEED)) as ProfileDto
  }

  private async tick(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, MockConfig.latencyMs))
    if (MockConfig.fakeError500) throw new Error('Mock 500: Internal Server Error')
  }

  private commit(next: ProfileDto): ProfileDto {
    this.state = next
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      /* quota exceeded: keep in memory only */
    }
    return next
  }

  async getMyProfile(): Promise<ProfileDto> {
    await this.tick()
    return this.state
  }

  async updateProfile(cmd: UpdateProfileCommand): Promise<ProfileDto> {
    await this.tick()
    const name = cmd.displayName.trim()
    const okEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cmd.email.trim())
    const okSkills = cmd.skills.length <= 12 && cmd.skills.every((s) => s.length > 0 && s.length <= 24)
    if (name.length < 2 || name.length > 60 || !okEmail || cmd.bio.length > 280 || cmd.title.length > 60 || !okSkills) {
      throw new ProfileError('VALIDATION')
    }
    const links = { github: cmd.links.github.trim(), linkedin: cmd.links.linkedin.trim(), website: cmd.links.website.trim() }
    if (!okLink(links.github, 'github.com') || !okLink(links.linkedin, 'linkedin.com') || !okLink(links.website)) throw new ProfileError('INVALID_LINK')
    return this.commit({ ...this.state, displayName: name, email: cmd.email.trim(), title: cmd.title.trim(), bio: cmd.bio.trim(), skills: [...cmd.skills], links })
  }

  async uploadAvatar(file: File): Promise<ProfileDto> {
    await this.tick()
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new ProfileError('UNSUPPORTED_TYPE')
    if (file.size > MAX_AVATAR_BYTES) throw new ProfileError('FILE_TOO_LARGE')
    return this.commit({ ...this.state, avatarUrl: await readAsDataUrl(file) })
  }

  async removeAvatar(): Promise<ProfileDto> {
    await this.tick()
    return this.commit({ ...this.state, avatarUrl: null })
  }

  async changePassword(cmd: ChangePasswordCommand): Promise<void> {
    await this.tick()
    if (!cmd.currentPassword) throw new ProfileError('INVALID_PASSWORD')
    if (cmd.newPassword.length < 8 || !/\d/.test(cmd.newPassword)) throw new ProfileError('WEAK_PASSWORD')
  }

  async setProjectPublic(projectId: string, isPublic: boolean): Promise<ProfileProjectDto> {
    await this.tick()
    const found = this.state.projects.find((p) => p.projectId === projectId)
    if (!found) throw new ProfileError('VALIDATION')
    const updated = { ...found, isPublic }
    this.commit({ ...this.state, projects: this.state.projects.map((p) => (p.projectId === projectId ? updated : p)) })
    return updated
  }

  async deactivateAccount(): Promise<void> {
    await this.tick()
  }

  async deleteAccount(cmd: DeleteAccountCommand): Promise<void> {
    await this.tick()
    if (cmd.confirmation !== 'DELETE') throw new ProfileError('CONFIRMATION_MISMATCH')
    try {
      localStorage.removeItem(KEY)
    } catch {
      /* ignore */
    }
    this.state = JSON.parse(JSON.stringify(SEED)) as ProfileDto
  }

  async updatePrivacy(cmd: ProfilePrivacyDto): Promise<ProfilePrivacyDto> {
    await this.tick()
    this.commit({ ...this.state, privacy: { ...cmd } })
    return cmd
  }
}
