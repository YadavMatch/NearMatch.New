import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    let friendly = 'An unexpected error occurred while talking to Firebase.';
    try {
      const parsed = JSON.parse(this.state.message);
      if (parsed && typeof parsed.error === 'string') {
        friendly = parsed.error;
      }
    } catch {
      if (this.state.message) friendly = this.state.message;
    }

    return (
      <div className="min-h-screen bg-[#FFF8EC] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-[#F5C4A8] rounded-3xl p-8 shadow-md text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#FDE4D8] text-[#C44C29] flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-[#3D2817] mb-2">Something went wrong</h1>
          <p className="text-sm text-[#7A5234] mb-6 leading-relaxed">{friendly}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-2xl bg-[#E8603A] hover:bg-[#C44C29] text-white text-sm font-bold transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Reload NearMatch
          </button>
        </div>
      </div>
    );
  }
}
