'use client';

import React, { useState, useMemo, useRef, useTransition } from 'react';
import {
  FileCode,
  Upload,
  Download,
  Copy,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  X,
  Shield,
  Check,
  FileText,
  Sparkles,
} from 'lucide-react';
import { useTreeStore } from '../../store/treeStore';
import {
  exportGraph,
  prepareGraphImport,
  getValidExampleDocument,
  getBrokenExampleDocument,
  IMPORT_ERROR_MESSAGES,
} from '../../lib/json';
import { evaluateExportGuard } from '../../lib/exportGuard';

interface JsonImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'export' | 'import';
}

export const JsonImportExportModal: React.FC<JsonImportExportModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'export',
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>(defaultTab);
  const nodes = useTreeStore((state) => state.nodes);
  const edges = useTreeStore((state) => state.edges);
  const setNodes = useTreeStore((state) => state.setNodes);
  const setEdges = useTreeStore((state) => state.setEdges);
  const setStatusFeedback = useTreeStore((state) => state.setStatusFeedback);

  // Export state
  const [copiedExport, setCopiedExport] = useState(false);

  // Import state
  const [importText, setImportText] = useState('');
  const [isPending, startTransition] = useTransition();
  const [commitSuccessMessage, setCommitSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Memoized export JSON string
  const exportJsonStr = useMemo(() => {
    if (!isOpen) return '';
    return exportGraph(nodes, edges);
  }, [isOpen, nodes, edges]);

  // Export guard evaluation
  const exportGuard = useMemo(() => evaluateExportGuard(nodes, edges), [nodes, edges]);

  // Memoized live import validation result
  const importResult = useMemo(() => {
    if (!importText.trim()) return null;
    return prepareGraphImport(importText);
  }, [importText]);

  if (!isOpen) return null;

  const handleCopyExport = async () => {
    if (!exportGuard.allowed) {
      setStatusFeedback(exportGuard.reason ?? 'Export blocked by export guard.');
      return;
    }
    try {
      await navigator.clipboard.writeText(exportJsonStr);
      setCopiedExport(true);
      setTimeout(() => setCopiedExport(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleDownloadExport = () => {
    if (!exportGuard.allowed) {
      setStatusFeedback(exportGuard.reason ?? 'Export blocked by export guard.');
      return;
    }
    const blob = new Blob([exportJsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compliance-tree-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setStatusFeedback('Exported compliance tree JSON successfully.');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setImportText(content);
        setActiveTab('import');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleLoadValidExample = () => {
    const validJson = getValidExampleDocument();
    setImportText(validJson);
    setActiveTab('import');
  };

  const handleLoadBrokenExample = () => {
    const brokenJson = getBrokenExampleDocument();
    setImportText(brokenJson);
    setActiveTab('import');
  };

  /**
   * Phase 2: Transactional Commit
   * Applies the prepared graph atomically into the store using Day 8 history-batching mechanism
   * (applyGraphBatch) creating exactly one Zundo history entry and clearing transient selection.
   */
  const handleCommitImport = () => {
    if (isPending) return;

    // Strict freshness check: revalidate directly from importText
    const freshCheck = prepareGraphImport(importText);
    if (!freshCheck.ok) return;

    startTransition(() => {
      const preparedGraph = freshCheck.graph;
      const success = useTreeStore.getState().applyGraphBatch({
        nodes: preparedGraph.nodes,
        edges: preparedGraph.edges,
      });

      if (!success) return;

      useTreeStore.getState().clearSelection();

      setCommitSuccessMessage(
        `Successfully imported graph with ${preparedGraph.nodes.length} nodes and ${preparedGraph.edges.length} edges.`
      );
      setStatusFeedback(`Imported graph successfully (${preparedGraph.nodes.length} nodes).`);

      setTimeout(() => {
        onClose();
      }, 1200);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 select-none animate-in fade-in-0 duration-150">
      <div
        className="nokey bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 tracking-tight">
                JSON Document Interchange & Versioned Import
              </h2>
              <p className="text-xs text-slate-500">
                Enterprise v1 schema specification with transactional validation & rollback protection
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 px-6 bg-white shrink-0">
          <button
            onClick={() => setActiveTab('export')}
            className={`px-4 py-3 text-xs font-semibold border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'export'
                ? 'border-blue-600 text-blue-600 bg-blue-50/30'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Export Document</span>
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`px-4 py-3 text-xs font-semibold border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'import'
                ? 'border-blue-600 text-blue-600 bg-blue-50/30'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Transactional Import</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {activeTab === 'export' ? (
            <div className="space-y-4">
              {!exportGuard.allowed && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-900 space-y-0.5">
                    <p className="font-semibold">Export Guard Active</p>
                    <p>{exportGuard.reason ?? 'Cannot export graph with critical validation errors.'}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Canonical v1 JSON Export
                  </h3>
                  <p className="text-xs text-slate-500">
                    Excludes UI runtime properties (selected, dragging, measured) and formats deterministically.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={!exportGuard.allowed}
                    onClick={handleCopyExport}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition shadow-2xs ${
                      exportGuard.allowed
                        ? 'text-slate-700 bg-white border-slate-200 hover:bg-slate-100 cursor-pointer'
                        : 'text-slate-400 bg-slate-50 border-slate-200 cursor-not-allowed opacity-60'
                    }`}
                    title={exportGuard.allowed ? 'Copy JSON to clipboard' : exportGuard.reason}
                  >
                    {copiedExport ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                    <span>{copiedExport ? 'Copied!' : 'Copy JSON'}</span>
                  </button>
                  <button
                    disabled={!exportGuard.allowed}
                    onClick={handleDownloadExport}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition shadow-2xs ${
                      exportGuard.allowed
                        ? 'text-white bg-blue-600 border-blue-600 hover:bg-blue-700 cursor-pointer'
                        : 'text-slate-400 bg-slate-200 border-slate-200 cursor-not-allowed opacity-60'
                    }`}
                    title={exportGuard.allowed ? 'Download JSON document' : exportGuard.reason}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download File</span>
                  </button>
                </div>
              </div>

              <div className="relative">
                <textarea
                  readOnly
                  value={exportJsonStr}
                  className="w-full h-96 p-4 font-mono text-xs bg-slate-900 text-slate-100 rounded-xl border border-slate-800 focus:outline-hidden resize-none shadow-inner"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                <Shield className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-900 space-y-1">
                  <p className="font-semibold">Export Compliance Guarantee</p>
                  <p>
                    The generated JSON document conforms strictly to the Day 15 schema specification. All node positions, types, parameters, tags, and directed edges are fully preserved for lossless interchange.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Import & Validate JSON Document
                  </h3>
                  <p className="text-xs text-slate-500">
                    Paste JSON content, upload a file, or load example fixtures to test transactional validation.
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".json"
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition shadow-2xs cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-slate-500" />
                    <span>Upload .json</span>
                  </button>
                  <button
                    onClick={handleLoadValidExample}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition shadow-2xs cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Load Valid Example</span>
                  </button>
                  <button
                    onClick={handleLoadBrokenExample}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition shadow-2xs cursor-pointer"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>Load Broken Example</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Input Textarea */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-700">
                    <span>JSON Source Input</span>
                    {importText && (
                      <button
                        onClick={() => setImportText('')}
                        className="text-blue-600 hover:underline cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <textarea
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder="Paste versioned compliance tree JSON here..."
                    className="w-full h-80 p-4 font-mono text-xs bg-white text-slate-900 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-hidden resize-none shadow-xs"
                  />
                </div>

                {/* Right: Live Validation & Diagnostics Panel */}
                <div className="space-y-2 flex flex-col">
                  <span className="text-xs font-medium text-slate-700">
                    Transactional Validation Preview
                  </span>
                  <div className="flex-1 bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between overflow-y-auto h-80 shadow-xs">
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
                            <span className="font-medium text-slate-700">Nodes Count:</span>
                            <span className="font-mono">{importResult.graph.nodes.length}</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-100">
                            <span className="font-medium text-slate-700">Edges Count:</span>
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

              {/* Commit Footer Action */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  disabled={!importResult || !importResult.ok || isPending}
                  onClick={handleCommitImport}
                  className={`px-5 py-2 text-xs font-semibold text-white rounded-lg transition shadow-sm flex items-center gap-2 ${
                    importResult && importResult.ok && !isPending
                      ? 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
                      : 'bg-slate-300 cursor-not-allowed opacity-70'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  <span>{isPending ? 'Committing...' : 'Commit Transactional Import'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
