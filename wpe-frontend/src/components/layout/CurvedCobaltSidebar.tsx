import { useState, type FC } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft,
  ClipboardList,
  LayoutDashboard,
  Network,
  Settings,
  Sparkles,
  Layers,
} from 'lucide-react'
import type { NavigationTab } from '../../store/useWorkflowStore'
import { getSavedAvatar } from '../../utils/avatarUtils'

export interface NavItemDef {
  id: NavigationTab
  label: string
  icon: typeof LayoutDashboard
  badge?: string
}

export const WORKSPACE_NAVIGATION: NavItemDef[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'workflow', label: 'Workflow', icon: Network },
  { id: 'my-tasks', label: 'My Tasks', icon: ClipboardList },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export interface TeamMemberItem {
  id?: string
  userId?: string
  name?: string
  username?: string
  avatarUrl?: string | null
  initials?: string
  avatarClass?: string
  role?: string
}

export interface CurvedCobaltSidebarProps {
  currentTab: NavigationTab
  onTabChange: (tab: NavigationTab) => void
  projectName: string
  projectStatus: string
  projectIcon?: string
  onBackToWorkspaces: () => void
  teamMembers?: TeamMemberItem[]
}

export const CurvedCobaltSidebar: FC<CurvedCobaltSidebarProps> = ({
  currentTab,
  onTabChange,
  projectName,
  projectStatus,
  projectIcon = '✣',
  onBackToWorkspaces,
  teamMembers = [],
}) => {
  const [isHovered, setIsHovered] = useState(false)
  const [hoveredNavId, setHoveredNavId] = useState<string | null>(null)

  return (
    <motion.aside
      initial={false}
      animate={{ width: isHovered ? 260 : 80 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false)
        setHoveredNavId(null)
      }}
      className="relative z-40 hidden h-screen shrink-0 select-none flex-col justify-between overflow-visible bg-gradient-to-b from-blue-700 via-blue-600 to-indigo-800 p-3 text-white shadow-2xl shadow-blue-950/25 border-r border-blue-400/20 lg:flex"
      style={{ willChange: 'width' }}
      aria-label="Sidebar Navigation"
    >
      {/* Top Section: Brand + Project Switcher */}
      <div className="space-y-3">
        {/* Brand Header */}
        <div className="flex h-12 items-center gap-3 px-2">
          <motion.div
            whileHover={{ rotate: 180, scale: 1.1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 shadow-inner shadow-white/20 text-white cursor-pointer"
            title="Workflow Pipeline Engine"
            onClick={onBackToWorkspaces}
          >
            <Sparkles size={20} className="text-blue-100" />
          </motion.div>

          <AnimatePresence>
            {isHovered && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.18, delay: 0.05 }}
                className="min-w-0 flex-1 whitespace-nowrap overflow-hidden"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-extrabold tracking-tight text-white">
                    Pipeline Engine
                  </span>
                  <span className="rounded-full bg-blue-400/25 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-blue-100 border border-blue-300/30">
                    SSOT
                  </span>
                </div>
                <p className="text-[10px] font-medium text-blue-200/70">
                  DAG & State Machine
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Project Selector / Return to Workspaces */}
        <motion.button
          type="button"
          onClick={onBackToWorkspaces}
          whileHover={{ scale: 1.02, x: 2 }}
          whileTap={{ scale: 0.98 }}
          className="group relative flex w-full items-center gap-3 rounded-2xl bg-white/10 p-2.5 text-left backdrop-blur-md border border-white/15 transition-colors hover:bg-white/15 cursor-pointer"
          title="Back to all pipelines"
        >
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white font-bold shadow-inner">
            <span className="text-sm">{projectIcon}</span>
            <ChevronLeft
              size={12}
              className="absolute -left-1 text-blue-200 opacity-0 group-hover:opacity-100 group-hover:-translate-x-0.5 transition-all"
            />
          </div>

          <AnimatePresence>
            {isHovered && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.18, delay: 0.05 }}
                className="min-w-0 flex-1 whitespace-nowrap overflow-hidden"
              >
                <b className="block text-xs font-bold truncate text-white group-hover:text-blue-100 transition-colors">
                  {projectName}
                </b>
                <div className="flex items-center gap-1 text-[10px] text-blue-200/80 font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="truncate">{projectStatus}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>

        {/* Navigation Item Stack */}
        <nav className="space-y-1.5 pt-2" aria-label="Workspace tabs">
          {WORKSPACE_NAVIGATION.map(({ id, label, icon: Icon }) => {
            const isActive = currentTab === id
            return (
              <div key={id} className="relative">
                <motion.button
                  type="button"
                  onClick={() => onTabChange(id)}
                  onMouseEnter={() => setHoveredNavId(id)}
                  onMouseLeave={() => setHoveredNavId(null)}
                  whileHover={{ scale: 1.02, x: 2 }}
                  whileTap={{ scale: 0.98 }}
                  className={`group relative flex h-12 w-full items-center rounded-2xl px-3 transition-colors cursor-pointer ${
                    isActive
                      ? 'text-blue-700 font-bold'
                      : 'text-blue-100/80 hover:text-white hover:bg-white/10'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {/* Sliding Curved White Pill for Active Item */}
                  {isActive && (
                    <motion.div
                      layoutId="activeSidebarIndicator"
                      className="absolute inset-0 rounded-2xl bg-white shadow-lg shadow-blue-950/20"
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  )}

                  {/* Icon with Micro-Animation */}
                  <motion.div
                    whileHover={{ scale: 1.15, rotate: [-2, 2, 0] }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center"
                  >
                    <Icon
                      size={20}
                      className={isActive ? 'text-blue-700' : 'text-blue-100 group-hover:text-white'}
                    />
                  </motion.div>

                  {/* Expanded Label */}
                  <AnimatePresence>
                    {isHovered && (
                      <motion.span
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.18, delay: 0.05 }}
                        className={`relative z-10 ml-3 whitespace-nowrap text-xs font-semibold overflow-hidden ${
                          isActive ? 'text-blue-700' : 'text-blue-100 group-hover:text-white'
                        }`}
                      >
                        {label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>

                {/* Floating Tooltip when Collapsed */}
                {!isHovered && hoveredNavId === id && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, x: 10 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.9, x: 10 }}
                    transition={{ duration: 0.15 }}
                    className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 rounded-xl bg-slate-900/95 px-3 py-1.5 text-xs font-semibold text-white shadow-xl backdrop-blur-md border border-slate-700/80 whitespace-nowrap"
                  >
                    {label}
                    <div className="absolute right-full top-1/2 -translate-y-1/2 -mr-1 border-4 border-transparent border-r-slate-900/95" />
                  </motion.div>
                )}
              </div>
            )
          })}
        </nav>
      </div>

      {/* Bottom Section: Team Avatars & Quick Link */}
      <div className="space-y-3 border-t border-white/15 pt-3">
        {/* Team Avatars Ribbon */}
        <div className="px-1">
          <AnimatePresence>
            {isHovered && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="mb-2 flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-blue-200/80"
              >
                <span>TEAM COLLABORATORS</span>
                <span className="rounded bg-white/10 px-1.5 py-0.2 text-[9px] text-blue-100">
                  {teamMembers.length}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center justify-center lg:justify-start">
            <div className="flex -space-x-1.5 overflow-hidden py-1">
              {teamMembers.slice(0, 3).map((m, idx) => {
                const name = ('username' in m ? m.username : m.name) || ''
                const initials = m.initials || 'U'
                const avatar =
                  'avatarUrl' in m && m.avatarUrl ? m.avatarUrl : getSavedAvatar(name)
                const bgClass = m.avatarClass || 'bg-blue-500'

                return avatar ? (
                  <motion.img
                    whileHover={{ y: -3, scale: 1.15 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    key={('userId' in m ? m.userId : m.id) || idx}
                    src={avatar}
                    alt={name}
                    title={name}
                    className="h-8 w-8 rounded-full object-cover border-2 border-blue-600 shadow-md ring-1 ring-white/20"
                  />
                ) : (
                  <motion.span
                    whileHover={{ y: -3, scale: 1.15 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    key={('userId' in m ? m.userId : m.id) || idx}
                    title={name}
                    className={`grid h-8 w-8 place-items-center rounded-full border-2 border-blue-600 text-[10px] font-bold text-white shadow-md ring-1 ring-white/20 ${bgClass}`}
                  >
                    {initials}
                  </motion.span>
                )
              })}

              {teamMembers.length > 3 && (
                <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-blue-600 bg-blue-900/80 text-[10px] font-bold text-blue-200 shadow-md">
                  +{teamMembers.length - 3}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Quick Link to Workspaces / Catalog */}
        <motion.button
          type="button"
          onClick={onBackToWorkspaces}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-2 text-xs font-semibold text-blue-100 hover:bg-white/20 hover:text-white transition-colors cursor-pointer"
          title="Switch Project"
        >
          <Layers size={16} />
          <AnimatePresence>
            {isHovered && (
              <motion.span
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15 }}
                className="whitespace-nowrap truncate"
              >
                All Pipelines
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
    </motion.aside>
  )
}
