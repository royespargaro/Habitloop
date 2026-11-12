import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { Sparkles, User, X } from './Icon';
import { useHabits } from '../context/HabitContext';

export const SettingsModal = ({ onClose, onOpenSignIn }: { onClose: () => void; onOpenSignIn: () => void }) => {
  const { user, signIn, signOut } = useHabits();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleSignIn = async () => {
    setError('');
    setBusy(true);
    try {
      await signIn();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in right now.');
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    setError('');
    setBusy(true);
    try {
      await signOut();
      onOpenSignIn();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign out right now.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" onMouseDown={e => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="eyebrow">workspace · account</div>
            <h2 id="settings-title">Settings</h2>
          </div>
          <button className="icon-btn" type="button" aria-label="Close settings" onClick={onClose}><X size={18}/></button>
        </div>

        <div className="settings-stack">
          <div className="settings-card">
            <div className="settings-avatar"><User size={18}/></div>
            <div className="settings-card-copy">
              <p className="settings-card-title">{user ? 'Signed in' : 'Local workspace'}</p>
              <p className="settings-card-sub">{user ? (user.email ?? 'Connected account') : 'Your data is stored locally on this device'}</p>
            </div>
          </div>

          <p className="settings-note">
            Use Export and Restore backup in the sidebar anytime to keep portable snapshots of your goals, projects, habits, and reviews.
          </p>

          {error && <p className="settings-error" role="alert">{error}</p>}

          <div className="modal-actions">
            {!user && (
              <button
                className="ui-btn ui-btn-outline"
                type="button"
                onClick={() => {
                  onOpenSignIn();
                  onClose();
                }}
              >
                Sign-in screen
              </button>
            )}
            <button className="ui-btn ui-btn-outline" type="button" onClick={onClose}>Close</button>
            {user ? (
              <button className="ui-btn ui-btn-danger" type="button" disabled={busy} onClick={handleSignOut}>
                <LogOut size={15}/> {busy ? 'Signing out…' : 'Sign out'}
              </button>
            ) : (
              <button className="ui-btn ui-btn-solid" type="button" disabled={busy} onClick={handleSignIn}>
                <Sparkles size={15}/> {busy ? 'Connecting…' : 'Sign in with Google'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
