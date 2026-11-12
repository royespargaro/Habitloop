import { Component, type ErrorInfo, type ReactNode } from 'react';
import { exportData, loadData } from '../services/appStore';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message || 'An unexpected interface error occurred.' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('InPursuit ErrorBoundary caught error:', error, info);
  }

  handleExportFallback = () => {
    try {
      exportData(loadData());
    } catch {
      // Best-effort backup export during crash recovery
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="recovery-shell" role="alert">
        <div className="recovery-card">
          <div className="eyebrow">recovery mode</div>
          <h1>Something unexpected interrupted InPursuit.</h1>
          <p>
            Your workspace remains preserved in browser storage. You can export a backup snapshot before reloading.
          </p>
          {this.state.message && <pre className="recovery-detail">{this.state.message}</pre>}
          <div className="modal-actions">
            <button type="button" className="ui-btn ui-btn-outline" onClick={this.handleExportFallback}>
              Export backup JSON
            </button>
            <button type="button" className="ui-btn ui-btn-solid" onClick={() => window.location.reload()}>
              Reload workspace
            </button>
          </div>
        </div>
      </div>
    );
  }
}
