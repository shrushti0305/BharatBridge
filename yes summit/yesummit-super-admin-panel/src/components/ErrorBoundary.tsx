import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
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
    console.warn('Recovered from error:', error.message, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] flex items-center justify-center p-4">
          <div className="max-w-md w-full p-6 rounded-xl bg-[var(--card)] border border-[var(--line)] shadow-xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--ink)]">Console Operational Notice</h2>
              <p className="text-xs text-[var(--mute)] mt-1">
                The operations command console caught a frame or rendering exception and safely isolated it.
              </p>
            </div>
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded bg-[var(--primary)] text-white hover:opacity-95 transition-opacity cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Resume Command Console</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
