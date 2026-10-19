import type { FC } from 'react'
import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'

export interface TabSliderItem<T extends string = string> {
  id: T
  label: string
  icon?: LucideIcon
  count?: number | string
}

export interface FloatingTabSliderProps<T extends string = string> {
  tabs: TabSliderItem<T>[]
  activeTab: T
  onChange: (tabId: T) => void
  layoutId?: string
  className?: string
}

export function FloatingTabSlider<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  layoutId = 'topbarTabPillSlider',
  className = '',
}: FloatingTabSliderProps<T>) {
  return (
    <nav
      className={`inline-flex items-center gap-1 rounded-2xl bg-slate-100/90 p-1 border border-slate-200/80 backdrop-blur-md shadow-xs ${className}`}
      aria-label="Navigation Tabs"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id
        const Icon = tab.icon

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`relative flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer select-none ${
              isActive
                ? 'text-blue-700'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            {/* Sliding Pill Indicator */}
            {isActive && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-xl bg-white shadow-sm border border-slate-200/60"
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              />
            )}

            {/* Icon */}
            {Icon && (
              <motion.span
                whileHover={{ scale: 1.15 }}
                className="relative z-10 flex items-center"
              >
                <Icon size={14} className={isActive ? 'text-blue-700' : 'text-slate-400'} />
              </motion.span>
            )}

            {/* Label */}
            <span className="relative z-10 truncate">{tab.label}</span>

            {/* Optional count / badge */}
            {tab.count !== undefined && (
              <span
                className={`relative z-10 rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'bg-slate-200/80 text-slate-600'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
