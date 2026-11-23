import { useEffect, useState, useCallback, lazy, Suspense, type FC } from 'react'
import { AuthView } from './components/auth/AuthView'
// Tải từng màn khi cần (tách file JS) để lần đầu mở trang không phải tải cả ứng dụng 1,2 MB.
const LandingView = lazy(() => import('./components/landing/LandingView').then((m) => ({ default: m.LandingView })))
const ResetPasswordView = lazy(() => import('./components/auth/ResetPasswordView').then((m) => ({ default: m.ResetPasswordView })))
const WorkspaceView = lazy(() => import('./components/workspace/WorkspaceView').then((m) => ({ default: m.WorkspaceView })))
const ProjectWorkspaceView = lazy(() => import('./views/ProjectWorkspaceView').then((m) => ({ default: m.ProjectWorkspaceView })))
const GuestRouteGate = lazy(() => import('./views/guest-report/GuestRouteGate'))
const AdminPortalView = lazy(() => import('./features/admin/AdminPortalView').then((m) => ({ default: m.AdminPortalView })))
const ProfileView = lazy(() => import('./views/ProfileView'))
const PublicProfileView = lazy(() => import('./views/PublicProfileView'))
const NotificationsView = lazy(() => import('./views/NotificationsView'))
import { ToastHost } from './components/common/ToastHost'
import { ProjectInviteAcceptModal } from './components/workspace/ProjectInviteAcceptModal'
import { useWorkflowStore, type NavigationTab } from './store/useWorkflowStore'
import { useRouter } from './router/useRouter'
import { isMockMode } from './services/env'
import { resolveAdminAccess, homePathFor, ADMIN_ONLY_MESSAGE } from './router/adminGuard'

const DevToolbar = import.meta.env.DEV && isMockMode
  ? lazy(() => import('./components/dev/DevToolbar').then((m) => ({ default: m.DevToolbar })))
  : null


