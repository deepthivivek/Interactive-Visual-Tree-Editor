'use client';

import React, { useEffect, useRef } from 'react';
import {
  Settings,
  X,
  Grid,
  Map as MapIcon,
  Magnet,
  Sun,
  Moon,
  Laptop,
  RotateCcw,
  HardDrive,
  CheckCircle2,
} from 'lucide-react';
import { useTreeStore } from '../../store/treeStore';
import {
  PERSISTENCE_STORAGE_KEY,
  DEFAULT_PERSISTED_SETTINGS,
} from '../../lib/persistence';
import { handleModalTabKey } from '../../lib/modalFocus';

export const SettingsModal: React.FC = () => {
  const isOpen = useTreeStore((state) => state.isSettingsModalOpen);
  const closeSettingsModal = useTreeStore((state) => state.closeSettingsModal);
  const persistedSettings = useTreeStore((state) => state.persistedSettings);
  const updateSettings = useTreeStore((state) => state.updateSettings);
  const resetSettingsToDefault = useTreeStore((state) => state.resetSettingsToDefault);
  const lastSavedAt = useTreeStore((state) => state.lastSavedAt);
  const saveStatus = useTreeStore((state) => state.saveStatus);

  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const gridVisible = persistedSettings.gridVisible ?? true;
  const miniMapVisible = persistedSettings.miniMapVisible ?? true;
  const snapToGrid = persistedSettings.snapToGrid ?? false;
  const theme = persistedSettings.theme ?? 'light';

  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 20);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeSettingsModal();
      } else if (e.key === 'Tab') {
        handleModalTabKey(e, modalRef.current);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, closeSettingsModal]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      aria-describedby="settings-modal-description"
      className="nokey fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 select-none"
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-lg rounded-xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shadow-2xs">
              <Settings className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <h2 id="settings-modal-title" className="text-base font-semibold text-slate-900">
                Editor Settings
              </h2>
              <p id="settings-modal-description" className="text-xs text-slate-500">
                Configure canvas appearance, interaction preferences, and persistence.
              </p>
            </div>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeSettingsModal}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition cursor-pointer"
            aria-label="Close settings modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Section 1: Canvas Appearance */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              Canvas Controls & Display
            </h3>

            <div className="space-y-3">
              {/* Grid Toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50/40 hover:bg-slate-50 transition">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-white border border-slate-200 text-slate-600">
                    <Grid className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-800">Canvas Dot Grid</div>
                    <div className="text-[11px] text-slate-500">
                      Show background dot grid pattern in the canvas viewport
                    </div>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={gridVisible}
                    onChange={(e) => updateSettings({ gridVisible: e.target.checked })}
                    className="sr-only peer"
                    aria-label="Toggle Canvas Dot Grid"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
                </label>
              </div>

              {/* MiniMap Toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50/40 hover:bg-slate-50 transition">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-white border border-slate-200 text-slate-600">
                    <MapIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-800">MiniMap Overview</div>
                    <div className="text-[11px] text-slate-500">
                      Display bird&apos;s-eye thumbnail map in the bottom-right corner
                    </div>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={miniMapVisible}
                    onChange={(e) => updateSettings({ miniMapVisible: e.target.checked })}
                    className="sr-only peer"
                    aria-label="Toggle MiniMap Overview"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
                </label>
              </div>

              {/* Snap to Grid */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50/40 hover:bg-slate-50 transition">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-white border border-slate-200 text-slate-600">
                    <Magnet className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-800">Snap to Grid</div>
                    <div className="text-[11px] text-slate-500">
                      Align nodes to 20px grid intervals during drag operations
                    </div>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={snapToGrid}
                    onChange={(e) => updateSettings({ snapToGrid: e.target.checked })}
                    className="sr-only peer"
                    aria-label="Toggle Snap to Grid"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
                </label>
              </div>
            </div>
          </div>

          {/* Section 2: Color Theme */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              Color Theme
            </h3>

            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => updateSettings({ theme: 'light' })}
                className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition cursor-pointer text-center ${
                  theme === 'light'
                    ? 'bg-blue-50/80 border-blue-500 ring-1 ring-blue-500 text-blue-800'
                    : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <Sun className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-medium">Light</span>
              </button>

              <button
                type="button"
                onClick={() => updateSettings({ theme: 'dark' })}
                className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition cursor-pointer text-center ${
                  theme === 'dark'
                    ? 'bg-blue-50/80 border-blue-500 ring-1 ring-blue-500 text-blue-800'
                    : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <Moon className="w-4 h-4 text-indigo-500" />
                <span className="text-xs font-medium">Dark</span>
              </button>

              <button
                type="button"
                onClick={() => updateSettings({ theme: 'system' })}
                className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition cursor-pointer text-center ${
                  theme === 'system'
                    ? 'bg-blue-50/80 border-blue-500 ring-1 ring-blue-500 text-blue-800'
                    : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <Laptop className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-medium">System</span>
              </button>
            </div>
          </div>

          {/* Section 3: Persistence & Storage Info */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1.5">
            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                <span>Storage Key</span>
              </span>
              <span className="font-mono text-[11px] text-slate-800 font-medium">
                {PERSISTENCE_STORAGE_KEY}
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-600">
              <span>Last Saved</span>
              <span className="text-[11px] text-slate-800">
                {lastSavedAt ? new Date(lastSavedAt).toLocaleTimeString() : 'Not yet saved'}
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-600">
              <span>Save Status</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span className="capitalize">{saveStatus}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <button
            type="button"
            onClick={resetSettingsToDefault}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-md transition cursor-pointer"
            title="Reset all settings to default values"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Defaults</span>
          </button>

          <button
            type="button"
            onClick={closeSettingsModal}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-xs transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
