'use client';

import React, {
  useState,
  useReducer,
  useMemo,
  useCallback,
  useRef,
  useEffect,
  useId,
} from 'react';
import { Search, X, Layers, Shield, GitBranch, Zap, CircleHelp, Check } from 'lucide-react';
import { useReactFlow, useViewport } from '@xyflow/react';
import { useTreeStore } from '../../store/treeStore';
import {
  searchNodes,
  searchDropdownReducer,
  getHighlightSegments,
  computeFocusTarget,
  isSlashShortcutEligible,
  getCachedSearchNodes,
  resolveSearchKeyDecision,
  type SearchResultItem,
} from '../../lib/search';
import { getNodeTypeConfig, type NodeIconId } from '../../lib/nodeTypeConfig';
import type { LucideIcon } from 'lucide-react';

const ICON_MAP: Record<NodeIconId, LucideIcon> = {
  root: Layers,
  rule: Shield,
  condition: GitBranch,
  action: Zap,
  unknown: CircleHelp,
};

export const SearchBox: React.FC = () => {
  const {
    nodes,
    selectedNodeId,
    setSelectedNodeId,
    setFocusPulseNodeId,
    deleteConfirmation,
    addChildChoiceOpen,
    cancelDeleteNode,
    setAddChildChoiceOpen,
  } = useTreeStore();

  const viewport = useViewport();
  const { setViewport } = useReactFlow();

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  const pulseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const announcementTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingFocusTokenRef = useRef<number>(0);
  const pendingRafRef1 = useRef<number | null>(null);
  const pendingRafRef2 = useRef<number | null>(null);

  const [announcement, setAnnouncement] = useState<string>('');

  const listboxId = useId();
  const inputId = useId();

  const [dropdownState, dispatch] = useReducer(searchDropdownReducer, {
    query: '',
    isOpen: false,
    activeIndex: -1,
  });

  const { query, isOpen, activeIndex } = dropdownState;

  // Compute search results stably using cached reference-equality fast path
  const results = useMemo(() => {
    return getCachedSearchNodes(nodes, query);
  }, [nodes, query]);

  const terms = useMemo(() => {
    const norm = query.trim().toLowerCase();
    return norm ? norm.split(/\s+/).filter(Boolean) : [];
  }, [query]);

  // Reconcile active index when results change
  useEffect(() => {
    dispatch({ type: 'reconcile', resultCount: results.length });
  }, [results.length]);

  // Debounced live region announcements
  useEffect(() => {
    if (announcementTimerRef.current) {
      clearTimeout(announcementTimerRef.current);
    }
    if (!query.trim()) {
      announcementTimerRef.current = setTimeout(() => {
        setAnnouncement('');
      }, 0);
      return;
    }
    announcementTimerRef.current = setTimeout(() => {
      if (results.length === 0) {
        setAnnouncement('No matching nodes found.');
      } else {
        setAnnouncement(`${results.length} matching node${results.length === 1 ? '' : 's'} found.`);
      }
    }, 300);

    return () => {
      if (announcementTimerRef.current) {
        clearTimeout(announcementTimerRef.current);
      }
    };
  }, [query, results.length]);

  // Scroll active option into view when navigating with keyboard
  useEffect(() => {
    if (isOpen && activeIndex >= 0 && listboxRef.current) {
      const activeEl = listboxRef.current.children[activeIndex] as HTMLElement | undefined;
      if (activeEl?.scrollIntoView) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [isOpen, activeIndex]);

  // Outside pointerdown listener to close dropdown
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        dispatch({ type: 'close' });
      }
    };
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  // Slash shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/') {
        if (
          !e.isComposing &&
          !deleteConfirmation &&
          !addChildChoiceOpen &&
          isSlashShortcutEligible(document.activeElement as HTMLElement)
        ) {
          e.preventDefault();
          inputRef.current?.focus();
          if (query.trim().length > 0) {
            inputRef.current?.select();
            dispatch({ type: 'open' });
            dispatch({ type: 'reconcile', resultCount: results.length });
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteConfirmation, addChildChoiceOpen, query, results.length]);

  // Clean up pulse timer, announcement timer, and pending animation frames on unmount
  useEffect(() => {
    return () => {
      if (pulseTimerRef.current) {
        clearTimeout(pulseTimerRef.current);
      }
      if (announcementTimerRef.current) {
        clearTimeout(announcementTimerRef.current);
      }
      if (pendingRafRef1.current !== null) {
        cancelAnimationFrame(pendingRafRef1.current);
      }
      if (pendingRafRef2.current !== null) {
        cancelAnimationFrame(pendingRafRef2.current);
      }
    };
  }, []);

  const handleSelectResult = useCallback(
    (item: SearchResultItem) => {
      // Invalidate any pending focus animation from previous selections
      const token = ++pendingFocusTokenRef.current;
      if (pendingRafRef1.current !== null) {
        cancelAnimationFrame(pendingRafRef1.current);
        pendingRafRef1.current = null;
      }
      if (pendingRafRef2.current !== null) {
        cancelAnimationFrame(pendingRafRef2.current);
        pendingRafRef2.current = null;
      }

      // 1. Validate that target node still exists
      const targetNode = nodes.find((n) => n.id === item.node.id);
      if (!targetNode) {
        setAnnouncement('Selected node no longer exists.');
        dispatch({ type: 'close' });
        return;
      }

      // 2. Close conflicting transient UI, including open delete confirmation or Add Child choice
      if (deleteConfirmation) {
        cancelDeleteNode();
      }
      if (addChildChoiceOpen) {
        setAddChildChoiceOpen(false);
      }

      // 3. Select target node and open existing inspector
      dispatch({ type: 'select' });
      if (selectedNodeId !== targetNode.id) {
        setSelectedNodeId(targetNode.id);
      }

      // 4. Reset & restart focus pulse (coalesced to single active timer)
      if (pulseTimerRef.current) {
        clearTimeout(pulseTimerRef.current);
        pulseTimerRef.current = null;
      }
      setFocusPulseNodeId(targetNode.id);
      pulseTimerRef.current = setTimeout(() => {
        setFocusPulseNodeId(null);
        pulseTimerRef.current = null;
      }, 1500);

      // 5. Compute focus target on usable viewport dimensions across animation frames
      pendingRafRef1.current = requestAnimationFrame(() => {
        pendingRafRef1.current = null;
        if (pendingFocusTokenRef.current !== token) return;

        pendingRafRef2.current = requestAnimationFrame(() => {
          pendingRafRef2.current = null;
          if (pendingFocusTokenRef.current !== token) return;

          const canvasEl = document.querySelector('.react-flow') as HTMLElement | null;
          const inspectorEl = document.querySelector('aside[aria-label="Properties Inspector"]') as HTMLElement | null;

          const inspectorWidth = inspectorEl ? inspectorEl.getBoundingClientRect().width : 0;

          let containerWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
          let containerHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
          let rightInset = 0;

          if (canvasEl) {
            const canvasRect = canvasEl.getBoundingClientRect();
            if (canvasRect.width > 0 && canvasRect.height > 0) {
              containerWidth = canvasRect.width;
              containerHeight = canvasRect.height;
            }

            // Check if inspector overlaps canvas (e.g. mobile absolute drawer vs flex sibling)
            if (inspectorEl && inspectorWidth > 0) {
              const inspectorRect = inspectorEl.getBoundingClientRect();
              const overlap = Math.max(
                0,
                Math.min(canvasRect.right, inspectorRect.right) - Math.max(canvasRect.left, inspectorRect.left)
              );
              // Only apply inset if inspector actually overlaps the canvas
              // If it's a flex sibling, canvasRect.width is already contracted; rightInset is 0 to avoid double counting
              if (overlap > 0 && inspectorRect.left >= canvasRect.left) {
                rightInset = overlap;
              }
            }
          } else {
            // Fallback when canvas element is not directly in DOM (e.g. test environment)
            rightInset = inspectorWidth;
          }

          const target = computeFocusTarget(
            targetNode,
            viewport,
            containerWidth,
            containerHeight,
            1,
            rightInset
          );

          const prefersReducedMotion =
            typeof window !== 'undefined' &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;

          setViewport(target, { duration: prefersReducedMotion ? 0 : 300 });
        });
      });

      const label = (targetNode.data as { label?: string })?.label || targetNode.id;
      setAnnouncement(`Selected ${label}`);

      // Keep focus in input
      inputRef.current?.focus();
    },
    [
      nodes,
      viewport,
      selectedNodeId,
      deleteConfirmation,
      addChildChoiceOpen,
      cancelDeleteNode,
      setAddChildChoiceOpen,
      setViewport,
      setSelectedNodeId,
      setFocusPulseNodeId,
    ]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    dispatch({ type: 'queryChanged', query: val, resultCount: searchNodes(nodes, val).length });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const isComposing = Boolean(e.nativeEvent?.isComposing);

    const decision = resolveSearchKeyDecision({
      key: e.key,
      isComposing,
      isOpen,
      hasQuery: query.trim().length > 0,
      activeIndex,
      resultCount: results.length,
    });

    switch (decision.action) {
      case 'none':
        break;
      case 'open':
        e.preventDefault();
        dispatch({ type: 'open' });
        break;
      case 'close':
        e.preventDefault();
        e.stopPropagation();
        dispatch({ type: 'close' });
        break;
      case 'clear':
        e.preventDefault();
        e.stopPropagation();
        dispatch({ type: 'clear' });
        break;
      case 'blur':
        e.preventDefault();
        e.stopPropagation();
        inputRef.current?.blur();
        break;
      case 'select':
        e.preventDefault();
        if (decision.index >= 0 && decision.index < results.length) {
          handleSelectResult(results[decision.index]);
        }
        break;
      case 'next':
        e.preventDefault();
        dispatch({ type: 'next', resultCount: results.length });
        break;
      case 'previous':
        e.preventDefault();
        dispatch({ type: 'previous', resultCount: results.length });
        break;
    }
  };

  const activeOptionId =
    isOpen && activeIndex >= 0 && activeIndex < results.length
      ? `search-option-${results[activeIndex].node.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`
      : undefined;

  return (
    <div ref={containerRef} className="relative nokey">
      {/* Live region for accessibility announcements */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      {/* Search Input Container */}
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md focus-within:bg-white focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition shadow-2xs w-60 sm:w-72">
        <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-activedescendant={activeOptionId}
          aria-autocomplete="list"
          aria-label="Search tree nodes"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (query.trim() && results.length > 0) {
              dispatch({ type: 'open' });
            }
          }}
          placeholder="Search nodes... (/)"
          autoComplete="off"
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          enterKeyHint="search"
          maxLength={200}
          className="w-full text-xs text-slate-900 bg-transparent outline-none placeholder:text-slate-400 font-medium"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              dispatch({ type: 'clear' });
              inputRef.current?.focus();
            }}
            className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer transition"
            aria-label="Clear search"
            title="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown Results Listbox */}
      {isOpen && (
        <ul
          ref={listboxRef}
          id={listboxId}
          role="listbox"
          aria-label="Search results"
          className="absolute left-0 right-0 mt-1 max-h-80 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1 divide-y divide-slate-100"
        >
          {nodes.length === 0 ? (
            <li role="option" aria-selected="false" className="px-3 py-2.5 text-xs text-slate-500 italic text-center">
              No nodes to search.
            </li>
          ) : results.length === 0 ? (
            <li role="option" aria-selected="false" className="px-3 py-2.5 text-xs text-slate-500 italic text-center">
              No matching nodes found.
            </li>
          ) : (
            results.map((item, index) => {
              const node = item.node;
              const data = node.data as { label?: string; ruleId?: string; description?: string };
              const label = data?.label || node.id;
              const ruleId = data?.ruleId;
              const config = getNodeTypeConfig(node.type);
              const IconComponent = ICON_MAP[config.iconId] || CircleHelp;
              const isActive = index === activeIndex;
              const optionDomId = `search-option-${node.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

              const labelSegments = getHighlightSegments(label, terms);

              return (
                <li
                  key={node.id}
                  id={optionDomId}
                  role="option"
                  aria-selected={isActive}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelectResult(item)}
                  className={`px-3 py-2 text-xs cursor-pointer transition flex items-start gap-2.5 min-h-[52px] ${
                    isActive ? 'bg-blue-50 text-blue-950' : 'hover:bg-slate-50 text-slate-800'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded flex items-center justify-center border shrink-0 mt-0.5 ${config.styling.iconBg} ${config.styling.iconText} ${config.styling.iconBorder}`}
                  >
                    <IconComponent className="w-3.5 h-3.5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold truncate" title={label}>
                        {labelSegments.map((seg, sIdx) =>
                          seg.match ? (
                            <mark key={sIdx} className="bg-yellow-200 text-slate-900 rounded px-0.5">
                              {seg.text}
                            </mark>
                          ) : (
                            seg.text
                          )
                        )}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                        {config.badgeLabel}
                      </span>
                    </div>

                    {ruleId && (
                      <div className="font-mono text-[10px] text-blue-700 mt-0.5 break-all">
                        {ruleId}
                      </div>
                    )}

                    {item.snippet && (
                      <p
                        title={data?.description}
                        className="text-[11px] text-slate-500 mt-0.5 italic line-clamp-1 truncate"
                      >
                        {item.snippet}
                      </p>
                    )}
                  </div>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
};
