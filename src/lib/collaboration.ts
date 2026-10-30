import type { TreeNode, TreeEdge } from '../types/tree';

export interface CollaborationUser {
  id: string;
  name: string;
  color: string;
  role: string;
  focusedNodeId: string | null;
  cursorPosition: { x: number; y: number } | null;
  lastActive: number;
}

export interface NodeLock {
  nodeId: string;
  lockedByUserId: string;
  lockedByUserName: string;
  lockedAt: number;
}

export interface CollaborationState {
  roomId: string;
  isConnected: boolean;
  currentUser: CollaborationUser;
  activeUsers: CollaborationUser[];
  activeLocks: Record<string, NodeLock>;
  revision: number;
}

export type CollaborationEvent =
  | { type: 'USER_JOIN'; user: CollaborationUser }
  | { type: 'USER_LEAVE'; userId: string }
  | { type: 'PRESENCE_UPDATE'; user: CollaborationUser }
  | { type: 'LOCK_ACQUIRE'; nodeId: string; user: CollaborationUser }
  | { type: 'LOCK_RELEASE'; nodeId: string; userId: string }
  | { type: 'GRAPH_SYNC'; revision: number; nodes: TreeNode[]; edges: TreeEdge[] };

const COLLAB_CHANNEL_NAME = 'visual_tree_editor_collab_v1';

export class CollaborationEngine {
  private channel: BroadcastChannel | null = null;
  private state: CollaborationState;
  private onStateChangeCallback: ((state: CollaborationState) => void) | null = null;
  private onGraphSyncCallback: ((nodes: TreeNode[], edges: TreeEdge[], revision: number) => void) | null = null;

  constructor(initialUser: Partial<CollaborationUser> = {}) {
    const userId = initialUser.id || `user_${Math.random().toString(36).substring(2, 9)}`;
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    this.state = {
      roomId: 'global-compliance-room',
      isConnected: false,
      currentUser: {
        id: userId,
        name: initialUser.name || `Compliance User ${userId.substring(5, 8)}`,
        color: initialUser.color || randomColor,
        role: initialUser.role || 'Editor',
        focusedNodeId: null,
        cursorPosition: null,
        lastActive: Date.now(),
      },
      activeUsers: [],
      activeLocks: {},
      revision: 1,
    };
  }

  public init(
    onStateChange: (state: CollaborationState) => void,
    onGraphSync?: (nodes: TreeNode[], edges: TreeEdge[], revision: number) => void
  ) {
    this.onStateChangeCallback = onStateChange;
    this.onGraphSyncCallback = onGraphSync || null;

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel(COLLAB_CHANNEL_NAME);
        this.channel.onmessage = (event: MessageEvent<CollaborationEvent>) => {
          this.handleIncomingEvent(event.data);
        };
      } catch {
        // BroadcastChannel unavailable
      }
    }

    this.state.isConnected = true;
    this.broadcastEvent({ type: 'USER_JOIN', user: this.state.currentUser });
    this.emitState();
  }

  public updatePresence(focusedNodeId: string | null, cursorPosition: { x: number; y: number } | null = null) {
    this.state.currentUser.focusedNodeId = focusedNodeId;
    this.state.currentUser.cursorPosition = cursorPosition;
    this.state.currentUser.lastActive = Date.now();

    this.broadcastEvent({
      type: 'PRESENCE_UPDATE',
      user: this.state.currentUser,
    });
    this.emitState();
  }

  public acquireNodeLock(nodeId: string): boolean {
    const existingLock = this.state.activeLocks[nodeId];
    if (existingLock && existingLock.lockedByUserId !== this.state.currentUser.id) {
      return false; // Lock denied
    }

    const lock: NodeLock = {
      nodeId,
      lockedByUserId: this.state.currentUser.id,
      lockedByUserName: this.state.currentUser.name,
      lockedAt: Date.now(),
    };

    this.state.activeLocks[nodeId] = lock;
    this.broadcastEvent({
      type: 'LOCK_ACQUIRE',
      nodeId,
      user: this.state.currentUser,
    });
    this.emitState();
    return true;
  }

  public releaseNodeLock(nodeId: string) {
    if (this.state.activeLocks[nodeId]?.lockedByUserId === this.state.currentUser.id) {
      delete this.state.activeLocks[nodeId];
      this.broadcastEvent({
        type: 'LOCK_RELEASE',
        nodeId,
        userId: this.state.currentUser.id,
      });
      this.emitState();
    }
  }

  public syncGraph(nodes: TreeNode[], edges: TreeEdge[]) {
    this.state.revision += 1;
    this.broadcastEvent({
      type: 'GRAPH_SYNC',
      revision: this.state.revision,
      nodes,
      edges,
    });
    this.emitState();
  }

  public disconnect() {
    if (this.channel) {
      this.broadcastEvent({
        type: 'USER_LEAVE',
        userId: this.state.currentUser.id,
      });
      this.channel.close();
      this.channel = null;
    }
    this.state.isConnected = false;
    this.emitState();
  }

  private handleIncomingEvent(event: CollaborationEvent) {
    switch (event.type) {
      case 'USER_JOIN': {
        const exists = this.state.activeUsers.some((u) => u.id === event.user.id);
        if (!exists && event.user.id !== this.state.currentUser.id) {
          this.state.activeUsers.push(event.user);
          // Reply with self join so newcomer sees existing users
          this.broadcastEvent({ type: 'PRESENCE_UPDATE', user: this.state.currentUser });
        }
        break;
      }

      case 'USER_LEAVE': {
        this.state.activeUsers = this.state.activeUsers.filter((u) => u.id !== event.userId);
        for (const [nodeId, lock] of Object.entries(this.state.activeLocks)) {
          if (lock.lockedByUserId === event.userId) {
            delete this.state.activeLocks[nodeId];
          }
        }
        break;
      }

      case 'PRESENCE_UPDATE': {
        if (event.user.id === this.state.currentUser.id) return;
        const index = this.state.activeUsers.findIndex((u) => u.id === event.user.id);
        if (index >= 0) {
          this.state.activeUsers[index] = event.user;
        } else {
          this.state.activeUsers.push(event.user);
        }
        break;
      }

      case 'LOCK_ACQUIRE': {
        if (event.user.id === this.state.currentUser.id) return;
        this.state.activeLocks[event.nodeId] = {
          nodeId: event.nodeId,
          lockedByUserId: event.user.id,
          lockedByUserName: event.user.name,
          lockedAt: Date.now(),
        };
        break;
      }

      case 'LOCK_RELEASE': {
        if (event.userId === this.state.currentUser.id) return;
        delete this.state.activeLocks[event.nodeId];
        break;
      }

      case 'GRAPH_SYNC': {
        if (event.revision > this.state.revision) {
          this.state.revision = event.revision;
          if (this.onGraphSyncCallback) {
            this.onGraphSyncCallback(event.nodes, event.edges, event.revision);
          }
        }
        break;
      }
    }

    this.emitState();
  }

  private broadcastEvent(event: CollaborationEvent) {
    if (this.channel) {
      try {
        this.channel.postMessage(event);
      } catch {
        // Channel closed or error
      }
    }
  }

  private emitState() {
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback({ ...this.state });
    }
  }
}
