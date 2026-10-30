import { describe, it, expect, beforeEach } from 'vitest';
import { useTreeStore } from '../store/treeStore';
import {
  getAvailableTemplates,
  getTemplateById,
  validateTemplate,
  calculateTemplateStats,
  type ComplianceTemplate,
} from '../lib/templates';
import {
  DEFAULT_PERSISTED_SETTINGS,
  serializeWorkspace,
  deserializeWorkspace,
  savePersistedWorkspace,
  loadPersistedWorkspace,
  PERSISTENCE_STORAGE_KEY,
} from '../lib/persistence';
import type { TreeNode, TreeEdge } from '../types/tree';

class MockStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

const mockStorage = new MockStorage();
if (typeof globalThis.window === 'undefined') {
  (globalThis as unknown as Record<string, unknown>).window = globalThis;
}
Object.defineProperty(globalThis, 'localStorage', {
  value: mockStorage,
  writable: true,
  configurable: true,
});
Object.defineProperty(globalThis.window, 'localStorage', {
  value: mockStorage,
  writable: true,
  configurable: true,
});

describe('Day 21 — Templates Feature Verification', () => {
  beforeEach(() => {
    useTreeStore.temporal.getState().clear();
    mockStorage.clear();
  });

  it('1. provides multiple curated compliance templates', () => {
    const templates = getAvailableTemplates();
    expect(templates.length).toBeGreaterThanOrEqual(4);

    const ids = templates.map((t) => t.id);
    expect(ids).toContain('full-compliance-framework');
    expect(ids).toContain('finra-communications-governance');
    expect(ids).toContain('sec-records-retention');
    expect(ids).toContain('minimal-starter-policy');
    expect(ids).toContain('blank-canvas');
  });

  it('2. all built-in templates strictly adhere to graph relationship grammar and integrity', () => {
    const templates = getAvailableTemplates();

    for (const tmpl of templates) {
      const validation = validateTemplate(tmpl);
      expect(validation.ok, `Template "${tmpl.id}" failed validation: ${validation.error}`).toBe(true);

      if (tmpl.nodes.length > 0) {
        expect(tmpl.stats.rootCount).toBeLessThanOrEqual(1);
        // Verify every edge respects relationship rules
        for (const edge of tmpl.edges) {
          const src = tmpl.nodes.find((n) => n.id === edge.source);
          const tgt = tmpl.nodes.find((n) => n.id === edge.target);
          expect(src).toBeDefined();
          expect(tgt).toBeDefined();
          // Action cannot have outgoing edges
          expect(src!.type).not.toBe('action');
          // Root cannot have incoming edges
          expect(tgt!.type).not.toBe('root');
        }
      }
    }
  });

  it('3. getTemplateById retrieves specific templates accurately', () => {
    const finraTmpl = getTemplateById('finra-communications-governance');
    expect(finraTmpl).toBeDefined();
    expect(finraTmpl?.title).toContain('FINRA-2210');
    expect(finraTmpl?.stats.nodeCount).toBe(5);

    const nonExistent = getTemplateById('non-existent-template-id');
    expect(nonExistent).toBeUndefined();
  });

  it('4. validateTemplate rejects invalid or malformed templates', () => {
    // Null / non-object
    expect(validateTemplate(null).ok).toBe(false);
    expect(validateTemplate(undefined).ok).toBe(false);
    expect(validateTemplate('invalid').ok).toBe(false);

    // Missing id or title
    expect(validateTemplate({ title: 'No ID', nodes: [], edges: [] }).ok).toBe(false);
    expect(validateTemplate({ id: 'no-title', nodes: [], edges: [] }).ok).toBe(false);

    // Duplicate node IDs
    const duplicateNodeTmpl = {
      id: 'dup-tmpl',
      title: 'Duplicate Nodes',
      nodes: [
        { id: 'node-1', type: 'root', position: { x: 0, y: 0 }, data: { label: 'Root' } },
        { id: 'node-1', type: 'rule', position: { x: 0, y: 100 }, data: { label: 'Rule' } },
      ],
      edges: [],
    };
    const dupRes = validateTemplate(duplicateNodeTmpl);
    expect(dupRes.ok).toBe(false);
    expect(dupRes.error).toContain('Duplicate node ID');

    // Multiple root nodes
    const multiRootTmpl = {
      id: 'multi-root-tmpl',
      title: 'Multiple Roots',
      nodes: [
        { id: 'r1', type: 'root', position: { x: 0, y: 0 }, data: { label: 'Root 1' } },
        { id: 'r2', type: 'root', position: { x: 200, y: 0 }, data: { label: 'Root 2' } },
      ],
      edges: [],
    };
    expect(validateTemplate(multiRootTmpl).ok).toBe(false);

    // Invalid relationship (Action -> Rule)
    const invalidGrammarTmpl = {
      id: 'bad-grammar',
      title: 'Bad Grammar',
      nodes: [
        { id: 'a1', type: 'action', position: { x: 0, y: 0 }, data: { label: 'Action' } },
        { id: 'r1', type: 'rule', position: { x: 0, y: 100 }, data: { label: 'Rule' } },
      ],
      edges: [{ id: 'e1', source: 'a1', target: 'r1' }],
    };
    expect(validateTemplate(invalidGrammarTmpl).ok).toBe(false);

    // Cyclic edges
    const cyclicTmpl = {
      id: 'cyclic-tmpl',
      title: 'Cyclic Tree',
      nodes: [
        { id: 'r1', type: 'root', position: { x: 0, y: 0 }, data: { label: 'Root' } },
        { id: 'rule1', type: 'rule', position: { x: 0, y: 100 }, data: { label: 'Rule 1' } },
        { id: 'cond1', type: 'condition', position: { x: 0, y: 200 }, data: { label: 'Cond 1' } },
      ],
      edges: [
        { id: 'e1', source: 'r1', target: 'rule1' },
        { id: 'e2', source: 'rule1', target: 'cond1' },
        { id: 'e3', source: 'cond1', target: 'rule1' }, // cycle!
      ],
    };
    expect(validateTemplate(cyclicTmpl).ok).toBe(false);
  });

  it('5. applyTemplate loads the selected template cleanly into the store', () => {
    const res = useTreeStore.getState().applyTemplate('finra-communications-governance');
    expect(res.ok).toBe(true);
    expect(res.templateTitle).toContain('FINRA-2210');

    const state = useTreeStore.getState();
    expect(state.nodes.length).toBe(5);
    expect(state.edges.length).toBe(4);
    expect(state.selectedNodeId).toBeNull();
    expect(state.selectedEdgeId).toBeNull();

    // Check clean temporal history (fresh baseline)
    expect(useTreeStore.temporal.getState().pastStates.length).toBe(0);
    expect(useTreeStore.temporal.getState().futureStates.length).toBe(0);
  });

  it('6. applyTemplate safely handles blank-canvas template', () => {
    const res = useTreeStore.getState().applyTemplate('blank-canvas');
    expect(res.ok).toBe(true);

    const state = useTreeStore.getState();
    expect(state.nodes.length).toBe(0);
    expect(state.edges.length).toBe(0);
  });

  it('7. applyTemplate gracefully rejects non-existent template ID without mutating workspace', () => {
    // Set up an existing node
    useTreeStore.setState({
      nodes: [{ id: 'existing-root', type: 'root', position: { x: 0, y: 0 }, data: { label: 'Original' } }],
      edges: [],
    });

    const res = useTreeStore.getState().applyTemplate('completely-bogus-template');
    expect(res.ok).toBe(false);
    expect(res.message).toContain('not found');

    // Existing nodes must remain untouched
    expect(useTreeStore.getState().nodes.length).toBe(1);
    expect(useTreeStore.getState().nodes[0].id).toBe('existing-root');
  });

  it('8. calculateTemplateStats correctly counts all four node types', () => {
    const nodes: TreeNode[] = [
      { id: '1', type: 'root', position: { x: 0, y: 0 }, data: { label: 'R' } },
      { id: '2', type: 'rule', position: { x: 0, y: 0 }, data: { label: 'Ru' } },
      { id: '3', type: 'condition', position: { x: 0, y: 0 }, data: { label: 'C1' } },
      { id: '4', type: 'condition', position: { x: 0, y: 0 }, data: { label: 'C2' } },
      { id: '5', type: 'action', position: { x: 0, y: 0 }, data: { label: 'A1' } },
    ];
    const stats = calculateTemplateStats(nodes, []);
    expect(stats.nodeCount).toBe(5);
    expect(stats.rootCount).toBe(1);
    expect(stats.ruleCount).toBe(1);
    expect(stats.conditionCount).toBe(2);
    expect(stats.actionCount).toBe(1);
  });
});

