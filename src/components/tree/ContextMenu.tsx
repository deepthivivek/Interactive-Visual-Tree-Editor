'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  Copy,
  ClipboardPaste,
  Files,
  Trash2,
  GitBranch,
  Layers,
  Shield,
  Zap,
  FolderTree,
  ChevronDown,
  ChevronUp,
  Maximize2,
  RotateCcw,
  Workflow,
  AlertTriangle,
} from 'lucide-react';
import { useTreeStore } from '../../store/treeStore';
import {
  resolveNodeContextMenuItems,
  resolvePaneContextMenuItems,
  clampMenuPosition,
  type ContextMenuItem,
} from '../../lib/contextMenu';
import { getDescendantCount } from '../../lib/subtree';

interface ContextMenuProps {
  onFitView?: () => void;
  onResetView?: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  onFitView,
  onResetView,
}) => {
  const nodeContextMenu = useTreeStore((state) => state.nodeContextMenu);
  const paneContextMenu = useTreeStore((state) => state.paneContextMenu);
  const closeAllContextMenus = useTreeStore(
    (state) => state.closeAllContextMenus
  );

  const nodes = useTreeStore((state) => state.nodes);
  const edges = useTreeStore((state) => state.edges);
  const clipboard = useTreeStore((state) => state.clipboard);

  const addChild = useTreeStore((state) => state.addChild);
  const copySubtree = useTreeStore((state) => state.copySubtree);
  const pasteSubtree = useTreeStore((state) => state.pasteSubtree);
  const duplicateSubtree = useTreeStore((state) => state.duplicateSubtree);
  const toggleNodeCollapse = useTreeStore((state) => state.toggleNodeCollapse);
  const deleteSingleNode = useTreeStore((state) => state.deleteSingleNode);
  const deleteSubtree = useTreeStore((state) => state.deleteSubtree);
  const createNode = useTreeStore((state) => state.createNode);

  const menuRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);

  const isNodeMenu = Boolean(nodeContextMenu?.isOpen && nodeContextMenu.nodeId);
  const isPaneMenu = Boolean(paneContextMenu?.isOpen);
  const isOpen = isNodeMenu || isPaneMenu;

  // Resolve items
  const targetNode = isNodeMenu
    ? nodes.find((n) => n.id === nodeContextMenu!.nodeId)
    : undefined;

  const descendantCount = targetNode
    ? getDescendantCount(targetNode.id, edges)
    : 0;

  const isCollapsed = Boolean(targetNode?.data?.collapsed);

  const items: ContextMenuItem[] = useMemo(() => {
    return isNodeMenu && targetNode
      ? resolveNodeContextMenuItems(targetNode, {
          hasClipboard: Boolean(clipboard && clipboard.nodes.length > 0),
          descendantCount,
          isCollapsed,
        })
      : isPaneMenu
      ? resolvePaneContextMenuItems({
          hasClipboard: Boolean(clipboard && clipboard.nodes.length > 0),
        })
      : [];
  }, [isNodeMenu, targetNode, isPaneMenu, clipboard, descendantCount, isCollapsed]);

  const executeAction = useCallback(
    (item: ContextMenuItem) => {
      closeAllContextMenus();

      switch (item.id) {
        case 'add-child-rule':
        case 'add-child-condition':
        case 'add-child-action': {
          if (targetNode && item.childType) {
            addChild(targetNode.id, item.childType);
          }
          break;
        }

        case 'copy-subtree': {
          if (targetNode) {
            copySubtree(targetNode.id);
          }
          break;
        }

        case 'paste-subtree-child': {
          if (targetNode) {
            pasteSubtree(targetNode.id);
          }
          break;
        }

        case 'paste-subtree-pane': {
          if (paneContextMenu?.flowPosition) {
            pasteSubtree(null, {
              cursorPosition: paneContextMenu.flowPosition,
            });
          }
          break;
        }

        case 'duplicate-subtree': {
          if (targetNode) {
            duplicateSubtree(targetNode.id);
          }
          break;
        }

        case 'toggle-collapse': {
          if (targetNode) {
            toggleNodeCollapse(targetNode.id);
          }
          break;
        }

        case 'delete-single': {
          if (targetNode) {
            deleteSingleNode(targetNode.id);
          }
          break;
        }

        case 'delete-subtree': {
          if (targetNode) {
            deleteSubtree(targetNode.id);
          }
          break;
        }

        case 'add-root': {
          if (paneContextMenu?.flowPosition) {
            createNode('root', paneContextMenu.flowPosition);
          }
          break;
        }

        case 'add-rule': {
          if (paneContextMenu?.flowPosition) {
            createNode('rule', paneContextMenu.flowPosition);
          }
          break;
        }

        case 'auto-layout': {
          window.dispatchEvent(new CustomEvent('tree:trigger-autolayout'));
          break;
        }

        case 'fit-view': {
          onFitView?.();
          break;
        }

        case 'reset-view': {
          onResetView?.();
          break;
        }
      }
    },
    [
      targetNode,
      paneContextMenu,
      addChild,
      copySubtree,
      pasteSubtree,
      duplicateSubtree,
      toggleNodeCollapse,
      deleteSingleNode,
      deleteSubtree,
      createNode,
      onFitView,
      onResetView,
      closeAllContextMenus,
    ]
  );

  // Reset focus index when opened (using queueMicrotask to avoid sync setState in effect)
  useEffect(() => {
    if (isOpen) {
      queueMicrotask(() => setFocusedIndex(0));
    }
  }, [isOpen]);

  // Click outside and keydown listeners
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeAllContextMenus();
        return;
      }

      if (items.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) => {
          let next = (prev + 1) % items.length;
          while (items[next]?.disabled && next !== prev) {
            next = (next + 1) % items.length;
          }
          return next;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => {
          let next = (prev - 1 + items.length) % items.length;
          while (items[next]?.disabled && next !== prev) {
            next = (next - 1 + items.length) % items.length;
          }
          return next;
        });
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const activeItem = items[focusedIndex];
        if (activeItem && !activeItem.disabled) {
          executeAction(activeItem);
        }
      }
    };

    const handlePointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeAllContextMenus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isOpen, items, focusedIndex, closeAllContextMenus, executeAction]);

  if (!isOpen) return null;

  const rawX = isNodeMenu ? nodeContextMenu!.x : paneContextMenu!.x;
  const rawY = isNodeMenu ? nodeContextMenu!.y : paneContextMenu!.y;
  const { x, y } = clampMenuPosition(rawX, rawY);

  const getActionIcon = (id: string) => {
    switch (id) {
      case 'add-child-rule':
        return <Shield className="w-3.5 h-3.5 text-indigo-500" />;
      case 'add-child-condition':
        return <GitBranch className="w-3.5 h-3.5 text-amber-500" />;
      case 'add-child-action':
        return <Zap className="w-3.5 h-3.5 text-emerald-500" />;
      case 'copy-subtree':
        return <Copy className="w-3.5 h-3.5 text-slate-500" />;
      case 'paste-subtree-child':
      case 'paste-subtree-pane':
        return <ClipboardPaste className="w-3.5 h-3.5 text-blue-500" />;
      case 'duplicate-subtree':
        return <Files className="w-3.5 h-3.5 text-slate-500" />;
      case 'toggle-collapse':
        return isCollapsed ? (
          <ChevronDown className="w-3.5 h-3.5 text-amber-600" />
        ) : (
          <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
        );
      case 'delete-single':
      case 'delete-subtree':
        return <Trash2 className="w-3.5 h-3.5 text-red-500" />;
      case 'add-root':
        return <Layers className="w-3.5 h-3.5 text-blue-500" />;
      case 'add-rule':
        return <Shield className="w-3.5 h-3.5 text-indigo-500" />;
      case 'auto-layout':
        return <Workflow className="w-3.5 h-3.5 text-blue-600" />;
      case 'fit-view':
        return <Maximize2 className="w-3.5 h-3.5 text-slate-500" />;
      case 'reset-view':
        return <RotateCcw className="w-3.5 h-3.5 text-slate-500" />;
      default:
        return null;
    }
  };

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={isNodeMenu ? 'Node context actions' : 'Canvas pane actions'}
      style={{ left: `${x}px`, top: `${y}px` }}
      className="fixed z-50 min-w-[210px] max-w-[280px] bg-white rounded-lg shadow-xl border border-slate-200 py-1 text-xs text-slate-700 animate-in fade-in-0 zoom-in-95 duration-100 select-none font-sans"
    >
      {/* Optional header indicating target */}
      {isNodeMenu && targetNode && (
        <div className="px-3 py-1.5 border-b border-slate-100 mb-1 text-[11px] font-semibold text-slate-800 bg-slate-50/70 truncate flex items-center justify-between">
          <span className="truncate max-w-[150px]">
            {targetNode.data?.label || 'Node'}
          </span>
          <span className="text-[10px] text-slate-400 font-normal uppercase tracking-wider">
            {targetNode.type}
          </span>
        </div>
      )}

      {items.map((item, idx) => (
        <React.Fragment key={item.id}>
          <button
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => executeAction(item)}
            onMouseEnter={() => setFocusedIndex(idx)}
            className={`w-full flex items-center justify-between px-3 py-1.5 text-left transition-colors cursor-pointer ${
              item.disabled
                ? 'opacity-40 cursor-not-allowed text-slate-400'
                : item.danger
                ? focusedIndex === idx
                  ? 'bg-red-50 text-red-700'
                  : 'text-red-600 hover:bg-red-50/80'
                : focusedIndex === idx
                ? 'bg-slate-100 text-slate-900 font-medium'
                : 'hover:bg-slate-50 text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              {getActionIcon(item.id)}
              <span className="truncate">{item.label}</span>
            </div>
            {item.shortcut && (
              <span className="ml-3 text-[10px] text-slate-400 font-mono">
                {item.shortcut}
              </span>
            )}
          </button>
          {item.separatorAfter && (
            <div className="my-1 border-t border-slate-100" />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};
