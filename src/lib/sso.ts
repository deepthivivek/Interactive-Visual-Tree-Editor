import type { UserRole } from './rolesAndApprovals';

export type SsoProtocol = 'oidc' | 'saml2';

export type SsoProviderType = 'okta' | 'azure_ad' | 'ping_identity' | 'google_workspace' | 'custom_oidc';

export interface SsoConfig {
  providerId: SsoProviderType;
  providerName: string;
  protocol: SsoProtocol;
  issuerUrl: string;
  clientId: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userInfoEndpoint: string;
  groupRoleMappings: Record<string, UserRole>;
  defaultRole: UserRole;
  tenantId?: string;
  enabled: boolean;
}

export interface SsoUserProfile {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  role: UserRole;
  organizationId: string;
  organizationName: string;
  ssoProvider: SsoProviderType;
  groups: string[];
  idTokenRaw?: string;
  accessTokenRaw?: string;
  authenticatedAt: number;
  expiresAt: number;
}

export interface SsoTokenVerificationResult {
  valid: boolean;
  user?: SsoUserProfile;
  error?: string;
  claims?: Record<string, unknown>;
}

export const PRESET_SSO_PROVIDERS: Record<SsoProviderType, SsoConfig> = {
  okta: {
    providerId: 'okta',
    providerName: 'Okta Enterprise SSO',
    protocol: 'oidc',
    issuerUrl: 'https://company.okta.com/oauth2/default',
    clientId: '0oac1234567890Example',
    authorizationEndpoint: 'https://company.okta.com/oauth2/v1/authorize',
    tokenEndpoint: 'https://company.okta.com/oauth2/v1/token',
    userInfoEndpoint: 'https://company.okta.com/oauth2/v1/userinfo',
    groupRoleMappings: {
      'Compliance-Admins': 'Admin',
      'Compliance-Approvers': 'Approver',
      'Compliance-Editors': 'Editor',
      'Compliance-Auditors': 'Reviewer',
    },
    defaultRole: 'Viewer',
    tenantId: 'tenant-enterprise-01',
    enabled: true,
  },
  azure_ad: {
    providerId: 'azure_ad',
    providerName: 'Microsoft Entra ID (Azure AD)',
    protocol: 'oidc',
    issuerUrl: 'https://login.microsoftonline.com/common/v2.0',
    clientId: '11111111-2222-3333-4444-555555555555',
    authorizationEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userInfoEndpoint: 'https://graph.microsoft.com/v1.0/me',
    groupRoleMappings: {
      'SG-Compliance-Admins': 'Admin',
      'SG-Compliance-Approvers': 'Approver',
      'SG-Compliance-Editors': 'Editor',
    },
    defaultRole: 'Viewer',
    tenantId: 'tenant-azure-02',
    enabled: true,
  },
  google_workspace: {
    providerId: 'google_workspace',
    providerName: 'Google Workspace Enterprise',
    protocol: 'oidc',
    issuerUrl: 'https://accounts.google.com',
    clientId: 'google-compliance-applet-client-id.apps.googleusercontent.com',
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    userInfoEndpoint: 'https://openidconnect.googleapis.com/v1/userinfo',
    groupRoleMappings: {
      'admins@company.com': 'Admin',
      'approvers@company.com': 'Approver',
      'editors@company.com': 'Editor',
    },
    defaultRole: 'Editor',
    tenantId: 'google-org-01',
    enabled: true,
  },
  ping_identity: {
    providerId: 'ping_identity',
    providerName: 'PingIdentity Federation',
    protocol: 'saml2',
    issuerUrl: 'https://auth.pingone.com/company',
    clientId: 'ping-compliance-client',
    authorizationEndpoint: 'https://auth.pingone.com/company/as/authorize',
    tokenEndpoint: 'https://auth.pingone.com/company/as/token',
    userInfoEndpoint: 'https://auth.pingone.com/company/as/userinfo',
    groupRoleMappings: {
      'Ping-Compliance-Admins': 'Admin',
    },
    defaultRole: 'Viewer',
    tenantId: 'ping-org-01',
    enabled: true,
  },
  custom_oidc: {
    providerId: 'custom_oidc',
    providerName: 'Custom OpenID Connect Provider',
    protocol: 'oidc',
    issuerUrl: 'https://sso.internal.company.com',
    clientId: 'custom-oidc-client-id',
    authorizationEndpoint: 'https://sso.internal.company.com/auth',
    tokenEndpoint: 'https://sso.internal.company.com/token',
    userInfoEndpoint: 'https://sso.internal.company.com/me',
    groupRoleMappings: {},
    defaultRole: 'Editor',
    tenantId: 'internal-corp-01',
    enabled: true,
  },
};

