import { NextRequest, NextResponse } from 'next/server';
import { PRESET_SSO_PROVIDERS, verifySsoIdToken, type SsoProviderType } from '@/src/lib/sso';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, providerId, idToken, expectedNonce } = body;

    const providerType = (providerId as SsoProviderType) || 'okta';
    const config = PRESET_SSO_PROVIDERS[providerType] || PRESET_SSO_PROVIDERS.okta;

    if (action === 'verify_token') {
      const verification = verifySsoIdToken(idToken, config, expectedNonce);

      if (!verification.valid) {
        return NextResponse.json(
          { success: false, error: verification.error || 'Invalid SSO token assertion' },
          { status: 401 }
        );
      }

      const response = NextResponse.json({
        success: true,
        user: verification.user,
        message: `Successfully authenticated via ${config.providerName}`,
      });

      // Set HTTP-only secure session cookie for production
      response.cookies.set('sso_session', verification.user?.id || 'session-active', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 8 * 3600, // 8 hours
        path: '/',
      });

      return response;
    }

    if (action === 'logout') {
      const response = NextResponse.json({
        success: true,
        message: 'SSO session terminated successfully.',
      });
      response.cookies.delete('sso_session');
      return response;
    }

    return NextResponse.json({
      success: true,
      provider: config.providerName,
      protocol: config.protocol,
      authorizationEndpoint: config.authorizationEndpoint,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'SSO authentication error';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
