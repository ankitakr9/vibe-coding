import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    let readable = error.message || 'An unexpected application error occurred.';
    try {
      const parsed = JSON.parse(error.message) as { error?: string; operationType?: string; path?: string };
      if (parsed && parsed.error) {
        readable = `Access or sync error during ${parsed.operationType ?? 'operation'} on ${parsed.path ?? 'database'}: ${parsed.error}`;
      }
    } catch {
      // Plain error message
    }
    return { hasError: true, message: readable };
  }

  componentDidCatch(error: Error) {
    console.error('Application ErrorBoundary caught:', error);
  }

  handleReset = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-slate-200 rounded-lg p-8">
            <div className="flex items-center gap-3 text-[#B91C1C] mb-4">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h1 className="text-lg font-semibold text-slate-900">
                Unable to Complete Request
              </h1>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed mb-6">
              {this.state.message}
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#0F172A] rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Try Again
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Reload Workspace
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
