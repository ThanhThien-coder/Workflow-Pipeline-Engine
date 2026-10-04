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
}

export interface AuthResponseDto {
  accessToken: string
  tokenType: 'Bearer'
  expiresAt: string
  user: UserDto
}
