'use client';

import React, { useEffect, useRef } from 'react';
import { AlertTriangle, RotateCcw, X } from 'lucide-react';
import { useTreeStore } from '../../store/treeStore';
import { handleModalTabKey } from '../../lib/modalFocus';

export const ResetConfirmationModal: React.FC = () => {
  const isOpen = useTreeStore((state) => state.isResetConfirmationOpen);
  const closeResetConfirmation = useTreeStore((state) => state.closeResetConfirmation);
  const confirmResetSampleTree = useTreeStore((state) => state.confirmResetSampleTree);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previousActiveElementRef.current = document.activeElement as HTMLElement | null;

    // Focus cancel button or confirm button when opened
    const timer = setTimeout(() => {
      confirmButtonRef.current?.focus();
    }, 10);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeResetConfirmation();
        return;
      }
      if (e.key === 'Tab') {
        handleModalTabKey(e, modalRef.current);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
      if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === 'function') {
        previousActiveElementRef.current.focus();
      }
    };
  }, [isOpen, closeResetConfirmation]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-modal-title"
      aria-describedby="reset-modal-description"
      className="nokey fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150 motion-reduce:transition-none"
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-2xl border border-slate-200"
      >
        <button
          type="button"
          onClick={closeResetConfirmation}
          className="absolute top-4 right-4 p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          aria-label="Close reset confirmation"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>

          <div className="flex-1">
            <h2 id="reset-modal-title" className="text-base font-semibold text-slate-900">
              Reset to Sample Tree?
            </h2>
            <p id="reset-modal-description" className="mt-2 text-xs leading-relaxed text-slate-600">
              Resetting will replace the entire current tree with the canonical Sample Compliance Template.
              All unsaved edits and existing undo/redo history will be cleared. This action immediately updates local storage.
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={closeResetConfirmation}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            onClick={() => confirmResetSampleTree()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-md shadow-xs transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Tree
          </button>
        </div>
      </div>
    </div>
  );
};
