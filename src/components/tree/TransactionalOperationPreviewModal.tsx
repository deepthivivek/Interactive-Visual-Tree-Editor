'use client';

import React, { useMemo, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Play,
  RotateCcw,
} from 'lucide-react';
import { useTreeStore } from '../../store/treeStore';
import { validateGraph, type ValidationResult } from '../../lib/validation';
import {
  compareValidationResults,
  type ValidationComparison,
} from '../../lib/validationComparison';
import type { TreeNode, TreeEdge } from '../../types/tree';

export interface TransactionalPreviewProps {
  isOpen: boolean;
  title: string;
  description: string;
  operationType: string;
  candidateNodes: TreeNode[];
  candidateEdges: TreeEdge[];
  affectedNodeIds: string[];
  affectedEdgeIds: string[];
  canApply: boolean;
  rejectionReason?: string;
  onConfirm: () => void;
  onClose: () => void;
}

export const TransactionalOperationPreviewModal: React.FC<TransactionalPreviewProps> = ({
  isOpen,
  title,
  description,
  operationType,
  candidateNodes,
  candidateEdges,
  affectedNodeIds,
  affectedEdgeIds,
  canApply,
  rejectionReason,
  onConfirm,
  onClose,
}) => {
  const { nodes: currentNodes, edges: currentEdges } = useTreeStore();

  const validationBefore: ValidationResult = useMemo(() => {
    return validateGraph(currentNodes, currentEdges);
  }, [currentNodes, currentEdges]);

  const validationAfter: ValidationResult = useMemo(() => {
    return validateGraph(candidateNodes, candidateEdges);
  }, [candidateNodes, candidateEdges]);

  const comparison: ValidationComparison = useMemo(() => {
    return compareValidationResults(validationBefore, validationAfter);
  }, [validationBefore, validationAfter]);

  // Close on Escape
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

  if (!isOpen) return null;

  const isBlocked = !canApply || comparison.newCriticalCount > 0;
  const isHighRisk = comparison.newErrorCount > 0 || !canApply;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs select-none animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="transaction-preview-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center text-white ${
                isBlocked
                  ? 'bg-rose-600'
                  : isHighRisk
                  ? 'bg-amber-500'
                  : 'bg-emerald-600'
              }`}
            >
              {isBlocked ? (
                <AlertCircle className="w-5 h-5" />
              ) : isHighRisk ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <ShieldCheck className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2
                  id="transaction-preview-title"
                  className="text-base font-semibold text-slate-900 tracking-tight"
                >
                  {title}
                </h2>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide uppercase ${
                    isBlocked
                      ? 'bg-rose-100 text-rose-800 border border-rose-200'
                      : isHighRisk
                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  {isBlocked
                    ? 'Blocked (Violation)'
                    : isHighRisk
                    ? 'Caution (Errors)'
                    : 'Safe Transaction'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{description}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 bg-slate-50/30 text-xs">
          {/* Operation Rejection Banner */}
          {rejectionReason && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800">
              <span className="font-semibold block mb-0.5">Operation Rejected:</span>
              <span>{rejectionReason}</span>
            </div>
          )}

          {/* Candidate Diff & Impact Card */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-2xs space-y-3">
            <h3 className="font-semibold text-slate-800 uppercase tracking-wider text-[11px]">
              Transactional Impact Preview
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="p-2 rounded bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-400 block uppercase font-medium">Nodes</span>
                <span className="font-semibold text-slate-800">
                  {currentNodes.length} → {candidateNodes.length}
                </span>
              </div>
              <div className="p-2 rounded bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-400 block uppercase font-medium">Edges</span>
                <span className="font-semibold text-slate-800">
                  {currentEdges.length} → {candidateEdges.length}
                </span>
              </div>
              <div className="p-2 rounded bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-400 block uppercase font-medium">Score</span>
                <span
                  className={`font-semibold ${
                    comparison.scoreDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {validationBefore.score} → {validationAfter.score} (
                  {comparison.scoreDelta >= 0 ? `+${comparison.scoreDelta}` : comparison.scoreDelta})
                </span>
              </div>
              <div className="p-2 rounded bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-400 block uppercase font-medium">Status</span>
                <span
                  className={`font-semibold ${
                    validationAfter.valid ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {validationAfter.valid ? 'Valid Tree' : 'Invalid Tree'}
                </span>
              </div>
            </div>

            <div className="text-slate-600 text-[11px] pt-1">
              <span>Directly affected entities: </span>
              <span className="font-medium text-slate-800">
                {affectedNodeIds.length} node(s), {affectedEdgeIds.length} edge(s).
              </span>
            </div>
          </div>

          {/* Validation Comparison */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-2xs space-y-2">
            <h3 className="font-semibold text-slate-800 uppercase tracking-wider text-[11px]">
              Validation Regression Analysis
            </h3>

            <p className="text-slate-700 leading-relaxed">{comparison.summary}</p>

            {comparison.newIssues.length > 0 && (
              <div className="mt-2 space-y-1.5">
                <span className="font-semibold text-rose-700 block">
                  Newly Introduced Issues ({comparison.newIssues.length}):
                </span>
                {comparison.newIssues.map((issue) => (
                  <div
                    key={issue.id}
                    className="p-2 rounded bg-rose-50 border border-rose-100 text-rose-800 text-[11px]"
                  >
                    <span className="font-semibold uppercase text-[10px] mr-1.5">
                      [{issue.severity}]
                    </span>
                    <span>{issue.message}</span>
                  </div>
                ))}
              </div>
            )}

            {comparison.resolvedIssues.length > 0 && (
              <div className="mt-2 space-y-1.5">
                <span className="font-semibold text-emerald-700 block">
                  Issues Resolved ({comparison.resolvedIssues.length}):
                </span>
                {comparison.resolvedIssues.map((issue) => (
                  <div
                    key={issue.id}
                    className="p-2 rounded bg-emerald-50 border border-emerald-100 text-emerald-800 text-[11px]"
                  >
                    <span className="font-semibold mr-1">✓</span>
                    <span>{issue.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between text-xs">
          <span className="text-slate-500">
            Applying creates exactly 1 atomic, undoable history entry.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition shadow-2xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isBlocked}
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition shadow-2xs flex items-center gap-1.5 ${
                isBlocked
                  ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
              }`}
            >
              <Play className="w-3.5 h-3.5" />
              <span>Confirm &amp; Apply</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
