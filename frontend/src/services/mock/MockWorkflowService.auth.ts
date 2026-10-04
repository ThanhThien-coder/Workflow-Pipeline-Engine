import type {
  AuthCredentialsDto,
  AuthResponseDto,
  RegisterUserCommand,
  UserDto,
} from '../../types/auth.types'

const DEFAULT_USER: UserDto = {
  id: 1,
  username: 'alex.kim',
  email: 'alex.kim@pipeline.engine',
  systemRole: 'ADMIN',
}

export class MockAuthApi {
  private currentUser: UserDto = DEFAULT_USER

  async login(credentials: AuthCredentialsDto): Promise<AuthResponseDto> {
    await new Promise((resolve) => setTimeout(resolve, 700))

    const username = credentials.identifier.includes('@')
      ? credentials.identifier.split('@')[0]
      : credentials.identifier

    const email = credentials.identifier.includes('@')
      ? credentials.identifier
      : `${credentials.identifier}@pipeline.engine`

    this.currentUser = {
      id: 1,
      username,
      email,
      systemRole: 'ADMIN',
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    return {
      accessToken: `mock-jwt-token-${btoa(JSON.stringify({ sub: username, role: 'ADMIN', exp: Date.now() + 86400000 }))}`,
      tokenType: 'Bearer',
      expiresAt,
      user: this.currentUser,
    }
  }

  async register(cmd: RegisterUserCommand): Promise<AuthResponseDto> {
    await new Promise((resolve) => setTimeout(resolve, 700))

    const username = cmd.fullName.toLowerCase().replace(/\s+/g, '.')
    this.currentUser = {
      id: Date.now(),
      username,
      email: cmd.email,
      systemRole: 'ADMIN',
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    return {
      accessToken: `mock-jwt-token-${btoa(JSON.stringify({ sub: username, org: cmd.workspaceName, exp: Date.now() + 86400000 }))}`,
      tokenType: 'Bearer',
      expiresAt,
      user: this.currentUser,
    }
  }

  async getCurrentUser(): Promise<UserDto> {
    await new Promise((resolve) => setTimeout(resolve, 100))
    return this.currentUser
  }

  async logout(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}
