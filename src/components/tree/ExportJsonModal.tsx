'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Download, Copy, Check, AlertTriangle, Shield, X } from 'lucide-react';
import { useTreeStore } from '../../store/treeStore';
import { exportGraph } from '../../lib/json';
import { evaluateExportGuard } from '../../lib/exportGuard';

interface ExportJsonModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExportJsonModal: React.FC<ExportJsonModalProps> = ({ isOpen, onClose }) => {
  const nodes = useTreeStore((state) => state.nodes);
  const edges = useTreeStore((state) => state.edges);
  const setStatusFeedback = useTreeStore((state) => state.setStatusFeedback);

  const [copiedExport, setCopiedExport] = useState(false);

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

  // Memoized export JSON string
  const exportJsonStr = useMemo(() => {
    if (!isOpen) return '';
    return exportGraph(nodes, edges);
  }, [isOpen, nodes, edges]);

  // Export guard evaluation
  const exportGuard = useMemo(() => evaluateExportGuard(nodes, edges), [nodes, edges]);

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
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
      aria-describedby="export-modal-desc"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 select-none animate-in fade-in-0 duration-150"
      onClick={onClose}
    >
      <div
        className="nokey bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 id="export-modal-title" className="text-base font-semibold text-slate-900 tracking-tight">
                Export Compliance Tree JSON
              </h2>
              <p id="export-modal-desc" className="text-xs text-slate-500">
                Canonical v1 schema export with structural validation & export guard protection
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500 outline-hidden"
            aria-label="Close export dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 space-y-4">
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
                Canonical v1 JSON Document
              </h3>
              <p className="text-xs text-slate-500">
                Excludes UI runtime properties (selected, dragging, measured) and formats deterministically.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={!exportGuard.allowed}
                onClick={handleCopyExport}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition shadow-2xs focus-visible:ring-2 focus-visible:ring-blue-500 outline-hidden ${
                  exportGuard.allowed
                    ? 'text-slate-700 bg-white border-slate-200 hover:bg-slate-100 cursor-pointer'
                    : 'text-slate-400 bg-slate-50 border-slate-200 cursor-not-allowed opacity-60'
                }`}
                title={exportGuard.allowed ? 'Copy JSON to clipboard' : exportGuard.reason}
                aria-label="Copy JSON to clipboard"
              >
                {copiedExport ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                <span>{copiedExport ? 'Copied!' : 'Copy JSON'}</span>
              </button>
              <button
                disabled={!exportGuard.allowed}
                onClick={handleDownloadExport}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition shadow-2xs focus-visible:ring-2 focus-visible:ring-blue-500 outline-hidden ${
                  exportGuard.allowed
                    ? 'text-white bg-blue-600 border-blue-600 hover:bg-blue-700 cursor-pointer'
                    : 'text-slate-400 bg-slate-200 border-slate-200 cursor-not-allowed opacity-60'
                }`}
                title={exportGuard.allowed ? 'Download JSON document' : exportGuard.reason}
                aria-label="Download JSON file"
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
              aria-label="Serialized JSON Document"
              className="w-full h-80 p-4 font-mono text-xs bg-slate-900 text-slate-100 rounded-xl border border-slate-800 focus:outline-hidden resize-none shadow-inner"
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

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-white flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500 outline-hidden"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
