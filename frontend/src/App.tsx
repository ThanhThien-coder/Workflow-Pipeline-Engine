import { useEffect, type FC } from 'react'
import { LandingView } from './components/landing/LandingView'
import { AuthView } from './components/auth/AuthView'
import { WorkspaceView } from './components/workspace/WorkspaceView'
import { ProjectWorkspaceView } from './views/ProjectWorkspaceView'
import GuestView from './views/GuestView' // NEW
import { ToastHost } from './components/common/ToastHost'
import { DevToolbar } from './components/dev/DevToolbar'
import { useWorkflowStore, type NavigationTab } from './store/useWorkflowStore'
import { useRouter } from './router/useRouter'


export default function App() {
  const { pathname, navigate, replace } = useRouter()
  const isAuthenticated = useWorkflowStore((state) => state.auth.isAuthenticated)
  const hydrate = useWorkflowStore((state) => state.auth.hydrate)

  // Hydrate auth session on mount
  useEffect(() => {
    hydrate()
  }, [hydrate])

  // Route Guarding & Dispatch
  const isAuthRoute = pathname === '/auth'
  const isLandingRoute = pathname === '/' || pathname === ''
  const isWorkspaceRoute = pathname === '/workspaces'
  const isProjectRoute = pathname.startsWith('/project/')
  const isGuestRoute = pathname === '/guest'           // NEW

  // Guard: if user visits protected route while unauthenticated, redirect to signin
  useEffect(() => {
    if (!isAuthenticated) {
      if (isWorkspaceRoute || isProjectRoute) {
        replace('/auth?tab=signin')
      }
    } else if (isAuthRoute) {
      // If already logged in and navigates to /auth, redirect to workspaces
      replace('/workspaces')
    }
  }, [isAuthenticated, isWorkspaceRoute, isProjectRoute, isAuthRoute, replace])

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

    if (isProjectRoute) {
      return <ProjectWorkspaceView projectId={projectId} subTab={projectSubTab} />
    }

    // Default fallback
    return <LandingView />
  }

  return (
    <>
      {renderScreen()}

      {/* Global Toast Host across all screens */}
      <ToastHost />

      {/* Dev floating panel - Only in DEV environment */}
      {import.meta.env.DEV && import.meta.env.VITE_USE_MOCK === 'true' && (
        <DevToolbar />
      )}
    </>
  )
}