export default function App() {
  const { pathname, searchParams, replace } = useRouter()
  const isAuthenticated = useWorkflowStore((state) => state.auth.isAuthenticated)
  const hydrate = useWorkflowStore((state) => state.auth.hydrate)
  const systemRole = useWorkflowStore((state) => state.auth.currentUser?.systemRole)
  const showToast = useWorkflowStore((state) => state.ui.showToast)

  const [activeInviteId, setActiveInviteId] = useState<string | null>(null)
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)

  // Catch deep link: ?action=open-invite-modal&invitationId={id}
  useEffect(() => {
    const action = searchParams.get('action')
    const invitationId = searchParams.get('invitationId')
    if (action === 'open-invite-modal' && invitationId) {
      setActiveInviteId(invitationId)
      setIsInviteModalOpen(true)
    }
  }, [searchParams])

  const handleCloseInviteModal = useCallback(() => {
    setIsInviteModalOpen(false)
    setActiveInviteId(null)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      if (url.searchParams.has('action') || url.searchParams.has('invitationId')) {
        url.searchParams.delete('action')
        url.searchParams.delete('invitationId')
        replace(url.pathname + (url.search ? url.search : '') + url.hash)
      }
    }
  }, [replace])

  // Hydrate auth session on mount
  useEffect(() => {
    hydrate()
  }, [hydrate])

  // Route Guarding & Dispatch
  const isAuthRoute = pathname === '/auth'
  const isResetPasswordRoute = pathname === '/reset-password'
  const isLandingRoute = pathname === '/' || pathname === ''
  const isWorkspaceRoute = pathname === '/workspaces' || pathname === '/workspace'
  const isProjectRoute = pathname.startsWith('/project/')
  const isProfileRoute = pathname === '/profile'
  const isPeopleRoute = pathname.startsWith('/people/')
  const isNotificationsRoute = pathname === '/notifications'
  const isGuestRoute = pathname === '/guest'           // NEW
  const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin')

  // Guard: if user visits protected route while unauthenticated, redirect to signin
  useEffect(() => {
    if (!isAuthenticated) {
      if (isWorkspaceRoute || isProjectRoute || isProfileRoute || isPeopleRoute || isNotificationsRoute) {
        replace('/auth?tab=signin')
      }
    } else if (isAuthRoute) {
      // If already logged in and navigates to /auth, redirect to workspaces
      replace(homePathFor(systemRole))
    }
  }, [isAuthenticated, isWorkspaceRoute, isProjectRoute, isProfileRoute, isPeopleRoute, isNotificationsRoute, isAuthRoute, replace, systemRole])

  // Admin Guard: check auth & role before allowing access to /admin
  useEffect(() => {
    if (isAdminRoute) {
      const decision = resolveAdminAccess(isAuthenticated, systemRole)
      if (decision === 'TO_SIGNIN') {
        replace('/auth?tab=signin')
      } else if (decision === 'TO_WORKSPACES') {
        showToast(ADMIN_ONLY_MESSAGE)
        replace('/workspaces')
      }
    }
  }, [isAdminRoute, isAuthenticated, systemRole, replace, showToast])

  // Parse Project Route: /project/:id/:tab
  let projectId = '1'
  let projectSubTab: NavigationTab | undefined
  let projectPhaseId: string | undefined

  if (isProjectRoute) {
    const parts = pathname.replace('/project/', '').split('/')
    if (parts[0]) projectId = parts[0]
    if (parts[1] && ['overview', 'workflow', 'my-tasks', 'settings'].includes(parts[1])) {
      projectSubTab = parts[1] as NavigationTab
    }
    // /project/:id/workflow/phase/:phaseId = màn chi tiết phase
    if (parts[1] === 'workflow' && parts[2] === 'phase' && parts[3]) {
      try {
        projectPhaseId = decodeURIComponent(parts[3])
      } catch {
        projectPhaseId = parts[3]
      }
    }
  }

  // Render current view
  const renderScreen = () => {
    if (isAdminRoute) {
      return resolveAdminAccess(isAuthenticated, systemRole) === 'ALLOW' ? <AdminPortalView /> : null
    }

    if (isGuestRoute) {                                // NEW
      return <GuestRouteGate />                        // NEW
    }
    
    if (isLandingRoute) {
      return <LandingView />
    }

    if (isResetPasswordRoute) {
      return <ResetPasswordView />
    }

    if (isAuthRoute) {
      return <AuthView />
    }

    if (isWorkspaceRoute) {
      return <WorkspaceView />
    }

    if (isProfileRoute) {
      return <ProfileView />
    }

    if (isPeopleRoute) {
      // /people/:id — chỉ cho người đã đăng nhập (guard ở effect trên)
      if (!isAuthenticated) return null
      const rawId = pathname.slice('/people/'.length).split('/')[0] ?? ''
      let personId = rawId
      try {
        personId = decodeURIComponent(rawId)
      } catch {
        /* giữ nguyên id thô */
      }
      return <PublicProfileView userId={personId} />
    }

    if (isNotificationsRoute) {
      return <NotificationsView />
    }

    if (isProjectRoute) {
      return <ProjectWorkspaceView projectId={projectId} subTab={projectSubTab} phaseId={projectPhaseId} />
    }

    // Default fallback
    return <LandingView />
  }

  return (
    <>
      <Suspense fallback={null}>{renderScreen()}</Suspense>

      {/* Global Project Invitation Acceptance Modal via Deep-Link */}
      <ProjectInviteAcceptModal
        isOpen={isInviteModalOpen}
        invitationId={activeInviteId}
        onClose={handleCloseInviteModal}
      />

      {/* Global Toast Host across all screens */}
      <ToastHost />

      {/* Dev floating panel - Only in DEV environment with mock enabled */}
      {DevToolbar && (
        <Suspense fallback={null}>
          <DevToolbar />
        </Suspense>
      )}
    </>
  )
}
