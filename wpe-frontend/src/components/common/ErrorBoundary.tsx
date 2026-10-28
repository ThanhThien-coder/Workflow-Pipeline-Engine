import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RotateCcw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error | null, reset: () => void) => ReactNode);
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled React Error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/workspaces';
  };

  public render() {
    if (this.state.hasError) {
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback(this.state.error, this.handleReset);
      }
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50 p-6 text-center select-none font-sans">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 mb-4 shadow-sm">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Đã xảy ra sự cố hiển thị giao diện
          </h2>
          <p className="mt-2 max-w-md text-sm text-slate-500 leading-relaxed">
            Hệ thống đã tự động bảo vệ phiên làm việc của bạn.
            {this.state.error?.message ? ` (${this.state.error.message})` : ''}
          </p>
          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 active:scale-95 cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Tải lại trang</span>
            </button>
            <button
              type="button"
              onClick={this.handleGoHome}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:border-slate-300 active:scale-95 cursor-pointer"
            >
              <Home className="h-4 w-4 text-slate-400" />
              <span>Về Trang chủ</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
