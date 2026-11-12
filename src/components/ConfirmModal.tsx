import { useEffect } from 'react';
import { AlertCircle, X } from './Icon';

interface ConfirmModalProps {
  title: string;
  eyebrow?: string;
  body: string;
  details?: string[];
  confirmLabel: string;
  tone?: 'danger' | 'solid';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  title,
  eyebrow = 'confirm action',
  body,
  details,
  confirmLabel,
  tone = 'solid',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  return (
    <div className="modal-backdrop" onMouseDown={onCancel}>
      <div
        className="modal confirm-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <div className="eyebrow">{eyebrow}</div>
            <h2 id="confirm-title">{title}</h2>
          </div>
          <button className="icon-btn" type="button" aria-label="Close dialog" onClick={onCancel}>
            <X size={18} />
          </button>
        </div>

        <p className="confirm-body">{body}</p>

        {details && details.length > 0 && (
          <ul className="confirm-details">
            {details.map((line, index) => (
              <li key={index}>
                <AlertCircle size={13} aria-hidden="true" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="modal-actions">
          <button className="ui-btn ui-btn-outline" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            className={`ui-btn ${tone === 'danger' ? 'ui-btn-danger' : 'ui-btn-solid'}`}
            type="button"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
