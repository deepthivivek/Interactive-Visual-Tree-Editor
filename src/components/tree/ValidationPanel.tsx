'use client';

import React, { useMemo, useEffect, useRef } from 'react';
import { ShieldAlert, AlertCircle, CheckCircle2, ArrowRight, Wrench, X } from 'lucide-react';
import { useTreeStore } from '../../store/treeStore';
import { validateGraph, type ValidationIssue } from '../../lib/validation';

interface ValidationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onFocusNode?: (nodeId: string) => void;
}

export const ValidationPanel: React.FC<ValidationPanelProps> = ({
  isOpen,
  onClose,
  onFocusNode,
}) => {
  const nodes = useTreeStore((state) => state.nodes);
  const edges = useTreeStore((state) => state.edges);
  const setSelectedNodeId = useTreeStore((state) => state.setSelectedNodeId);

  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previousActiveElementRef.current = document.activeElement as HTMLElement | null;

    const timer = setTimeout(() => {
      closeBtnRef.current?.focus();
    }, 10);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
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

  const validationResult = useMemo(() => {
    return validateGraph(nodes, edges);
  }, [nodes, edges]);

  const { valid, errors, warnings, metrics, score } = validationResult;

  const handleFixNextIssue = () => {
    const firstIssue = errors[0] ?? warnings[0];
    if (!firstIssue) return;

    if (firstIssue.nodeIds.length > 0) {
      const targetId = firstIssue.nodeIds[0];
      setSelectedNodeId(targetId);
      onFocusNode?.(targetId);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="region"
      aria-label="Graph Validation and Quality Panel"
      className="nokey absolute top-16 right-4 z-40 w-96 max-h-[80vh] bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 motion-reduce:transition-none select-none"
    >
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center ${
              valid ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
            }`}
          >
            {valid ? <CheckCircle2 className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Validation & Quality</h2>
            <p className="text-[11px] text-slate-500" aria-live="polite">
              Score: {score}/100 • {errors.length} error{errors.length !== 1 ? 's' : ''}, {warnings.length} warning{warnings.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button
          ref={closeBtnRef}
          type="button"
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500 outline-hidden"
          aria-label="Close validation panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Accessible Status Summary Bar */}
      <div className="px-5 py-2.5 bg-slate-100/70 border-b border-slate-200/60 flex items-center justify-between text-xs">
        <span className="font-medium text-slate-700">
          Status: {valid ? 'Graph is Valid' : 'Action Required'}
        </span>
        {(errors.length > 0 || warnings.length > 0) && (
          <button
            type="button"
            onClick={handleFixNextIssue}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md border border-blue-200 transition cursor-pointer"
            aria-label="Fix next validation issue"
          >
            <Wrench className="w-3 h-3" />
            <span>Fix Next Issue</span>
          </button>
        )}
      </div>

      {/* Issues List */}
      <div className="p-4 overflow-y-auto space-y-3 flex-1 max-h-[50vh]">
        {errors.length === 0 && warnings.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <p className="text-xs font-medium text-slate-700">No validation issues detected!</p>
            <p className="text-[11px] text-slate-400">Your graph structure conforms to all integrity rules.</p>
          </div>
        ) : (
          <>
            {errors.map((issue) => (
              <div
                key={issue.id}
                className="p-3 rounded-lg bg-rose-50/60 border border-rose-200/80 space-y-1.5 text-left"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-rose-700 font-semibold text-xs">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{issue.type}</span>
                  </div>
                  <span className="px-1.5 py-0.5 text-[10px] font-bold bg-rose-200/60 text-rose-800 rounded">
                    {issue.severity}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{issue.message}</p>
                {issue.nodeIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedNodeId(issue.nodeIds[0]);
                      onFocusNode?.(issue.nodeIds[0]);
                    }}
                    className="flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-800 mt-1 cursor-pointer"
                  >
                    <span>Inspect node {issue.nodeIds[0]}</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}

            {warnings.map((issue) => (
              <div
                key={issue.id}
                className="p-3 rounded-lg bg-amber-50/60 border border-amber-200/80 space-y-1.5 text-left"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-amber-700 font-semibold text-xs">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{issue.type}</span>
                  </div>
                  <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-200/60 text-amber-800 rounded">
                    {issue.severity}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{issue.message}</p>
                {issue.nodeIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedNodeId(issue.nodeIds[0]);
                      onFocusNode?.(issue.nodeIds[0]);
                    }}
                    className="flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-800 mt-1 cursor-pointer"
                  >
                    <span>Inspect node {issue.nodeIds[0]}</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </>
        )}
      </div>

      {/* Footer Metrics */}
      <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <span>Nodes: {metrics.nodeCount}</span>
        <span>Edges: {metrics.edgeCount}</span>
        <span>Orphans: {metrics.orphanCount}</span>
        <span>Cycles: {metrics.cycleCount}</span>
      </div>
    </div>
  );
};
