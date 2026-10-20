import { useId, type FC, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { spring } from '../../lib/motion'

export interface TabItem {
  id: string
  label: string
  icon?: ReactNode
  badge?: string
}

export interface SmoothTabSwitcherProps {
  tabs: TabItem[]
  activeTab: string
  onChange: (id: string) => void
  className?: string
  layoutId?: string
}

export const SmoothTabSwitcher: FC<SmoothTabSwitcherProps> = ({
  tabs,
  activeTab,
  onChange,
  className,
  layoutId,
}) => {
  const generatedId = useId()
  const uid = layoutId || generatedId

  return (
    <div
      role="tablist"
      className={clsx(
        'relative inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-mp-n-200 bg-white/80 p-1.5 shadow-sm backdrop-blur-md no-scrollbar',
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={clsx(
              'relative z-10 flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-xs sm:text-sm font-medium transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-mp-purple-100',
              isActive
                ? 'text-mp-purple-150 font-semibold'
                : 'text-mp-n-600 hover:text-mp-ink'
            )}
          >
            {tab.icon && <span className="shrink-0">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge && (
              <span
                className={clsx(
                  'rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase',
                  isActive
                    ? 'bg-mp-purple-100/15 text-mp-purple-150'
                    : 'bg-mp-n-100 text-mp-n-500'
                )}
              >
                {tab.badge}
              </span>
            )}

            {/* Sliding Pill Indicator */}
            {isActive && (
              <motion.span
                layoutId={`${uid}-pill`}
                transition={spring.pill}
                className="absolute inset-0 -z-10 rounded-full bg-mp-purple-20 border border-mp-purple-100/25 shadow-sm"
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
