'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, X, CheckCircle2, AlertTriangle, Shield, ArrowRight, Loader2 } from 'lucide-react';
import { useTreeStore } from '../../store/treeStore';
import { handleModalTabKey } from '../../lib/modalFocus';
import type { TreeNode, TreeEdge } from '../../types/tree';

export const AiGenerationModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [proposal, setProposal] = useState<{ title: string; description: string; nodes: TreeNode[]; edges: TreeEdge[] } | null>(null);
  const [validation, setValidation] = useState<{ valid: boolean; score: number; errors: unknown[]; warnings: unknown[] } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const setNodes = useTreeStore((state) => state.setNodes);
  const setEdges = useTreeStore((state) => state.setEdges);
  const setStatusFeedback = useTreeStore((state) => state.setStatusFeedback);

  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleTrigger = () => setIsOpen(true);
    window.addEventListener('tree:trigger-ai-modal', handleTrigger);
    return () => window.removeEventListener('tree:trigger-ai-modal', handleTrigger);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
      } else if (e.key === 'Tab') {
        handleModalTabKey(e, modalRef.current);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setErrorMsg(null);
    setProposal(null);
    setValidation(null);

    try {
      const res = await fetch('/api/ai/generate-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate compliance tree proposal.');
      }
      setProposal(data.proposal);
      setValidation(data.validation);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyProposal = () => {
    if (!proposal) return;
    setNodes(proposal.nodes);
    setEdges(proposal.edges);
    setStatusFeedback(`Applied AI generated rule tree: ${proposal.title}`);
    setIsOpen(false);
    setProposal(null);
    setPrompt('');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 select-none animate-in fade-in-0 duration-150"
      onClick={() => setIsOpen(false)}
    >
      <div
        ref={modalRef}
        className="nokey bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-600 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 id="ai-modal-title" className="text-base font-semibold text-slate-900 tracking-tight">
                AI Rule Generator (Gemini 3.8 Flash)
              </h2>
              <p className="text-xs text-slate-500">
                Generate validated compliance hierarchies from natural language requirements.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <form onSubmit={handleGenerate} className="space-y-3">
            <label className="block text-xs font-semibold text-slate-700">
              Compliance Policy Description & Requirements
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., Create a strict data protection policy requiring encryption at rest, access logging, and regular security audits for financial records..."
              className="w-full h-28 p-3 text-xs bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-purple-500 text-slate-900 resize-none shadow-2xs"
              required
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isGenerating || !prompt.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>{isGenerating ? 'Generating Proposal...' : 'Generate Compliance Tree'}</span>
              </button>
            </div>
          </form>

          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-3 text-xs text-rose-800">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Generation Error</p>
                <p>{errorMsg}</p>
              </div>
            </div>
          )}

          {proposal && validation && (
            <div className="border border-purple-200 bg-purple-50/40 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{proposal.title}</h3>
                  <p className="text-xs text-slate-600 mt-0.5">{proposal.description}</p>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-md text-xs font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Score: {validation.score}/100</span>
                </div>
              </div>

              <div className="text-xs text-slate-600 flex items-center gap-4 font-mono">
                <span>Nodes: {proposal.nodes.length}</span>
                <span>Edges: {proposal.edges.length}</span>
                <span>Valid Grammar: {validation.valid ? 'Yes' : 'No'}</span>
              </div>

              <div className="flex justify-end pt-2 border-t border-purple-200">
                <button
                  type="button"
                  onClick={handleApplyProposal}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition cursor-pointer"
                >
                  <span>Apply Proposal to Canvas</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-white flex justify-end">
          <button
            onClick={() => setIsOpen(false)}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
