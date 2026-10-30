/// <reference types="node" />
// Vercel Routing Middleware: every request for the static site passes through here first, so no
// file in dist/ is served without a Sentanis staff session. Follows the sentanis-crm AuthKit
// pattern (lib/web-auth.ts, lib/workos-auth.ts): PKCE, the Sentanis organization checked at
// sign-in, a verified email, and an encrypted host-only session cookie. No WorkOS access or
// refresh token is stored.
import { WorkOS } from '@workos-inc/node';
import { EncryptJWT, base64url, jwtDecrypt } from 'jose';

export const config = { runtime: 'nodejs', matcher: '/:path*' };

// Sentanis, Inc. Pinned here rather than read from the environment, so a configuration mistake
// cannot widen access to another WorkOS organization.
export const SENTANIS_ORGANIZATION_ID = 'org_01KZRWFJ4GHC22D73XDEY7EA9K';

export const SESSION_COOKIE = '__Host-insurance_bench_session';
export const TRANSACTION_COOKIE = '__Host-insurance_bench_authkit';
const SESSION_AUDIENCE = 'insurance-bench-web-session';
const TRANSACTION_AUDIENCE = 'insurance-bench-authkit-transaction';
const SESSION_SECONDS = 60 * 60 * 8;
const TRANSACTION_SECONDS = 60 * 10;
const encoder = new TextEncoder();

export interface AuthConfig {
  appUrl: string;
  apiKey: string;
  clientId: string;
  sessionSecret: string;
}

/** The two WorkOS calls the middleware makes; injectable so tests make no network requests. */
export interface AuthKit {
  authorizationUrl(input: { clientId: string; organizationId: string; redirectUri: string; state: string; codeChallenge: string }): string;
  authenticateWithCode(input: { clientId: string; code: string; codeVerifier: string }): Promise<{
    organizationId?: string | null;
    user: { id: string; email: string; emailVerified: boolean };
  }>;
}

function nonEmpty(environment: Record<string, string | undefined>, name: string) {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

export function authConfig(environment: Record<string, string | undefined> = process.env): AuthConfig {
  const url = new URL(nonEmpty(environment, 'INSURANCE_BENCH_PUBLIC_URL'));
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('INSURANCE_BENCH_PUBLIC_URL must be an HTTPS origin without a path.');
  }
  const clientId = nonEmpty(environment, 'WORKOS_CLIENT_ID');
  if (!/^client_[A-Za-z0-9]{3,250}$/.test(clientId)) throw new Error('WORKOS_CLIENT_ID must be a WorkOS client ID.');
  const sessionSecret = nonEmpty(environment, 'INSURANCE_BENCH_SESSION_SECRET');
  if (sessionSecret.length < 32) throw new Error('INSURANCE_BENCH_SESSION_SECRET must be at least 32 characters.');
  return { appUrl: url.origin, apiKey: nonEmpty(environment, 'WORKOS_API_KEY'), clientId, sessionSecret };
}

export function workosAuthKit(apiKey: string): AuthKit {
  const workos = new WorkOS(apiKey);
  return {
    authorizationUrl: input => workos.userManagement.getAuthorizationUrl({ provider: 'authkit', codeChallengeMethod: 'S256', ...input }),
    authenticateWithCode: input => workos.userManagement.authenticateWithCode(input),
  };
}

function randomValue() {
  return base64url.encode(crypto.getRandomValues(new Uint8Array(32)));
}

async function sha256(value: string) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
}

async function encrypt(config: AuthConfig, payload: Record<string, unknown>, audience: string, lifetime: number) {
  const now = Math.floor(Date.now() / 1000);
  return new EncryptJWT(payload)
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM', typ: 'JWT' })
    .setIssuedAt(now).setIssuer(config.appUrl).setAudience(audience).setExpirationTime(now + lifetime)
    .encrypt(await sha256(config.sessionSecret));
}

async function decrypt(config: AuthConfig, value: string | undefined, audience: string) {
  if (!value) return undefined;
  try {
    return (await jwtDecrypt(value, await sha256(config.sessionSecret), { issuer: config.appUrl, audience })).payload;
  } catch {
    return undefined;
  }
}

