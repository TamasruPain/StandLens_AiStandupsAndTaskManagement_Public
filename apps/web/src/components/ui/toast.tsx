'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
}

interface ToastContextType {
  toast: (type: ToastType, title: string, description?: string) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const toast = (type: ToastType, title: string, description?: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, title, description }]);

    setTimeout(() => {
      removeToast(id);
    }, 4000);
  };

  const success = (title: string, description?: string) => toast('success', title, description);
  const error = (title: string, description?: string) => toast('error', title, description);
  const info = (title: string, description?: string) => toast('info', title, description);
  const warning = (title: string, description?: string) => toast('warning', title, description);

  return (
    <ToastContext.Provider value={{ toast, success, error, info, warning }}>
      {children}
      {/* Toast Render Stack */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex items-start gap-3 p-4 rounded-2xl border shadow-2xl backdrop-blur-md transition-all animate-in slide-in-from-bottom-5 duration-200',
              t.type === 'success' && 'bg-[#14141A]/95 border-[#34D399]/30 text-[#F0ECE5]',
              t.type === 'error' && 'bg-[#14141A]/95 border-[#F87171]/30 text-[#F0ECE5]',
              t.type === 'info' && 'bg-[#14141A]/95 border-[#E5A320]/30 text-[#F0ECE5]',
              t.type === 'warning' && 'bg-[#14141A]/95 border-[#E5A320]/30 text-[#F0ECE5]',
            )}
          >
            <div className="shrink-0 mt-0.5">
              {t.type === 'success' && <CheckCircle2 className="w-5 h-5 text-[#34D399]" />}
              {t.type === 'error' && <AlertCircle className="w-5 h-5 text-[#F87171]" />}
              {t.type === 'info' && <Info className="w-5 h-5 text-[#E5A320]" />}
              {t.type === 'warning' && <AlertTriangle className="w-5 h-5 text-[#E5A320]" />}
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-[#F0ECE5]">{t.title}</h4>
              {t.description && <p className="text-xs text-[#9B9BA3] mt-0.5">{t.description}</p>}
            </div>

            <button
              onClick={() => removeToast(t.id)}
              className="text-[#9B9BA3] hover:text-[#F0ECE5] p-1 rounded-lg shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
