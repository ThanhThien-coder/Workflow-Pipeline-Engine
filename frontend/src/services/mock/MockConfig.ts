export interface MockConfigState {
  latencyMs: number
  fakeError500: boolean
}

export const MockConfig: MockConfigState = {
  latencyMs: 150,
  fakeError500: false,
}

export async function mockDelay(customMs?: number): Promise<void> {
  if (MockConfig.fakeError500) {
    throw new Error('HTTP 500: Internal Server Error (Simulated by DevToolbar)')
  }
  const ms = customMs !== undefined ? customMs : MockConfig.latencyMs
  if (ms > 0) {
    await new Promise((resolve) => setTimeout(resolve, ms))
  }
}
