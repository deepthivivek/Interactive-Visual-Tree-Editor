'use client';

import React, { useEffect, useState } from 'react';
import { Users, Wifi, WifiOff, Share2, Lock, Shield } from 'lucide-react';
import { useTreeStore } from '../../store/treeStore';
import { CollaborationEngine, type CollaborationState } from '../../lib/collaboration';

export const CollaborationBar: React.FC = () => {
  const [engine] = useState(() => new CollaborationEngine());
  const [collabState, setCollabState] = useState<CollaborationState>(() => ({
    roomId: 'global-compliance-room',
    isConnected: true,
    currentUser: {
      id: 'usr_me',
      name: 'Active User',
      color: '#3b82f6',
      role: 'Editor',
      focusedNodeId: null,
      cursorPosition: null,
      lastActive: Date.now(),
    },
    activeUsers: [],
    activeLocks: {},
    revision: 1,
  }));

  const selectedNodeId = useTreeStore((state) => state.selectedNodeId);

  useEffect(() => {
    engine.init((newState) => {
      setCollabState(newState);
    });

    return () => {
      engine.disconnect();
    };
  }, [engine]);

  useEffect(() => {
    if (selectedNodeId) {
      engine.updatePresence(selectedNodeId);
      engine.acquireNodeLock(selectedNodeId);
    } else {
      engine.updatePresence(null);
    }
  }, [selectedNodeId, engine]);

  const activeCount = collabState.activeUsers.length + 1;

  return (
    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-700">
      <div className="flex items-center gap-1.5" title="Real-Time Sync Status">
        {collabState.isConnected ? (
          <span className="flex items-center gap-1 text-emerald-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="hidden sm:inline font-mono text-[11px]">Live Room</span>
          </span>
        ) : (
          <span className="flex items-center gap-1 text-slate-400">
            <WifiOff className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Offline</span>
          </span>
        )}
      </div>

      <span className="text-slate-300">|</span>

      {/* Active Users Avatar Badges */}
      <div className="flex items-center -space-x-1" title={`${activeCount} active user(s) in collaboration room`}>
        <div
          className="w-5 h-5 rounded-full border border-white flex items-center justify-center text-[9px] font-bold text-white shadow-2xs"
          style={{ backgroundColor: collabState.currentUser.color }}
          title={`You: ${collabState.currentUser.name}`}
        >
          {collabState.currentUser.name.charAt(0)}
        </div>

        {collabState.activeUsers.map((user) => (
          <div
            key={user.id}
            className="w-5 h-5 rounded-full border border-white flex items-center justify-center text-[9px] font-bold text-white shadow-2xs"
            style={{ backgroundColor: user.color }}
            title={`Active: ${user.name} (${user.role})`}
          >
            {user.name.charAt(0)}
          </div>
        ))}
      </div>

      <span className="text-[11px] text-slate-500 font-mono">({activeCount})</span>
    </div>
  );
};
