'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  FileText,
  Sliders,
  Play,
  Download,
  Info,
} from 'lucide-react';
import { useTreeStore } from '../../store/treeStore';
import {
  validateGraph,
  type ValidationResult,
  type ValidationSeverity,
  type ValidationIssue,
} from '../../lib/validation';
import {
  buildCorrectionPlan,
  type CorrectionPlan,
  type AdvisoryCorrectionAction,
} from '../../lib/correctionPlan';
import { simulateGraphChange, type SimulationResult } from '../../lib/simulation';
import { generateValidationReport } from '../../lib/validationReport';

interface GraphDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFocusNode?: (nodeId: string) => void;
}

type DiagnosticsTab = 'issues' | 'quality' | 'plan';

export const GraphDiagnosticsModal: React.FC<GraphDiagnosticsModalProps> = ({
  isOpen,
  onClose,
  onFocusNode,
}) => {
  const { nodes, edges, setSelectedNodeId, setFocusPulseNodeId, revealNode } = useTreeStore();
  const [activeTab, setActiveTab] = useState<DiagnosticsTab>('issues');
  const [selectedSeverity, setSelectedSeverity] = useState<ValidationSeverity | 'all'>('all');
  const [refreshNonce, setRefreshNonce] = useState(0);

  // Simulation state for advisory correction previews
  const [activeSimulation, setActiveSimulation] = useState<SimulationResult | null>(null);

  // Run pure validation synchronously on full graph (including collapsed descendants)
  const validation: ValidationResult = useMemo(() => {
    // refreshNonce explicitly forces recalculation if user clicks refresh
    if (refreshNonce < 0) return validateGraph(nodes, edges);
    return validateGraph(nodes, edges);
  }, [nodes, edges, refreshNonce]);

  // Compute advisory correction plan purely from validation
  const correctionPlan: CorrectionPlan = useMemo(() => {
    return buildCorrectionPlan(nodes, edges, validation);
  }, [nodes, edges, validation]);

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
  const filteredIssues: ValidationIssue[] = useMemo(() => {
    if (selectedSeverity === 'all') {
      return validation.issues;
    }
    return validation.issues.filter((i) => i.severity === selectedSeverity);
  }, [validation.issues, selectedSeverity]);

  if (!isOpen) return null;

  const handleSelectIssueNode = (nodeId?: string) => {
    if (!nodeId) return;
    // Reveal node if it was collapsed inside a hidden subtree
    revealNode(nodeId);
    setSelectedNodeId(nodeId);
    setFocusPulseNodeId(nodeId);
    if (onFocusNode) {
      onFocusNode(nodeId);
    }
    onClose();
  };

  const handleSimulateAction = (action: AdvisoryCorrectionAction) => {
    if (!action.proposedChange) return;
    const simRes = simulateGraphChange(nodes, edges, action.proposedChange);
    setActiveSimulation(simRes);
  };

  const handleDownloadReport = () => {
    const report = generateValidationReport(validation);
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `compliance-validation-report-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const criticalCount = validation.issues.filter((i) => i.severity === 'CRITICAL').length;
  const errorCount = validation.issues.filter((i) => i.severity === 'ERROR').length;
  const warningCount = validation.issues.filter((i) => i.severity === 'WARNING').length;

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
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center text-white ${
                validation.valid
                  ? warningCount > 0
                    ? 'bg-amber-500'
                    : 'bg-emerald-600'
                  : 'bg-red-600'
              }`}
            >
              {validation.valid ? (
                warningCount > 0 ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <ShieldCheck className="w-5 h-5" />
                )
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
                  Graph Structure &amp; Quality Diagnostics
                </h2>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide uppercase ${
                    validation.valid
                      ? warningCount > 0
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-red-100 text-red-800 border border-red-200'
                  }`}
                >
                  {validation.valid
                    ? warningCount > 0
                      ? `${warningCount} Warning${warningCount > 1 ? 's' : ''}`
                      : 'Valid Tree'
                    : `${validation.errors.length} Error${validation.errors.length > 1 ? 's' : ''}`}
                </span>

                <span
                  className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200"
                  title="Graph Quality Integrity Score (Heuristic 0-100)"
                >
                  Score: {validation.score}/100
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Deterministic validation against tree invariants, hierarchy grammar, and cycle safety (Day 13)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadReport}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition shadow-2xs cursor-pointer"
              title="Download sanitized Validation Report JSON (Schema v1)"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Report</span>
            </button>
            <button
              type="button"
              onClick={() => setRefreshNonce((n) => n + 1)}
              className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-200/60 transition cursor-pointer"
              title="Re-run Diagnostics"
              aria-label="Re-run diagnostics"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition cursor-pointer"
              aria-label="Close diagnostics dialog"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 border-b border-slate-200 bg-white flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => {
                setActiveTab('issues');
                setActiveSimulation(null);
              }}
              className={`py-2.5 font-medium border-b-2 transition cursor-pointer ${
                activeTab === 'issues'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Issues ({validation.issues.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('quality');
                setActiveSimulation(null);
              }}
              className={`py-2.5 font-medium border-b-2 transition cursor-pointer ${
                activeTab === 'quality'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Quality &amp; Coverage
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('plan');
                setActiveSimulation(null);
              }}
              className={`py-2.5 font-medium border-b-2 transition cursor-pointer ${
                activeTab === 'plan'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Advisory Plan ({correctionPlan.advisoryActions.length})
            </button>
          </div>

          <div className="hidden sm:block text-[11px] text-slate-400">
            {validation.metrics.nodeCount} nodes • {validation.metrics.edgeCount} edges
          </div>
        </div>

        {/* Tab 1: Issues View */}
        {activeTab === 'issues' && (
          <>
            {/* Severity Sub-filters */}
            <div className="px-6 py-2 border-b border-slate-100 flex items-center justify-between text-xs bg-slate-50/50">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setSelectedSeverity('all')}
                  className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                    selectedSeverity === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  All ({validation.issues.length})
                </button>
                {criticalCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedSeverity('CRITICAL')}
                    className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                      selectedSeverity === 'CRITICAL'
                        ? 'bg-rose-700 text-white'
                        : 'text-rose-800 hover:bg-rose-50'
                    }`}
                  >
                    Critical ({criticalCount})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedSeverity('ERROR')}
                  className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                    selectedSeverity === 'ERROR'
                      ? 'bg-red-600 text-white'
                      : 'text-red-700 hover:bg-red-50'
                  }`}
                >
                  Errors ({errorCount})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSeverity('WARNING')}
                  className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                    selectedSeverity === 'WARNING'
                      ? 'bg-amber-500 text-white'
                      : 'text-amber-700 hover:bg-amber-50'
                  }`}
                >
                  Warnings ({warningCount})
                </button>
              </div>

              <span className="text-[11px] text-slate-400">
                Showing {filteredIssues.length} issue{filteredIssues.length === 1 ? '' : 's'}
              </span>
            </div>

            {/* Issues Scrollable List */}
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
                  const isCritical = issue.severity === 'CRITICAL';
                  const isError = issue.severity === 'ERROR';

                  return (
                    <div
                      key={issue.id}
                      className={`p-4 rounded-lg border bg-white shadow-2xs transition hover:shadow-xs ${
                        isCritical
                          ? 'border-rose-300 ring-1 ring-rose-200'
                          : isError
                          ? 'border-red-200'
                          : 'border-amber-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="mt-0.5 shrink-0">
                            {isCritical ? (
                              <AlertCircle className="w-4 h-4 text-rose-700" />
                            ) : isError ? (
                              <AlertCircle className="w-4 h-4 text-red-600" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 text-amber-500" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  isCritical
                                    ? 'bg-rose-100 text-rose-800'
                                    : isError
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {issue.severity}
                              </span>
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200 uppercase">
                                {issue.type.replace(/_/g, ' ')}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                Confidence: {issue.confidence}
                              </span>
                            </div>

                            <p className="text-xs text-slate-800 font-medium mt-1 leading-relaxed">
                              {issue.message}
                            </p>

                            {/* Structured evidence */}
                            {issue.evidence && Object.keys(issue.evidence).length > 0 && (
                              <div className="mt-1.5 text-[11px] font-mono bg-slate-50 border border-slate-100 rounded px-2 py-1 text-slate-600">
                                <span>Evidence: </span>
                                <span>{JSON.stringify(issue.evidence)}</span>
                              </div>
                            )}

                            {issue.suggestedFix && (
                              <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1.5">
                                <span className="font-semibold text-slate-700">Advisory:</span>
                                <span>{issue.suggestedFix}</span>
                              </p>
                            )}
                          </div>
                        </div>

                        {issue.nodeIds.length > 0 && (
                          <button
                            type="button"
                            onClick={() => handleSelectIssueNode(issue.nodeIds[0])}
                            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-50 text-blue-600 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 text-xs font-medium transition cursor-pointer"
                            title="Reveal and focus this node"
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
          </>
        )}

        {/* Tab 2: Quality & Coverage View */}
        {activeTab === 'quality' && (
          <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/30">
            {/* Quality Score Breakdown */}
            <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-2xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                  Graph Quality Score Heuristic
                </h3>
                <span className="text-lg font-bold text-blue-600">
                  {validation.score}/100
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed mb-4">
                Transparent heuristic metric calculating structural completeness, acyclicity, and policy grammar compliance.
                (Score capped at 85 whenever structural errors or critical cycles are present).
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-400 block uppercase font-medium">Nodes</span>
                  <span className="text-sm font-semibold text-slate-800">{validation.metrics.nodeCount}</span>
                </div>
                <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-400 block uppercase font-medium">Edges</span>
                  <span className="text-sm font-semibold text-slate-800">{validation.metrics.edgeCount}</span>
                </div>
                <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-400 block uppercase font-medium">Components</span>
                  <span className="text-sm font-semibold text-slate-800">{validation.metrics.connectedComponentCount}</span>
                </div>
                <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-400 block uppercase font-medium">Reachable Nodes</span>
                  <span className="text-sm font-semibold text-slate-800">{validation.metrics.reachableNodeCount}</span>
                </div>
              </div>
            </div>

            {/* Validation Coverage Grid */}
            <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-2xs">
              <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-3">
                Validation Category Coverage
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {Object.entries(validation.coverage).map(([category, item]) => (
                  <div
                    key={category}
                    className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100"
                  >
                    <span className="font-medium text-slate-700 capitalize">
                      {category.replace(/([A-Z])/g, ' $1')}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        item.status === 'COMPLETED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {item.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Advisory Correction Plan View */}
        {activeTab === 'plan' && (
          <div className="p-6 overflow-y-auto space-y-4 flex-1 bg-slate-50/30">
            <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-2xs flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-slate-900">
                  Advisory Correction Plan
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {correctionPlan.summary}
                </p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 uppercase">
                Advisory Only
              </span>
            </div>

            {/* Active Simulation Preview Banner */}
            {activeSimulation && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 animate-in fade-in">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Play className="w-4 h-4 text-blue-600" />
                    <h4 className="text-xs font-semibold text-blue-900">
                      Isolated What-If Simulation Result
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSimulation(null)}
                    className="text-xs text-blue-700 hover:text-blue-900 font-medium cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>

                <p className="text-xs text-blue-800 leading-relaxed">
                  {activeSimulation.comparison?.summary}
                </p>
                <div className="mt-2 text-[11px] text-blue-700 flex items-center gap-4">
                  <span>Score Delta: {activeSimulation.comparison?.scoreDelta && activeSimulation.comparison.scoreDelta > 0 ? `+${activeSimulation.comparison.scoreDelta}` : activeSimulation.comparison?.scoreDelta || 0}</span>
                  <span>Resolved: {activeSimulation.comparison?.resolvedIssues.length || 0} issue(s)</span>
                  <span>New Defects: {activeSimulation.comparison?.newIssues.length || 0}</span>
                </div>
              </div>
            )}

            {/* Steps list */}
            {correctionPlan.advisoryActions.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-lg border border-slate-200 p-6">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-800">
                  No structural corrections needed.
                </p>
              </div>
            ) : (
              correctionPlan.advisoryActions.map((action, idx) => (
                <div
                  key={action.id}
                  className="bg-white rounded-lg border border-slate-200 p-4 shadow-2xs space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div>
                        <h4 className="text-xs font-semibold text-slate-900">
                          {action.title}
                        </h4>
                        <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                          {action.description}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Expected Impact: {action.expectedImpact}
                        </p>
                      </div>
                    </div>

                    {action.proposedChange && (
                      <button
                        type="button"
                        onClick={() => handleSimulateAction(action)}
                        className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 rounded border border-blue-200 transition cursor-pointer"
                        title="Simulate this correction in isolated memory without touching the real graph"
                      >
                        <Play className="w-3 h-3" />
                        <span>Simulate</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between text-xs text-slate-500">
          <span>Click &quot;Inspect&quot; on any issue to reveal and focus the node in the canvas</span>
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