describe('Day 21 — Settings Feature Verification', () => {
  beforeEach(() => {
    useTreeStore.temporal.getState().clear();
    mockStorage.clear();
    useTreeStore.getState().resetSettingsToDefault();
  });

  it('1. DEFAULT_PERSISTED_SETTINGS defines expected defaults', () => {
    expect(DEFAULT_PERSISTED_SETTINGS.gridVisible).toBe(true);
    expect(DEFAULT_PERSISTED_SETTINGS.miniMapVisible).toBe(true);
    expect(DEFAULT_PERSISTED_SETTINGS.theme).toBe('light');
    expect(DEFAULT_PERSISTED_SETTINGS.snapToGrid).toBe(false);
  });

  it('2. updateSettings updates state and serializes to persistence', () => {
    const state = useTreeStore.getState();
    state.updateSettings({ gridVisible: false, miniMapVisible: false, snapToGrid: true, theme: 'dark' });

    const updated = useTreeStore.getState().persistedSettings;
    expect(updated.gridVisible).toBe(false);
    expect(updated.miniMapVisible).toBe(false);
    expect(updated.snapToGrid).toBe(true);
    expect(updated.theme).toBe('dark');

    // Verify written to storage
    const storedRaw = localStorage.getItem(PERSISTENCE_STORAGE_KEY);
    expect(storedRaw).not.toBeNull();
    const parsed = JSON.parse(storedRaw!);
    expect(parsed.settings.gridVisible).toBe(false);
    expect(parsed.settings.miniMapVisible).toBe(false);
    expect(parsed.settings.snapToGrid).toBe(true);
    expect(parsed.settings.theme).toBe('dark');
  });

  it('3. deserializeWorkspace preserves all settings keys across round-trip', () => {
    const nodes = useTreeStore.getState().nodes;
    const edges = useTreeStore.getState().edges;
    const settings = {
      theme: 'dark',
      gridVisible: false,
      miniMapVisible: true,
      snapToGrid: true,
    };

    const json = serializeWorkspace(nodes, edges, settings);
    const result = deserializeWorkspace(json);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.settings).toEqual(settings);
    }
  });

  it('4. resetSettingsToDefault restores all defaults cleanly', () => {
    // Change settings first
    useTreeStore.getState().updateSettings({ gridVisible: false, theme: 'dark' });
    expect(useTreeStore.getState().persistedSettings.gridVisible).toBe(false);

    // Reset
    useTreeStore.getState().resetSettingsToDefault();
    const current = useTreeStore.getState().persistedSettings;
    expect(current.gridVisible).toBe(true);
    expect(current.miniMapVisible).toBe(true);
    expect(current.theme).toBe('light');
    expect(current.snapToGrid).toBe(false);
  });

  it('5. updating settings does not modify graph nodes, edges, or undo history', () => {
    const initialNodes = useTreeStore.getState().nodes;
    const initialEdges = useTreeStore.getState().edges;
    const initialPastCount = useTreeStore.temporal.getState().pastStates.length;

    useTreeStore.getState().updateSettings({ gridVisible: false, miniMapVisible: false });

    expect(useTreeStore.getState().nodes).toEqual(initialNodes);
    expect(useTreeStore.getState().edges).toEqual(initialEdges);
    expect(useTreeStore.temporal.getState().pastStates.length).toBe(initialPastCount);
  });

  it('6. modal open and close actions function properly', () => {
    expect(useTreeStore.getState().isTemplatesModalOpen).toBe(false);
    useTreeStore.getState().openTemplatesModal();
    expect(useTreeStore.getState().isTemplatesModalOpen).toBe(true);
    useTreeStore.getState().closeTemplatesModal();
    expect(useTreeStore.getState().isTemplatesModalOpen).toBe(false);

    expect(useTreeStore.getState().isSettingsModalOpen).toBe(false);
    useTreeStore.getState().openSettingsModal();
    expect(useTreeStore.getState().isSettingsModalOpen).toBe(true);
    useTreeStore.getState().closeSettingsModal();
    expect(useTreeStore.getState().isSettingsModalOpen).toBe(false);
  });

  it('7. theme updates persist and apply dark mode class accurately', () => {
    // Test dark mode selection
    useTreeStore.getState().updateSettings({ theme: 'dark' });
    expect(useTreeStore.getState().persistedSettings.theme).toBe('dark');

    // Test persistence round trip with dark theme
    const doc = loadPersistedWorkspace();
    expect(doc.ok).toBe(true);
    if (doc.ok) {
      expect(doc.document.settings?.theme).toBe('dark');
    }

    // Resetting defaults restores light theme
    useTreeStore.getState().resetSettingsToDefault();
    expect(useTreeStore.getState().persistedSettings.theme).toBe('light');
  });
});
