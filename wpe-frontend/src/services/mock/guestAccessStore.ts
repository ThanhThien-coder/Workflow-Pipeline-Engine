export type GuestTokenStatus = 'active' | 'revoked' | 'expired'

const KEY = 'wpe_mock_guest_access'

type StoreMap = Record<string, GuestTokenStatus>
let memoryMap: StoreMap = {}

function readStore(): StoreMap {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(KEY)
      if (!raw) return memoryMap
      return JSON.parse(raw) as StoreMap
    }
  } catch {
    /* fallback to memory */
  }
  return memoryMap
}

function writeStore(map: StoreMap): void {
  memoryMap = map
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(KEY, JSON.stringify(map))
    }
  } catch {
    /* ignore storage errors */
  }
}

export const guestAccessStore = {
  get(token: string): GuestTokenStatus | undefined {
    return readStore()[token]
  },
  set(token: string, status: GuestTokenStatus): void {
    const map = { ...readStore(), [token]: status }
    writeStore(map)
  },
  clear(): void {
    memoryMap = {}
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(KEY)
      }
    } catch {
      /* ignore */
    }
  },
}
