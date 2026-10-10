import { describe, it, expect } from 'vitest';
import {
  normalizeQuery,
  tokenizeQuery,
  getHighlightSegments,
  getSnippet,
  getSearchSignature,
  getCachedSearchNodes,
  resetSearchCache,
  areNodeDataReferencesEqual,
  searchDropdownReducer,
  computeFocusTarget,
  isSlashShortcutEligible,
  resolveSearchKeyDecision,
  searchNodes,
} from '../lib/search';
import type { TreeNode } from '../types/tree';

describe('Day 9: Advanced Search Engine & Utilities', () => {
  describe('1. Normalization & Tokenization', () => {
    it('normalizes query correctly (trim, collapse spaces, lowercase, max 200 chars)', () => {
      expect(normalizeQuery('  DISC   Rule   ')).toBe('disc rule');
      expect(normalizeQuery('hello\n\tworld')).toBe('hello world');
      expect(normalizeQuery('')).toBe('');
      const longQuery = 'a'.repeat(250);
      expect(normalizeQuery(longQuery).length).toBe(200);
    });

    it('tokenizes query into search terms', () => {
      expect(tokenizeQuery('  rule-2210   compliance  ')).toEqual(['rule-2210', 'compliance']);
      expect(tokenizeQuery('   ')).toEqual([]);
    });
  });

  describe('2. Highlighting (`getHighlightSegments`)', () => {
    it('generates correct highlight segments for matching terms case-insensitively', () => {
      const segments = getHighlightSegments('FINRA Rule 2210 Compliance', ['rule', 'compliance']);
      expect(segments).toEqual([
        { text: 'FINRA ', match: false },
        { text: 'Rule', match: true },
        { text: ' 2210 ', match: false },
        { text: 'Compliance', match: true },
      ]);
    });

    it('handles special characters literally without regex errors', () => {
      const text = 'Condition (Rule A) + B [test].*?';
      const segments = getHighlightSegments(text, ['(rule a)', '+ b']);
      expect(segments.some((s: { match: boolean; text: string }) => s.match && s.text.toLowerCase().includes('rule a'))).toBe(true);
      expect(segments.some((s: { match: boolean; text: string }) => s.match && s.text.toLowerCase().includes('+ b'))).toBe(true);
    });

    it('handles empty text or empty terms safely', () => {
      expect(getHighlightSegments('', ['test'])).toEqual([{ text: '', match: false }]);
      expect(getHighlightSegments('Hello', [])).toEqual([{ text: 'Hello', match: false }]);
    });
  });

  describe('3. Snippet Generation (`getSnippet`)', () => {
    it('produces a useful snippet around the first match', () => {
      const desc = 'This is a very long policy description regarding FINRA rule 2210 compliance requirements for broker-dealers.';
      const snippet = getSnippet(desc, ['2210']);
      expect(snippet).toContain('2210');
    });

    it('handles missing terms or short text gracefully', () => {
      expect(getSnippet('Short text', ['missing'])).toBe('Short text');
      expect(getSnippet('', ['term'])).toBe('');
    });
  });

  describe('4. Search Signature (`getSearchSignature`)', () => {
    it('produces identical signature when positions or selections change, but changes when searchable fields change', () => {
      const nodeA: TreeNode = {
        id: 'node-1',
        type: 'rule',
        position: { x: 0, y: 0 },
        data: { label: 'Test Label', ruleId: 'RULE-1' },
      };
      const nodeASelected: TreeNode = {
        ...nodeA,
        selected: true,
        position: { x: 500, y: 500 },
      };
      const nodeAModified: TreeNode = {
        ...nodeA,
        data: { label: 'Updated Label', ruleId: 'RULE-1' },
      };

      const sig1 = getSearchSignature([nodeA]);
      const sig2 = getSearchSignature([nodeASelected]);
      const sig3 = getSearchSignature([nodeAModified]);

      expect(sig1).toBe(sig2);
      expect(sig1).not.toBe(sig3);
    });
  });

  describe('5. Dropdown Reducer', () => {
    it('handles open, close, clear, queryChanged, next, previous, select, and reconcile correctly', () => {
      let state = { query: '', isOpen: false, activeIndex: -1 };

      state = searchDropdownReducer(state, { type: 'queryChanged', query: 'rule', resultCount: 3 });
      expect(state.query).toBe('rule');
      expect(state.isOpen).toBe(true);
      expect(state.activeIndex).toBe(0);

      state = searchDropdownReducer(state, { type: 'next', resultCount: 3 });
      expect(state.activeIndex).toBe(1);

      state = searchDropdownReducer(state, { type: 'next', resultCount: 3 });
      expect(state.activeIndex).toBe(2);

      state = searchDropdownReducer(state, { type: 'next', resultCount: 3 });
      expect(state.activeIndex).toBe(0); // wraps around

      state = searchDropdownReducer(state, { type: 'previous', resultCount: 3 });
      expect(state.activeIndex).toBe(2); // wraps around backwards

      state = searchDropdownReducer(state, { type: 'clear' });
      expect(state.query).toBe('');
      expect(state.isOpen).toBe(false);
      expect(state.activeIndex).toBe(-1);
    });
  });

  describe('6. Viewport Focus & Slash Shortcut', () => {
    it('computes focus target coordinates safely', () => {
      const node: TreeNode = {
        id: 'n1',
        type: 'rule',
        position: { x: 100, y: 200 },
        data: { label: 'Node' },
      };
      const target = computeFocusTarget(node, { x: 0, y: 0, zoom: 1 }, 1200, 800, 1);
      expect(typeof target.x).toBe('number');
      expect(typeof target.y).toBe('number');
      expect(target.zoom).toBe(1);
    });

    it('computes focus target accounting for right-side inset without double-counting', () => {
      const node: TreeNode = {
        id: 'n1',
        type: 'rule',
        position: { x: 0, y: 0 },
        measured: { width: 200, height: 100 },
        data: { label: 'Node' },
      };
      // Node center = (100, 50).
      // Case A: screenWidth = 1200, rightInset = 352 (inspector).
      // Usable width = 1200 - 352 = 848. Center = 424.
      // Expected target.x = 424 - 100 * 1 = 324.
      const targetWithInset = computeFocusTarget(node, { x: 0, y: 0, zoom: 1 }, 1200, 800, 1, 352);
      expect(targetWithInset.x).toBe(324);
      expect(targetWithInset.y).toBe(350); // (800 / 2) - 50 = 350

      // Case B: Inset passed as object { right: 352 }
      const targetWithObjInset = computeFocusTarget(node, { x: 0, y: 0, zoom: 1 }, 1200, 800, 1, { right: 352 });
      expect(targetWithObjInset.x).toBe(324);

      // Case C: Canvas width already measured as 848 (flex sibling, no overlap).
      // With rightInset = 0, target.x should be identical to 324, verifying zero double-counting.
      const targetAlreadyContracted = computeFocusTarget(node, { x: 0, y: 0, zoom: 1 }, 848, 800, 1, 0);
      expect(targetAlreadyContracted.x).toBe(324);
    });

    it('clamps target zoom safely within [0.2, 1.5]', () => {
      const node: TreeNode = {
        id: 'n1',
        type: 'rule',
        position: { x: 100, y: 100 },
        data: { label: 'Node' },
      };
      expect(computeFocusTarget(node, { x: 0, y: 0, zoom: 1 }, 1000, 800, 0.05).zoom).toBe(0.2);
      expect(computeFocusTarget(node, { x: 0, y: 0, zoom: 1 }, 1000, 800, 3.5).zoom).toBe(1.5);
    });

    it('determines slash shortcut eligibility', () => {
      expect(isSlashShortcutEligible({ tagName: 'INPUT' } as HTMLElement)).toBe(false);
      expect(isSlashShortcutEligible({ tagName: 'TEXTAREA' } as HTMLElement)).toBe(false);
      expect(isSlashShortcutEligible({ tagName: 'DIV', closest: () => ({}) } as unknown as HTMLElement)).toBe(false);
      expect(isSlashShortcutEligible({ tagName: 'DIV', closest: () => null } as unknown as HTMLElement)).toBe(true);
    });
  });

  describe('7. Ranked Search (`searchNodes`)', () => {
    it('ranks exact Rule ID higher than exact node ID and label matches', () => {
      const nodes: TreeNode[] = [
        { id: 'rule-1', type: 'rule', position: { x: 0, y: 0 }, data: { label: 'Rule 2210', ruleId: 'RULE-2210-sub' } },
        { id: 'RULE-2210', type: 'rule', position: { x: 0, y: 0 }, data: { label: 'Other', ruleId: 'RULE-2210' } },
      ];

      const results = searchNodes(nodes, 'rule-2210');
      expect(results.length).toBe(2);
      expect(results[0].node.id).toBe('RULE-2210');
    });

    it('requires every query term to match', () => {
      const nodes: TreeNode[] = [
        { id: '1', type: 'rule', position: { x: 0, y: 0 }, data: { label: 'Risk Disclosure Rule', description: 'Mandatory' } },
        { id: '2', type: 'rule', position: { x: 0, y: 0 }, data: { label: 'Risk Policy', description: 'Optional' } },
      ];

      const results = searchNodes(nodes, 'risk mandatory');
      expect(results.length).toBe(1);
      expect(results[0].node.id).toBe('1');
    });

    it('scores tag matches at exactly 300 points', () => {
      const node: TreeNode = {
        id: 'node-tag-test',
        type: 'rule',
        position: { x: 0, y: 0 },
        data: {
          label: 'Unrelated Title',
          description: 'No matching keywords here',
          tags: ['compliance-critical', 'audit'],
        },
      };

      const results = searchNodes([node], 'compliance-critical');
      expect(results.length).toBe(1);
      expect(results[0].score).toBe(300);
      expect(results[0].matchedFields).toContain('tag');
    });

    it('scores metadata key and value matches at exactly 100 points', () => {
      const nodeWithKeyMatch: TreeNode = {
        id: 'node-meta-key',
        type: 'rule',
        position: { x: 0, y: 0 },
        data: {
          label: 'Generic Label',
          metadata: { jurisdiction: 'global' },
        },
      };

      const nodeWithValueMatch: TreeNode = {
        id: 'node-meta-val',
        type: 'rule',
        position: { x: 0, y: 0 },
        data: {
          label: 'Generic Label',
          metadata: { region: 'apac-east' },
        },
      };

      const resultsKey = searchNodes([nodeWithKeyMatch], 'jurisdiction');
      expect(resultsKey.length).toBe(1);
      expect(resultsKey[0].score).toBe(100);
      expect(resultsKey[0].matchedFields).toContain('metadata');

      const resultsVal = searchNodes([nodeWithValueMatch], 'apac-east');
      expect(resultsVal.length).toBe(1);
      expect(resultsVal[0].score).toBe(100);
      expect(resultsVal[0].matchedFields).toContain('metadata');
    });

    it('scores parameter key and value matches at exactly 100 points', () => {
      const nodeWithParamKey: TreeNode = {
        id: 'node-param-key',
        type: 'rule',
        position: { x: 0, y: 0 },
        data: {
          label: 'Generic Label',
          parameters: { threshold: 99 },
        },
      };

      const nodeWithParamVal: TreeNode = {
        id: 'node-param-val',
        type: 'rule',
        position: { x: 0, y: 0 },
        data: {
          label: 'Generic Label',
          parameters: { severity: 'critical-high' },
        },
      };

      const resultsKey = searchNodes([nodeWithParamKey], 'threshold');
      expect(resultsKey.length).toBe(1);
      expect(resultsKey[0].score).toBe(100);
      expect(resultsKey[0].matchedFields).toContain('parameters');

      const resultsVal = searchNodes([nodeWithParamVal], 'critical-high');
      expect(resultsVal.length).toBe(1);
      expect(resultsVal[0].score).toBe(100);
      expect(resultsVal[0].matchedFields).toContain('parameters');
    });

    it('preserves original input order when two or more nodes have equal total scores', () => {
      // Create 3 nodes with identical score (e.g. tag match of score 300)
      // Node IDs and labels are intentionally ordered anti-alphabetically to verify
      // it does NOT sort alphabetically by label or ID.
      const nodeZ: TreeNode = {
        id: 'z-node',
        type: 'rule',
        position: { x: 0, y: 0 },
        data: { label: 'Zebra Rule', tags: ['shared-tag'] },
      };
      const nodeM: TreeNode = {
        id: 'm-node',
        type: 'rule',
        position: { x: 0, y: 0 },
        data: { label: 'Monkey Rule', tags: ['shared-tag'] },
      };
      const nodeA: TreeNode = {
        id: 'a-node',
        type: 'rule',
        position: { x: 0, y: 0 },
        data: { label: 'Apple Rule', tags: ['shared-tag'] },
      };

      // Input order: [nodeZ, nodeM, nodeA]
      const results1 = searchNodes([nodeZ, nodeM, nodeA], 'shared-tag');
      expect(results1.map((r) => r.score)).toEqual([300, 300, 300]);
      expect(results1.map((r) => r.node.id)).toEqual(['z-node', 'm-node', 'a-node']);

      // Reversed input order: [nodeA, nodeM, nodeZ]
      const results2 = searchNodes([nodeA, nodeM, nodeZ], 'shared-tag');
      expect(results2.map((r) => r.score)).toEqual([300, 300, 300]);
      expect(results2.map((r) => r.node.id)).toEqual(['a-node', 'm-node', 'z-node']);
    });

    it('enforces the 200-character query limit and matches literal special characters safely', () => {
      const specialNode: TreeNode = {
        id: 'spec-1',
        type: 'rule',
        position: { x: 0, y: 0 },
        data: {
          label: 'Calculation: [x + y] * (z / 2) >= 100?',
          description: 'Special regex characters: .*+?^${}()|[]\\',
        },
      };

      // Literal special character matching without crashing
      const literalResults = searchNodes([specialNode], '[x + y]');
      expect(literalResults.length).toBe(1);
      expect(literalResults[0].node.id).toBe('spec-1');

      const regexCharResults = searchNodes([specialNode], '.*+?^${}()|[]\\');
      expect(regexCharResults.length).toBe(1);
      expect(regexCharResults[0].node.id).toBe('spec-1');

      // Query limit: query longer than 200 chars gets truncated by normalizeQuery
      const longInput = 'x'.repeat(250);
      expect(normalizeQuery(longInput).length).toBe(200);

      // Verify searchNodes respects the 200-character cap
      // Construct a node whose label has 200 'a' characters
      const exact200String = 'a'.repeat(200);
      const targetNode: TreeNode = {
        id: 'node-200',
        type: 'rule',
        position: { x: 0, y: 0 },
        data: { label: exact200String },
      };

      // Query matching exact 200 chars
      const exactResults = searchNodes([targetNode], exact200String);
      expect(exactResults.length).toBe(1);
      expect(exactResults[0].node.id).toBe('node-200');

      // If query has 250 'a' characters, normalizeQuery truncates it to 200 'a's,
      // which still matches targetNode exactly!
      const query250 = 'a'.repeat(250);
      const truncatedResults = searchNodes([targetNode], query250);
      expect(truncatedResults.length).toBe(1);
      expect(truncatedResults[0].node.id).toBe('node-200');

      // Extra tokens placed after 200 characters are truncated away and do not prevent matching
      const targetNodeMulti: TreeNode = {
        id: 'node-multi',
        type: 'rule',
        position: { x: 0, y: 0 },
        data: { label: 'alpha' },
      };
      // 'alpha' followed by spaces up to 200 chars, then an unmatched term 'nonexistent' at char 205
      const queryWithDiscardedTerm = 'alpha ' + 'b'.repeat(195) + ' nonexistent';
      // The 'nonexistent' term falls beyond 200 chars and is truncated out
      const cappedQuery = normalizeQuery(queryWithDiscardedTerm);
      expect(cappedQuery.length).toBe(200);
      expect(cappedQuery.includes('nonexistent')).toBe(false);
    });
  });

  describe('8. Search Purity Regression', () => {
    it('ensures search.ts has no dependencies on react, @xyflow/react, zustand, or application stores', () => {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(__dirname, '../lib/search.ts');
      const sourceCode = fs.readFileSync(filePath, 'utf8');

      const forbiddenModules = ['react', '@xyflow/react', 'zustand', 'treeStore'];

      const lines = sourceCode.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('import') || trimmed.startsWith('export') || trimmed.includes('require(')) {
          for (const mod of forbiddenModules) {
            if (trimmed.toLowerCase().includes(mod.toLowerCase())) {
              throw new Error(`search.ts imports or references forbidden module "${mod}": "${trimmed}"`);
            }
          }
        }
      }
    });
  });

  describe('9. Search Result Reference Stability (`getCachedSearchNodes`)', () => {
    it('preserves search-result reference identity on position-only or selection-only updates', () => {
      const node: TreeNode = {
        id: 'n1',
        type: 'rule',
        position: { x: 0, y: 0 },
        data: { label: 'Compliance Rule', ruleId: 'RULE-1' },
      };
      const results1 = getCachedSearchNodes([node], 'compliance');

      // Position-only change
      const nodePosChanged: TreeNode = {
        ...node,
        position: { x: 100, y: 200 },
      };
      const results2 = getCachedSearchNodes([nodePosChanged], 'compliance');
      expect(results1).toBe(results2);

      // Selection-only change
      const nodeSelected: TreeNode = {
        ...nodePosChanged,
        selected: true,
      };
      const results3 = getCachedSearchNodes([nodeSelected], 'compliance');
      expect(results1).toBe(results3);
    });

    it('invalidates cache when label, ruleId, added/removed nodes, or query changes', () => {
      const node: TreeNode = {
        id: 'n1',
        type: 'rule',
        position: { x: 0, y: 0 },
        data: { label: 'Compliance Rule', ruleId: 'RULE-1' },
      };
      const results1 = getCachedSearchNodes([node], 'compliance');

      // Label change
      const nodeLabelChanged: TreeNode = {
        ...node,
        data: { label: 'Updated Rule', ruleId: 'RULE-1' },
      };
      const results2 = getCachedSearchNodes([nodeLabelChanged], 'compliance');
      expect(results1).not.toBe(results2);

      // RuleId change
      const nodeRuleChanged: TreeNode = {
        ...node,
        data: { label: 'Compliance Rule', ruleId: 'RULE-2' },
      };
      const results3 = getCachedSearchNodes([nodeRuleChanged], 'compliance');
      expect(results1).not.toBe(results3);

      // Add node
      const node2: TreeNode = {
        id: 'n2',
        type: 'rule',
        position: { x: 50, y: 50 },
        data: { label: 'Another Rule' },
      };
      const results4 = getCachedSearchNodes([node, node2], 'compliance');
      expect(results1).not.toBe(results4);

      // Query change
      const results5 = getCachedSearchNodes([node], 'rule');
      expect(results1).not.toBe(results5);
    });

    it('demonstrates that a position-only update returns the identical search results object by reference without recomputing signature', () => {
      resetSearchCache();
      const nodeA: TreeNode = {
        id: 'node-alpha',
        type: 'rule',
        position: { x: 10, y: 20 },
        data: { label: 'Alpha Policy', ruleId: 'POL-ALPHA' },
      };
      const beforeResults = getCachedSearchNodes([nodeA], 'alpha');
      expect(beforeResults.length).toBe(1);

      // Drag node: update position while retaining identical data reference
      const draggedNodeA: TreeNode = {
        ...nodeA,
        position: { x: 450, y: 780 },
      };
      // Data reference is preserved
      expect(draggedNodeA.data).toBe(nodeA.data);
      expect(areNodeDataReferencesEqual([nodeA], [draggedNodeA])).toBe(true);

      const afterResults = getCachedSearchNodes([draggedNodeA], 'alpha');
      // Identical search results object by reference
      expect(afterResults).toBe(beforeResults);

      // Editing a searchable field creates new data reference and produces updated results
      const editedNodeA: TreeNode = {
        ...draggedNodeA,
        data: { label: 'Alpha Policy Updated', ruleId: 'POL-ALPHA' },
      };
      expect(areNodeDataReferencesEqual([draggedNodeA], [editedNodeA])).toBe(false);
      const editedResults = getCachedSearchNodes([editedNodeA], 'alpha');
      expect(editedResults).not.toBe(beforeResults);
    });
  });

  describe('10. Pure Keyboard Decision Helper & IME Handling (`resolveSearchKeyDecision`)', () => {
    it('leaves search untouched during IME composition (isComposing = true)', () => {
      // Escape during IME composition must return 'none' (not close, clear, or blur)
      expect(
        resolveSearchKeyDecision({
          key: 'Escape',
          isComposing: true,
          isOpen: true,
          hasQuery: true,
          activeIndex: 0,
          resultCount: 5,
        })
      ).toEqual({ action: 'none' });

      // Enter during composition
      expect(
        resolveSearchKeyDecision({
          key: 'Enter',
          isComposing: true,
          isOpen: true,
          hasQuery: true,
          activeIndex: 0,
          resultCount: 5,
        })
      ).toEqual({ action: 'none' });

      // Arrow keys during composition
      expect(
        resolveSearchKeyDecision({
          key: 'ArrowDown',
          isComposing: true,
          isOpen: true,
          hasQuery: true,
          activeIndex: 0,
          resultCount: 5,
        })
      ).toEqual({ action: 'none' });
    });

    it('enforces the exact 3-step Escape lifecycle when not composing', () => {
      // Step 1: Open dropdown -> close dropdown
      expect(
        resolveSearchKeyDecision({
          key: 'Escape',
          isComposing: false,
          isOpen: true,
          hasQuery: true,
          activeIndex: 1,
          resultCount: 3,
        })
      ).toEqual({ action: 'close' });

      // Step 2: Closed dropdown, has query -> clear query
      expect(
        resolveSearchKeyDecision({
          key: 'Escape',
          isComposing: false,
          isOpen: false,
          hasQuery: true,
          activeIndex: -1,
          resultCount: 0,
        })
      ).toEqual({ action: 'clear' });

      // Step 3: Closed dropdown, empty query -> blur input
      expect(
        resolveSearchKeyDecision({
          key: 'Escape',
          isComposing: false,
          isOpen: false,
          hasQuery: false,
          activeIndex: -1,
          resultCount: 0,
        })
      ).toEqual({ action: 'blur' });
    });

    it('handles Enter key safely for valid and invalid indices', () => {
      // Valid active index
      expect(
        resolveSearchKeyDecision({
          key: 'Enter',
          isComposing: false,
          isOpen: true,
          hasQuery: true,
          activeIndex: 2,
          resultCount: 4,
        })
      ).toEqual({ action: 'select', index: 2 });

      // Negative index -> none
      expect(
        resolveSearchKeyDecision({
          key: 'Enter',
          isComposing: false,
          isOpen: true,
          hasQuery: true,
          activeIndex: -1,
          resultCount: 4,
        })
      ).toEqual({ action: 'none' });

      // Index out of range -> none
      expect(
        resolveSearchKeyDecision({
          key: 'Enter',
          isComposing: false,
          isOpen: true,
          hasQuery: true,
          activeIndex: 5,
          resultCount: 4,
        })
      ).toEqual({ action: 'none' });

      // Empty result list -> none
      expect(
        resolveSearchKeyDecision({
          key: 'Enter',
          isComposing: false,
          isOpen: true,
          hasQuery: true,
          activeIndex: 0,
          resultCount: 0,
        })
      ).toEqual({ action: 'none' });

      // Dropdown not open -> none
      expect(
        resolveSearchKeyDecision({
          key: 'Enter',
          isComposing: false,
          isOpen: false,
          hasQuery: true,
          activeIndex: 0,
          resultCount: 4,
        })
      ).toEqual({ action: 'none' });
    });

    it('navigates results with ArrowDown and ArrowUp without interference', () => {
      // ArrowDown opens closed dropdown if query exists
      expect(
        resolveSearchKeyDecision({
          key: 'ArrowDown',
          isComposing: false,
          isOpen: false,
          hasQuery: true,
          activeIndex: -1,
          resultCount: 3,
        })
      ).toEqual({ action: 'open' });

      // ArrowDown advances active item when open
      expect(
        resolveSearchKeyDecision({
          key: 'ArrowDown',
          isComposing: false,
          isOpen: true,
          hasQuery: true,
          activeIndex: 0,
          resultCount: 3,
        })
      ).toEqual({ action: 'next' });

      // ArrowUp retreats active item
      expect(
        resolveSearchKeyDecision({
          key: 'ArrowUp',
          isComposing: false,
          isOpen: true,
          hasQuery: true,
          activeIndex: 1,
          resultCount: 3,
        })
      ).toEqual({ action: 'previous' });

      // Tab closes open dropdown
      expect(
        resolveSearchKeyDecision({
          key: 'Tab',
          isComposing: false,
          isOpen: true,
          hasQuery: true,
          activeIndex: 0,
          resultCount: 3,
        })
      ).toEqual({ action: 'close' });
    });
  });

  describe('11. Slash Shortcut Eligibility Tests', () => {
    it('evaluates non-DOM target descriptors accurately', () => {
      expect(isSlashShortcutEligible({ tagName: 'input' })).toBe(false);
      expect(isSlashShortcutEligible({ tagName: 'textarea' })).toBe(false);
      expect(isSlashShortcutEligible({ tagName: 'select' })).toBe(false);
      expect(isSlashShortcutEligible({ isContentEditable: true })).toBe(false);
      expect(isSlashShortcutEligible({ isInProtectedArea: true })).toBe(false);
      expect(isSlashShortcutEligible({ tagName: 'div', isInProtectedArea: false })).toBe(true);
      expect(isSlashShortcutEligible(null)).toBe(true);
    });
  });
});

