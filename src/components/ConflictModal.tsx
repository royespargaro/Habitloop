import { useState } from 'react';
import type { ConflictState } from '../context/HabitContext';
import { Sparkles } from './Icon';

interface ConflictModalProps {
  conflict: ConflictState;
  onResolve: (strategy: 'keep-cloud' | 'use-local' | 'merge') => Promise<void>;
}

export function ConflictModal({ conflict, onResolve }: ConflictModalProps) {
  const [busy, setBusy] = useState(false);

  const pick = async (strategy: 'keep-cloud' | 'use-local' | 'merge') => {
    setBusy(true);
    try {
      await onResolve(strategy);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal conflict-modal" role="dialog" aria-modal="true" aria-labelledby="conflict-title">
        <div className="modal-head">
          <div>
            <div className="eyebrow">sync conflict detected</div>
            <h2 id="conflict-title">Choose how to combine your workspaces</h2>
          </div>
          <span className="focus-icon">
            <Sparkles size={15} />
          </span>
        </div>

        <p className="confirm-body">
          You created local changes before signing in, and your cloud account already has saved data. Nothing has been overwritten yet.
        </p>

        <div className="conflict-grid">
          <div className="conflict-card">
            <div className="eyebrow">this device</div>
            <ul>
              <li>{conflict.localSummary.goals} goals</li>
              <li>{conflict.localSummary.projects} projects</li>
              <li>{conflict.localSummary.tasks} tasks</li>
              <li>{conflict.localSummary.habits} habits · {conflict.localSummary.habitLogs} logs</li>
            </ul>
          </div>
          <div className="conflict-card">
            <div className="eyebrow">cloud account</div>
            <ul>
              <li>{conflict.cloudSummary.goals} goals</li>
              <li>{conflict.cloudSummary.projects} projects</li>
              <li>{conflict.cloudSummary.tasks} tasks</li>
              <li>{conflict.cloudSummary.habits} habits · {conflict.cloudSummary.habitLogs} logs</li>
            </ul>
          </div>
        </div>

        <div className="conflict-actions">
          <button type="button" className="ui-btn ui-btn-solid" disabled={busy} onClick={() => void pick('merge')}>
            Merge both (Recommended)
          </button>
          <button type="button" className="ui-btn ui-btn-outline" disabled={busy} onClick={() => void pick('keep-cloud')}>
            Keep cloud data
          </button>
          <button type="button" className="ui-btn ui-btn-danger" disabled={busy} onClick={() => void pick('use-local')}>
            Replace cloud with local
          </button>
        </div>
      </div>
    </div>
  );
}
