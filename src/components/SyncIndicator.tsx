import type { SyncStatus } from '../types';

interface SyncIndicatorProps {
  syncStatus: SyncStatus;
  lastSyncedAt: string | null;
  pendingSync: boolean;
  onRetry: () => void;
  onOpenSettings: () => void;
}

const formatShortTime = (iso: string | null) => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export function SyncIndicator({ syncStatus, lastSyncedAt, pendingSync, onRetry, onOpenSettings }: SyncIndicatorProps) {
  let dotClass = 'status-dot';
  let label = 'Local workspace · saved on device';
  let actionLabel: string | null = null;
  let actionFn: (() => void) | null = null;

  if (syncStatus === 'hydrating') {
    dotClass = 'status-dot syncing';
    label = 'Connecting to cloud…';
  } else if (syncStatus === 'syncing') {
    dotClass = 'status-dot syncing';
    label = 'Syncing changes…';
  } else if (syncStatus === 'synced') {
    dotClass = 'status-dot synced';
    const time = formatShortTime(lastSyncedAt);
    label = time ? `Synced · ${time}` : 'Synced to cloud';
  } else if (syncStatus === 'offline') {
    dotClass = 'status-dot offline';
    label = pendingSync ? 'Offline · changes queued' : 'Offline · saved locally';
  } else if (syncStatus === 'error') {
    dotClass = 'status-dot error';
    label = 'Sync failed · saved locally';
    actionLabel = 'Retry';
    actionFn = onRetry;
  } else if (syncStatus === 'conflict') {
    dotClass = 'status-dot error';
    label = 'Sync conflict · action needed';
    actionLabel = 'Resolve';
    actionFn = onOpenSettings;
  }

  return (
    <div className="local-note" role="status" aria-live="polite">
      <span className={dotClass} aria-hidden="true" />
      <span className="sync-label-text">{label}</span>
      {actionLabel && actionFn && (
        <button type="button" className="sync-retry-btn" onClick={actionFn}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
