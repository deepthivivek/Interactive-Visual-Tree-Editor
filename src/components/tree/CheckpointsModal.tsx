'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Bookmark,
  Plus,
  Trash2,
  RotateCcw,
  Clock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useTreeStore } from '../../store/treeStore';
import {
  type GraphCheckpoint,
  computeCheckpointDiff,
} from '../../lib/checkpoints';

interface CheckpointsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CheckpointsModal: React.FC<CheckpointsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    nodes,
    edges,
    checkpoints,
    createCheckpoint,
    restoreCheckpoint,
    deleteCheckpoint,
  } = useTreeStore();

  const [checkpointName, setCheckpointName] = useState('');
  const [selectedCheckpointId, setSelectedCheckpointId] = useState<string | null>(null);
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);

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

  if (!isOpen) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkpointName.trim()) return;
    createCheckpoint(checkpointName.trim());
    setCheckpointName('');
  };

  const selectedCheckpoint = checkpoints.find((cp) => cp.id === selectedCheckpointId);
  const diff = selectedCheckpoint ? computeCheckpointDiff(nodes, edges, selectedCheckpoint) : null;

  const handleRestore = (id: string) => {
    restoreCheckpoint(id);
    setConfirmRestoreId(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs select-none animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkpoints-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <Bookmark className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="checkpoints-modal-title"
                className="text-base font-semibold text-slate-900 tracking-tight"
              >
                Named Graph Checkpoints
              </h2>
              <p className="text-xs text-slate-500">
                Save and restore immutable snapshots. Restoration is recorded as an undoable action.
              </p>
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

        {/* Create Input Bar */}
        <form
          onSubmit={handleCreate}
          className="p-4 border-b border-slate-100 bg-white flex items-center gap-2"
        >
          <input
            type="text"
            value={checkpointName}
            onChange={(e) => setCheckpointName(e.target.value)}
            placeholder="New checkpoint label (e.g. 'Before Major Restructure')..."
            className="flex-1 px-3 py-1.5 text-xs rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
          />
          <button
            type="submit"
            disabled={!checkpointName.trim()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition shadow-2xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Save Snapshot</span>
          </button>
        </form>

        {/* Checkpoints List Body */}
        <div className="p-6 overflow-y-auto space-y-3 flex-1 bg-slate-50/30">
          {checkpoints.length === 0 ? (
            <div className="text-center py-10">
              <Bookmark className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-medium text-slate-600">No checkpoints saved yet</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Save snapshots above to benchmark edits or safely recover previous graph states.
              </p>
            </div>
          ) : (
            checkpoints.map((cp) => {
              const isSelected = cp.id === selectedCheckpointId;
              const isConfirming = confirmRestoreId === cp.id;

              return (
                <div
                  key={cp.id}
                  className={`p-3.5 rounded-lg border bg-white shadow-2xs transition ${
                    isSelected ? 'border-blue-500 ring-1 ring-blue-400' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className="cursor-pointer flex-1"
                      onClick={() => setSelectedCheckpointId(isSelected ? null : cp.id)}
                    >
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-semibold text-slate-900">{cp.name}</h4>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(cp.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500 flex items-center gap-3">
                        <span>{cp.nodeCount} node(s)</span>
                        <span>•</span>
                        <span>{cp.edgeCount} edge(s)</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isConfirming ? (
                        <div className="flex items-center gap-1.5 animate-in fade-in">
                          <span className="text-[10px] text-rose-700 font-medium">Confirm?</span>
                          <button
                            type="button"
                            onClick={() => handleRestore(cp.id)}
                            className="px-2 py-1 text-[11px] font-semibold bg-rose-600 text-white rounded hover:bg-rose-700 cursor-pointer"
                          >
                            Restore
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmRestoreId(null)}
                            className="px-2 py-1 text-[11px] text-slate-600 bg-slate-100 rounded hover:bg-slate-200 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmRestoreId(cp.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 rounded border border-slate-200 transition cursor-pointer"
                          title="Restore graph to this checkpoint"
                        >
                          <RotateCcw className="w-3 h-3 text-slate-500" />
                          <span>Restore</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => deleteCheckpoint(cp.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition cursor-pointer"
                        title="Delete checkpoint"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Diff breakdown if selected */}
                  {isSelected && diff && (
                    <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600">
                      <div className="p-2 rounded bg-slate-50 border border-slate-100">
                        <span className="font-semibold block mb-0.5 text-slate-700">
                          Differences from active graph:
                        </span>
                        <span>{diff.summary}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between text-xs text-slate-500">
          <span>Checkpoints remain local to this session and never alter exported graph JSON.</span>
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
