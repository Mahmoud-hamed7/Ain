/**
 * ConfirmDialog — Reusable dark modal for destructive confirmations.
 */
import type { ReactNode } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface Props {
  open:        boolean;
  title:       string;
  message:     string | ReactNode;
  confirmText?: string;
  danger?:     boolean;
  isLoading?:  boolean;
  onConfirm:   () => void;
  onCancel:    () => void;
}

export default function ConfirmDialog({
  open, title, message, confirmText = 'Confirm', danger = true, isLoading, onConfirm, onCancel,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-md p-6">
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${danger ? 'bg-red-500/15' : 'bg-blue-500/15'}`}>
            <AlertTriangle className={`w-5 h-5 ${danger ? 'text-red-400' : 'text-blue-400'}`} />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">{title}</h3>
            <div className="mt-1 text-sm text-gray-400">{message}</div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors disabled:opacity-50 ${
              danger
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
          >
            {isLoading ? 'Processing…' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
