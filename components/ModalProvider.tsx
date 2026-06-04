'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { AlertCircle, CheckCircle2, Info, X, AlertTriangle } from 'lucide-react'

export type ModalType = 'alert' | 'confirm';

export interface ModalOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
}

export interface ModalContextType {
  alert: (message: string, options?: ModalOptions | string) => Promise<boolean>;
  confirm: (message: string, options?: ModalOptions | string) => Promise<boolean>;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

interface ModalState {
  isOpen: boolean;
  type: ModalType;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  isDestructive: boolean;
  resolve: ((value: boolean) => void) | null;
}

const initialModalState: ModalState = {
  isOpen: false,
  type: 'alert',
  title: '',
  message: '',
  confirmLabel: 'OK',
  cancelLabel: 'Cancel',
  isDestructive: false,
  resolve: null,
};

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ModalState>(initialModalState);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const showModal = useCallback((type: ModalType, message: string, options?: ModalOptions | string): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      let title = type === 'confirm' ? 'Confirm Action' : 'Notification';
      let confirmLabel = type === 'confirm' ? 'Confirm' : 'OK';
      let cancelLabel = 'Cancel';
      let isDestructive = false;

      // Handle overloaded options parameter (string title or full options object)
      if (typeof options === 'string') {
        title = options;
      } else if (options && typeof options === 'object') {
        if (options.title) title = options.title;
        if (options.confirmLabel) confirmLabel = options.confirmLabel;
        if (options.cancelLabel) cancelLabel = options.cancelLabel;
        if (options.isDestructive !== undefined) {
          isDestructive = options.isDestructive;
        }
      }

      // Auto-detect destructive actions based on common keywords
      const destructiveKeywords = ['delete', 'purge', 'remove', 'permanently', 'trash', 'clear', 'wipe'];
      const lowercaseMsg = message.toLowerCase();
      const lowercaseTitle = title.toLowerCase();
      
      const isDestructiveOverridden = options && typeof options === 'object' && options.isDestructive !== undefined;

      if (
        !isDestructiveOverridden &&
        (destructiveKeywords.some((keyword) => lowercaseMsg.includes(keyword)) ||
          destructiveKeywords.some((keyword) => lowercaseTitle.includes(keyword)))
      ) {
        isDestructive = true;
      }

      setState({
        isOpen: true,
        type,
        title,
        message,
        confirmLabel,
        cancelLabel,
        isDestructive,
        resolve,
      });
    });
  }, []);

  const alert = useCallback((message: string, options?: ModalOptions | string) => {
    return showModal('alert', message, options);
  }, [showModal]);

  const confirm = useCallback((message: string, options?: ModalOptions | string) => {
    return showModal('confirm', message, options);
  }, [showModal]);

  const handleConfirm = useCallback(() => {
    if (state.resolve) state.resolve(true);
    setState(initialModalState);
  }, [state]);

  const handleCancel = useCallback(() => {
    if (state.resolve) state.resolve(false);
    setState(initialModalState);
  }, [state]);

  // Handle body scroll locking
  useEffect(() => {
    if (state.isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [state.isOpen]);

  // Accessibilty: Focus management & Key listener
  useEffect(() => {
    if (!state.isOpen) return;

    // Focus primary action on open
    if (state.type === 'confirm' && state.isDestructive) {
      // In destructive confirmations, default focus to cancel for safety
      cancelBtnRef.current?.focus();
    } else {
      confirmBtnRef.current?.focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      } else if (e.key === 'Enter') {
        // If textarea or specific button has focus, don't hijack enter
        const activeElement = document.activeElement;
        if (
          activeElement instanceof HTMLButtonElement ||
          activeElement instanceof HTMLTextAreaElement
        ) {
          return;
        }
        e.preventDefault();
        handleConfirm();
      } else if (e.key === 'Tab') {
        // Simple focus trap
        const focusableElements = containerRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusableElements || focusableElements.length === 0) return;

        const firstEl = focusableElements[0] as HTMLElement;
        const lastEl = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey) {
          if (document.activeElement === firstEl) {
            lastEl.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastEl) {
            firstEl.focus();
            e.preventDefault();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.isOpen, state.type, state.isDestructive, handleCancel, handleConfirm]);

  return (
    <ModalContext.Provider value={{ alert, confirm }}>
      {children}
      {state.isOpen && (
        <div
          ref={containerRef}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md transition-opacity duration-300 ease-out"
          onClick={handleCancel}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          {/* Modal Card */}
          <div
            className="w-full max-w-md overflow-hidden rounded-xl border border-[var(--auth-border)] bg-[var(--auth-bg)] text-[var(--auth-text)] shadow-2xl transition-all duration-300 ease-out scale-100 opacity-100 animate-[modalEnter_0.2s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--auth-border)] px-6 py-4">
              <div className="flex items-center gap-3">
                {state.isDestructive ? (
                  <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
                ) : state.type === 'confirm' ? (
                  <Info className="h-5 w-5 text-[var(--auth-accent)] shrink-0" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-[var(--auth-accent-alt)] shrink-0" />
                )}
                <h3 id="modal-title" className="text-base font-semibold leading-6">
                  {state.title}
                </h3>
              </div>
              <button
                type="button"
                className="rounded-full p-1 text-[var(--auth-text-muted)] hover:bg-[var(--auth-surface)] hover:text-[var(--auth-text)] transition-all cursor-pointer"
                onClick={handleCancel}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5">
              <p className="text-sm leading-relaxed text-[var(--auth-text-muted)]">
                {state.message}
              </p>
            </div>

            {/* Footer Actions */}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 border-t border-[var(--auth-border)] px-6 py-4 bg-[var(--auth-surface)]/20">
              {state.type === 'confirm' && (
                <button
                  ref={cancelBtnRef}
                  type="button"
                  className="w-full sm:w-auto rounded-md border border-[var(--auth-border)] bg-[var(--auth-bg)] px-4 py-2 text-xs font-semibold text-[var(--auth-text)] hover:bg-[var(--auth-surface)] transition-all cursor-pointer"
                  onClick={handleCancel}
                >
                  {state.cancelLabel}
                </button>
              )}
              <button
                ref={confirmBtnRef}
                type="button"
                className={`w-full sm:w-auto rounded-md px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all cursor-pointer ${
                  state.isDestructive
                    ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 focus-visible:outline-red-600'
                    : 'bg-gradient-to-r from-[var(--auth-accent)] to-[var(--auth-accent-alt)] hover:brightness-110 text-zinc-950 font-bold'
                }`}
                onClick={handleConfirm}
              >
                {state.confirmLabel}
              </button>
            </div>
          </div>
          
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes modalEnter {
              from {
                opacity: 0;
                transform: scale(0.95) translateY(10px);
              }
              to {
                opacity: 1;
                transform: scale(1) translateY(0);
              }
            }
          `}} />
        </div>
      )}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
}
