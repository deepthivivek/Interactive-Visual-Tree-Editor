'use client';

import React, { Component, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Tree Editor ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-6 bg-slate-50 rounded-xl border border-slate-200 text-center">
          <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 mb-4 shadow-sm">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-semibold text-slate-900 mb-1">
            {this.props.fallbackTitle ?? 'Something went wrong in the Tree Workspace'}
          </h2>
          <p className="text-xs text-slate-500 max-w-md mb-6 leading-relaxed">
            {this.state.error?.message ?? 'An unexpected rendering or state error occurred.'}
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reload Workspace</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
