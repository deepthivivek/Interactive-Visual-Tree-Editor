import { describe, it, expect, beforeEach } from 'vitest';
import { useTreeStore } from '../store/treeStore';
import { act } from 'react';

describe('ContextMenu Actions End-to-End Store Operations', () => {
  beforeEach(() => {
    act(() => {
      useTreeStore.getState().setNodes([]);
      useTreeStore.getState().setEdges([]);
      useTreeStore.getState().createNode('root', { x: 0, y: 0 });
    });
  });

  it('correctly sets delete confirmation when deleting root or connected node', () => {
    const rootNode = useTreeStore.getState().nodes[0];
    
    // Create a child rule node to make the root connected
    act(() => {
      useTreeStore.getState().addChild(rootNode.id, 'rule');
    });
    
    const nodes = useTreeStore.getState().nodes;
    expect(nodes.length).toBe(2);

    // Simulate delete-single on root
    act(() => {
      useTreeStore.getState().requestDeleteNode(rootNode.id);
    });
    
    // Delete confirmation must be set for root
    const confirmState = useTreeStore.getState().deleteConfirmation;
    expect(confirmState).not.toBeNull();
    expect(confirmState?.nodeId).toBe(rootNode.id);
    expect(confirmState?.isRoot).toBe(true);
    
    // Confirm single deletion
    act(() => {
      useTreeStore.getState().confirmDeleteNode('single');
    });
    
    // Root removed, child remains orphaned
    const remainingNodes = useTreeStore.getState().nodes;
    expect(remainingNodes.length).toBe(1);
    expect(remainingNodes[0].type).toBe('rule');
  });

  it('correctly executes delete-subtree on node with descendants', () => {
    const rootNode = useTreeStore.getState().nodes[0];
    
    act(() => {
      useTreeStore.getState().addChild(rootNode.id, 'rule');
    });
    
    expect(useTreeStore.getState().nodes.length).toBe(2);

    act(() => {
      useTreeStore.getState().deleteSubtree(rootNode.id);
    });

    expect(useTreeStore.getState().nodes.length).toBe(0);
  });

  it('correctly copies and pastes subtree', () => {
    const rootNode = useTreeStore.getState().nodes[0];
    
    act(() => {
      useTreeStore.getState().addChild(rootNode.id, 'rule');
      useTreeStore.getState().copySubtree(rootNode.id);
    });

    const clipboard = useTreeStore.getState().clipboard;
    expect(clipboard).not.toBeNull();
    expect(clipboard?.nodes.length).toBe(2);
  });

  it('correctly duplicates subtree', () => {
    const rootNode = useTreeStore.getState().nodes[0];
    
    act(() => {
      useTreeStore.getState().addChild(rootNode.id, 'rule');
    });
    
    const countBefore = useTreeStore.getState().nodes.length;
    expect(countBefore).toBe(2);

    act(() => {
      useTreeStore.getState().duplicateSubtree(rootNode.id);
    });

    const countAfter = useTreeStore.getState().nodes.length;
    expect(countAfter).toBe(4);
  });

  it('correctly toggles collapse state for subtree', () => {
    const rootNode = useTreeStore.getState().nodes[0];
    
    act(() => {
      useTreeStore.getState().addChild(rootNode.id, 'rule');
    });

    expect(useTreeStore.getState().nodes[0].data?.collapsed).toBeFalsy();

    act(() => {
      useTreeStore.getState().toggleNodeCollapse(rootNode.id);
    });

    expect(useTreeStore.getState().nodes[0].data?.collapsed).toBe(true);

    act(() => {
      useTreeStore.getState().toggleNodeCollapse(rootNode.id);
    });

    expect(useTreeStore.getState().nodes[0].data?.collapsed).toBe(false);
  });

  it('correctly adds child node from context menu', () => {
    const rootNode = useTreeStore.getState().nodes[0];
    
    act(() => {
      useTreeStore.getState().addChild(rootNode.id, 'rule');
    });

    const nodes = useTreeStore.getState().nodes;
    expect(nodes.length).toBe(2);
    expect(nodes[1].type).toBe('rule');
    
    const edges = useTreeStore.getState().edges;
    expect(edges.length).toBe(1);
    expect(edges[0].source).toBe(rootNode.id);
    expect(edges[0].target).toBe(nodes[1].id);
  });

  it('correctly opens and closes context menus', () => {
    const rootNode = useTreeStore.getState().nodes[0];

    act(() => {
      useTreeStore.getState().setNodeContextMenu({
        isOpen: true,
        x: 150,
        y: 200,
        nodeId: rootNode.id,
      });
    });

    expect(useTreeStore.getState().nodeContextMenu?.isOpen).toBe(true);
    expect(useTreeStore.getState().nodeContextMenu?.nodeId).toBe(rootNode.id);

    act(() => {
      useTreeStore.getState().closeAllContextMenus();
    });

    expect(useTreeStore.getState().nodeContextMenu).toBeNull();
    expect(useTreeStore.getState().paneContextMenu).toBeNull();
  });
});
