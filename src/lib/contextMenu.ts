/**
 * Pure Context Menu Model & Item Resolvers for Day 12.
 *
 * Implements:
 * - Typed data structures for Node and Canvas Pane context menus
 * - Dynamic action resolution based on node type, clipboard state, and descendant counts
 * - Clamping helpers for keeping menus within viewport boundaries
 * - Screen-to-canvas coordinate mapping helpers
 */

import type { TreeNode, NodeType } from '../types/tree';
import { ALLOWED_CHILDREN_MAP } from './relationshipRules';

export interface NodeContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  nodeId: string;
}

export interface PaneContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  flowPosition: { x: number; y: number };
}

export type ContextMenuActionId =
  | 'add-child-rule'
  | 'add-child-condition'
  | 'add-child-action'
  | 'select-subtree'
  | 'copy-subtree'
  | 'paste-subtree-child'
  | 'paste-subtree-pane'
  | 'duplicate-subtree'
  | 'toggle-collapse'
  | 'delete-single'
  | 'delete-subtree'
  | 'copy-selected'
  | 'delete-selected'
  | 'clear-selection'
  | 'add-root'
  | 'add-rule'
  | 'auto-layout'
  | 'fit-view'
  | 'reset-view';

export interface ContextMenuItem {
  id: ContextMenuActionId;
  label: string;
  shortcut?: string;
  icon?: string;
  disabled?: boolean;
  danger?: boolean;
  separatorAfter?: boolean;
  childType?: NodeType;
}

/**
 * Resolves context menu items for a specific clicked node.
 */
export function resolveNodeContextMenuItems(
  node: TreeNode,
  options: {
    hasClipboard: boolean;
    descendantCount: number;
    isCollapsed: boolean;
    multiSelectedCount?: number;
  }
): ContextMenuItem[] {
  const items: ContextMenuItem[] = [];

  // If multiple nodes are selected, prioritize multi-selection bulk actions at the top
  if (options.multiSelectedCount && options.multiSelectedCount >= 2) {
    items.push({
      id: 'copy-selected',
      label: `Copy Selected Nodes (${options.multiSelectedCount})`,
      shortcut: 'Ctrl+C',
    });
    items.push({
      id: 'delete-selected',
      label: `Delete Selected Nodes (${options.multiSelectedCount})`,
      shortcut: 'Del',
      danger: true,
    });
    items.push({
      id: 'clear-selection',
      label: 'Clear Selection',
      separatorAfter: true,
    });
  }

  const allowedChildren = ALLOWED_CHILDREN_MAP[node.type] || [];

  // 1. Add Child actions based on policy relationship rules
  if (allowedChildren.includes('rule')) {
    items.push({
      id: 'add-child-rule',
      label: 'Add Child Rule',
      childType: 'rule',
    });
  }
  if (allowedChildren.includes('condition')) {
    items.push({
      id: 'add-child-condition',
      label: 'Add Child Condition',
      childType: 'condition',
    });
  }
  if (allowedChildren.includes('action')) {
    items.push({
      id: 'add-child-action',
      label: 'Add Child Action',
      childType: 'action',
    });
  }

  if (items.length > 0) {
    items[items.length - 1].separatorAfter = true;
  }

  // 2. Selection & Clipboard operations
  items.push({
    id: 'select-subtree',
    label: options.descendantCount > 0 ? `Select Subtree (${options.descendantCount + 1} nodes)` : 'Select Subtree',
  });

  items.push({
    id: 'copy-subtree',
    label: options.descendantCount > 0 ? 'Copy Subtree' : 'Copy Node',
    shortcut: 'Ctrl+C',
  });

  items.push({
    id: 'paste-subtree-child',
    label: 'Paste Subtree as Child',
    shortcut: 'Ctrl+V',
    disabled: !options.hasClipboard,
  });

  items.push({
    id: 'duplicate-subtree',
    label: options.descendantCount > 0 ? 'Duplicate Subtree' : 'Duplicate Node',
    separatorAfter: true,
  });

  // 3. Subtree Collapse / Expand (only if node has descendants)
  if (options.descendantCount > 0) {
    items.push({
      id: 'toggle-collapse',
      label: options.isCollapsed
        ? `Expand Subtree (${options.descendantCount} hidden)`
        : `Collapse Subtree (${options.descendantCount} node${options.descendantCount > 1 ? 's' : ''})`,
      separatorAfter: true,
    });
  }

  // 4. Deletion Semantics
  items.push({
    id: 'delete-single',
    label: 'Delete Node Only',
    shortcut: 'Del',
    danger: true,
  });

  if (options.descendantCount > 0) {
    items.push({
      id: 'delete-subtree',
      label: `Delete Subtree (${options.descendantCount + 1} nodes)`,
      shortcut: 'Shift+Del',
      danger: true,
    });
  }

  return items;
}

/**
 * Resolves context menu items for a blank canvas pane click.
 */
export function resolvePaneContextMenuItems(options: {
  hasClipboard: boolean;
}): ContextMenuItem[] {
  return [
    {
      id: 'paste-subtree-pane',
      label: 'Paste Subtree Here',
      shortcut: 'Ctrl+V',
      disabled: !options.hasClipboard,
      separatorAfter: true,
    },
    {
      id: 'add-root',
      label: 'Add Root Node',
    },
    {
      id: 'add-rule',
      label: 'Add Rule Node',
      separatorAfter: true,
    },
    {
      id: 'auto-layout',
      label: 'Auto Layout',
      shortcut: 'Ctrl+Shift+L',
    },
    {
      id: 'fit-view',
      label: 'Fit View',
      shortcut: 'Ctrl+0',
    },
    {
      id: 'reset-view',
      label: 'Reset View',
      shortcut: 'Ctrl+1',
    },
  ];
}

/**
 * Clamps context menu position to prevent overflow offscreen.
 */
export function clampMenuPosition(
  x: number,
  y: number,
  menuWidth = 220,
  menuHeight = 320
): { x: number; y: number } {
  if (typeof window === 'undefined') {
    return { x, y };
  }

  const padding = 10;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let clampedX = x;
  let clampedY = y;

  if (clampedX + menuWidth > viewportWidth - padding) {
    clampedX = Math.max(padding, viewportWidth - menuWidth - padding);
  }

  if (clampedY + menuHeight > viewportHeight - padding) {
    clampedY = Math.max(padding, viewportHeight - menuHeight - padding);
  }

  return { x: clampedX, y: clampedY };
}
