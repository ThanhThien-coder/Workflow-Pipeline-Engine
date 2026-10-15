export const buildGuestUrl = (token: string): string => {
  const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : ''
  return `${origin}/guest?token=${encodeURIComponent(token)}`
}
