'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  GitCompare,
  X,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Layers,
  FileSpreadsheet,
  Plus,
  Minus,
  Edit2,
  RefreshCw,
} from 'lucide-react';
import { useTreeStore } from '../../store/treeStore';
import { getAvailableTemplates } from '../../lib/templates';
import { comparePolicyGraphs, type PolicyGraphComparison } from '../../lib/policyComparison';
import { handleModalTabKey } from '../../lib/modalFocus';

export const PolicyComparisonModal: React.FC = () => {
  const isOpen = useTreeStore((state) => state.isComparisonModalOpen);
  const closeComparisonModal = useTreeStore((state) => state.closeComparisonModal);
  const currentNodes = useTreeStore((state) => state.nodes);
  const currentEdges = useTreeStore((state) => state.edges);

  const templates = getAvailableTemplates();
  const [selectedBaselineId, setSelectedBaselineId] = useState<string>('minimal-starter-policy');

  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const baselineTemplate = templates.find((t) => t.id === selectedBaselineId) || templates[0];
  const baselineNodes = baselineTemplate.nodes;
  const baselineEdges = baselineTemplate.edges;


  const comparison: PolicyGraphComparison = useMemo(() => {
    return comparePolicyGraphs(
      baselineNodes,
      baselineEdges,
      currentNodes,
      currentEdges
    );
  }, [selectedBaselineId, currentNodes, currentEdges, baselineNodes, baselineEdges]);


  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 20);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeComparisonModal();
      } else if (e.key === 'Tab') {
        handleModalTabKey(e, modalRef.current);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, closeComparisonModal]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="comparison-modal-title"
      className="nokey fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 select-none"
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-3xl max-h-[85vh] rounded-xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shadow-2xs">
              <GitCompare className="w-5 h-5" />
            </div>
            <div>
              <h2 id="comparison-modal-title" className="text-base font-semibold text-slate-900">
                Policy Version Comparison & Diff
              </h2>
              <p className="text-xs text-slate-500">
                Compare active tree against template baselines, checkpoints, or past versions.
              </p>
            </div>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeComparisonModal}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition cursor-pointer"
            aria-label="Close comparison modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Controls Bar */}
        <div className="px-6 py-3 bg-slate-100/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-700">Baseline Template:</span>
            <select
              value={selectedBaselineId}
              onChange={(e) => setSelectedBaselineId(e.target.value)}
              className="px-2.5 py-1 rounded bg-white border border-slate-300 text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} ({t.nodes.length} nodes)
                </option>
              ))}

            </select>
          </div>

          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
              +{comparison.addedNodeCount} added
            </span>
            <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-semibold">
              -{comparison.removedNodeCount} removed
            </span>
            <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
              ~{comparison.modifiedNodeCount} modified
            </span>
          </div>
        </div>

        {/* Diff Results Scroll Area */}
        <div className="p-6 overflow-y-auto space-y-3 flex-1">
          {comparison.isIdentical ? (
            <div className="py-12 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <h3 className="text-sm font-semibold text-slate-800">Graphs Are Identical</h3>
              <p className="text-xs text-slate-500">
                The active tree matches the selected baseline baseline template with zero structural or property differences.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider px-1">
                Node Differences ({comparison.nodeDiffs.length})
              </div>

              {comparison.nodeDiffs.map((diff) => (
                <div
                  key={diff.nodeId}
                  className={`p-3.5 rounded-lg border text-xs space-y-2 ${
                    diff.changeType === 'added'
                      ? 'bg-emerald-50/60 border-emerald-200'
                      : diff.changeType === 'removed'
                      ? 'bg-rose-50/60 border-rose-200'
                      : diff.changeType === 'modified'
                      ? 'bg-amber-50/60 border-amber-200'
                      : 'bg-slate-50 border-slate-200 opacity-75'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {diff.changeType === 'added' ? (
                        <Plus className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : diff.changeType === 'removed' ? (
                        <Minus className="w-4 h-4 text-rose-600 shrink-0" />
                      ) : diff.changeType === 'modified' ? (
                        <Edit2 className="w-4 h-4 text-amber-600 shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <span className="font-semibold text-slate-900">{diff.label}</span>
                      <span className="text-[10px] uppercase tracking-wide font-mono text-slate-500 px-1.5 py-0.5 rounded bg-white/80 border border-slate-200">
                        {diff.type}
                      </span>
                    </div>

                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                        diff.changeType === 'added'
                          ? 'bg-emerald-100 text-emerald-800'
                          : diff.changeType === 'removed'
                          ? 'bg-rose-100 text-rose-800'
                          : diff.changeType === 'modified'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {diff.changeType}
                    </span>
                  </div>

                  {diff.propertyDiffs.length > 0 && (
                    <div className="pl-6 space-y-1 font-mono text-[11px] text-slate-700">
                      {diff.propertyDiffs.map((p, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="font-semibold text-slate-600">{p.property}:</span>
                          <span className="line-through text-rose-600">{String(p.previousValue ?? 'empty')}</span>
                          <ArrowRight className="w-3 h-3 text-slate-400" />
                          <span className="font-semibold text-emerald-700">{String(p.currentValue ?? 'empty')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={closeComparisonModal}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-white hover:bg-slate-900 transition cursor-pointer"
          >
            Close Diff
          </button>
        </div>
      </div>
    </div>
  );
};
