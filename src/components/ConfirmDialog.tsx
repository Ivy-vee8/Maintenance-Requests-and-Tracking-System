import { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { BTN_DANGER_CLS, BTN_PRIMARY_CLS, BTN_SECONDARY_CLS } from './FormControls';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, loading, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[1px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onClick={() => {
        if (!loading) onCancel();
      }}
    >
      <div
        className="bg-white border border-slate-200 rounded-lg shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {variant === 'danger' && (
              <div className="p-2 rounded-md bg-red-50 border border-red-200 text-red-700 shrink-0">
                <AlertTriangle className="w-4 h-4" aria-hidden="true" />
              </div>
            )}
            <div>
              <h3 id="confirm-dialog-title" className="font-display text-base font-semibold text-slate-900">
                {title}
              </h3>
              <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{description}</p>
            </div>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]/30"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className={BTN_SECONDARY_CLS}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={variant === 'danger' ? BTN_DANGER_CLS : BTN_PRIMARY_CLS}
          >
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
