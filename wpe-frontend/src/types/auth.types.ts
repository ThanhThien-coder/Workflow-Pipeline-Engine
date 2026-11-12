export interface AuthCredentialsDto {
  identifier: string
  password: string
  rememberMe: boolean
}

export interface RegisterUserCommand {
  fullName: string
  email: string
  password: string
  workspaceName: string
}

export interface UserDto {
  id: number | string
  username: string
  email: string
  systemRole: 'ADMIN' | 'USER'
  avatarUrl?: string | null
  /** Tên hiển thị (AuthResponse.user.name của backend). Mock không có. */
  name?: string | null
}

export interface AuthResponseDto {
  accessToken: string
  tokenType: 'Bearer'
  expiresAt: string
  /** A4: refresh token "rt_..." của backend (dùng 1 lần, phải lưu đè sau mỗi lần refresh). Mock không có. */
  refreshToken?: string
  user: UserDto
}
