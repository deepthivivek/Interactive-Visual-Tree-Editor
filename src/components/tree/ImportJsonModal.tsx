'use client';

import React, { useState, useMemo, useRef, useTransition, useEffect } from 'react';
import {
  Upload,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  X,
  Check,
  FileText,
  Sparkles,
  GitMerge,
} from 'lucide-react';
import { useTreeStore } from '../../store/treeStore';
import {
  prepareGraphImport,
  mergeGraph,
  getValidExampleDocument,
  getBrokenExampleDocument,
  IMPORT_ERROR_MESSAGES,
} from '../../lib/json';
import { handleModalTabKey } from '../../lib/modalFocus';

interface ImportJsonModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ImportJsonModal: React.FC<ImportJsonModalProps> = ({ isOpen, onClose }) => {
  const setStatusFeedback = useTreeStore((state) => state.setStatusFeedback);

  const [importText, setImportText] = useState('');
  const [mergeMode, setMergeMode] = useState(true); // Default to merging with existing canvas
  const [isPending, startTransition] = useTransition();
  const [commitSuccessMessage, setCommitSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  // Focus trap, initial focus, focus restoration, and Escape listener
  useEffect(() => {
    if (!isOpen) return;

    previousActiveElementRef.current = document.activeElement as HTMLElement | null;

    const timer = setTimeout(() => {
      const firstBtn = modalRef.current?.querySelector<HTMLElement>('button:not([disabled])');
      firstBtn?.focus();
    }, 10);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
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
  }, [isOpen, onClose]);

  // Memoized live import validation result
  const importResult = useMemo(() => {
    if (!importText.trim()) return null;
    return prepareGraphImport(importText);
  }, [importText]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setImportText(content);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleLoadValidExample = () => {
    const validJson = getValidExampleDocument();
    setImportText(validJson);
  };

  const handleLoadBrokenExample = () => {
    const brokenJson = getBrokenExampleDocument();
    setImportText(brokenJson);
  };

  const handleCommitImport = () => {
    if (isPending) return;

    const freshCheck = prepareGraphImport(importText);
    if (!freshCheck.ok) return;

    startTransition(() => {
      const preparedGraph = freshCheck.graph;
      const state = useTreeStore.getState();

      let targetNodes = preparedGraph.nodes;
      let targetEdges = preparedGraph.edges;

      if (mergeMode) {
        const merged = mergeGraph(state.nodes, state.edges, preparedGraph.nodes, preparedGraph.edges);
        targetNodes = merged.nodes;
        targetEdges = merged.edges;
      }

      const success = state.applyGraphBatch({
        nodes: targetNodes,
        edges: targetEdges,
      });

      if (!success) return;

      useTreeStore.getState().clearSelection();

      const actionDesc = mergeMode ? 'merged into canvas' : 'imported';
      setCommitSuccessMessage(
        `Successfully ${actionDesc} with ${preparedGraph.nodes.length} imported nodes and ${preparedGraph.edges.length} edges.`
      );
      setStatusFeedback(`Graph successfully ${actionDesc} (${preparedGraph.nodes.length} nodes).`);

      setTimeout(() => {
        onClose();
      }, 1200);
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-modal-title"
      aria-describedby="import-modal-desc"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 select-none animate-in fade-in-0 duration-150"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="nokey bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 id="import-modal-title" className="text-base font-semibold text-slate-900 tracking-tight">
                Import & Validate JSON Document
              </h2>
              <p id="import-modal-desc" className="text-xs text-slate-500">
                Transactional validation engine with merge & rollback protection
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500 outline-hidden"
            aria-label="Close import dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                JSON Import Source
              </h3>
              <p className="text-xs text-slate-500">
                Upload a `.json` file, paste compliance tree JSON, or test with fixture examples.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".json"
                className="hidden"
                aria-label="Upload JSON file"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition shadow-2xs cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500 outline-hidden"
              >
                <Upload className="w-3.5 h-3.5 text-slate-500" />
                <span>Upload .json</span>
              </button>
              <button
                onClick={handleLoadValidExample}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition shadow-2xs cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-500 outline-hidden"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Load Valid Example</span>
              </button>
              <button
                onClick={handleLoadBrokenExample}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition shadow-2xs cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-500 outline-hidden"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>Load Broken Example</span>
              </button>
            </div>
          </div>

          {/* Import Mode Option */}
          <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <GitMerge className="w-4 h-4 text-blue-600 shrink-0" />
              <div className="text-xs text-blue-900">
                <span className="font-semibold">Canvas Import Mode:</span>{' '}
                {mergeMode
                  ? 'Existing tree remains intact; imported nodes will be appended & merged alongside it.'
                  : 'Existing tree will be replaced entirely by the imported document.'}
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer shrink-0 text-xs font-medium text-blue-900 select-none">
              <input
                type="checkbox"
                checked={mergeMode}
                onChange={(e) => setMergeMode(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-blue-300 focus:ring-blue-500 cursor-pointer"
              />
              <span>Merge with existing canvas</span>
            </label>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Input Textarea */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-slate-700">
                <span>JSON Source Input</span>
                {importText && (
                  <button
                    onClick={() => setImportText('')}
                    className="text-blue-600 hover:underline cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500 outline-hidden rounded px-1"
                  >
                    Clear
                  </button>
                )}
              </div>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="Paste versioned compliance tree JSON here..."
                aria-label="JSON Source Input"
                className="w-full h-72 p-4 font-mono text-xs bg-white text-slate-900 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-hidden resize-none shadow-xs"
              />
            </div>

            {/* Right: Live Validation & Diagnostics Panel */}
            <div className="space-y-2 flex flex-col">
              <span className="text-xs font-medium text-slate-700">
                Transactional Validation Preview
              </span>
              <div className="flex-1 bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between overflow-y-auto h-72 shadow-xs">
                {!importText.trim() ? (
                  <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 space-y-2">
                    <FileText className="w-8 h-8 stroke-1" />
                    <p className="text-xs">Paste or load JSON to begin live validation.</p>
                  </div>
                ) : importResult === null ? (
                  <div className="flex items-center justify-center h-full text-slate-500 text-xs">
                    Validating syntax and structure...
                  </div>
                ) : importResult.ok ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-emerald-900">
                          Validation Passed Successfully
                        </p>
                        <p className="text-[11px] text-emerald-700">
                          Graph is structurally sound, acyclic, and ready for transactional commit.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs text-slate-600">
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="font-medium text-slate-700">Document Version:</span>
                        <span className="font-mono">v{importResult.graph.version}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="font-medium text-slate-700">Imported Nodes:</span>
                        <span className="font-mono">{importResult.graph.nodes.length}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="font-medium text-slate-700">Imported Edges:</span>
                        <span className="font-mono">{importResult.graph.edges.length}</span>
                      </div>
                      {importResult.notes.length > 0 && (
                        <div className="mt-2 p-2 bg-slate-50 rounded text-[11px] text-slate-500">
                          <span className="font-medium">Normalization Notes:</span>
                          <ul className="list-disc list-inside mt-1 space-y-0.5">
                            {importResult.notes.map((note, idx) => (
                              <li key={idx}>{note}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {commitSuccessMessage && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 font-medium">
                        {commitSuccessMessage}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3 overflow-y-auto">
                    <div className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg">
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                      <p className="text-xs font-semibold text-red-900">
                        Import Blocked ({importResult.errors.length} error{importResult.errors.length > 1 ? 's' : ''})
                      </p>
                    </div>

                    <div className="space-y-2">
                      {importResult.errors.map((err, idx) => {
                        const details = IMPORT_ERROR_MESSAGES[err.code];
                        return (
                          <div
                            key={idx}
                            className="p-2.5 bg-red-50/50 border border-red-100 rounded-lg space-y-1 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-red-900">
                                {details?.title ?? err.code}
                              </span>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 bg-red-100 text-red-800 rounded">
                                {err.stage}
                              </span>
                            </div>
                            <p className="text-slate-700 text-[11px]">{err.message}</p>
                            {details && (
                              <p className="text-[11px] text-slate-500 italic">
                                <span className="font-medium">Fix:</span> {details.howToFix}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Commit Footer Action */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-white">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500 outline-hidden"
          >
            Cancel
          </button>
          <button
            disabled={!importResult || !importResult.ok || isPending}
            onClick={handleCommitImport}
            className={`px-5 py-2 text-xs font-semibold text-white rounded-lg transition shadow-sm flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-blue-500 outline-hidden ${
              importResult && importResult.ok && !isPending
                ? 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
                : 'bg-slate-300 cursor-not-allowed opacity-70'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>
              {isPending
                ? 'Committing...'
                : mergeMode
                ? 'Merge & Append to Canvas'
                : 'Commit Transactional Import'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