/**
 * Pure function that resolves user role from SSO group claims using mapped rules.
 */
export function resolveRoleFromSsoGroups(
  groups: string[],
  groupRoleMappings: Record<string, UserRole>,
  defaultRole: UserRole
): UserRole {
  for (const group of groups) {
    if (groupRoleMappings[group]) {
      return groupRoleMappings[group];
    }
  }
  return defaultRole;
}

/**
 * Validates mock/live OIDC ID token structure & assertions.
 */
export function verifySsoIdToken(
  tokenString: string,
  config: SsoConfig,
  expectedNonce?: string
): SsoTokenVerificationResult {
  if (!tokenString || tokenString.trim().length === 0) {
    return { valid: false, error: 'Missing or empty SSO token.' };
  }

  // Handle JWT token strings (header.payload.signature)
  const parts = tokenString.split('.');
  if (parts.length === 3) {
    try {
      const payloadJson = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
      const claims = JSON.parse(payloadJson);

      const now = Math.floor(Date.now() / 1000);

      // Check Expiration
      if (claims.exp && claims.exp < now) {
        return { valid: false, error: 'SSO ID token has expired.', claims };
      }

      // Check Not Before
      if (claims.nbf && claims.nbf > now) {
        return { valid: false, error: 'SSO token not active yet.', claims };
      }

      // Check Nonce if supplied
      if (expectedNonce && claims.nonce && claims.nonce !== expectedNonce) {
        return { valid: false, error: 'Nonce mismatch in SSO assertion.', claims };
      }

      const groups = Array.isArray(claims.groups) ? claims.groups : Array.isArray(claims.roles) ? claims.roles : [];
      const userRole = resolveRoleFromSsoGroups(groups, config.groupRoleMappings, config.defaultRole);

      const user: SsoUserProfile = {
        id: claims.sub || `sso-user-${Math.random().toString(36).substr(2, 6)}`,
        email: claims.email || claims.preferred_username || 'sso-user@enterprise.com',
        fullName: claims.name || claims.given_name || 'Enterprise SSO User',
        avatarUrl: claims.picture,
        role: userRole,
        organizationId: config.tenantId || 'enterprise-org-1',
        organizationName: `${config.providerName} Authorized Domain`,
        ssoProvider: config.providerId,
        groups,
        idTokenRaw: tokenString,
        authenticatedAt: Date.now(),
        expiresAt: claims.exp ? claims.exp * 1000 : Date.now() + 8 * 3600 * 1000,
      };

      return { valid: true, user, claims };
    } catch {
      return { valid: false, error: 'Malformed JWT token payload.' };
    }
  }

  // Support structured JSON token fallback for test environments
  try {
    const claims = JSON.parse(tokenString);
    const groups = Array.isArray(claims.groups) ? claims.groups : [];
    const userRole = resolveRoleFromSsoGroups(groups, config.groupRoleMappings, config.defaultRole);

    const user: SsoUserProfile = {
      id: claims.sub || 'sso-user-1',
      email: claims.email || 'user@enterprise.com',
      fullName: claims.name || 'Enterprise User',
      role: userRole,
      organizationId: config.tenantId || 'enterprise-org-1',
      organizationName: config.providerName,
      ssoProvider: config.providerId,
      groups,
      authenticatedAt: Date.now(),
      expiresAt: Date.now() + 8 * 3600 * 1000,
    };

    return { valid: true, user, claims };
  } catch {
    return { valid: false, error: 'Invalid token format. Must be valid JWT or JSON string.' };
  }
}
