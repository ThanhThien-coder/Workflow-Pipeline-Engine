// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import ProfileView from '../ProfileView'
import { useProfileStore } from '../../store/useProfileStore'
import { useWorkflowStore } from '../../store/useWorkflowStore'
import type { ProfileDto } from '../../types/profile.types'

const mockProfile: ProfileDto = {
  userId: '1',
  displayName: 'Alex Kim',
  email: 'alex@wpe.io',
  title: 'Backend Engineer',
  bio: 'Building DAG engines',
  avatarUrl: null,
  skills: ['TypeScript', 'Spring Boot'],
  links: { github: 'https://github.com/alex', linkedin: '', website: '' },
  privacy: { visibility: 'members', showEmail: false, showStats: true },
  projects: [
    {
      projectId: '10',
      name: 'Workflow Core',
      phaseLabel: 'Phase 1',
      role: 'OWNER',
      contribution: 'Lead Architect',
      isPublic: true,
      stats: { tasksDone: 5, tasksTotal: 10, onTimePct: 90 },
    },
  ],
  recentActivity: [],
}

describe('ProfileView Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useProfileStore.setState({
      profile: mockProfile,
      loading: false,
      error: null,
      loadProfile: vi.fn().mockResolvedValue(mockProfile),
      updateProfileData: vi.fn().mockResolvedValue(mockProfile),
      changePassword: vi.fn().mockResolvedValue(undefined),
      deleteAccount: vi.fn().mockResolvedValue(undefined),
      deactivateAccount: vi.fn().mockResolvedValue(undefined),
    })
    useWorkflowStore.setState((s) => ({
      auth: {
        ...s.auth,
        currentUser: { id: 1, username: 'alex', email: 'alex@wpe.io', systemRole: 'USER' },
      },
    }))
  })

  afterEach(() => {
    cleanup()
  })

  it('không còn chữ "chưa hỗ trợ" trên giao diện', () => {
    render(<ProfileView />)
    expect(screen.queryByText(/chưa hỗ trợ/i)).toBeNull()
    expect(document.body.textContent).not.toContain('chưa hỗ trợ')
  })

  it('nút Save bật khi sửa form (dirty)', async () => {
    render(<ProfileView />)
    const input = await screen.findByLabelText(/Display name/i)
    await waitFor(() => {
      expect((input as HTMLInputElement).value).toBe('Alex Kim')
    })

    const saveBtn = screen.getByRole('button', { name: /Save changes/i }) as HTMLButtonElement
    expect(saveBtn.disabled).toBe(true)

    fireEvent.change(input, { target: { value: 'New Name' } })
    expect((saveBtn as HTMLButtonElement).disabled).toBe(false)
  })

  it('ô mật khẩu nhập được trong tab Account & Security', async () => {
    render(<ProfileView />)

    const tabBtn = await screen.findByRole('button', { name: /Account & Security/i })
    fireEvent.click(tabBtn)

    const curPw = (await screen.findByLabelText(/Current password/i)) as HTMLInputElement
    const newPw = (await screen.findByLabelText(/^New password/i)) as HTMLInputElement
    const confirmPw = (await screen.findByLabelText(/Confirm new password/i)) as HTMLInputElement

    expect(curPw.disabled).toBe(false)
    expect(newPw.disabled).toBe(false)
    expect(confirmPw.disabled).toBe(false)

    fireEvent.change(curPw, { target: { value: 'example-current-pass-1' } })
    fireEvent.change(newPw, { target: { value: 'example-new-pass-2' } })
    fireEvent.change(confirmPw, { target: { value: 'example-new-pass-2' } })

    expect(curPw.value).toBe('example-current-pass-1')
    expect(newPw.value).toBe('example-new-pass-2')
    expect(confirmPw.value).toBe('example-new-pass-2')
  })

  it('nút Delete mở hộp xác nhận', async () => {
    render(<ProfileView />)

    const tabBtn = await screen.findByRole('button', { name: /Account & Security/i })
    fireEvent.click(tabBtn)

    const deleteBtn = (await screen.findByRole('button', { name: /^Delete$/i })) as HTMLButtonElement
    expect(deleteBtn.disabled).toBe(false)

    fireEvent.click(deleteBtn)

    expect(await screen.findByText(/Type "DELETE" to confirm:/i)).toBeTruthy()
    const confirmBtn = (await screen.findByRole('button', { name: /Confirm/i })) as HTMLButtonElement
    expect(confirmBtn.disabled).toBe(true)

    const confirmInput = await screen.findByPlaceholderText('DELETE')
    fireEvent.change(confirmInput, { target: { value: 'DELETE' } })
    expect(confirmBtn.disabled).toBe(false)
  })
})
