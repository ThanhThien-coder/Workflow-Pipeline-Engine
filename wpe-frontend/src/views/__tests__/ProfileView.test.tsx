// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import ProfileView from '../ProfileView'
import { useProfileStore } from '../../store/useProfileStore'
import { ApiError } from '../../services/http/ApiError'
import { ProfileError, type ProfileErrorCode } from '../../types/profile.types'

/** A5 — ProfileView hiện câu báo lỗi đúng cho lỗi từ backend thật (ApiError) và lỗi EMAIL_TAKEN. */
describe('ProfileView: xử lý lỗi', () => {
  const original = useProfileStore.getState()

  afterEach(() => {
    cleanup()
    useProfileStore.setState(original, true)
  })

  it('tải hồ sơ lỗi mạng (ApiError): hiện message của ApiError, không phải câu chung chung', async () => {
    useProfileStore.setState({
      profile: null,
      loadProfile: () =>
        Promise.reject(new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'Không kết nối được tới máy chủ.' })),
    })
    render(<ProfileView />)
    expect(await screen.findByText('Không kết nối được tới máy chủ.')).toBeTruthy()
  })

  it('ProfileError EMAIL_TAKEN: hiện câu báo email đã có người dùng', async () => {
    useProfileStore.setState({
      profile: null,
      loadProfile: () => Promise.reject(new ProfileError('EMAIL_TAKEN' as ProfileErrorCode)),
    })
    render(<ProfileView />)
    expect(await screen.findByText('This email is already used by another account.')).toBeTruthy()
  })
})
