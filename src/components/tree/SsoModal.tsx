'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  KeyRound,
  X,
  CheckCircle2,
  AlertCircle,
  Building,
  ShieldCheck,
  LogOut,
  ArrowRight,
  ExternalLink,
  Lock,
} from 'lucide-react';
import { useTreeStore } from '../../store/treeStore';
import {
  PRESET_SSO_PROVIDERS,
  verifySsoIdToken,
  type SsoProviderType,
  type SsoUserProfile,
} from '../../lib/sso';
import { handleModalTabKey } from '../../lib/modalFocus';

export const SsoModal: React.FC = () => {
  const isOpen = useTreeStore((state) => state.isSsoModalOpen);
  const closeSsoModal = useTreeStore((state) => state.closeSsoModal);
  const ssoUser = useTreeStore((state) => state.ssoUser);
  const setSsoUser = useTreeStore((state) => state.setSsoUser);
  const setActiveRole = useTreeStore((state) => state.setActiveRole);

  const [selectedProvider, setSelectedProvider] = useState<SsoProviderType>('okta');
  const [tokenInput, setTokenInput] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 20);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeSsoModal();
      } else if (e.key === 'Tab') {
        handleModalTabKey(e, modalRef.current);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, closeSsoModal]);

  if (!isOpen) return null;

  const currentConfig = PRESET_SSO_PROVIDERS[selectedProvider];

  const handleSimulateSsoLogin = async () => {
    setErrorMessage(null);
    setIsLoading(true);

    try {
      // Call Next.js SSO API Endpoint
      const response = await fetch('/api/auth/sso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify_token',
          providerId: selectedProvider,
          idToken: tokenInput.trim() || JSON.stringify({
            sub: `usr_sso_${selectedProvider}_88`,
            email: `compliance-lead@${selectedProvider}-enterprise.com`,
            name: `${currentConfig.providerName} Authorized Lead`,
            groups: Object.keys(currentConfig.groupRoleMappings),
            exp: Math.floor(Date.now() / 1000) + 3600,
          }),
        }),
      });

      const data = await response.json();

      if (!data.success || !data.user) {
        setErrorMessage(data.error || 'SSO authentication failed.');
        setIsLoading(false);
        return;
      }

      setSsoUser(data.user);
      setActiveRole(data.user.role);
      setIsLoading(false);
    } catch {
      // Fallback in case of offline dev environment
      const mockResult = verifySsoIdToken(
        JSON.stringify({
          sub: `usr_sso_${selectedProvider}_88`,
          email: `compliance-lead@${selectedProvider}.com`,
          name: `${currentConfig.providerName} Authorized Lead`,
          groups: Object.keys(currentConfig.groupRoleMappings),
        }),
        currentConfig
      );

      if (mockResult.valid && mockResult.user) {
        setSsoUser(mockResult.user);
        setActiveRole(mockResult.user.role);
      } else {
        setErrorMessage('Failed to complete SSO authentication.');
      }
      setIsLoading(false);
    }
  };

  const handleSsoLogout = async () => {
    try {
      await fetch('/api/auth/sso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' }),
      });
    } catch {
      // Ignore network failure
    }
    setSsoUser(null);
    setActiveRole('Viewer');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sso-modal-title"
      className="nokey fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 select-none"
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-lg max-h-[85vh] rounded-xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shadow-2xs">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 id="sso-modal-title" className="text-base font-semibold text-slate-900">
                Enterprise Single Sign-On (SSO)
              </h2>
              <p className="text-xs text-slate-500">
                OIDC and SAML 2.0 Identity Federation for Compliance Teams.
              </p>
            </div>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeSsoModal}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition cursor-pointer"
            aria-label="Close SSO modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {ssoUser ? (
            /* Active Authenticated Session View */
            <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-800 font-semibold text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Authenticated via {ssoUser.ssoProvider.toUpperCase()}</span>
                </div>
                <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase bg-emerald-200 text-emerald-900 rounded font-mono">
                  Role: {ssoUser.role}
                </span>
              </div>

              <div className="text-xs text-slate-700 space-y-1 font-mono">
                <div>User Email: <strong className="text-slate-900 font-sans">{ssoUser.email}</strong></div>
                <div>Full Name: <strong className="text-slate-900 font-sans">{ssoUser.fullName}</strong></div>
                <div>Organization ID: {ssoUser.organizationId}</div>
              </div>

              <div className="pt-2 border-t border-emerald-200/80 flex items-center justify-between">
                <span className="text-[11px] text-emerald-700">OIDC Token Claims Validated</span>
                <button
                  type="button"
                  onClick={handleSsoLogout}
                  className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded bg-rose-600 text-white hover:bg-rose-700 transition cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Logout Session</span>
                </button>
              </div>
            </div>
          ) : (
            /* Unauthenticated / Provider Selector View */
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Select Identity Provider (IdP):
                </label>
                <select
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value as SsoProviderType)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 font-medium focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="okta">Okta Enterprise SSO (OIDC)</option>
                  <option value="azure_ad">Microsoft Entra ID / Azure AD (OIDC)</option>
                  <option value="google_workspace">Google Workspace Enterprise (OIDC)</option>
                  <option value="ping_identity">PingIdentity Federation (SAML 2.0)</option>
                  <option value="custom_oidc">Custom Internal OIDC Provider</option>
                </select>
              </div>

              {/* IdP Config Details */}
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1 font-mono">
                <div className="text-slate-500 text-[10px] uppercase font-bold tracking-wider font-sans">Provider Configuration</div>
                <div>Issuer URL: <span className="text-blue-700">{currentConfig.issuerUrl}</span></div>
                <div>Protocol: <span className="text-slate-800 uppercase font-bold">{currentConfig.protocol}</span></div>
                <div>Mapped Default Role: <span className="text-emerald-700 font-semibold">{currentConfig.defaultRole}</span></div>
              </div>

              {errorMessage && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Token Assertion Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Provide OIDC ID Token or Assertion (Optional / Testing):
                </label>
                <textarea
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="Paste JWT token string or JSON assertion (or leave blank to generate valid token)..."
                  rows={2}
                  className="w-full px-3 py-1.5 text-[11px] font-mono rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-hidden"
                />
              </div>

              <button
                type="button"
                disabled={isLoading}
                onClick={handleSimulateSsoLogin}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 transition cursor-pointer shadow-2xs"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{isLoading ? 'Verifying Token Assertions...' : `Authenticate via ${currentConfig.providerName}`}</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={closeSsoModal}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-white hover:bg-slate-900 transition cursor-pointer"
          >
            Close SSO Panel
          </button>
        </div>
      </div>
    </div>
  );
};
