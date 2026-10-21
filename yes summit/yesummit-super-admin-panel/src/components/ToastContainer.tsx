import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  AlertOctagon,
  X,
  Clock
} from 'lucide-react';
import { ToastNotification } from '../types';

interface ToastContainerProps {
  toasts: ToastNotification[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-20 right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      {toasts.map((toast) => {
        const styles = {
          error: {
            bg: 'bg-red-600 text-white',
            icon: AlertOctagon,
            border: 'border-red-700'
          },
          warning: {
            bg: 'bg-amber-600 text-white',
            icon: AlertTriangle,
            border: 'border-amber-700'
          },
          success: {
            bg: 'bg-emerald-600 text-white',
            icon: CheckCircle2,
            border: 'border-emerald-700'
          },
          info: {
            bg: 'bg-[var(--card)] text-[var(--ink)] border-[var(--line)]',
            icon: Info,
            border: 'border-[var(--line)]'
          }
        }[toast.type];

        const Icon = styles.icon;

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto p-3.5 rounded-lg border shadow-xl flex items-start gap-3 transition-all transform animate-in slide-in-from-bottom-2 ${styles.bg} ${styles.border}`}
          >
            <Icon className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs">
              <div className="flex items-center justify-between font-bold">
                <span>{toast.title}</span>
                <span className="text-[10px] opacity-80 font-mono">{toast.timestamp}</span>
              </div>
              <p className="mt-1 opacity-90 leading-snug">{toast.message}</p>
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="p-1 rounded opacity-70 hover:opacity-100 transition-opacity"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
