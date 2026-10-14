'use client';

import React, { useEffect, useRef } from 'react';
import { X, Keyboard, Navigation, History, Search, ShieldCheck } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
}

interface ShortcutCategory {
  title: string;
  icon: React.ElementType;
  shortcuts: ShortcutItem[];
}

const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  {
    title: 'Canvas Navigation',
    icon: Navigation,
    shortcuts: [
      { keys: ['Drag'], description: 'Pan canvas workspace' },
      { keys: ['Scroll'], description: 'Zoom in / out' },
      { keys: ['Ctrl', '0'], description: 'Fit view to entire graph' },
      { keys: ['Ctrl', '1'], description: 'Reset zoom to 100%' },
      { keys: ['Ctrl', 'M'], description: 'Toggle MiniMap visibility' },
      { keys: ['Ctrl', 'G'], description: 'Toggle background grid' },
      { keys: ['Arrow Keys'], description: 'Nudge selected node by 20px' },
    ],
  },
  {
    title: 'Editing & History',
    icon: History,
    shortcuts: [
      { keys: ['Ctrl', 'Z'], description: 'Undo last graph change' },
      { keys: ['Ctrl', 'Shift', 'Z'], description: 'Redo previously undone change' },
      { keys: ['Ctrl', 'Shift', 'L'], description: 'Auto-arrange tree (Dagre layout)' },
      { keys: ['Ctrl', 'C'], description: 'Copy selected node & subtree' },
      { keys: ['Ctrl', 'V'], description: 'Paste subtree (as child or on canvas)' },
      { keys: ['Ctrl', 'D'], description: 'Duplicate selected node & subtree' },
      { keys: ['Ctrl', 'E'], description: 'Toggle subtree collapse / expand' },
      { keys: ['Del / Backspace'], description: 'Delete selected node (preserves children)' },
      { keys: ['Shift', 'Delete'], description: 'Delete entire subtree (cascade)' },
    ],
  },
  {
    title: 'Selection & Search',
    icon: Search,
    shortcuts: [
      { keys: ['/'], description: 'Quick focus search box' },
      { keys: ['Ctrl', 'K'], description: 'Open search query' },
      { keys: ['Tab'], description: 'Cycle forward to next node' },
      { keys: ['Shift', 'Tab'], description: 'Cycle backward to previous node' },
      { keys: ['Esc'], description: 'Clear selection / Close active modal' },
    ],
  },
  {
    title: 'Diagnostics & Assistance',
    icon: ShieldCheck,
    shortcuts: [
      { keys: ['Ctrl', 'Shift', 'D'], description: 'Open Graph Diagnostics panel' },
      { keys: ['?'], description: 'Open this keyboard shortcuts reference' },
    ],
  },
];

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs select-none animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <h2
                id="shortcuts-modal-title"
                className="text-base font-semibold text-slate-900 tracking-tight"
              >
                Keyboard Shortcuts
              </h2>
              <p className="text-xs text-slate-500">
                Quick commands to navigate and edit the compliance tree
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition"
            aria-label="Close shortcuts dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {SHORTCUT_CATEGORIES.map((category) => {
              const Icon = category.icon;
              return (
                <div
                  key={category.title}
                  className="bg-slate-50/50 rounded-lg border border-slate-200/70 p-4 space-y-3"
                >
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 uppercase tracking-wider">
                    <Icon className="w-3.5 h-3.5 text-slate-500" />
                    <span>{category.title}</span>
                  </div>

                  <div className="space-y-2">
                    {category.shortcuts.map((shortcut, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-3 text-xs"
                      >
                        <span className="text-slate-600 leading-snug">
                          {shortcut.description}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {shortcut.keys.map((k, kIdx) => (
                            <kbd
                              key={kIdx}
                              className="px-1.5 py-0.5 text-[11px] font-mono font-medium text-slate-700 bg-white border border-slate-300 rounded shadow-2xs"
                            >
                              {k}
                            </kbd>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between text-xs text-slate-500">
          <span>Shortcuts are automatically disabled inside text inputs</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition shadow-2xs cursor-pointer"
          >
            Got it (Esc)
          </button>
        </div>
      </div>
    </div>
  );
};
