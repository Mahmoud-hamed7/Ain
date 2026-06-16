/**
 * ToastContainer — Premium toast notification system.
 *
 * Features:
 *  - Slide-in from right with spring easing
 *  - Animated progress bar (shrinks over auto-dismiss duration)
 *  - Type-specific icons and color schemes
 *  - SOS toast: pulsing red border, severity chip, community name, "View" button
 *  - Auto-dismiss: success 3s, info 4s, warning 5s, error requires manual close
 *  - Max 4 visible simultaneously (handled by store)
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  X, CheckCircle, AlertCircle, AlertTriangle, Info, Siren,
} from 'lucide-react';
import { useNotificationStore, type ToastMessage } from '../../store/notificationStore';

/* ── Duration map ── */
const DURATIONS: Record<string, number> = {
  success: 3000,
  info:    4000,
  warning: 5000,
  error:   0, // manual close only
  sos:     8000,
};

/* ── Per-type visual config ── */
const STYLES: Record<string, { border: string; icon: string; iconEl: React.ReactElement; progress: string }> = {
  success: {
    border:   'border-emerald-500/60',
    icon:     'text-emerald-400',
    iconEl:   <CheckCircle className="w-5 h-5" />,
    progress: 'bg-emerald-500',
  },
  error: {
    border:   'border-red-500/60',
    icon:     'text-red-400',
    iconEl:   <AlertCircle className="w-5 h-5" />,
    progress: 'bg-red-500',
  },
  warning: {
    border:   'border-amber-500/60',
    icon:     'text-amber-400',
    iconEl:   <AlertTriangle className="w-5 h-5" />,
    progress: 'bg-amber-500',
  },
  info: {
    border:   'border-blue-500/60',
    icon:     'text-blue-400',
    iconEl:   <Info className="w-5 h-5" />,
    progress: 'bg-blue-500',
  },
  sos: {
    border:   'border-red-500',
    icon:     'text-red-400',
    iconEl:   <Siren className="w-5 h-5" />,
    progress: 'bg-red-500',
  },
};

function Toast({ toast, onRemove }: { toast: ToastMessage; onRemove: (id: string) => void }) {
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const duration = DURATIONS[toast.type] ?? 4000;
  const style = STYLES[toast.type] ?? STYLES.info;
  const isSOS = toast.type === 'sos';

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => onRemove(toast.id), 240);
  }, [toast.id, onRemove]);

  useEffect(() => {
    if (duration === 0) return;
    timerRef.current = setTimeout(dismiss, duration);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [duration, dismiss]);

  return (
    <div
      className={`
        relative w-80 rounded-2xl border bg-gray-900/95 backdrop-blur-md shadow-2xl
        overflow-hidden pointer-events-auto
        ${style.border}
        ${isSOS ? 'toast-sos' : ''}
        ${exiting ? 'toast-exit' : 'toast-enter'}
      `}
    >
      {/* Progress bar */}
      {duration > 0 && (
        <div className="absolute top-0 left-0 right-0 h-0.5">
          <div
            className={`h-full ${style.progress} toast-progress opacity-60`}
            style={{ animationDuration: `${duration}ms` }}
          />
        </div>
      )}

      <div className="p-4 flex items-start gap-3">
        {/* Icon */}
        <div className={`shrink-0 mt-0.5 ${style.icon}`}>
          {isSOS ? (
            <div className="relative">
              {style.iconEl}
              {/* Ping ring for SOS */}
              <span className="absolute inset-0 rounded-full animate-ping bg-red-400 opacity-30" />
            </div>
          ) : style.iconEl}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white leading-tight">{toast.title}</p>

          {toast.description && (
            <p className="text-xs text-gray-400 mt-1 leading-relaxed">{toast.description}</p>
          )}

          {/* SOS-specific extras */}
          {isSOS && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {toast.severity && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30">
                  {toast.severity}
                </span>
              )}
              {toast.communityName && (
                <span className="text-[10px] text-gray-400 bg-gray-800 border border-gray-700 px-2 py-0.5 rounded-full">
                  📍 {toast.communityName}
                </span>
              )}
            </div>
          )}

          {/* Action link */}
          {toast.actionLink && (
            <Link
              to={toast.actionLink}
              onClick={dismiss}
              className="mt-2 inline-flex items-center text-xs font-semibold text-red-400 hover:text-red-300 transition-colors underline underline-offset-2"
            >
              View Alert →
            </Link>
          )}
        </div>

        {/* Close button */}
        <button
          onClick={dismiss}
          className="shrink-0 p-1 -mr-1 -mt-1 text-gray-600 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function ToastContainer() {
  const toasts     = useNotificationStore((s) => s.toasts);
  const removeToast = useNotificationStore((s) => s.removeToast);

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  );
}