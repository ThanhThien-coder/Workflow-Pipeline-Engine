import type { Variants } from 'framer-motion'

export const ease = {
  out: [0.16, 1, 0.3, 1] as const,
  inOut: [0.65, 0, 0.35, 1] as const,
  editorial: [0.22, 1, 0.36, 1] as const,
  gentle: [0.25, 0.1, 0.25, 1] as const,
}

export const spring = {
  pill: { type: 'spring', stiffness: 420, damping: 34, mass: 0.9 } as const,
  card: { type: 'spring', stiffness: 260, damping: 24 } as const,
  magnet: { type: 'spring', stiffness: 180, damping: 14, mass: 0.6 } as const,
  gentle: { type: 'spring', stiffness: 120, damping: 20 } as const,
}

export const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
}

export const itemVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 24,
    filter: 'blur(6px)',
  },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 0.7,
      ease: ease.out,
    },
  },
}

/* ───────────────────────────────────────────────────────────
   Editorial & Locomotive-inspired motion tokens
   - Soft inertia reveals
   - Masked text elevation
   - Subtle depth scaling
   ─────────────────────────────────────────────────────────── */
export const editorialStaggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.06,
    },
  },
}

export const editorialTextReveal: Variants = {
  hidden: {
    opacity: 0,
    y: 36,
    filter: 'blur(8px)',
  },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 0.8,
      ease: ease.out,
    },
  },
}

export const cardParallaxEnter: Variants = {
  hidden: {
    opacity: 0,
    y: 38,
    scale: 0.97,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.75,
      ease: ease.editorial,
    },
  },
}

export const badgePop: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.92,
    y: 12,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: ease.out,
    },
  },
}

export const maskRevealVariants: Variants = {
  hidden: {
    clipPath: 'inset(100% 0% 0% 0%)',
    opacity: 0,
    scale: 1.04,
  },
  visible: {
    clipPath: 'inset(0% 0% 0% 0%)',
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.9,
      ease: ease.out,
    },
  },
}

