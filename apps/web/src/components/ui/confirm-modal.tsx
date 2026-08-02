'use client';

import { X, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDestructive = false,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#0B0B0F]/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-[#14141A] border border-[#23232C] rounded-2xl p-6 max-w-md w-full space-y-5 shadow-2xl">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'p-2.5 rounded-xl',
                isDestructive ? 'bg-[#F87171]/10 text-[#F87171]' : 'bg-[#E5A320]/10 text-[#E5A320]',
              )}
            >
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[#F0ECE5]">{title}</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#9B9BA3] hover:text-[#F0ECE5] p-1 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-[#9B9BA3] leading-relaxed">{description}</p>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-[#9B9BA3] hover:text-[#F0ECE5] cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={cn(
              'font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md cursor-pointer',
              isDestructive
                ? 'bg-[#F87171] hover:bg-[#EF4444] text-white'
                : 'bg-[#E5A320] hover:bg-[#F5B731] text-[#0B0B0F]',
            )}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
