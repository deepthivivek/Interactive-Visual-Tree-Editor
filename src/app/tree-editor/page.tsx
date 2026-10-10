import React from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { TreeWorkspace } from '../../components/tree/TreeWorkspace';

export default function TreeEditorPage() {
  return (
    <ReactFlowProvider>
      <TreeWorkspace />
    </ReactFlowProvider>
  );
}

