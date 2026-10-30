'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  FileSpreadsheet,
  X,
  CheckCircle2,
  AlertTriangle,
  FolderTree,
  Sparkles,
  Layers,
  ArrowRight,
  Shield,
  HelpCircle,
  RotateCcw,
} from 'lucide-react';
import { useTreeStore } from '../../store/treeStore';
import {
  getAvailableTemplates,
  validateTemplate,
  type ComplianceTemplate,
} from '../../lib/templates';
import { handleModalTabKey } from '../../lib/modalFocus';

export const TemplatesModal: React.FC = () => {
  const isOpen = useTreeStore((state) => state.isTemplatesModalOpen);
  const closeTemplatesModal = useTreeStore((state) => state.closeTemplatesModal);
  const applyTemplate = useTreeStore((state) => state.applyTemplate);
  const nodes = useTreeStore((state) => state.nodes);
  const edges = useTreeStore((state) => state.edges);

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('full-compliance-framework');
  const [confirmingTemplate, setConfirmingTemplate] = useState<ComplianceTemplate | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const templates = getAvailableTemplates();

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? templates[0];

  const handleClose = React.useCallback(() => {
    setConfirmingTemplate(null);
    setErrorMessage(null);
    setSuccessMessage(null);
    closeTemplatesModal();
  }, [closeTemplatesModal]);

  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 20);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (confirmingTemplate) {
          setConfirmingTemplate(null);
        } else {
          handleClose();
        }
      } else if (e.key === 'Tab') {
        handleModalTabKey(e, modalRef.current);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, confirmingTemplate, handleClose]);

  if (!isOpen) return null;

  const handleSelectTemplate = (template: ComplianceTemplate) => {
    setSelectedTemplateId(template.id);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleInitiateApply = (template: ComplianceTemplate) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    // Validate template integrity before applying
    const validation = validateTemplate(template);
    if (!validation.ok) {
      setErrorMessage(validation.error ?? 'Invalid template structure.');
      return;
    }

    // If workspace currently has existing nodes, require confirmation to protect existing work
    if (nodes.length > 0) {
      setConfirmingTemplate(template);
    } else {
      executeApply(template);
    }
  };

  const executeApply = (template: ComplianceTemplate) => {
    const res = applyTemplate(template.id);
    if (res.ok) {
      setSuccessMessage(res.message);
      setConfirmingTemplate(null);
      setTimeout(() => {
        closeTemplatesModal();
      }, 350);
    } else {
      setErrorMessage(res.message);
      setConfirmingTemplate(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="templates-modal-title"
      aria-describedby="templates-modal-description"
      className="nokey fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 select-none"
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shadow-2xs">
              <FileSpreadsheet className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 id="templates-modal-title" className="text-base font-semibold text-slate-900">
                Compliance Rule Templates
              </h2>
              <p id="templates-modal-description" className="text-xs text-slate-500">
                Select and apply pre-configured, validated policy hierarchies.
              </p>
            </div>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition cursor-pointer"
            aria-label="Close templates modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Banners */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Confirmation Overlay (Safe Handling of Existing Work) */}
        {confirmingTemplate ? (
          <div className="p-8 flex flex-col items-center justify-center text-center max-w-lg mx-auto">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">
              Replace Active Workspace?
            </h3>
            <p className="mt-2 text-xs text-slate-600 leading-relaxed">
              Your active workspace currently contains{' '}
              <strong className="text-slate-800">{nodes.length} nodes</strong> and{' '}
              <strong className="text-slate-800">{edges.length} connections</strong>. Applying{' '}
              <strong className="text-blue-700">&ldquo;{confirmingTemplate.title}&rdquo;</strong> will replace the current
              canvas with the template.
            </p>
            <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-md text-[11px] text-slate-500">
              Tip: You can export your current document to JSON first before loading a new template.
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setConfirmingTemplate(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition cursor-pointer"
              >
                Keep Current Workspace
              </button>
              <button
                type="button"
                onClick={() => executeApply(confirmingTemplate)}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition cursor-pointer"
              >
                Confirm & Replace Workspace
              </button>
            </div>
          </div>
        ) : (
          /* Main Two-Column Layout */
          <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[420px]">
            {/* Left: Template List (5 columns) */}
            <div className="md:col-span-5 border-r border-slate-200 p-4 overflow-y-auto space-y-2 bg-slate-50/40">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-2 py-1">
                Available Templates ({templates.length})
              </div>

              {templates.map((template) => {
                const isSelected = template.id === selectedTemplateId;
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => handleSelectTemplate(template)}
                    className={`w-full text-left p-3 rounded-lg border transition cursor-pointer flex flex-col gap-1.5 ${
                      isSelected
                        ? 'bg-blue-50/80 border-blue-400 shadow-xs ring-1 ring-blue-400'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-900 truncate">
                        {template.title}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                        {template.stats.nodeCount} {template.stats.nodeCount === 1 ? 'node' : 'nodes'}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 line-clamp-2">
                      {template.description}
                    </p>

                    <div className="flex items-center gap-1.5 pt-1 text-[10px] text-slate-400">
                      <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-medium">
                        {template.category}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Right: Selected Template Inspector & Preview (7 columns) */}
            <div className="md:col-span-7 p-6 overflow-y-auto flex flex-col justify-between bg-white">
              <div className="space-y-4">
                {/* Header */}
                <div className="border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-mono">
                      {selectedTemplate.category}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      ID: {selectedTemplate.id}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">
                    {selectedTemplate.title}
                  </h3>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                    {selectedTemplate.description}
                  </p>
                </div>

                {/* Regulatory Disclaimer Notice */}
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-amber-800 text-[11px] flex items-start gap-2">
                  <Shield className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="leading-tight">
                    <strong className="font-semibold">{selectedTemplate.disclaimer}</strong>
                    <div className="text-[10px] text-amber-700 mt-0.5">
                      Structured according to standard relationship rules (Root → Rule → Condition → Action). Not legal or regulatory advice.
                    </div>
                  </div>
                </div>

                {/* Composition Breakdown */}
                <div>
                  <h4 className="text-xs font-semibold text-slate-800 mb-2 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-slate-500" />
                    <span>Hierarchy Structure</span>
                  </h4>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    <div className="p-2.5 rounded-lg border border-blue-200 bg-blue-50/50">
                      <div className="text-xs font-bold text-blue-700">
                        {selectedTemplate.stats.rootCount}
                      </div>
                      <div className="text-[10px] font-medium text-blue-600">Root Node</div>
                    </div>
                    <div className="p-2.5 rounded-lg border border-indigo-200 bg-indigo-50/50">
                      <div className="text-xs font-bold text-indigo-700">
                        {selectedTemplate.stats.ruleCount}
                      </div>
                      <div className="text-[10px] font-medium text-indigo-600">Rule Branches</div>
                    </div>
                    <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50/50">
                      <div className="text-xs font-bold text-amber-700">
                        {selectedTemplate.stats.conditionCount}
                      </div>
                      <div className="text-[10px] font-medium text-amber-600">Conditions</div>
                    </div>
                    <div className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/50">
                      <div className="text-xs font-bold text-emerald-700">
                        {selectedTemplate.stats.actionCount}
                      </div>
                      <div className="text-[10px] font-medium text-emerald-600">Actions</div>
                    </div>
                  </div>
                </div>

                {/* Included Nodes Preview */}
                {selectedTemplate.nodes.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-slate-800 mb-2">
                      Included Nodes ({selectedTemplate.nodes.length})
                    </h4>
                    <div className="max-h-36 overflow-y-auto space-y-1 p-2 bg-slate-50 border border-slate-200 rounded-md">
                      {selectedTemplate.nodes.map((n) => (
                        <div
                          key={n.id}
                          className="flex items-center justify-between text-[11px] py-1 px-1.5 rounded hover:bg-white transition"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                n.type === 'root'
                                  ? 'bg-blue-600'
                                  : n.type === 'rule'
                                  ? 'bg-indigo-600'
                                  : n.type === 'condition'
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-600'
                              }`}
                            />
                            <span className="font-medium text-slate-800 truncate">
                              {n.data.label}
                            </span>
                          </div>
                          <span className="font-mono text-[10px] text-slate-400 shrink-0">
                            {n.type}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  {nodes.length > 0
                    ? `Current canvas has ${nodes.length} nodes (will be replaced)`
                    : 'Canvas is empty'}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-md transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInitiateApply(selectedTemplate)}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-xs transition cursor-pointer"
                  >
                    <span>Load Template</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
