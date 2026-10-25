import { useEffect, useState, useCallback, lazy, Suspense, type FC } from 'react'
import { LandingView } from './components/landing/LandingView'
import { AuthView } from './components/auth/AuthView'
import { WorkspaceView } from './components/workspace/WorkspaceView'
import { ProjectWorkspaceView } from './views/ProjectWorkspaceView'
import GuestView from './views/GuestView' // NEW
import { AdminPortalView } from './features/admin/AdminPortalView'
import ProfileView from './views/ProfileView'
import NotificationsView from './views/NotificationsView'
import { ToastHost } from './components/common/ToastHost'
import { ProjectInviteAcceptModal } from './components/workspace/ProjectInviteAcceptModal'
import { useWorkflowStore, type NavigationTab } from './store/useWorkflowStore'
import { useRouter } from './router/useRouter'

const DevToolbar = import.meta.env.DEV && import.meta.env.VITE_USE_MOCK === 'true'
  ? lazy(() => import('./components/dev/DevToolbar').then((m) => ({ default: m.DevToolbar })))
  : null


export default function App() {
  const { pathname, searchParams, replace } = useRouter()
  const isAuthenticated = useWorkflowStore((state) => state.auth.isAuthenticated)
  const hydrate = useWorkflowStore((state) => state.auth.hydrate)

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
  const isLandingRoute = pathname === '/' || pathname === ''
  const isWorkspaceRoute = pathname === '/workspaces' || pathname === '/workspace'
  const isProjectRoute = pathname.startsWith('/project/')
  const isProfileRoute = pathname === '/profile'
  const isNotificationsRoute = pathname === '/notifications'
  const isGuestRoute = pathname === '/guest'           // NEW
  const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin')

  // Guard: if user visits protected route while unauthenticated, redirect to signin
  useEffect(() => {
    if (!isAuthenticated) {
      if (isWorkspaceRoute || isProjectRoute || isProfileRoute || isNotificationsRoute) {
        replace('/auth?tab=signin')
      }
    } else if (isAuthRoute) {
      // If already logged in and navigates to /auth, redirect to workspaces
      replace('/workspaces')
    }
  }, [isAuthenticated, isWorkspaceRoute, isProjectRoute, isProfileRoute, isNotificationsRoute, isAuthRoute, replace])

  // Parse Project Route: /project/:id/:tab
  let projectId = '1'
  let projectSubTab: NavigationTab | undefined

  if (isProjectRoute) {
    const parts = pathname.replace('/project/', '').split('/')
    if (parts[0]) projectId = parts[0]
    if (parts[1] && ['overview', 'workflow', 'my-tasks', 'settings'].includes(parts[1])) {
      projectSubTab = parts[1] as NavigationTab
    }
  }

  // Render current view
  const renderScreen = () => {
    if (isAdminRoute) {
      return <AdminPortalView />
    }

    if (isGuestRoute) {                                // NEW
      return <GuestView />                             // NEW
    }
    
    if (isLandingRoute) {
      return <LandingView />
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

    if (isNotificationsRoute) {
      return <NotificationsView />
    }

    if (isProjectRoute) {
      return <ProjectWorkspaceView projectId={projectId} subTab={projectSubTab} />
    }

    // Default fallback
    return <LandingView />
  }

  return (
    <>
      {renderScreen()}

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
