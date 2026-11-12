import { useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import { Sparkles, User, X } from './Icon';
import { useHabits } from '../context/HabitContext';
import { getReadableAuthError } from '../utils/authErrors';

interface SettingsModalProps {
  onClose: () => void;
  onOpenSignIn: () => void;
  onExportBackup?: () => void;
  onRestoreBackup?: () => void;
}

export const SettingsModal = ({ onClose, onOpenSignIn, onExportBackup, onRestoreBackup }: SettingsModalProps) => {
  const { user, signIn, signOut, syncStatus, syncError, lastSyncedAt, pendingSync, retrySync } = useHabits();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [failedPhotoUrl, setFailedPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, onClose]);

  const avatarPhotoUrl = user?.photoURL && user.photoURL !== failedPhotoUrl ? user.photoURL : null;

  const handleSignIn = async () => {
    setError('');
    setBusy(true);
    try {
      await signIn();
      onClose();
    } catch (err) {
      setError(getReadableAuthError(err));
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

  const syncSummary = () => {
    if (!user) return 'Local-only mode. Sign in with Google to synchronize across devices.';
    if (syncStatus === 'synced') {
      return lastSyncedAt
        ? `Cloud sync active · last confirmed ${new Date(lastSyncedAt).toLocaleString()}`
        : 'Cloud sync active.';
    }
    if (syncStatus === 'syncing' || syncStatus === 'hydrating') return 'Synchronizing changes with Firestore…';
    if (syncStatus === 'offline') {
      return pendingSync
        ? 'Currently offline. Recent changes are stored on this device and will upload automatically when reconnected.'
        : 'Currently offline. Using cached workspace on this device.';
    }
    if (syncStatus === 'conflict') return 'A workspace conflict needs your confirmation.';
    return syncError || 'Cloud synchronization failed. Your changes remain safe on this device.';
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" onMouseDown={e => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="eyebrow">workspace · account</div>
            <h2 id="settings-title">Settings</h2>
          </div>
          <button className="icon-btn" type="button" aria-label="Close settings" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="settings-stack">
          <div className="settings-card">
            <div className="settings-avatar">
              {avatarPhotoUrl ? (
                <img
                  className="settings-avatar-img"
                  src={avatarPhotoUrl}
                  alt={user?.displayName ?? user?.email ?? 'Account profile'}
                  referrerPolicy="no-referrer"
                  onError={() => setFailedPhotoUrl(avatarPhotoUrl)}
                />
              ) : (
                <User size={18} />
              )}
            </div>
            <div className="settings-card-copy">
              <p className="settings-card-title">{user ? (user.displayName || 'Signed in') : 'Local workspace'}</p>
              <p className="settings-card-sub">{user ? (user.email ?? 'Connected account') : 'Your data is stored locally on this device'}</p>
            </div>
          </div>

          <div className="settings-sync-box">
            <div className="eyebrow">synchronization</div>
            <p className="settings-note">{syncSummary()}</p>
            {user && (syncStatus === 'error' || (syncStatus === 'offline' && pendingSync)) && (
              <button
                type="button"
                className="text-action"
                onClick={() => void retrySync()}
              >
                Retry sync now
              </button>
            )}
          </div>

          {(onExportBackup || onRestoreBackup) && (
            <div className="settings-backup-box">
              <div className="eyebrow">portable snapshots</div>
              <p className="settings-note">
                Export or restore versioned JSON backups of your goals, projects, habits, and reviews.
              </p>
              <div className="settings-backup-actions">
                {onExportBackup && (
                  <button type="button" className="ui-btn ui-btn-outline" onClick={onExportBackup}>
                    Export backup
                  </button>
                )}
                {onRestoreBackup && (
                  <button
                    type="button"
                    className="ui-btn ui-btn-outline"
                    onClick={() => {
                      onClose();
                      onRestoreBackup();
                    }}
                  >
                    Restore backup
                  </button>
                )}
              </div>
            </div>
          )}

          {(error || (user && syncError)) && <p className="settings-error" role="alert">{error || syncError}</p>}

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
            <button className="ui-btn ui-btn-outline" type="button" onClick={onClose}>
              Close
            </button>
            {user ? (
              <button className="ui-btn ui-btn-danger" type="button" disabled={busy} onClick={handleSignOut}>
                <LogOut size={15} /> {busy ? 'Signing out…' : 'Sign out'}
              </button>
            ) : (
              <button className="ui-btn ui-btn-solid" type="button" disabled={busy} onClick={handleSignIn}>
                <Sparkles size={15} /> {busy ? 'Connecting…' : 'Sign in with Google'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
