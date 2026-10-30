import { describe, it, expect, beforeEach } from 'vitest';
import { comparePolicyGraphs } from '../lib/policyComparison';
import {
  ROLE_PERMISSIONS_MATRIX,
  getPermissionsForRole,
  canTransitionApprovalState,
  isGraphModificationAllowed,
} from '../lib/rolesAndApprovals';
import { CollaborationEngine } from '../lib/collaboration';
import { resolveRoleFromSsoGroups, verifySsoIdToken, PRESET_SSO_PROVIDERS } from '../lib/sso';
import { useTreeStore } from '../store/treeStore';
import type { TreeNode, TreeEdge } from '../types/tree';

describe('Days 22–30 Enterprise Features Test Suite', () => {
  const sampleNodes: TreeNode[] = [
    {
      id: 'root-1',
      type: 'root',
      position: { x: 100, y: 100 },
      data: { label: 'Root Node', ruleId: 'R-100', severity: 'info', status: 'active' },
    },
    {
      id: 'rule-1',
      type: 'rule',
      position: { x: 100, y: 200 },
      data: { label: 'FINRA Rule 2210', ruleId: 'R-2210', severity: 'high', status: 'active' },
    },
  ];

  const sampleEdges: TreeEdge[] = [
    { id: 'e1', source: 'root-1', target: 'rule-1' },
  ];

  beforeEach(() => {
    useTreeStore.setState({
      activeRole: 'Admin',
      approvalWorkflow: {
        currentState: 'draft',
        version: 1,
        lastUpdated: Date.now(),
        history: [],
      },
      ssoUser: null,
    });
  });

  // ---------------------------------------------------------------------------
  // DAY 22: POLICY COMPARISON
  // ---------------------------------------------------------------------------
  describe('Day 22: Policy Comparison & Diffing Engine', () => {
    it('1. Detects identical graphs correctly', () => {
      const result = comparePolicyGraphs(sampleNodes, sampleEdges, sampleNodes, sampleEdges);
      expect(result.isIdentical).toBe(true);
      expect(result.addedNodeCount).toBe(0);
      expect(result.removedNodeCount).toBe(0);
      expect(result.modifiedNodeCount).toBe(0);
    });

    it('2. Identifies added and modified nodes correctly', () => {
      const modifiedNodes: TreeNode[] = [
        {
          id: 'root-1',
          type: 'root',
          position: { x: 100, y: 100 },
          data: { label: 'Modified Root Title', ruleId: 'R-100', severity: 'critical', status: 'active' },
        },
        {
          id: 'rule-1',
          type: 'rule',
          position: { x: 100, y: 200 },
          data: { label: 'FINRA Rule 2210', ruleId: 'R-2210', severity: 'high', status: 'active' },
        },
        {
          id: 'cond-1',
          type: 'condition',
          position: { x: 100, y: 300 },
          data: { label: 'New Condition', ruleId: 'C-01', severity: 'medium', status: 'active' },
        },
      ];

      const result = comparePolicyGraphs(sampleNodes, sampleEdges, modifiedNodes, sampleEdges);
      expect(result.isIdentical).toBe(false);
      expect(result.addedNodeCount).toBe(1);
      expect(result.modifiedNodeCount).toBe(1);
      expect(result.nodeDiffs.find((d) => d.nodeId === 'root-1')?.changeType).toBe('modified');
      expect(result.nodeDiffs.find((d) => d.nodeId === 'cond-1')?.changeType).toBe('added');
    });
  });

  // ---------------------------------------------------------------------------
  // DAY 26: ROLES, PERMISSIONS & APPROVALS
  // ---------------------------------------------------------------------------
  describe('Day 26: Roles, Permissions & Approvals (RBAC)', () => {
    it('1. Enforces permission matrix rules by role', () => {
      const adminPerms = getPermissionsForRole('Admin');
      expect(adminPerms.canEditNodes).toBe(true);
      expect(adminPerms.canApprovePolicy).toBe(true);

      const viewerPerms = getPermissionsForRole('Viewer');
      expect(viewerPerms.canEditNodes).toBe(false);
      expect(viewerPerms.canApprovePolicy).toBe(false);

      const approverPerms = getPermissionsForRole('Approver');
      expect(approverPerms.canApprovePolicy).toBe(true);
      expect(approverPerms.canEditNodes).toBe(false);
    });

    it('2. Validates approval lifecycle state transitions', () => {
      // Editor submitting draft for review
      const res1 = canTransitionApprovalState('draft', 'in_review', 'Editor');
      expect(res1.allowed).toBe(true);

      // Viewer attempting to approve
      const res2 = canTransitionApprovalState('in_review', 'approved', 'Viewer');
      expect(res2.allowed).toBe(false);

      // Approver approving in_review policy
      const res3 = canTransitionApprovalState('in_review', 'approved', 'Approver');
      expect(res3.allowed).toBe(true);
    });

    it('3. Locks graph edits when policy is in approved/published state', () => {
      const draftCheck = isGraphModificationAllowed('draft', 'Editor');
      expect(draftCheck.allowed).toBe(true);

      const approvedCheck = isGraphModificationAllowed('approved', 'Editor');
      expect(approvedCheck.allowed).toBe(false);

      // Admin override
      const adminCheck = isGraphModificationAllowed('approved', 'Admin');
      expect(adminCheck.allowed).toBe(true);
    });

    it('4. Updates store approval state and appends audit log entry', () => {
      useTreeStore.getState().setApprovalState('in_review', 'Editor', 'Submitting for audit');
      let wf = useTreeStore.getState().approvalWorkflow;
      expect(wf.currentState).toBe('in_review');
      expect(wf.history.length).toBe(1);
      expect(wf.history[0].comments).toBe('Submitting for audit');

      useTreeStore.getState().setApprovalState('approved', 'Approver', 'Passed compliance audit');
      wf = useTreeStore.getState().approvalWorkflow;
      expect(wf.currentState).toBe('approved');
      expect(wf.history.length).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // DAY 27: REAL-TIME COLLABORATION
  // ---------------------------------------------------------------------------
  describe('Day 27: Real-Time Collaboration Engine', () => {
    it('1. Initializes collaboration session and presence', () => {
      const engine = new CollaborationEngine({ id: 'test_user_1', name: 'Alice' });
      let currentState: unknown = null;

      engine.init((state) => {
        currentState = state;
      });

      expect(currentState).not.toBeNull();
      engine.updatePresence('rule-1');
      engine.disconnect();
    });

    it('2. Acquires and releases node locks correctly', () => {
      const engine1 = new CollaborationEngine({ id: 'usr_1', name: 'User 1' });
      engine1.init(() => {});

      const locked = engine1.acquireNodeLock('rule-1');
      expect(locked).toBe(true);

      engine1.releaseNodeLock('rule-1');
      engine1.disconnect();
    });
  });

  // ---------------------------------------------------------------------------
  // DAY 30: ENTERPRISE SINGLE SIGN-ON
  // ---------------------------------------------------------------------------
  describe('Day 30: Enterprise Single Sign-On (SSO)', () => {
    it('1. Maps SSO group assertions to application UserRole', () => {
      const role = resolveRoleFromSsoGroups(
        ['Compliance-Admins'],
        PRESET_SSO_PROVIDERS.okta.groupRoleMappings,
        'Viewer'
      );
      expect(role).toBe('Admin');
    });

    it('2. Verifies structured JSON token assertions successfully', () => {
      const mockPayload = JSON.stringify({
        sub: 'usr_okta_99',
        email: 'auditor@company.com',
        name: 'Jane Auditor',
        groups: ['Compliance-Approvers'],
      });

      const result = verifySsoIdToken(mockPayload, PRESET_SSO_PROVIDERS.okta);
      expect(result.valid).toBe(true);
      expect(result.user?.email).toBe('auditor@company.com');
      expect(result.user?.role).toBe('Approver');
    });

    it('3. Sets authenticated SSO user in store', () => {
      const mockPayload = JSON.stringify({
        sub: 'usr_okta_100',
        email: 'lead@company.com',
        name: 'Lead Compliance',
        groups: ['Compliance-Admins'],
      });

      const result = verifySsoIdToken(mockPayload, PRESET_SSO_PROVIDERS.okta);
      expect(result.valid).toBe(true);
      useTreeStore.getState().setSsoUser(result.user!);

      const ssoUser = useTreeStore.getState().ssoUser;
      expect(ssoUser).not.toBeNull();
      expect(ssoUser?.email).toBe('lead@company.com');
      expect(ssoUser?.role).toBe('Admin');
    });
  });
});
