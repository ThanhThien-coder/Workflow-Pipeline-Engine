import { Component, type ErrorInfo, type ReactNode } from 'react'

export interface GuestReportErrorBoundaryProps {
  children: ReactNode
  fallback: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface GuestReportErrorBoundaryState {
  hasError: boolean
}

export class GuestReportErrorBoundary extends Component<
  GuestReportErrorBoundaryProps,
  GuestReportErrorBoundaryState
> {
  state: GuestReportErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): GuestReportErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.props.onError?.(error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }
    return this.props.children
  }
}

export default GuestReportErrorBoundary
