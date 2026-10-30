'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Download, Copy, Check, AlertTriangle, Shield, X, FileText, Image as ImageIcon } from 'lucide-react';
import { useTreeStore } from '../../store/treeStore';
import { exportGraph } from '../../lib/json';
import { evaluateExportGuard } from '../../lib/exportGuard';
import { handleModalTabKey } from '../../lib/modalFocus';
import { generateGraphSvg, generatePrintableHtmlReport } from '../../lib/exportArtifacts';

interface ExportJsonModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ExportTab = 'json' | 'svg' | 'html';

export const ExportJsonModal: React.FC<ExportJsonModalProps> = ({ isOpen, onClose }) => {
  const nodes = useTreeStore((state) => state.nodes);
  const edges = useTreeStore((state) => state.edges);
  const setStatusFeedback = useTreeStore((state) => state.setStatusFeedback);

  const [activeTab, setActiveTab] = useState<ExportTab>('json');
  const [copiedExport, setCopiedExport] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

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

  const exportJsonStr = useMemo(() => {
    if (!isOpen) return '';
    return exportGraph(nodes, edges);
  }, [isOpen, nodes, edges]);

  const exportSvgStr = useMemo(() => {
    if (!isOpen) return '';
    return generateGraphSvg(nodes, edges);
  }, [isOpen, nodes, edges]);

  const exportHtmlStr = useMemo(() => {
    if (!isOpen) return '';
    return generatePrintableHtmlReport(nodes, edges);
  }, [isOpen, nodes, edges]);

  const exportGuard = useMemo(() => evaluateExportGuard(nodes, edges), [nodes, edges]);

  if (!isOpen) return null;

  const handleCopyExport = async () => {
    if (!exportGuard.allowed) {
      setStatusFeedback(exportGuard.reason ?? 'Export blocked by export guard.');
      return;
    }
    const content = activeTab === 'json' ? exportJsonStr : activeTab === 'svg' ? exportSvgStr : exportHtmlStr;
    try {
      await navigator.clipboard.writeText(content);
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
    const dateStr = new Date().toISOString().slice(0, 10);
    let mime = 'application/json';
    let ext = 'json';
    let content = exportJsonStr;

    if (activeTab === 'svg') {
      mime = 'image/svg+xml';
      ext = 'svg';
      content = exportSvgStr;
    } else if (activeTab === 'html') {
      mime = 'text/html';
      ext = 'html';
      content = exportHtmlStr;
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compliance-tree-${dateStr}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setStatusFeedback(`Exported compliance tree ${ext.toUpperCase()} successfully.`);
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
        ref={modalRef}
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
                Export Compliance Tree Artifacts
              </h2>
              <p id="export-modal-desc" className="text-xs text-slate-500">
                Export canonical JSON, standalone SVG diagram, or printable HTML report.
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

        {/* Format Selector Tabs */}
        <div className="px-6 py-2 bg-slate-100 border-b border-slate-200 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('json')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
              activeTab === 'json' ? 'bg-white text-blue-700 shadow-2xs border border-slate-200' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Canonical JSON
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('svg')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
              activeTab === 'svg' ? 'bg-white text-blue-700 shadow-2xs border border-slate-200' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            SVG Vector Diagram
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('html')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
              activeTab === 'html' ? 'bg-white text-blue-700 shadow-2xs border border-slate-200' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Printable HTML Report
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
                {activeTab === 'json' ? 'v1 JSON Schema Document' : activeTab === 'svg' ? 'Scalable Vector Graphics (SVG)' : 'Printable Compliance Audit Report'}
              </h3>
              <p className="text-xs text-slate-500">
                {activeTab === 'json'
                  ? 'Excludes UI runtime properties and formats deterministically.'
                  : activeTab === 'svg'
                  ? 'Standalone vector diagram rendering all nodes, relationship connectors, and badges.'
                  : 'Complete hierarchical inventory and validation score structured for printing or PDF export.'}
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
                title={exportGuard.allowed ? 'Copy content to clipboard' : exportGuard.reason}
                aria-label="Copy to clipboard"
              >
                {copiedExport ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                <span>{copiedExport ? 'Copied!' : 'Copy Code'}</span>
              </button>
              <button
                disabled={!exportGuard.allowed}
                onClick={handleDownloadExport}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition shadow-2xs focus-visible:ring-2 focus-visible:ring-blue-500 outline-hidden ${
                  exportGuard.allowed
                    ? 'text-white bg-blue-600 border-blue-600 hover:bg-blue-700 cursor-pointer'
                    : 'text-slate-400 bg-slate-200 border-slate-200 cursor-not-allowed opacity-60'
                }`}
                title={exportGuard.allowed ? 'Download file' : exportGuard.reason}
                aria-label="Download file"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download {activeTab.toUpperCase()}</span>
              </button>
            </div>
          </div>

          <div className="relative">
            <textarea
              readOnly
              value={activeTab === 'json' ? exportJsonStr : activeTab === 'svg' ? exportSvgStr : exportHtmlStr}
              aria-label="Serialized Export Output"
              className="w-full h-80 p-4 font-mono text-xs bg-slate-900 text-slate-100 rounded-xl border border-slate-800 focus:outline-hidden resize-none shadow-inner"
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
            <Shield className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-900 space-y-1">
              <p className="font-semibold">Enterprise Export Guarantee</p>
              <p>
                All exported artifacts are generated deterministically from the current verified graph state, ensuring audit readiness and lossless data preservation.
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
