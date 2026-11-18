import React from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { BTN_PRIMARY_CLS } from './FormControls';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'An unexpected application error occurred.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[MRTMIS UI ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F4F6F9] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-lg p-6 sm:p-8 text-center space-y-4">
            <div className="w-10 h-10 rounded-md bg-red-50 border border-red-200 text-red-700 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-5 h-5" aria-hidden="true" />
            </div>
            <h1 className="font-display text-lg font-semibold text-slate-900">
              Application Error
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              The workspace encountered an unexpected error. Reload the page to restore your session.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className={BTN_PRIMARY_CLS}
            >
              <RotateCw className="w-4 h-4" aria-hidden="true" />
              <span>Reload Workspace</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
