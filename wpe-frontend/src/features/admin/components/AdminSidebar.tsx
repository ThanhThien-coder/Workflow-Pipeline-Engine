import { useState, type FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AdminPortalTab } from '../../../hooks/useAdminPortal';
import {
  BarChart3,
  Users,
  Zap,
  ShieldCheck,
  Workflow,
  Layers,
  ArrowLeft,
} from 'lucide-react';

import { useRouter } from '../../../router/useRouter';

interface AdminSidebarProps {
  currentTab: AdminPortalTab;
  onTabChange: (tab: AdminPortalTab) => void;
}

interface NavItem {
  id: AdminPortalTab;
  label: string;
  icon: typeof BarChart3;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview & Analytics', icon: BarChart3 },
  { id: 'users', label: 'User Management', icon: Users },
  { id: 'workspaces', label: 'Workspaces & DAGs', icon: Zap },
  { id: 'templates', label: 'Template Library', icon: Layers },
  { id: 'audit', label: 'Security & Audit Logs', icon: ShieldCheck },
];

export const AdminSidebar: FC<AdminSidebarProps> = ({
  currentTab,
  onTabChange,
}) => {
  const { navigate } = useRouter();
  const [isHovered, setIsHovered] = useState(false);
  const [hoveredNavId, setHoveredNavId] = useState<string | null>(null);

  return (
    <>
      {/* Desktop / Tablet Curved Cobalt Ribbon Sidebar */}
      <motion.aside
        id="sidebar"
        initial={false}
        animate={{ width: isHovered ? 260 : 80 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          setHoveredNavId(null);
        }}
        className="sticky top-0 z-30 hidden md:flex h-screen shrink-0 select-none flex-col justify-between overflow-visible bg-gradient-to-b from-blue-700 via-blue-600 to-indigo-800 p-3 text-white shadow-2xl shadow-blue-950/25 border-r border-blue-400/20"
        style={{ willChange: 'width' }}
        aria-label="Admin Navigation"
      >
        {/* Top: Brand Header */}
        <div className="space-y-4">
          <div
            onClick={() => navigate('/workspaces')}
            className="flex h-12 items-center gap-3 px-2 cursor-pointer"
            title="Return to Pipelines & Workspaces"
          >
            <motion.div
              whileHover={{ rotate: 180, scale: 1.1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 shadow-inner text-white"
            >
              <Workflow className="h-5 w-5 text-blue-100" />
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
                  <div className="truncate text-sm font-extrabold tracking-tight text-white">
                    Pipeline Engine
                  </div>
                  <span className="mt-0.5 inline-flex rounded-full bg-blue-400/30 px-2 py-0.5 text-[9px] font-extrabold tracking-wider text-blue-100 border border-blue-300/30 uppercase">
                    SUPER ADMIN
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Navigation Items */}
          <nav className="space-y-1.5 pt-2" aria-label="Admin navigation">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <div key={item.id} className="relative">
                  <motion.button
                    type="button"
                    onClick={() => onTabChange(item.id)}
                    onMouseEnter={() => setHoveredNavId(item.id)}
                    onMouseLeave={() => setHoveredNavId(null)}
                    whileHover={{ scale: 1.02, x: 2 }}
                    whileTap={{ scale: 0.98 }}
                    className={`group relative flex h-12 w-full items-center rounded-2xl px-3 transition-colors cursor-pointer ${
                      isActive
                        ? 'text-blue-700 font-bold'
                        : 'text-blue-100/80 hover:text-white hover:bg-white/10'
                    }`}
                    title={item.label}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {/* Active Sliding Curved White Pill */}
                    {isActive && (
                      <motion.div
                        layoutId="activeAdminSidebarIndicator"
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
                        className={`h-5 w-5 ${
                          isActive ? 'text-blue-700' : 'text-blue-100 group-hover:text-white'
                        }`}
                      />
                    </motion.div>

                    {/* Label */}
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
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.button>

                  {/* Floating Tooltip when Collapsed */}
                  {!isHovered && hoveredNavId === item.id && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9, x: 10 }}
                      animate={{ opacity: 1, scale: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.9, x: 10 }}
                      transition={{ duration: 0.15 }}
                      className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 rounded-xl bg-slate-900/95 px-3 py-1.5 text-xs font-semibold text-white shadow-xl backdrop-blur-md border border-slate-700/80 whitespace-nowrap"
                    >
                      {item.label}
                      <div className="absolute right-full top-1/2 -translate-y-1/2 -mr-1 border-4 border-transparent border-r-slate-900/95" />
                    </motion.div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section: Quick Exit to Workspaces */}
        <div className="border-t border-white/15 pt-3">
          <motion.button
            type="button"
            onClick={() => navigate('/workspaces')}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-2 text-xs font-semibold text-blue-100 hover:bg-white/20 hover:text-white transition-colors cursor-pointer"
            title="Back to User Workspaces"
          >
            <ArrowLeft size={16} />
            <AnimatePresence>
              {isHovered && (
                <motion.span
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.15 }}
                  className="whitespace-nowrap truncate"
                >
                  User Workspaces
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </motion.aside>

      {/* Mobile Bottom Navigation */}
      <div className="mobile-nav fixed bottom-4 left-4 right-4 z-30 flex items-center justify-around rounded-2xl border border-slate-200 bg-white/95 p-1.5 shadow-xl backdrop-blur-lg md:hidden">
        {NAV_ITEMS.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`relative mobile-tab rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                isActive ? 'text-blue-700 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="activeAdminMobileTab"
                  className="absolute inset-0 rounded-xl bg-blue-50 border border-blue-200/60"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10">
                {item.id === 'overview'
                  ? 'Overview'
                  : item.id === 'users'
                  ? 'Users'
                  : item.id === 'workspaces'
                  ? 'DAGs'
                  : item.id === 'templates'
                  ? 'Templates'
                  : 'Audit'}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
};
