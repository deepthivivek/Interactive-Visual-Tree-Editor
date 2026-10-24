'use client';

import React, { useEffect, useRef } from 'react';
import { AlertOctagon, Download, RefreshCw, PlusCircle, X } from 'lucide-react';
import { useTreeStore } from '../../store/treeStore';
import { handleModalTabKey } from '../../lib/modalFocus';

export const PersistenceRecoveryModal: React.FC = () => {
  const persistenceStatus = useTreeStore((state) => state.persistenceStatus);
  const recoveryError = useTreeStore((state) => state.recoveryError);
  const corruptedPayload = useTreeStore((state) => state.corruptedPayload);
  const recoverWithSampleTree = useTreeStore((state) => state.recoverWithSampleTree);
  const recoverWithEmptyTree = useTreeStore((state) => state.recoverWithEmptyTree);
  const dismissRecoveryModal = useTreeStore((state) => state.dismissRecoveryModal);

  const isOpen = persistenceStatus === 'recovery-required' && recoveryError !== null;
  const initialFocusRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previousActiveElementRef.current = document.activeElement as HTMLElement | null;

    const timer = setTimeout(() => {
      initialFocusRef.current?.focus();
    }, 10);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        dismissRecoveryModal();
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
  }, [isOpen, dismissRecoveryModal]);

  if (!isOpen) return null;

  const handleDownloadRawPayload = () => {
    if (!corruptedPayload) return;
    const blob = new Blob([corruptedPayload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `corrupted-tree-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="recovery-modal-title"
      aria-describedby="recovery-modal-description"
      className="nokey fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 motion-reduce:transition-none"
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl border border-slate-200"
      >
        <button
          type="button"
          onClick={dismissRecoveryModal}
          className="absolute top-4 right-4 p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          aria-label="Dismiss recovery notice"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
            <AlertOctagon className="w-5 h-5" />
          </div>

          <div className="flex-1">
            <h2 id="recovery-modal-title" className="text-base font-semibold text-slate-900">
              Workspace Recovery Required
            </h2>
            <p id="recovery-modal-description" className="mt-1 text-xs text-slate-600">
              The workspace saved in local storage failed validation or contains incompatible data.
              To guarantee zero accidental data loss, local storage was <span className="font-semibold text-slate-800">not</span> overwritten.
            </p>
          </div>
        </div>

        {/* Diagnostic Error Box */}
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-[11px] font-mono font-medium text-red-800 break-words">
            {recoveryError}
          </p>
        </div>

        {/* Options / Action List */}
        <div className="mt-5 space-y-2.5">
          <div className="text-xs font-medium text-slate-700">Choose recovery action:</div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              ref={initialFocusRef}
              type="button"
              onClick={() => recoverWithSampleTree()}
              className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 text-left transition group cursor-pointer"
            >
              <RefreshCw className="w-4 h-4 text-blue-600 shrink-0 group-hover:rotate-180 transition-transform duration-300" />
              <div>
                <div className="text-xs font-semibold text-slate-800">Restore Sample Tree</div>
                <div className="text-[10px] text-slate-500">Reset storage to canonical template</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => recoverWithEmptyTree()}
              className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 text-left transition group cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <div className="text-xs font-semibold text-slate-800">Start Blank Canvas</div>
                <div className="text-[10px] text-slate-500">Clear workspace to clean empty canvas</div>
              </div>
            </button>
          </div>

          {corruptedPayload && (
            <button
              type="button"
              onClick={handleDownloadRawPayload}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              Download Raw Backup Payload ({corruptedPayload.length} bytes)
            </button>
          )}
        </div>

        <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={dismissRecoveryModal}
            className="text-xs text-slate-500 hover:text-slate-700 hover:underline cursor-pointer"
          >
            Dismiss and inspect in-memory workspace
          </button>
        </div>
      </div>
    </div>
  );
};
