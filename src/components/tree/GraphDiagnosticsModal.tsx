'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  Layers,
  ArrowRight,
  RefreshCw,
  GitBranch,
} from 'lucide-react';
import { useTreeStore } from '../../store/treeStore';
import {
  runGraphDiagnostics,
  type GraphDiagnosticIssue,
  type DiagnosticSeverity,
} from '../../lib/graphDiagnostics';

interface GraphDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFocusNode?: (nodeId: string) => void;
}

export const GraphDiagnosticsModal: React.FC<GraphDiagnosticsModalProps> = ({
  isOpen,
  onClose,
  onFocusNode,
}) => {
  const { nodes, edges, setSelectedNodeId, setFocusPulseNodeId } = useTreeStore();
  const [selectedSeverity, setSelectedSeverity] = useState<DiagnosticSeverity | 'all'>('all');
  const [refreshNonce, setRefreshNonce] = useState(0);

  // Run pure diagnostics synchronously whenever nodes/edges change or refresh is triggered
  const diagnostics = useMemo(() => {
    if (refreshNonce < 0) return runGraphDiagnostics(nodes, edges);
    return runGraphDiagnostics(nodes, edges);
  }, [nodes, edges, refreshNonce]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Filtered issues
  const filteredIssues = useMemo(() => {
    if (selectedSeverity === 'all') {
      return diagnostics.issues;
    }
    return diagnostics.issues.filter((i) => i.severity === selectedSeverity);
  }, [diagnostics.issues, selectedSeverity]);

  if (!isOpen) return null;

  const handleSelectIssueNode = (nodeId?: string) => {
    if (!nodeId) return;
    setSelectedNodeId(nodeId);
    setFocusPulseNodeId(nodeId);
    if (onFocusNode) {
      onFocusNode(nodeId);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs select-none animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="diagnostics-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center text-white ${
                diagnostics.status === 'healthy'
                  ? 'bg-emerald-600'
                  : diagnostics.status === 'warning'
                  ? 'bg-amber-500'
                  : 'bg-red-600'
              }`}
            >
              {diagnostics.status === 'healthy' ? (
                <ShieldCheck className="w-5 h-5" />
              ) : diagnostics.status === 'warning' ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2
                  id="diagnostics-modal-title"
                  className="text-base font-semibold text-slate-900 tracking-tight"
                >
                  Graph Structure Diagnostics
                </h2>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide uppercase ${
                    diagnostics.status === 'healthy'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : diagnostics.status === 'warning'
                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                      : 'bg-red-100 text-red-800 border border-red-200'
                  }`}
                >
                  {diagnostics.status === 'healthy'
                    ? 'Healthy Hierarchy'
                    : diagnostics.status === 'warning'
                    ? `${diagnostics.warningCount} Warning${diagnostics.warningCount > 1 ? 's' : ''}`
                    : `${diagnostics.errorCount} Error${diagnostics.errorCount > 1 ? 's' : ''}`}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Audits single-parent compliance hierarchy, relationship rules, and tree completeness
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRefreshNonce((n) => n + 1)}
              className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-200/60 transition"
              title="Re-run Diagnostics"
              aria-label="Re-run diagnostics"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition"
              aria-label="Close diagnostics dialog"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Structural Metrics Ribbon */}
        <div className="bg-slate-100/60 border-b border-slate-200/80 px-6 py-2.5 grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs">
          <div className="bg-white rounded px-2 py-1 border border-slate-200/60 shadow-2xs">
            <span className="text-[10px] uppercase font-medium text-slate-400 block">Nodes</span>
            <span className="font-semibold text-slate-800">{diagnostics.metrics.nodeCount}</span>
          </div>
          <div className="bg-white rounded px-2 py-1 border border-slate-200/60 shadow-2xs">
            <span className="text-[10px] uppercase font-medium text-slate-400 block">Edges</span>
            <span className="font-semibold text-slate-800">{diagnostics.metrics.edgeCount}</span>
          </div>
          <div className="bg-white rounded px-2 py-1 border border-slate-200/60 shadow-2xs">
            <span className="text-[10px] uppercase font-medium text-slate-400 block">Max Depth</span>
            <span className="font-semibold text-slate-800">{diagnostics.metrics.maxDepth}</span>
          </div>
          <div className="bg-white rounded px-2 py-1 border border-slate-200/60 shadow-2xs">
            <span className="text-[10px] uppercase font-medium text-slate-400 block">Leaves</span>
            <span className="font-semibold text-slate-800">{diagnostics.metrics.leafCount}</span>
          </div>
          <div className="bg-white rounded px-2 py-1 border border-slate-200/60 shadow-2xs">
            <span className="text-[10px] uppercase font-medium text-slate-400 block">Roots</span>
            <span
              className={`font-semibold ${
                diagnostics.metrics.rootCount === 1 ? 'text-emerald-700' : 'text-amber-600'
              }`}
            >
              {diagnostics.metrics.rootCount}
            </span>
          </div>
          <div className="bg-white rounded px-2 py-1 border border-slate-200/60 shadow-2xs">
            <span className="text-[10px] uppercase font-medium text-slate-400 block">Orphaned</span>
            <span
              className={`font-semibold ${
                diagnostics.metrics.orphanedCount === 0 ? 'text-slate-700' : 'text-amber-600'
              }`}
            >
              {diagnostics.metrics.orphanedCount}
            </span>
          </div>
        </div>

        {/* Severity Filter Tabs */}
        <div className="px-6 py-2.5 border-b border-slate-100 flex items-center justify-between text-xs bg-white">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedSeverity('all')}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                selectedSeverity === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              All ({diagnostics.totalIssues})
            </button>
            <button
              type="button"
              onClick={() => setSelectedSeverity('error')}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                selectedSeverity === 'error'
                  ? 'bg-red-600 text-white'
                  : 'text-red-700 hover:bg-red-50'
              }`}
            >
              Errors ({diagnostics.errorCount})
            </button>
            <button
              type="button"
              onClick={() => setSelectedSeverity('warning')}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                selectedSeverity === 'warning'
                  ? 'bg-amber-500 text-white'
                  : 'text-amber-700 hover:bg-amber-50'
              }`}
            >
              Warnings ({diagnostics.warningCount})
            </button>
            <button
              type="button"
              onClick={() => setSelectedSeverity('info')}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                selectedSeverity === 'info'
                  ? 'bg-blue-600 text-white'
                  : 'text-blue-700 hover:bg-blue-50'
              }`}
            >
              Info ({diagnostics.infoCount})
            </button>
          </div>

          <span className="text-[11px] text-slate-400">
            Showing {filteredIssues.length} issue{filteredIssues.length === 1 ? '' : 's'}
          </span>
        </div>

        {/* Issues List Body */}
        <div className="p-6 overflow-y-auto space-y-3 flex-1 bg-slate-50/30">
          {filteredIssues.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-800">No issues found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {selectedSeverity === 'all'
                  ? 'The tree structure conforms to all compliance relationship rules and hierarchy standards.'
                  : `No issues matching the "${selectedSeverity}" severity level.`}
              </p>
            </div>
          ) : (
            filteredIssues.map((issue) => {
              const isError = issue.severity === 'error';
              const isWarning = issue.severity === 'warning';

              return (
                <div
                  key={issue.id}
                  className={`p-4 rounded-lg border bg-white shadow-2xs transition hover:shadow-xs ${
                    isError
                      ? 'border-red-200'
                      : isWarning
                      ? 'border-amber-200'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="mt-0.5 shrink-0">
                        {isError ? (
                          <AlertCircle className="w-4 h-4 text-red-600" />
                        ) : isWarning ? (
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                        ) : (
                          <Info className="w-4 h-4 text-blue-500" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs font-semibold text-slate-900 leading-snug">
                            {issue.title}
                          </h4>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200 uppercase">
                            {issue.category}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                          {issue.description}
                        </p>
                        {issue.fixSuggestion && (
                          <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1.5">
                            <span className="font-medium text-slate-700">Suggestion:</span>
                            <span>{issue.fixSuggestion}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    {issue.nodeId && (
                      <button
                        type="button"
                        onClick={() => handleSelectIssueNode(issue.nodeId)}
                        className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-50 text-blue-600 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 text-xs font-medium transition cursor-pointer"
                        title="Select and center on this node"
                      >
                        <span>Inspect</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between text-xs text-slate-500">
          <span>Click &quot;Inspect&quot; on any issue to focus the node in the canvas</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition shadow-2xs cursor-pointer"
          >
            Close (Esc)
          </button>
        </div>
      </div>
    </div>
  );
};
