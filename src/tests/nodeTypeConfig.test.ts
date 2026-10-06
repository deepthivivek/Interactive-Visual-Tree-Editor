import { describe, it, expect } from 'vitest';
import {
  getNodeTypeConfig,
  getNodeStatusConfig,
  NODE_TYPE_CONFIGS,
  NODE_STATUS_CONFIGS,
  UNKNOWN_NODE_TYPE_CONFIG,
  UNKNOWN_NODE_STATUS_CONFIG,
  type NodeTypeConfig,
} from '../lib/nodeTypeConfig';
import type { NodeType, NodeStatus } from '../types/tree';

describe('Shared Node Type Configuration (Day 3)', () => {
  describe('getNodeTypeConfig - Core Supported Types', () => {
    it('resolves Root node configuration accurately', () => {
      const config = getNodeTypeConfig('root');
      expect(config.type).toBe('root');
      expect(config.displayLabel).toBe('Root Node');
      expect(config.badgeLabel).toBe('ROOT');
      expect(config.iconId).toBe('root');
      expect(config.colors.primary).toBe('#2563eb');
      expect(config.styling.accentBar).toBe('bg-blue-600');
    });

    it('resolves Rule node configuration accurately', () => {
      const config = getNodeTypeConfig('rule');
      expect(config.type).toBe('rule');
      expect(config.displayLabel).toBe('Rule');
      expect(config.badgeLabel).toBe('RULE');
      expect(config.iconId).toBe('rule');
      expect(config.colors.primary).toBe('#4f46e5');
      expect(config.styling.accentBar).toBe('bg-indigo-600');
    });

    it('resolves Condition node configuration accurately', () => {
      const config = getNodeTypeConfig('condition');
      expect(config.type).toBe('condition');
      expect(config.displayLabel).toBe('Condition');
      expect(config.badgeLabel).toBe('CONDITION');
      expect(config.iconId).toBe('condition');
      expect(config.colors.primary).toBe('#d97706');
      expect(config.styling.accentBar).toBe('bg-amber-500');
    });

    it('resolves Action node configuration accurately', () => {
      const config = getNodeTypeConfig('action');
      expect(config.type).toBe('action');
      expect(config.displayLabel).toBe('Action');
      expect(config.badgeLabel).toBe('ACTION');
      expect(config.iconId).toBe('action');
      expect(config.colors.primary).toBe('#059669');
      expect(config.styling.accentBar).toBe('bg-emerald-600');
    });

    it('handles uppercase and whitespace gracefully', () => {
      expect(getNodeTypeConfig(' ROOT ').type).toBe('root');
      expect(getNodeTypeConfig('Rule').type).toBe('rule');
      expect(getNodeTypeConfig(' CONDITION ').type).toBe('condition');
      expect(getNodeTypeConfig('ACTION').type).toBe('action');
    });
  });

  describe('getNodeTypeConfig - Defensive Fallback Behavior', () => {
    it('returns safe fallback for unknown runtime type string without throwing', () => {
      const config = getNodeTypeConfig('nonexistent_type');
      expect(config).toEqual(UNKNOWN_NODE_TYPE_CONFIG);
      expect(config.type).toBe('unknown');
      expect(config.displayLabel).toBe('Unknown Node');
      expect(config.badgeLabel).toBe('UNKNOWN');
      expect(config.iconId).toBe('unknown');
      expect(config.colors.primary).toBe('#64748b');
    });

    it('returns safe fallback for null or undefined input', () => {
      expect(getNodeTypeConfig(null)).toEqual(UNKNOWN_NODE_TYPE_CONFIG);
      expect(getNodeTypeConfig(undefined)).toEqual(UNKNOWN_NODE_TYPE_CONFIG);
      expect(getNodeTypeConfig('')).toEqual(UNKNOWN_NODE_TYPE_CONFIG);
    });
  });

  describe('Configuration Completeness & Serializability', () => {
    const supportedTypes: NodeType[] = ['root', 'rule', 'condition', 'action'];

    it('ensures all 4 supported types have complete color definitions for future MiniMap', () => {
      for (const type of supportedTypes) {
        const config: NodeTypeConfig = NODE_TYPE_CONFIGS[type];
        expect(config.colors.primary).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(config.colors.background).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(config.colors.border).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(config.colors.text).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    });

    it('ensures all styling attributes use complete static Tailwind classes', () => {
      for (const type of supportedTypes) {
        const config: NodeTypeConfig = NODE_TYPE_CONFIGS[type];
        expect(config.styling.cardBorder).toContain('border-');
        expect(config.styling.cardBorderSelected).toContain('border-');
        expect(config.styling.cardRingSelected).toContain('ring-');
        expect(config.styling.headerBg).toContain('bg-');
        expect(config.styling.iconBg).toContain('bg-');
        expect(config.styling.badgeBg).toContain('bg-');
      }
    });

    it('is strictly serializable (no React elements or functions)', () => {
      for (const type of supportedTypes) {
        const config = NODE_TYPE_CONFIGS[type];
        const serialized = JSON.stringify(config);
        const parsed = JSON.parse(serialized);
        expect(parsed.type).toBe(type);
        expect(parsed.iconId).toBe(config.iconId);
      }
    });
  });

  describe('getNodeStatusConfig - Status Presentation', () => {
    const supportedStatuses: NodeStatus[] = ['active', 'in_review', 'draft', 'deprecated'];

    it('resolves all supported statuses accurately', () => {
      for (const status of supportedStatuses) {
        const config = getNodeStatusConfig(status);
        expect(config.status).toBe(status);
        expect(config.label).toBeTruthy();
        expect(config.dotColor).toContain('bg-');
        expect(config.textColor).toContain('text-');
        expect(config.hex).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    });

    it('falls back safely for unknown or missing status values', () => {
      expect(getNodeStatusConfig('nonexistent')).toEqual(UNKNOWN_NODE_STATUS_CONFIG);
      expect(getNodeStatusConfig(null)).toEqual(UNKNOWN_NODE_STATUS_CONFIG);
      expect(getNodeStatusConfig(undefined)).toEqual(UNKNOWN_NODE_STATUS_CONFIG);
    });
  });
});
