import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  serializeWorkspace,
  deserializeWorkspace,
  validateWorkspaceDocument,
  isStorageAvailable,
  savePersistedWorkspace,
  loadPersistedWorkspace,
  clearPersistedWorkspace,
  PERSISTENCE_STORAGE_KEY,
  PERSISTENCE_FORMAT_VERSION,
  MAX_PERSISTENCE_BYTES,
  type SavedWorkspaceDocument,
} from '../lib/persistence';
import { useTreeStore, getCanonicalSampleNodes, getCanonicalSampleEdges } from '../store/treeStore';
import type { TreeNode, TreeEdge } from '../types/tree';

// Helper mock storage
class MockStorage implements Storage {
  private store = new Map<string, string>();
  public shouldThrowOnSet = false;
  public throwQuotaError = false;

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
    if (this.throwQuotaError) {
      const err = new Error('Quota exceeded');
      err.name = 'QuotaExceededError';
      throw err;
    }
    if (this.shouldThrowOnSet) {
      throw new Error('Storage write disabled');
    }
    this.store.set(key, String(value));
  }
}

if (typeof globalThis.window === 'undefined') {
  (globalThis as unknown as Record<string, unknown>).window = globalThis;
}

describe('Day 16 — Reliable Local Persistence & Recovery Suite', () => {
  let mockStorage: MockStorage;

  beforeEach(() => {
    vi.useFakeTimers();
    mockStorage = new MockStorage();
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
    // Reset store to known state
    useTreeStore.setState({
      nodes: getCanonicalSampleNodes(),
      edges: getCanonicalSampleEdges(),
      persistenceStatus: 'idle',
      saveStatus: 'idle',
      saveErrorMessage: null,
      lastSavedAt: null,
      corruptedPayload: null,
      recoveryError: null,
      isResetConfirmationOpen: false,
      persistedSettings: {},
    });
    useTreeStore.temporal.getState().clear();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  // ==========================================================================
  // SECTION A: Format, Schema, Versioning, and Serialization (Tests 1–12)
  // ==========================================================================

  it('1. serializeWorkspace produces valid JSON containing persistenceVersion: 1, savedAt, nodes, edges', () => {
    const nodes = getCanonicalSampleNodes();
    const edges = getCanonicalSampleEdges();
    const json = serializeWorkspace(nodes, edges, { theme: 'light' }, 1234567890);

    const parsed = JSON.parse(json);
    expect(parsed.persistenceVersion).toBe(1);
    expect(parsed.savedAt).toBe(1234567890);
    expect(parsed.nodes).toHaveLength(nodes.length);
    expect(parsed.edges).toHaveLength(edges.length);
    expect(parsed.settings).toEqual({ theme: 'light' });
  });

  it('2. Format version is strictly checked; unsupported versions fail with UNSUPPORTED_VERSION', () => {
    const raw = JSON.stringify({
      persistenceVersion: 99,
      savedAt: Date.now(),
      nodes: [{ id: 'root', type: 'root', position: { x: 0, y: 0 }, data: { label: 'Root' } }],
      edges: [],
    });

    const res = deserializeWorkspace(raw);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errorType).toBe('UNSUPPORTED_VERSION');
    }
  });

  it('3. Valid node types are allowed; invalid types fail INVALID_STRUCTURE', () => {
    const raw = JSON.stringify({
      persistenceVersion: 1,
      savedAt: Date.now(),
      nodes: [
        { id: 'bad-node', type: 'unknown_type', position: { x: 0, y: 0 }, data: { label: 'Invalid' } },
      ],
      edges: [],
    });

    const res = deserializeWorkspace(raw);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errorType).toBe('INVALID_STRUCTURE');
      expect(res.message).toContain('unknown_type');
    }
  });

  it('4. Empty graph (0 nodes, 0 edges) is supported as valid editing state, while empty nodes with edges fails with DANGLING_EDGE', () => {
    // A: Clean empty graph
    const validEmpty = JSON.stringify({
      persistenceVersion: 1,
      savedAt: Date.now(),
      nodes: [],
      edges: [],
    });
    const resClean = deserializeWorkspace(validEmpty);
    expect(resClean.ok).toBe(true);
    if (resClean.ok) {
      expect(resClean.document.nodes).toHaveLength(0);
      expect(resClean.document.edges).toHaveLength(0);
    }

    // B: Empty nodes but has edges -> dangling edge
    const dangling = JSON.stringify({
      persistenceVersion: 1,
      savedAt: Date.now(),
      nodes: [],
      edges: [{ id: 'e-bad', source: 'missing-src', target: 'missing-tgt' }],
    });
    const resBad = deserializeWorkspace(dangling);
    expect(resBad.ok).toBe(false);
    if (!resBad.ok) {
      expect(resBad.errorType).toBe('DANGLING_EDGE');
    }
  });

  it('5. Duplicate node IDs fail validation with DUPLICATE_NODE_ID', () => {
    const raw = JSON.stringify({
      persistenceVersion: 1,
      savedAt: Date.now(),
      nodes: [
        { id: 'dup-1', type: 'root', position: { x: 0, y: 0 }, data: { label: 'Node 1' } },
        { id: 'dup-1', type: 'rule', position: { x: 10, y: 10 }, data: { label: 'Node 2' } },
      ],
      edges: [],
    });

    const res = deserializeWorkspace(raw);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errorType).toBe('DUPLICATE_NODE_ID');
      expect(res.message).toContain('dup-1');
    }
  });

  it('6. Edge with non-existent source node fails validation with DANGLING_EDGE', () => {
    const raw = JSON.stringify({
      persistenceVersion: 1,
      savedAt: Date.now(),
      nodes: [{ id: 'root-1', type: 'root', position: { x: 0, y: 0 }, data: { label: 'Root' } }],
      edges: [{ id: 'e-1', source: 'ghost-source', target: 'root-1' }],
    });

    const res = deserializeWorkspace(raw);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errorType).toBe('DANGLING_EDGE');
      expect(res.message).toContain('ghost-source');
    }
  });

  it('7. Edge with non-existent target node fails validation with DANGLING_EDGE', () => {
    const raw = JSON.stringify({
      persistenceVersion: 1,
      savedAt: Date.now(),
      nodes: [{ id: 'root-1', type: 'root', position: { x: 0, y: 0 }, data: { label: 'Root' } }],
      edges: [{ id: 'e-1', source: 'root-1', target: 'ghost-target' }],
    });

    const res = deserializeWorkspace(raw);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errorType).toBe('DANGLING_EDGE');
      expect(res.message).toContain('ghost-target');
    }
  });

  it('8. Incomplete editing graph (e.g. single rule without children) is accepted as valid for persistence', () => {
    const incompleteNodes: TreeNode[] = [
      {
        id: 'root-policy-hierarchy',
        type: 'root',
        position: { x: 0, y: 0 },
        data: { label: 'Policy Root' },
      },
      {
        id: 'rule-single',
        type: 'rule',
        position: { x: 100, y: 100 },
        data: { label: 'Draft Rule Incomplete' },
      },
    ];
    const incompleteEdges: TreeEdge[] = [
      {
        id: 'e-r1',
        source: 'root-policy-hierarchy',
        target: 'rule-single',
        data: { relationshipType: 'root-rule' },
      },
    ];

    const json = serializeWorkspace(incompleteNodes, incompleteEdges);
    const res = deserializeWorkspace(json);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.document.nodes).toHaveLength(2);
      expect(res.document.edges).toHaveLength(1);
    }
  });

  it('9. Prototype pollution in JSON keys is rejected with PROTOTYPE_POLLUTION', () => {
    const evilPayload = '{"persistenceVersion":1,"savedAt":100,"nodes":[{"id":"root","type":"root","position":{"x":0,"y":0},"data":{"__proto__":{"polluted":true}}}],"edges":[]}';
    const res = deserializeWorkspace(evilPayload);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errorType).toBe('PROTOTYPE_POLLUTION');
    }
  });

  it('10. Payload size exceeding 5 MiB is rejected with PAYLOAD_TOO_LARGE', () => {
    const hugeLabel = 'a'.repeat(5 * 1024 * 1024 + 100);
    const bigNodes: TreeNode[] = [
      {
        id: 'root-big',
        type: 'root',
        position: { x: 0, y: 0 },
        data: { label: hugeLabel },
      },
    ];

    const saveRes = savePersistedWorkspace(bigNodes, [], {}, mockStorage);
    expect(saveRes.ok).toBe(false);
    if (!saveRes.ok) {
      expect(saveRes.errorType).toBe('PAYLOAD_TOO_LARGE');
    }
  });

  it('11. Optional settings (theme, gridVisible) are serialized and deserialized cleanly', () => {
    const nodes = getCanonicalSampleNodes();
    const edges = getCanonicalSampleEdges();
    const settings = { theme: 'dark', gridVisible: true };

    const json = serializeWorkspace(nodes, edges, settings);
    const res = deserializeWorkspace(json);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.document.settings).toEqual(settings);
    }
  });

  it('12. Transient state (selection, search, clipboard, history) is NEVER included in serialized document', () => {
    const nodes = getCanonicalSampleNodes();
    const edges = getCanonicalSampleEdges();
    const json = serializeWorkspace(nodes, edges);
    const parsed = JSON.parse(json);

    expect(parsed.selectedNodeId).toBeUndefined();
    expect(parsed.selectedEdgeId).toBeUndefined();
    expect(parsed.searchQuery).toBeUndefined();
    expect(parsed.clipboard).toBeUndefined();
    expect(parsed.pastStates).toBeUndefined();
    expect(parsed.futureStates).toBeUndefined();
  });

  // ==========================================================================
  // SECTION B: Storage Availability, Load & Save Operations (Tests 13–24)
  // ==========================================================================

  it('13. isStorageAvailable returns true for working storage and false when throwing or null', () => {
    expect(isStorageAvailable(mockStorage)).toBe(true);

    const throwingStorage = new MockStorage();
    throwingStorage.shouldThrowOnSet = true;
    expect(isStorageAvailable(throwingStorage)).toBe(false);

    expect(isStorageAvailable(null)).toBe(false);
  });

  it('14. savePersistedWorkspace stores serialized string under key interactive_tree_editor_v1_store', () => {
    const nodes = getCanonicalSampleNodes();
    const edges = getCanonicalSampleEdges();
    const res = savePersistedWorkspace(nodes, edges, { gridVisible: false }, mockStorage);

    expect(res.ok).toBe(true);
    const raw = mockStorage.getItem(PERSISTENCE_STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.persistenceVersion).toBe(1);
    expect(parsed.nodes).toHaveLength(nodes.length);
  });

  it('15. savePersistedWorkspace handles QuotaExceededError returning QUOTA_EXCEEDED error', () => {
    mockStorage.throwQuotaError = true;
    const res = savePersistedWorkspace(getCanonicalSampleNodes(), [], {}, mockStorage);

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errorType).toBe('QUOTA_EXCEEDED');
      expect(res.message).toContain('quota exceeded');
    }
  });

  it('16. savePersistedWorkspace handles generic write failures with WRITE_FAILED', () => {
    mockStorage.shouldThrowOnSet = true;
    const res = savePersistedWorkspace(getCanonicalSampleNodes(), [], {}, mockStorage);

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errorType).toBe('WRITE_FAILED');
    }
  });

  it('17. loadPersistedWorkspace returns NO_DATA when key is absent or empty', () => {
    mockStorage.removeItem(PERSISTENCE_STORAGE_KEY);
    const res = loadPersistedWorkspace(mockStorage);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errorType).toBe('NO_DATA');
    }
  });

  it('18. loadPersistedWorkspace successfully parses and returns document when storage contains valid JSON', () => {
    savePersistedWorkspace(getCanonicalSampleNodes(), getCanonicalSampleEdges(), {}, mockStorage);
    const res = loadPersistedWorkspace(mockStorage);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.document.persistenceVersion).toBe(1);
      expect(res.document.nodes.length).toBeGreaterThan(0);
    }
  });

  it('19. loadPersistedWorkspace detects malformed JSON and returns CORRUPTED_JSON with rawPayload', () => {
    const malformed = '{ "persistenceVersion": 1, "nodes": [broken json';
    mockStorage.setItem(PERSISTENCE_STORAGE_KEY, malformed);

    const res = loadPersistedWorkspace(mockStorage);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errorType).toBe('CORRUPTED_JSON');
      expect(res.rawPayload).toBe(malformed);
    }
  });

  it('20. loadPersistedWorkspace does NOT modify storage when encountering corrupt JSON', () => {
    const malformed = 'corrupt content';
    mockStorage.setItem(PERSISTENCE_STORAGE_KEY, malformed);

    loadPersistedWorkspace(mockStorage);
    expect(mockStorage.getItem(PERSISTENCE_STORAGE_KEY)).toBe(malformed);
  });

  it('21. loadPersistedWorkspace returns STORAGE_UNAVAILABLE when storage is null or throws', () => {
    const res = loadPersistedWorkspace(null as unknown as Storage);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errorType).toBe('STORAGE_UNAVAILABLE');
    }
  });

  it('22. clearPersistedWorkspace removes the key from storage', () => {
    mockStorage.setItem(PERSISTENCE_STORAGE_KEY, 'some-data');
    const cleared = clearPersistedWorkspace(mockStorage);
    expect(cleared).toBe(true);
    expect(mockStorage.getItem(PERSISTENCE_STORAGE_KEY)).toBeNull();
  });

  it('23. In-memory serialization failure leaves existing storage untouched', () => {
    const existing = 'valid-prior-save';
    mockStorage.setItem(PERSISTENCE_STORAGE_KEY, existing);

    // Node circular reference simulation or huge payload
    const hugeLabel = 'x'.repeat(MAX_PERSISTENCE_BYTES + 500);
    const hugeNodes: TreeNode[] = [
      { id: 'root', type: 'root', position: { x: 0, y: 0 }, data: { label: hugeLabel } },
    ];

    const saveRes = savePersistedWorkspace(hugeNodes, [], {}, mockStorage);
    expect(saveRes.ok).toBe(false);
    expect(mockStorage.getItem(PERSISTENCE_STORAGE_KEY)).toBe(existing);
  });

  it('24. Atomic save idempotence: saving repeatedly updates savedAt and preserves data integrity', () => {
    const nodes = getCanonicalSampleNodes();
    const edges = getCanonicalSampleEdges();

    const save1 = savePersistedWorkspace(nodes, edges, {}, mockStorage);
    expect(save1.ok).toBe(true);

    const save2 = savePersistedWorkspace(nodes, edges, {}, mockStorage);
    expect(save2.ok).toBe(true);

    const loadRes = loadPersistedWorkspace(mockStorage);
    expect(loadRes.ok).toBe(true);
    if (loadRes.ok) {
      expect(loadRes.document.nodes).toHaveLength(nodes.length);
    }
  });

  // ==========================================================================
  // SECTION C: Store Initialization, Restore & History Decoupling (Tests 25–34)
  // ==========================================================================

  it('25. initializePersistence restores saved graph nodes and edges into store when valid document exists', async () => {
    const customNodes: TreeNode[] = [
      {
        id: 'root-custom',
        type: 'root',
        position: { x: 100, y: 100 },
        data: { label: 'Custom Root Saved' },
      },
    ];
    savePersistedWorkspace(customNodes, [], { theme: 'slate' }, mockStorage);

    await useTreeStore.getState().initializePersistence();

    expect(useTreeStore.getState().nodes).toHaveLength(1);
    expect(useTreeStore.getState().nodes[0].id).toBe('root-custom');
    expect(useTreeStore.getState().persistenceStatus).toBe('ready');
    expect(useTreeStore.getState().saveStatus).toBe('saved');
  });

  it('26. initializePersistence establishes canonical sample tree and saves it when storage is empty (NO_DATA)', async () => {
    mockStorage.clear();

    await useTreeStore.getState().initializePersistence();

    expect(useTreeStore.getState().persistenceStatus).toBe('ready');
    expect(useTreeStore.getState().saveStatus).toBe('saved');
    expect(mockStorage.getItem(PERSISTENCE_STORAGE_KEY)).not.toBeNull();
  });

  it('27. initializePersistence transitions persistenceStatus to recovery-required on corrupted storage without overwriting', async () => {
    const corruptPayload = '{"persistenceVersion": 1, "nodes": [broken';
    mockStorage.setItem(PERSISTENCE_STORAGE_KEY, corruptPayload);

    await useTreeStore.getState().initializePersistence();

    expect(useTreeStore.getState().persistenceStatus).toBe('recovery-required');
    expect(useTreeStore.getState().corruptedPayload).toBe(corruptPayload);
    expect(useTreeStore.getState().recoveryError).not.toBeNull();
    // Verify storage was NOT overwritten
    expect(mockStorage.getItem(PERSISTENCE_STORAGE_KEY)).toBe(corruptPayload);
  });

  it('28. initializePersistence transitions persistenceStatus to unavailable when storage throws', async () => {
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: () => {
          throw new Error('Access denied');
        },
        setItem: () => {
          throw new Error('Access denied');
        },
        removeItem: () => {},
      },
      writable: true,
      configurable: true,
    });

    await useTreeStore.getState().initializePersistence();

    expect(useTreeStore.getState().persistenceStatus).toBe('unavailable');
  });

  it('29. Restored graph starts with completely clean history (0 past states, 0 future states)', async () => {
    // Put some state in temporal history first
    useTreeStore.getState().addChild('root-policy-hierarchy', 'rule');
    expect(useTreeStore.temporal.getState().pastStates.length).toBeGreaterThan(0);

    // Save and reinitialize
    savePersistedWorkspace(useTreeStore.getState().nodes, useTreeStore.getState().edges, {}, mockStorage);
    await useTreeStore.getState().initializePersistence();

    expect(useTreeStore.temporal.getState().pastStates).toHaveLength(0);
    expect(useTreeStore.temporal.getState().futureStates).toHaveLength(0);
  });

  it('30. Prior session history is never restored from storage', async () => {
    savePersistedWorkspace(getCanonicalSampleNodes(), getCanonicalSampleEdges(), {}, mockStorage);
    await useTreeStore.getState().initializePersistence();

    expect(useTreeStore.temporal.getState().pastStates).toEqual([]);
    expect(useTreeStore.temporal.getState().futureStates).toEqual([]);
  });

  it('31. canUndo() and canRedo() both return false immediately after restore', async () => {
    savePersistedWorkspace(getCanonicalSampleNodes(), getCanonicalSampleEdges(), {}, mockStorage);
    await useTreeStore.getState().initializePersistence();

    expect(useTreeStore.getState().canUndo()).toBe(false);
    expect(useTreeStore.getState().canRedo()).toBe(false);
  });

  it('32. Selection (selectedNodeId, selectedNodeIds) is null / empty after restore', async () => {
    useTreeStore.setState({ selectedNodeId: 'rule-finra-2210', selectedNodeIds: ['rule-finra-2210'] });
    savePersistedWorkspace(getCanonicalSampleNodes(), getCanonicalSampleEdges(), {}, mockStorage);

    await useTreeStore.getState().initializePersistence();

    expect(useTreeStore.getState().selectedNodeId).toBeNull();
    expect(useTreeStore.getState().selectedNodeIds).toHaveLength(0);
  });

  it('33. Search state (searchQuery, matchingNodeIds) is empty after restore', async () => {
    useTreeStore.setState({ searchQuery: 'FINRA', matchingNodeIds: new Set(['rule-finra-2210']) });
    savePersistedWorkspace(getCanonicalSampleNodes(), getCanonicalSampleEdges(), {}, mockStorage);

    await useTreeStore.getState().initializePersistence();

    expect(useTreeStore.getState().searchQuery).toBe('');
    expect(useTreeStore.getState().matchingNodeIds.size).toBe(0);
  });

  it('34. Checkpoints and clipboard are isolated from restore', async () => {
    savePersistedWorkspace(getCanonicalSampleNodes(), getCanonicalSampleEdges(), {}, mockStorage);
    await useTreeStore.getState().initializePersistence();

    expect(useTreeStore.getState().clipboard).toBeNull();
    expect(useTreeStore.getState().checkpoints).toEqual([]);
  });

  // ==========================================================================
  // SECTION D: Autosave, Status Transitions & Debouncing (Tests 35–42)
  // ==========================================================================

  it('35. saveStatus starts at idle or transitions to saved after initial load', async () => {
    mockStorage.clear();
    await useTreeStore.getState().initializePersistence();
    expect(useTreeStore.getState().saveStatus).toBe('saved');
  });

  it('36. Selection-only changes do NOT trigger autosave and leave saveStatus unchanged', async () => {
    await useTreeStore.getState().initializePersistence();
    expect(useTreeStore.getState().saveStatus).toBe('saved');

    // Select a node
    useTreeStore.getState().setSelectedNodeId('rule-finra-2210');
    expect(useTreeStore.getState().saveStatus).toBe('saved');

    vi.advanceTimersByTime(2000);
    expect(useTreeStore.getState().saveStatus).toBe('saved');
  });

  it('37. Search-only changes do NOT trigger autosave', async () => {
    await useTreeStore.getState().initializePersistence();
    expect(useTreeStore.getState().saveStatus).toBe('saved');

    useTreeStore.getState().setSearchQueryAndMatches('search test', new Set());
    expect(useTreeStore.getState().saveStatus).toBe('saved');

    vi.advanceTimersByTime(2000);
    expect(useTreeStore.getState().saveStatus).toBe('saved');
  });

  it('38. Structural graph mutations (e.g. addChild) mark saveStatus as unsaved and schedule autosave', async () => {
    await useTreeStore.getState().initializePersistence();
    expect(useTreeStore.getState().saveStatus).toBe('saved');

    useTreeStore.getState().addChild('root-policy-hierarchy', 'rule');
    expect(useTreeStore.getState().saveStatus).toBe('unsaved');
  });

  it('39. Debounced autosave executes after timer and transitions saveStatus from saving to saved', async () => {
    await useTreeStore.getState().initializePersistence();
    useTreeStore.getState().addChild('root-policy-hierarchy', 'rule');
    expect(useTreeStore.getState().saveStatus).toBe('unsaved');

    // Advance timer past debounce threshold (600ms)
    vi.advanceTimersByTime(700);

    expect(useTreeStore.getState().saveStatus).toBe('saved');
    expect(useTreeStore.getState().lastSavedAt).not.toBeNull();
  });

  it('40. saveNow() forces immediate synchronous save, updating lastSavedAt', async () => {
    await useTreeStore.getState().initializePersistence();
    useTreeStore.getState().addChild('root-policy-hierarchy', 'rule');

    const ok = useTreeStore.getState().saveNow();
    expect(ok).toBe(true);
    expect(useTreeStore.getState().saveStatus).toBe('saved');
  });

  it('41. When save fails (e.g. quota exceeded), saveStatus transitions to error with saveErrorMessage', async () => {
    await useTreeStore.getState().initializePersistence();
    mockStorage.throwQuotaError = true;

    useTreeStore.getState().addChild('root-policy-hierarchy', 'rule');
    const ok = useTreeStore.getState().saveNow();

    expect(ok).toBe(false);
    expect(useTreeStore.getState().saveStatus).toBe('error');
    expect(useTreeStore.getState().saveErrorMessage).toContain('quota exceeded');
  });

  it('42. Retrying saveNow() after error condition clears transitions saveStatus back to saved', async () => {
    await useTreeStore.getState().initializePersistence();
    mockStorage.throwQuotaError = true;
    useTreeStore.getState().saveNow();
    expect(useTreeStore.getState().saveStatus).toBe('error');

    // Fix error condition
    mockStorage.throwQuotaError = false;
    const ok = useTreeStore.getState().saveNow();
    expect(ok).toBe(true);
    expect(useTreeStore.getState().saveStatus).toBe('saved');
    expect(useTreeStore.getState().saveErrorMessage).toBeNull();
  });

  // ==========================================================================
  // SECTION E: Confirmed Reset & Recovery Workflows (Tests 43–50)
  // ==========================================================================

  it('43. openResetConfirmation() opens modal (isResetConfirmationOpen = true)', () => {
    expect(useTreeStore.getState().isResetConfirmationOpen).toBe(false);
    useTreeStore.getState().openResetConfirmation();
    expect(useTreeStore.getState().isResetConfirmationOpen).toBe(true);
  });

  it('44. closeResetConfirmation() closes modal without modifying graph', () => {
    const nodeCountBefore = useTreeStore.getState().nodes.length;
    useTreeStore.getState().openResetConfirmation();
    useTreeStore.getState().closeResetConfirmation();

    expect(useTreeStore.getState().isResetConfirmationOpen).toBe(false);
    expect(useTreeStore.getState().nodes.length).toBe(nodeCountBefore);
  });

  it('45. confirmResetSampleTree() replaces graph with canonical sample tree and clears history', async () => {
    await useTreeStore.getState().initializePersistence();
    // Modify graph
    useTreeStore.getState().addChild('root-policy-hierarchy', 'rule');
    expect(useTreeStore.temporal.getState().pastStates.length).toBeGreaterThan(0);

    useTreeStore.getState().confirmResetSampleTree();

    expect(useTreeStore.getState().nodes).toEqual(getCanonicalSampleNodes());
    expect(useTreeStore.getState().edges).toEqual(getCanonicalSampleEdges());
    expect(useTreeStore.temporal.getState().pastStates).toHaveLength(0);
    expect(useTreeStore.temporal.getState().futureStates).toHaveLength(0);
  });

  it('46. confirmResetSampleTree() writes sample tree immediately to storage', async () => {
    await useTreeStore.getState().initializePersistence();
    useTreeStore.getState().confirmResetSampleTree();

    const raw = mockStorage.getItem(PERSISTENCE_STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.nodes).toHaveLength(getCanonicalSampleNodes().length);
    expect(useTreeStore.getState().saveStatus).toBe('saved');
  });

  it('47. recoverWithSampleTree() replaces corrupted workspace in storage with canonical template and clears recovery error', async () => {
    mockStorage.setItem(PERSISTENCE_STORAGE_KEY, 'corrupted JSON');
    await useTreeStore.getState().initializePersistence();
    expect(useTreeStore.getState().persistenceStatus).toBe('recovery-required');

    useTreeStore.getState().recoverWithSampleTree();

    expect(useTreeStore.getState().persistenceStatus).toBe('ready');
    expect(useTreeStore.getState().recoveryError).toBeNull();
    expect(useTreeStore.getState().corruptedPayload).toBeNull();

    const raw = mockStorage.getItem(PERSISTENCE_STORAGE_KEY);
    const parsed = JSON.parse(raw!);
    expect(parsed.nodes).toHaveLength(getCanonicalSampleNodes().length);
  });

  it('48. recoverWithEmptyTree() replaces corrupted workspace in storage with clean empty canvas and clears recovery error', async () => {
    mockStorage.setItem(PERSISTENCE_STORAGE_KEY, 'corrupted JSON');
    await useTreeStore.getState().initializePersistence();
    expect(useTreeStore.getState().persistenceStatus).toBe('recovery-required');

    useTreeStore.getState().recoverWithEmptyTree();

    expect(useTreeStore.getState().persistenceStatus).toBe('ready');
    expect(useTreeStore.getState().recoveryError).toBeNull();
    expect(useTreeStore.getState().corruptedPayload).toBeNull();
    expect(useTreeStore.getState().nodes).toHaveLength(0);
    expect(useTreeStore.getState().edges).toHaveLength(0);

    const raw = mockStorage.getItem(PERSISTENCE_STORAGE_KEY);
    const parsed = JSON.parse(raw!);
    expect(parsed.nodes).toHaveLength(0);
    expect(parsed.edges).toHaveLength(0);
  });

  it('49. dismissRecoveryModal() hides recovery modal while leaving storage untouched', async () => {
    const corruptPayload = 'corrupt-content';
    mockStorage.setItem(PERSISTENCE_STORAGE_KEY, corruptPayload);
    await useTreeStore.getState().initializePersistence();

    useTreeStore.getState().dismissRecoveryModal();

    expect(useTreeStore.getState().recoveryError).toBeNull();
    // Storage was not overwritten
    expect(mockStorage.getItem(PERSISTENCE_STORAGE_KEY)).toBe(corruptPayload);
  });

  it('50. Full integration round-trip: Restore -> Add Child -> Autosave -> Simulate Reload -> Restore verifies persistence fidelity', async () => {
    // 1. Initial boot
    await useTreeStore.getState().initializePersistence();
    expect(useTreeStore.getState().nodes).toHaveLength(getCanonicalSampleNodes().length);

    // 2. Add child
    const addRes = useTreeStore.getState().addChild('root-policy-hierarchy', 'rule');
    expect(addRes.ok).toBe(true);
    const newRuleId = addRes.newChild!.id;

    // 3. Trigger autosave
    vi.advanceTimersByTime(700);
    expect(useTreeStore.getState().saveStatus).toBe('saved');

    // 4. Simulate page reload: reset in-memory store
    useTreeStore.setState({
      nodes: [],
      edges: [],
      persistenceStatus: 'idle',
      saveStatus: 'idle',
    });

    // 5. Re-initialize persistence
    await useTreeStore.getState().initializePersistence();

    // 6. Verify restored tree matches exactly with new child preserved
    const restoredNodes = useTreeStore.getState().nodes;
    expect(restoredNodes).toHaveLength(getCanonicalSampleNodes().length + 1);
    expect(restoredNodes.some((n) => n.id === newRuleId)).toBe(true);
    expect(useTreeStore.temporal.getState().pastStates).toHaveLength(0);
  });
});
