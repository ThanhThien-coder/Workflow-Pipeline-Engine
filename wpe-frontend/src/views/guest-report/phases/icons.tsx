import type { GuestArtifactKind } from '../../../types/guest.types'

export const PHASE_ICON_PATHS = {
  chev: ['M9 6l6 6-6 6'],
  clip: ['M21 12l-8.5 8.5a5 5 0 01-7-7L14 5a3.5 3.5 0 015 5l-8.5 8.5a2 2 0 01-3-3L15 8'],
  lock: ['M6 11h12v10H6z', 'M8 11V7a4 4 0 018 0v4'],
  msg: ['M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z'],
  minus: ['M5 12h14'],
  plus: ['M12 5v14', 'M5 12h14'],
} as const

export const ARTIFACT_ICON_PATHS: Record<GuestArtifactKind, readonly string[]> = {
  PR: [
    'M6 3v12',
    'M18 9a3 3 0 100-6 3 3 0 000 6z',
    'M6 21a3 3 0 100-6 3 3 0 000 6z',
    'M18 9a9 9 0 01-9 9',
  ],
  DOCS: ['M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z', 'M14 3v6h6'],
  FIGMA: ['M12 20h9', 'M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z'],
  SWAGGER: ['M8 6l-6 6 6 6', 'M16 6l6 6-6 6'],
  OTHER_LINK: [
    'M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1',
    'M14 11a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1',
  ],
}

export function PhaseIcon({
  paths,
  className = 'h-4 w-4',
}: {
  paths: readonly string[]
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  )
}
