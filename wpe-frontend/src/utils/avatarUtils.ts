export function getSavedAvatar(nameOrId?: string): string | null {
  try {
    const target = nameOrId?.trim().toLowerCase()

    // 1. Check Profile storage
    const rawProfile = localStorage.getItem('wpe_mock_profile_v2')
    if (rawProfile) {
      const parsed = JSON.parse(rawProfile) as { displayName?: string; userId?: string; avatarUrl?: string | null }
      if (parsed.avatarUrl) {
        if (!target) return parsed.avatarUrl
        const pName = parsed.displayName?.trim().toLowerCase()
        const pId = parsed.userId?.trim().toLowerCase()
        if (
          target === pName ||
          target === pId ||
          (target === 'sarah chen' && (!pName || pName === 'sarah chen')) ||
          (target === '2' && (!pId || pId === '2' || pId === 'u_sarah')) ||
          target === 'sc'
        ) {
          return parsed.avatarUrl
        }
      }
    }

    // 2. Check Auth user storage
    const rawUser = localStorage.getItem('wpe_auth_user')
    if (rawUser) {
      const parsed = JSON.parse(rawUser) as { username?: string; id?: string; avatarUrl?: string | null; email?: string }
      if (parsed.avatarUrl) {
        if (!target) return parsed.avatarUrl
        const uName = parsed.username?.trim().toLowerCase()
        const uId = parsed.id?.trim().toLowerCase()
        if (
          target === uName ||
          target === uId ||
          (target === 'sarah chen' && (uName === 'sarah chen' || !uName)) ||
          (target === '2' && (uId === '2' || !uId)) ||
          target === 'sc'
        ) {
          return parsed.avatarUrl
        }
      }
    }

    // 3. Check simple avatar key
    const directAvatar = localStorage.getItem('wpe_user_avatar')
    if (directAvatar) {
      if (!target || target === 'sarah chen' || target === '2' || target === 'u_sarah' || target === 'sc') {
        return directAvatar
      }
    }
  } catch {
    // Ignore storage parse errors
  }

  return null
}

