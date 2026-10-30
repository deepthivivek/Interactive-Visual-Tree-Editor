export type UserRole = 'Admin' | 'Editor' | 'Reviewer' | 'Approver' | 'Viewer';

export type ApprovalState = 'draft' | 'in_review' | 'approved' | 'published' | 'rejected';

export interface RolePermissions {
  canEditNodes: boolean;
  canDeleteNodes: boolean;
  canApplyTemplate: boolean;
  canImportJson: boolean;
  canSubmitForReview: boolean;
  canApprovePolicy: boolean;
  canPublishPolicy: boolean;
  canManageSettings: boolean;
}

export const ROLE_PERMISSIONS_MATRIX: Record<UserRole, RolePermissions> = {
  Admin: {
    canEditNodes: true,
    canDeleteNodes: true,
    canApplyTemplate: true,
    canImportJson: true,
    canSubmitForReview: true,
    canApprovePolicy: true,
    canPublishPolicy: true,
    canManageSettings: true,
  },
  Editor: {
    canEditNodes: true,
    canDeleteNodes: true,
    canApplyTemplate: true,
    canImportJson: true,
    canSubmitForReview: true,
    canApprovePolicy: false,
    canPublishPolicy: false,
    canManageSettings: false,
  },
  Reviewer: {
    canEditNodes: false,
    canDeleteNodes: false,
    canApplyTemplate: false,
    canImportJson: false,
    canSubmitForReview: false,
    canApprovePolicy: false,
    canPublishPolicy: false,
    canManageSettings: false,
  },
  Approver: {
    canEditNodes: false,
    canDeleteNodes: false,
    canApplyTemplate: false,
    canImportJson: false,
    canSubmitForReview: true,
    canApprovePolicy: true,
    canPublishPolicy: true,
    canManageSettings: false,
  },
  Viewer: {
    canEditNodes: false,
    canDeleteNodes: false,
    canApplyTemplate: false,
    canImportJson: false,
    canSubmitForReview: false,
    canApprovePolicy: false,
    canPublishPolicy: false,
    canManageSettings: false,
  },
};

export interface ApprovalRecord {
  id: string;
  state: ApprovalState;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  timestamp: number;
  comments: string;
  graphVersionId: string;
  nodeCount: number;
}

export interface PolicyApprovalWorkflow {
  currentState: ApprovalState;
  version: number;
  lastUpdated: number;
  history: ApprovalRecord[];
}

export function getPermissionsForRole(role: UserRole): RolePermissions {
  return ROLE_PERMISSIONS_MATRIX[role] || ROLE_PERMISSIONS_MATRIX.Viewer;
}

export function canTransitionApprovalState(
  fromState: ApprovalState,
  toState: ApprovalState,
  userRole: UserRole
): { allowed: boolean; reason?: string } {
  const permissions = getPermissionsForRole(userRole);

  if (fromState === toState) {
    return { allowed: true };
  }

  // Admin override
  if (userRole === 'Admin') {
    return { allowed: true };
  }

  switch (toState) {
    case 'in_review':
      if (fromState !== 'draft' && fromState !== 'rejected') {
        return { allowed: false, reason: 'Can only submit for review from draft or rejected status.' };
      }
      if (!permissions.canSubmitForReview) {
        return { allowed: false, reason: 'Your role does not have permission to submit policies for review.' };
      }
      return { allowed: true };

    case 'approved':
      if (fromState !== 'in_review') {
        return { allowed: false, reason: 'Can only approve policies that are currently in review.' };
      }
      if (!permissions.canApprovePolicy) {
        return { allowed: false, reason: 'Your role does not have permission to approve compliance policies.' };
      }
      return { allowed: true };

    case 'rejected':
      if (fromState !== 'in_review') {
        return { allowed: false, reason: 'Can only reject policies that are currently in review.' };
      }
      if (!permissions.canApprovePolicy) {
        return { allowed: false, reason: 'Your role does not have permission to reject policies.' };
      }
      return { allowed: true };

    case 'published':
      if (fromState !== 'approved') {
        return { allowed: false, reason: 'Can only publish policies that have been approved.' };
      }
      if (!permissions.canPublishPolicy) {
        return { allowed: false, reason: 'Your role does not have permission to publish policies.' };
      }
      return { allowed: true };

    case 'draft':
      return { allowed: true };

    default:
      return { allowed: false, reason: 'Invalid state transition.' };
  }
}

export function isGraphModificationAllowed(
  approvalState: ApprovalState,
  userRole: UserRole
): { allowed: boolean; reason?: string } {
  if (userRole === 'Admin') {
    return { allowed: true };
  }

  const permissions = getPermissionsForRole(userRole);
  if (!permissions.canEditNodes) {
    return { allowed: false, reason: `Role "${userRole}" cannot edit nodes.` };
  }

  if (approvalState === 'approved' || approvalState === 'published') {
    return {
      allowed: false,
      reason: `Policy is in locked status "${approvalState}". Revert status to draft to edit.`,
    };
  }

  return { allowed: true };
}
