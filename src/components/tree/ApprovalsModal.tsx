'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  Send,
  Lock,
  FileText,
  UserCheck,
  RotateCcw,
} from 'lucide-react';
import { useTreeStore } from '../../store/treeStore';
import {
  getPermissionsForRole,
  canTransitionApprovalState,
  isGraphModificationAllowed,
  type UserRole,
  type ApprovalState,
  type ApprovalRecord,
} from '../../lib/rolesAndApprovals';
import { handleModalTabKey } from '../../lib/modalFocus';

export const ApprovalsModal: React.FC = () => {
  const isOpen = useTreeStore((state) => state.isApprovalsModalOpen);
  const closeApprovalsModal = useTreeStore((state) => state.closeApprovalsModal);
  const activeRole = useTreeStore((state) => state.activeRole);
  const setActiveRole = useTreeStore((state) => state.setActiveRole);
  const approvalWorkflow = useTreeStore((state) => state.approvalWorkflow);
  const setApprovalState = useTreeStore((state) => state.setApprovalState);
  const nodes = useTreeStore((state) => state.nodes);

  const [commentInput, setCommentInput] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 20);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeApprovalsModal();
      } else if (e.key === 'Tab') {
        handleModalTabKey(e, modalRef.current);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, closeApprovalsModal]);

  if (!isOpen) return null;

  const permissions = getPermissionsForRole(activeRole);
  const currentState = approvalWorkflow.currentState;
  const isLocked = !isGraphModificationAllowed(currentState, activeRole).allowed;

  const handleTransition = (targetState: ApprovalState) => {
    setErrorMessage(null);
    const check = canTransitionApprovalState(currentState, targetState, activeRole);
    if (!check.allowed) {
      setErrorMessage(check.reason || 'Transition not allowed for your role.');
      return;
    }

    setApprovalState(
      targetState,
      activeRole,
      commentInput.trim() || `Status updated to ${targetState}`,
      `usr_${activeRole.toLowerCase()}_01`,
      `${activeRole} User`
    );
    setCommentInput('');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="approvals-modal-title"
      className="nokey fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 select-none"
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-2xl max-h-[85vh] rounded-xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-2xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 id="approvals-modal-title" className="text-base font-semibold text-slate-900">
                Governance, Roles & Policy Approvals
              </h2>
              <p className="text-xs text-slate-500">
                Role-based authorization (RBAC) and audited policy lifecycle management.
              </p>
            </div>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeApprovalsModal}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition cursor-pointer"
            aria-label="Close approvals modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Role Selector Bar */}
        <div className="px-6 py-3 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-slate-600" />
            <span className="font-semibold text-slate-700">Active Role:</span>
            <select
              value={activeRole}
              onChange={(e) => setActiveRole(e.target.value as UserRole)}
              className="px-2.5 py-1 rounded bg-white border border-slate-300 font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="Admin">Admin (Full Control)</option>
              <option value="Editor">Editor (Draft & Submit)</option>
              <option value="Reviewer">Reviewer (Read & Audit)</option>
              <option value="Approver">Approver (Approve & Publish)</option>
              <option value="Viewer">Viewer (Read-Only)</option>
            </select>
          </div>

          <div className="flex items-center gap-2 text-slate-600 font-mono text-[11px]">
            <span>Edit Perm: {permissions.canEditNodes ? 'YES' : 'NO'}</span>
            <span>•</span>
            <span>Approve Perm: {permissions.canApprovePolicy ? 'YES' : 'NO'}</span>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Current Status Card */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500 font-medium">Policy Lifecycle State</div>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider ${
                    currentState === 'draft'
                      ? 'bg-slate-200 text-slate-800'
                      : currentState === 'in_review'
                      ? 'bg-amber-100 text-amber-800'
                      : currentState === 'approved'
                      ? 'bg-blue-100 text-blue-800'
                      : currentState === 'published'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {currentState.replace('_', ' ')}
                </span>

                {isLocked && (
                  <span className="flex items-center gap-1 text-xs text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    <Lock className="w-3 h-3" />
                    Canvas Edits Locked
                  </span>
                )}
              </div>
            </div>

            <div className="text-right text-xs text-slate-500 font-mono">
              <div>Version #{approvalWorkflow.version}</div>
              <div>Nodes Count: {nodes.length}</div>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Comment & Transition Actions */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-700">
              Audit Comment / Approval Rationale:
            </label>
            <textarea
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              placeholder="Provide context for this status change (e.g. Approved for Q1 FINRA audit)..."
              rows={2}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-hidden"
            />

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {currentState === 'draft' && (
                <button
                  type="button"
                  onClick={() => handleTransition('in_review')}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition cursor-pointer"
                >
                  Submit for Review
                </button>
              )}

              {currentState === 'in_review' && (
                <>
                  <button
                    type="button"
                    onClick={() => handleTransition('approved')}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition cursor-pointer"
                  >
                    Approve Policy
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTransition('rejected')}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition cursor-pointer"
                  >
                    Reject Policy
                  </button>
                </>
              )}

              {currentState === 'approved' && (
                <button
                  type="button"
                  onClick={() => handleTransition('published')}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition cursor-pointer"
                >
                  Publish Policy
                </button>
              )}

              {currentState !== 'draft' && (
                <button
                  type="button"
                  onClick={() => handleTransition('draft')}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 transition cursor-pointer ml-auto"
                >
                  Revert to Draft
                </button>
              )}
            </div>
          </div>

          {/* Audit Trail History */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Approval & Governance Audit Trail ({approvalWorkflow.history.length})
            </h3>

            {approvalWorkflow.history.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No approval history recorded yet.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {approvalWorkflow.history.slice().reverse().map((rec) => (
                  <div key={rec.id} className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
                    <div className="flex items-center justify-between text-slate-800">
                      <span className="font-semibold">{rec.actorName} ({rec.actorRole})</span>
                      <span className="font-mono text-[10px] text-slate-500">
                        {new Date(rec.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold uppercase text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                        {rec.state}
                      </span>
                      <span className="text-slate-600 italic">&quot;{rec.comments}&quot;</span>

                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={closeApprovalsModal}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-white hover:bg-slate-900 transition cursor-pointer"
          >
            Close Governance
          </button>
        </div>
      </div>
    </div>
  );
};