export function safeReturnTo(value: string | null | undefined) {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') && !value.startsWith('/auth/') ? value : '/';
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

function cookie(request: Request, name: string) {
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const separator = part.indexOf('=');
    if (separator > 0 && part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim();
  }
  return undefined;
}

function setCookie(name: string, value: string, maxAge: number) {
  return `${name}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

function redirect(location: string, cookies: string[] = []) {
  const headers = new Headers({ Location: location, 'Cache-Control': 'no-store' });
  for (const value of cookies) headers.append('Set-Cookie', value);
  return new Response(null, { status: 302, headers });
}

function page(status: number, message: string, cookies: string[] = []) {
  const headers = new Headers({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  for (const value of cookies) headers.append('Set-Cookie', value);
  const body = `<!doctype html><meta charset="utf-8"><title>Insurance Bench</title><p>${message}</p><p><a href="/auth/login">Sign in with Sentanis</a></p>`;
  return new Response(body, { status, headers });
}

// Equivalent of next() from @vercel/functions, which sets only this header. That package is not
// a dependency because it pulls in a zod version with an open high-severity advisory.
function continueToStaticFile() {
  return new Response(null, { headers: { 'x-middleware-next': '1', 'Cache-Control': 'private, no-store' } });
}

export async function readSession(config: AuthConfig, request: Request) {
  const payload = await decrypt(config, cookie(request, SESSION_COOKIE), SESSION_AUDIENCE);
  return typeof payload?.subject === 'string' && payload.organizationId === SENTANIS_ORGANIZATION_ID ? payload : undefined;
}

export function createMiddleware(dependencies: { config?: () => AuthConfig; authKit?: (config: AuthConfig) => AuthKit } = {}) {
  return async function middleware(request: Request): Promise<Response> {
    let config: AuthConfig;
    try {
      config = (dependencies.config ?? authConfig)();
    } catch {
      return new Response('Insurance Bench staff sign-in is not configured.', { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
    const url = new URL(request.url);
    // Sign-in cookies are host-only, so always use the one public origin.
    if (url.origin !== config.appUrl) return redirect(new URL(url.pathname + url.search, config.appUrl).href);
    const authKit = (dependencies.authKit ?? (value => workosAuthKit(value.apiKey)))(config);

    if (url.pathname === '/auth/login') {
      const transaction = { state: randomValue(), codeVerifier: randomValue(), returnTo: safeReturnTo(url.searchParams.get('returnTo')) };
      const location = authKit.authorizationUrl({
        clientId: config.clientId,
        organizationId: SENTANIS_ORGANIZATION_ID,
        redirectUri: `${config.appUrl}/auth/callback`,
        state: transaction.state,
        codeChallenge: base64url.encode(await sha256(transaction.codeVerifier)),
      });
      return redirect(location, [setCookie(TRANSACTION_COOKIE, await encrypt(config, transaction, TRANSACTION_AUDIENCE, TRANSACTION_SECONDS), TRANSACTION_SECONDS)]);
    }

    if (url.pathname === '/auth/callback') {
      const clearTransaction = setCookie(TRANSACTION_COOKIE, '', 0);
      const transaction = await decrypt(config, cookie(request, TRANSACTION_COOKIE), TRANSACTION_AUDIENCE);
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      if (!code || !state || typeof transaction?.state !== 'string' || typeof transaction.codeVerifier !== 'string' ||
          !constantTimeEqual(state, transaction.state)) {
        return page(403, 'Sign-in could not be completed. Please try again.', [clearTransaction]);
      }
      try {
        const response = await authKit.authenticateWithCode({ clientId: config.clientId, code, codeVerifier: transaction.codeVerifier });
        if (response.organizationId !== SENTANIS_ORGANIZATION_ID || !response.user.emailVerified) throw new Error('Not Sentanis staff.');
        const session = await encrypt(config, { subject: response.user.id, email: response.user.email, organizationId: SENTANIS_ORGANIZATION_ID }, SESSION_AUDIENCE, SESSION_SECONDS);
        return redirect(new URL(safeReturnTo(typeof transaction.returnTo === 'string' ? transaction.returnTo : undefined), config.appUrl).href,
          [setCookie(SESSION_COOKIE, session, SESSION_SECONDS), clearTransaction]);
      } catch {
        return page(403, 'Insurance Bench is available to Sentanis staff only.', [clearTransaction]);
      }
    }

    if (url.pathname === '/auth/logout') {
      return page(200, 'You are signed out of Insurance Bench.', [setCookie(SESSION_COOKIE, '', 0)]);
    }

    if (await readSession(config, request)) return continueToStaticFile();
    return redirect(`${config.appUrl}/auth/login?returnTo=${encodeURIComponent(url.pathname + url.search)}`);
  };
}

export default createMiddleware();
