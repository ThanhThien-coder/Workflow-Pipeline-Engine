export const buildGuestUrl = (token: string): string =>
  `https://pipeline.io/guest?token=${token.replace('gst_sec_', 'gst_')}`
