/**
 * Pure graph cycle detection utilities for the Interactive Visual Tree Editor (Day 5).
 * Completely framework-independent: zero dependencies on React, Zustand, or the DOM.
 */

export interface EdgeConnectionLike {
  id?: string;
  source: string;
  target: string;
}

/**
 * Checks whether adding a directed edge from `sourceId` to `targetId`
 * would introduce a cycle into the graph.
 *
 * Algorithm:
 * In a directed graph, adding the edge `source -> target` creates a cycle
 * if and only if `target` can already reach `source` through existing edges.
 *
 * @param sourceId - Parent node ID
 * @param targetId - Child node ID
 * @param edges - Current collection of graph edges
 * @param ignoreEdgeId - Optional edge ID to ignore (essential during edge reconnection)
 * @returns True if a cycle would be formed, false otherwise
 */
export function wouldCreateCycle(
  sourceId: string,
  targetId: string,
  edges: Iterable<EdgeConnectionLike>,
  ignoreEdgeId?: string
): boolean {
  // 1. Direct self-loop (source === target)
  if (sourceId === targetId) {
    return true;
  }

  // 2. Build adjacency list of directed connections excluding ignoreEdgeId
  const adj = new Map<string, string[]>();
  for (const edge of edges) {
    if (ignoreEdgeId && edge.id === ignoreEdgeId) {
      continue;
    }
    const neighbors = adj.get(edge.source);
    if (neighbors) {
      neighbors.push(edge.target);
    } else {
      adj.set(edge.source, [edge.target]);
    }
  }

  // 3. Breadth-First Search (BFS) to determine if sourceId is reachable from targetId
  const visited = new Set<string>();
  const queue: string[] = [targetId];
  visited.add(targetId);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === sourceId) {
      return true;
    }

    const nextNodes = adj.get(current);
    if (nextNodes) {
      for (const next of nextNodes) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }
  }

  return false;
}

/**
 * Validates whether an entire directed graph contains any cycles.
 * Uses topological Kahn's algorithm or DFS cycle detection.
 *
 * @param edges - Collection of graph edges
 * @returns True if any cycle exists in the graph
 */
export function hasAnyCycle(edges: Iterable<EdgeConnectionLike>): boolean {
  const adj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  const nodes = new Set<string>();

  for (const edge of edges) {
    nodes.add(edge.source);
    nodes.add(edge.target);

    const neighbors = adj.get(edge.source) || [];
    neighbors.push(edge.target);
    adj.set(edge.source, neighbors);

    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    if (!inDegree.has(edge.source)) {
      inDegree.set(edge.source, 0);
    }
  }

  const queue: string[] = [];
  for (const node of nodes) {
    if ((inDegree.get(node) || 0) === 0) {
      queue.push(node);
    }
  }

  let visitedCount = 0;
  while (queue.length > 0) {
    const current = queue.shift()!;
    visitedCount++;

    const neighbors = adj.get(current);
    if (neighbors) {
      for (const neighbor of neighbors) {
        const count = (inDegree.get(neighbor) || 0) - 1;
        inDegree.set(neighbor, count);
        if (count === 0) {
          queue.push(neighbor);
        }
      }
    }
  }

  return visitedCount !== nodes.size;
}

/**
 * Structured evidence representing a detected cycle in the graph.
 */
export interface CycleEvidence {
  path: string[]; // Ordered sequence of node IDs closing the loop, e.g. ['A', 'B', 'C', 'A']
  edgeIds: string[]; // Corresponding edge IDs forming the cycle
}

/**
 * Finds all elementary or distinct cycles in a directed graph.
 * Returns deterministic cycle evidence including ordered node IDs and edge IDs.
 *
 * @param edges - Collection of graph edges
 * @returns Array of cycle evidence objects
 */
export function findCyclePaths(edges: Iterable<EdgeConnectionLike>): CycleEvidence[] {
  const edgeList = Array.from(edges);
  const cycles: CycleEvidence[] = [];
  const reportedCycleKeys = new Set<string>();

  // 1. Detect immediate self-loops
  for (const edge of edgeList) {
    if (edge.source === edge.target) {
      const key = `${edge.source}->${edge.target}`;
      if (!reportedCycleKeys.has(key)) {
        reportedCycleKeys.add(key);
        cycles.push({
          path: [edge.source, edge.target],
          edgeIds: edge.id ? [edge.id] : [],
        });
      }
    }
  }

  // 2. Build adjacency map with edge references
  const adj = new Map<string, Array<{ target: string; edgeId?: string }>>();
  const allNodes = new Set<string>();

  for (const edge of edgeList) {
    allNodes.add(edge.source);
    allNodes.add(edge.target);
    const existing = adj.get(edge.source) || [];
    existing.push({ target: edge.target, edgeId: edge.id });
    adj.set(edge.source, existing);
  }

  // 3. DFS with recursion stack (0 = unvisited, 1 = visiting (in stack), 2 = visited)
  const state = new Map<string, number>();
  const parentMap = new Map<string, { parent: string; edgeId?: string }>();

  // Sort nodes deterministically for consistent traversal
  const sortedNodes = Array.from(allNodes).sort();

  function dfs(u: string, stack: string[], edgeStack: string[]) {
    state.set(u, 1);
    stack.push(u);

    const neighbors = adj.get(u) || [];
    // Sort neighbors deterministically
    const sortedNeighbors = [...neighbors].sort((a, b) => a.target.localeCompare(b.target));

    for (const { target: v, edgeId } of sortedNeighbors) {
      if (u === v) continue; // Already handled self-loops

      const vState = state.get(v) || 0;
      if (vState === 1) {
        // Cycle detected: v is currently in recursion stack
        const cycleStartIndex = stack.indexOf(v);
        if (cycleStartIndex !== -1) {
          const cycleNodes = [...stack.slice(cycleStartIndex), v];
          const cycleEdges = [...edgeStack.slice(cycleStartIndex), edgeId || ''].filter(Boolean);

          // Canonical key for deduplication (normalize rotation)
          const canonicalKey = [...stack.slice(cycleStartIndex)].sort().join(',');
          if (!reportedCycleKeys.has(canonicalKey)) {
            reportedCycleKeys.add(canonicalKey);
            cycles.push({
              path: cycleNodes,
              edgeIds: cycleEdges,
            });
          }
        }
      } else if (vState === 0) {
        if (edgeId) edgeStack.push(edgeId);
        dfs(v, stack, edgeStack);
        if (edgeId) edgeStack.pop();
      }
    }

    stack.pop();
    state.set(u, 2);
  }

  for (const node of sortedNodes) {
    if ((state.get(node) || 0) === 0) {
      dfs(node, [], []);
    }
  }

  return cycles;
}
