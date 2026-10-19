'use client';

import React, { useSyncExternalStore, useMemo } from 'react';
import {
  Network,
  RotateCcw,
  Search,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  FileCode,
  Sun,
  User,
  Undo2,
  Redo2,
  Workflow,
  Keyboard,
} from 'lucide-react';
import { useTreeStore, SAMPLE_COMPLIANCE_TEMPLATE_LABEL } from '../../store/treeStore';
import { SearchBox } from './SearchBox';
import { runGraphDiagnostics } from '../../lib/graphDiagnostics';
import { exportTreeDocument } from '../../lib/graphOperations';
import { evaluateExportGuard } from '../../lib/exportGuard';

export const TreeHeader: React.FC = () => {
  const { loadSampleTree, undo, redo } = useTreeStore();
  const nodes = useTreeStore((state) => state.nodes);
  const edges = useTreeStore((state) => state.edges);
  const nodesCount = nodes.length;

  const diagnostics = useMemo(() => runGraphDiagnostics(nodes, edges), [nodes, edges]);

  const handleExportJson = () => {
    const exportCheck = evaluateExportGuard(nodes, edges);
    if (!exportCheck.allowed) {
      useTreeStore.getState().setStatusFeedback(exportCheck.reason ?? 'Cannot export invalid graph.');
      window.dispatchEvent(new CustomEvent('tree:trigger-validation'));
      return;
    }

    const doc = exportTreeDocument(nodes, edges);
    const jsonStr = JSON.stringify(doc, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compliance-tree-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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
      {/* Left: Application Logo, Title, Subtitle */}
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

      {/* Right: Reserved Action Placeholders, Undo/Redo & Working Reset */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Undo Action (Day 8) */}
        <button
          type="button"
          disabled={pastCount === 0}
          onClick={() => undo()}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition shadow-2xs ${
            pastCount > 0
              ? 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100 cursor-pointer'
              : 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed opacity-60'
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

        {/* Redo Action (Day 8) */}
        <button
          type="button"
          disabled={futureCount === 0}
          onClick={() => redo()}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition shadow-2xs ${
            futureCount > 0
              ? 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100 cursor-pointer'
              : 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed opacity-60'
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

        {/* Advanced Search Box (Day 9) */}
        <SearchBox />

        {/* Graph Diagnostics Trigger (Day 11) */}
        <button
          type="button"
          onClick={() => {
            window.dispatchEvent(new CustomEvent('tree:trigger-diagnostics'));
          }}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition shadow-2xs cursor-pointer ${
            diagnostics.status === 'healthy'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300'
              : diagnostics.status === 'warning'
              ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100 hover:border-amber-300'
              : 'bg-red-50 text-red-800 border-red-200 hover:bg-red-100 hover:border-red-300'
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

        {/* Keyboard Shortcuts Trigger (Day 11) */}
        <button
          type="button"
          onClick={() => {
            window.dispatchEvent(new CustomEvent('tree:trigger-shortcuts'));
          }}
          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100 transition shadow-2xs cursor-pointer"
          title="Keyboard Shortcuts Reference [?]"
          aria-label="Keyboard Shortcuts"
        >
          <Keyboard className="w-3.5 h-3.5 text-slate-500" />
          <span className="hidden xl:inline">Shortcuts</span>
        </button>

        {/* Graph Validation & Quality Trigger (Day 14) */}
        <button
          type="button"
          onClick={() => {
            window.dispatchEvent(new CustomEvent('tree:trigger-validation'));
          }}
          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100 transition shadow-2xs cursor-pointer"
          title="Graph Validation & Quality Panel"
          aria-label="Validation & Quality Panel"
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span className="hidden xl:inline">Validation</span>
        </button>

        {/* JSON / Export Action */}
        <button
          type="button"
          onClick={handleExportJson}
          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100 transition shadow-2xs cursor-pointer"
          title="Export compliance tree JSON document (version 1 schema)"
          aria-label="Export compliance tree as JSON"
        >
          <FileCode className="w-3.5 h-3.5 text-slate-500" />
          <span className="hidden xl:inline">Export JSON</span>
        </button>

        {/* Auto Layout (Day 10) */}
        <button
          type="button"
          disabled={nodesCount === 0}
          onClick={() => {
            window.dispatchEvent(new CustomEvent('tree:trigger-autolayout'));
          }}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition shadow-2xs ${
            nodesCount > 0
              ? 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100 cursor-pointer'
              : 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed opacity-60'
          }`}
          title="Auto Layout (arranges tree in hierarchical top-to-bottom layout)"
          aria-label="Auto Layout"
        >
          <Workflow className="w-3.5 h-3.5 text-blue-600" />
          <span className="hidden sm:inline">Auto Layout</span>
        </button>

        {/* Load Sample Tree (Active Day 1/4 Action) */}
        <button
          onClick={() => loadSampleTree()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100 transition shadow-2xs cursor-pointer"
          title="Replace current tree with the canonical Day 1 sample compliance template"
        >
          <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
          <span>Load Sample Tree</span>
        </button>

        {/* Theme Placeholder */}
        <button
          disabled
          className="p-1.5 text-slate-400 hover:text-slate-500 rounded-md hover:bg-slate-50 border border-transparent cursor-not-allowed opacity-70"
          title="Light theme is active. Theme selector scheduled for later milestone"
        >
          <Sun className="w-4 h-4" />
        </button>

        {/* User / Profile Placeholder */}
        <div className="pl-2 border-l border-slate-200 flex items-center">
          <div
            className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shadow-2xs"
            title="Enterprise Compliance Officer (Day 1 Session)"
          >
            <User className="w-4 h-4 text-slate-500" />
          </div>
        </div>
      </div>
    </header>
  );
};
