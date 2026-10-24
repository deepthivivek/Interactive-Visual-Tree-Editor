'use client';

import React, { useSyncExternalStore, useMemo } from 'react';
import {
  Network,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Undo2,
  Redo2,
  Workflow,
  Keyboard,
  Upload,
  Download,
} from 'lucide-react';
import { useTreeStore, SAMPLE_COMPLIANCE_TEMPLATE_LABEL } from '../../store/treeStore';
import { SearchBox } from './SearchBox';
import { runGraphDiagnostics } from '../../lib/graphDiagnostics';

export const TreeHeader: React.FC = () => {
  const { undo, redo } = useTreeStore();
  const nodes = useTreeStore((state) => state.nodes);
  const edges = useTreeStore((state) => state.edges);
  const persistenceStatus = useTreeStore((state) => state.persistenceStatus);
  const saveStatus = useTreeStore((state) => state.saveStatus);
  const saveErrorMessage = useTreeStore((state) => state.saveErrorMessage);
  const lastSavedAt = useTreeStore((state) => state.lastSavedAt);
  const saveNow = useTreeStore((state) => state.saveNow);
  const openResetConfirmation = useTreeStore((state) => state.openResetConfirmation);
  const nodesCount = nodes.length;

  const diagnostics = useMemo(() => runGraphDiagnostics(nodes, edges), [nodes, edges]);

  const pastCount = useSyncExternalStore(
    useTreeStore.temporal.subscribe,
    () => useTreeStore.temporal.getState().pastStates.length,
    () => 0
  );
  const futureCount = useSyncExternalStore(
    useTreeStore.temporal.subscribe,
    () => useTreeStore.temporal.getState().futureStates.length,
    () => 0
  );

  return (
    <header className="nokey h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between shrink-0 select-none z-20">
      {/* Left Zone: Brand Wordmark & Template Context */}
      <div className="flex items-center gap-3.5 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
          <Network className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-sm sm:text-base font-semibold text-slate-900 tracking-tight truncate">
              Interactive Visual Tree Editor
            </h1>
            <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
              {SAMPLE_COMPLIANCE_TEMPLATE_LABEL}
            </span>
          </div>
          <p className="text-xs text-slate-500 truncate">
            Build, manage and visualize your compliance rule trees
          </p>
        </div>
      </div>

      {/* Right Zone: Cleanly Grouped Functional Action Controls */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        {/* Group 1: Undo / Redo History */}
        <div className="flex items-center gap-1 bg-slate-50 p-0.5 rounded-lg border border-slate-200/80">
          <button
            type="button"
            disabled={pastCount === 0}
            onClick={() => undo()}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition ${
              pastCount > 0
                ? 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100 shadow-2xs cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500'
                : 'text-slate-300 cursor-not-allowed opacity-60'
            }`}
            title={
              pastCount > 0
                ? `Undo (${pastCount} action${pastCount > 1 ? 's' : ''} available) [Ctrl+Z / ⌘Z]`
                : 'Undo (No actions to undo) [Ctrl+Z / ⌘Z]'
            }
            aria-label={`Undo (${pastCount} actions available)`}
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Undo</span>
            {pastCount > 0 && (
              <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1 rounded">
                {pastCount}
              </span>
            )}
          </button>

          <button
            type="button"
            disabled={futureCount === 0}
            onClick={() => redo()}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition ${
              futureCount > 0
                ? 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100 shadow-2xs cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500'
                : 'text-slate-300 cursor-not-allowed opacity-60'
            }`}
            title={
              futureCount > 0
                ? `Redo (${futureCount} action${futureCount > 1 ? 's' : ''} available) [Ctrl+Shift+Z / ⌘Shift+Z]`
                : 'Redo (No actions to redo) [Ctrl+Shift+Z / ⌘Shift+Z]'
            }
            aria-label={`Redo (${futureCount} actions available)`}
          >
            <Redo2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Redo</span>
            {futureCount > 0 && (
              <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1 rounded">
                {futureCount}
              </span>
            )}
          </button>
        </div>

        {/* Group 2: Search */}
        <SearchBox />

        {/* Group 3: Diagnostics & Shortcuts */}
        <button
          type="button"
          onClick={() => {
            window.dispatchEvent(new CustomEvent('tree:trigger-diagnostics'));
          }}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition shadow-2xs cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500 ${
            diagnostics.status === 'healthy'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
              : diagnostics.status === 'warning'
              ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
              : 'bg-red-50 text-red-800 border-red-200 hover:bg-red-100'
          }`}
          title={`Graph Diagnostics: ${
            diagnostics.status === 'healthy'
              ? 'Hierarchy is healthy (0 issues)'
              : `${diagnostics.totalIssues} issue${diagnostics.totalIssues > 1 ? 's' : ''} detected`
          } [Ctrl+Shift+D]`}
          aria-label={`Graph Diagnostics: ${diagnostics.status}`}
        >
          {diagnostics.status === 'healthy' ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          ) : diagnostics.status === 'warning' ? (
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 text-red-600" />
          )}
          <span className="hidden sm:inline font-semibold">
            {diagnostics.status === 'healthy'
              ? 'Healthy'
              : diagnostics.status === 'warning'
              ? `${diagnostics.warningCount} Warn`
              : `${diagnostics.errorCount} Error${diagnostics.errorCount > 1 ? 's' : ''}`}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            window.dispatchEvent(new CustomEvent('tree:trigger-shortcuts'));
          }}
          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 hover:border-slate-300 transition shadow-2xs cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500"
          title="Keyboard Shortcuts Reference [?]"
          aria-label="Keyboard Shortcuts"
        >
          <Keyboard className="w-3.5 h-3.5 text-slate-500" />
          <span className="hidden xl:inline">Shortcuts</span>
        </button>

        {/* Group 4: Interchange & Actions */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('tree:trigger-import-modal'))}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 hover:border-slate-300 transition shadow-2xs cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500"
            title="Import compliance tree JSON document with validation and merge support"
            aria-label="Import JSON"
          >
            <Upload className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden xl:inline">Import</span>
          </button>

          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('tree:trigger-export-modal'))}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 hover:border-slate-300 transition shadow-2xs cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500"
            title="Export compliance tree JSON document (version 1 schema)"
            aria-label="Export JSON"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden xl:inline">Export</span>
          </button>

          <button
            type="button"
            disabled={nodesCount === 0}
            onClick={() => {
              window.dispatchEvent(new CustomEvent('tree:trigger-autolayout'));
            }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition shadow-2xs ${
              nodesCount > 0
                ? 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300 cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500'
                : 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed opacity-60'
            }`}
            title="Auto Layout (arranges tree in hierarchical top-to-bottom layout) [Ctrl+Shift+L / ⌘Shift+L]"
            aria-label="Auto Layout"
          >
            <Workflow className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline">Auto Layout</span>
          </button>

          <button
            type="button"
            onClick={() => openResetConfirmation()}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 hover:border-slate-300 transition shadow-2xs cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500"
            title="Reset tree to sample compliance template (requires confirmation)"
            aria-label="Reset Tree"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden xl:inline">Reset</span>
          </button>
        </div>

        {/* Group 5: Truthful Persistence & Save Status Indicator */}
        <div className="flex items-center pl-1 border-l border-slate-200">
          {persistenceStatus === 'recovery-required' ? (
            <button
              type="button"
              onClick={() => {
                useTreeStore.setState({ recoveryError: useTreeStore.getState().recoveryError || 'Workspace corruption detected' });
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition shadow-2xs cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500"
              title="Corrupted data detected in local storage. Click to resolve."
              aria-label="Storage recovery required"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-red-600 animate-pulse" />
              <span>Recovery Needed</span>
            </button>
          ) : persistenceStatus === 'restoring' || saveStatus === 'saving' ? (
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs"
              title="Saving changes to local storage..."
              role="status"
              aria-live="polite"
            >
              <RotateCcw className="w-3.5 h-3.5 text-blue-600 animate-spin" />
              <span>{persistenceStatus === 'restoring' ? 'Restoring...' : 'Saving...'}</span>
            </div>
          ) : saveStatus === 'error' ? (
            <button
              type="button"
              onClick={() => saveNow()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition shadow-2xs cursor-pointer focus-visible:ring-2 focus-visible:ring-rose-500"
              title={`Save error: ${saveErrorMessage ?? 'Storage write failed'}. Click to retry.`}
              aria-label="Save failed, click to retry"
            >
              <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
              <span>Retry Save</span>
            </button>
          ) : saveStatus === 'unsaved' ? (
            <button
              type="button"
              onClick={() => saveNow()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition shadow-2xs cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-500"
              title="Unsaved changes pending autosave debounce. Click to save now."
              aria-label="Unsaved changes, click to save now"
            >
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Unsaved</span>
            </button>
          ) : saveStatus === 'saved' ? (
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-slate-50 text-slate-600 border border-slate-200 shadow-2xs"
              title={lastSavedAt ? `Saved to local storage at ${new Date(lastSavedAt).toLocaleTimeString()}` : 'Saved to local storage'}
              role="status"
              aria-label="All changes saved to local storage"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Saved</span>
            </div>
          ) : persistenceStatus === 'unavailable' ? (
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-slate-100 text-slate-500 border border-slate-200 shadow-2xs"
              title="Local storage is disabled or unavailable in this browser environment."
              role="status"
            >
              <span>Offline</span>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
};
