import assert from 'node:assert/strict';
import test from 'node:test';
import { authConfig, createMiddleware, safeReturnTo, SENTANIS_ORGANIZATION_ID, SESSION_COOKIE, TRANSACTION_COOKIE, type AuthConfig, type AuthKit } from '../middleware.ts';

const APP = 'https://insurancebench.sentanis.ai';
const CONFIG: AuthConfig = { appUrl: APP, apiKey: 'sk_test_unused', clientId: 'client_01TEST', sessionSecret: 's'.repeat(40) };

function fakeAuthKit(result: Awaited<ReturnType<AuthKit['authenticateWithCode']>>) {
  const calls: unknown[] = [];
  const authKit: AuthKit = {
    authorizationUrl: input => { calls.push(input); return `https://api.workos.com/user_management/authorize?state=${input.state}`; },
    authenticateWithCode: async input => { calls.push(input); return result; },
  };
  return { authKit, calls };
}

const staff = { organizationId: SENTANIS_ORGANIZATION_ID, user: { id: 'user_01STAFF', email: 'staff@sentanis.ai', emailVerified: true } };

function cookieValue(response: Response, name: string) {
  const header = response.headers.getSetCookie().find(value => value.startsWith(`${name}=`));
  return header?.slice(name.length + 1).split(';')[0];
}

async function signIn(result: Awaited<ReturnType<AuthKit['authenticateWithCode']>> = staff, returnTo = '/self-runs/') {
  const { authKit, calls } = fakeAuthKit(result);
  const middleware = createMiddleware({ config: () => CONFIG, authKit: () => authKit });
  const login = await middleware(new Request(`${APP}/auth/login?returnTo=${encodeURIComponent(returnTo)}`));
  const transaction = cookieValue(login, TRANSACTION_COOKIE)!;
  const state = new URL(login.headers.get('location')!).searchParams.get('state')!;
  const callback = await middleware(new Request(`${APP}/auth/callback?code=code_1&state=${state}`, { headers: { cookie: `${TRANSACTION_COOKIE}=${transaction}` } }));
  return { middleware, login, callback, calls, state, transaction };
}

test('an anonymous request for any file is sent to staff sign-in, never served', async () => {
  const middleware = createMiddleware({ config: () => CONFIG, authKit: () => fakeAuthKit(staff).authKit });
  for (const path of ['/', '/index.html', '/scores.json', '/assets/composite.js', '/self-runs/selfrun-data.json']) {
    const response = await middleware(new Request(`${APP}${path}`));
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), `${APP}/auth/login?returnTo=${encodeURIComponent(path)}`);
    assert.equal(response.headers.get('x-middleware-next'), null);
  }
});

test('sign-in is pinned to the Sentanis organization with PKCE and the exact callback', async () => {
  const { login, calls } = await signIn();
  assert.equal(login.status, 302);
  const request = calls[0] as Record<string, string>;
  assert.equal(request.organizationId, SENTANIS_ORGANIZATION_ID);
  assert.equal(request.clientId, 'client_01TEST');
  assert.equal(request.redirectUri, `${APP}/auth/callback`);
  assert.match(request.codeChallenge, /^[A-Za-z0-9_-]{43}$/);
  const transaction = login.headers.getSetCookie().find(value => value.startsWith(`${TRANSACTION_COOKIE}=`))!;
  assert.match(transaction, /HttpOnly; Secure; SameSite=Lax/);
});

test('a Sentanis staff member is signed in, returned to the page, and then served files', async () => {
  const { middleware, callback } = await signIn();
  assert.equal(callback.status, 302);
  assert.equal(callback.headers.get('location'), `${APP}/self-runs/`);
  const session = cookieValue(callback, SESSION_COOKIE)!;
  assert.ok(session.length > 20);
  assert.equal(cookieValue(callback, TRANSACTION_COOKIE), '');
  const file = await middleware(new Request(`${APP}/scores.json`, { headers: { cookie: `${SESSION_COOKIE}=${session}` } }));
  assert.equal(file.headers.get('x-middleware-next'), '1');
  assert.equal(file.headers.get('cache-control'), 'private, no-store');
});

test('other organizations, unverified emails, and forged state are refused without a session', async () => {
  for (const result of [
    { ...staff, organizationId: 'org_01OTHER' },
    { ...staff, organizationId: null },
    { ...staff, user: { ...staff.user, emailVerified: false } },
  ]) {
    const { callback } = await signIn(result);
    assert.equal(callback.status, 403);
    assert.equal(cookieValue(callback, SESSION_COOKIE), undefined);
  }
  const { middleware, transaction } = await signIn();
  const forged = await middleware(new Request(`${APP}/auth/callback?code=code_1&state=forged`, { headers: { cookie: `${TRANSACTION_COOKIE}=${transaction}` } }));
  assert.equal(forged.status, 403);
  const missing = await middleware(new Request(`${APP}/auth/callback?code=code_1&state=forged`));
  assert.equal(missing.status, 403);
});

test('a tampered or foreign session cookie is not accepted', async () => {
  const { callback } = await signIn();
  const session = cookieValue(callback, SESSION_COOKIE)!;
  const other = createMiddleware({ config: () => ({ ...CONFIG, sessionSecret: 'x'.repeat(40) }), authKit: () => fakeAuthKit(staff).authKit });
  assert.equal((await other(new Request(`${APP}/`, { headers: { cookie: `${SESSION_COOKIE}=${session}` } }))).status, 302);
  const middleware = createMiddleware({ config: () => CONFIG, authKit: () => fakeAuthKit(staff).authKit });
  const tampered = session.slice(0, -2) + (session.endsWith('A') ? 'BB' : 'AA');
  assert.equal((await middleware(new Request(`${APP}/`, { headers: { cookie: `${SESSION_COOKIE}=${tampered}` } }))).status, 302);
});

test('return paths cannot leave the site and other hosts are sent to the public origin', async () => {
  assert.equal(safeReturnTo('//evil.example/x'), '/');
  assert.equal(safeReturnTo('https://evil.example/'), '/');
  assert.equal(safeReturnTo('/\\evil'), '/');
  assert.equal(safeReturnTo('/auth/callback'), '/');
  assert.equal(safeReturnTo('/research.html?x=1'), '/research.html?x=1');
  const middleware = createMiddleware({ config: () => CONFIG, authKit: () => fakeAuthKit(staff).authKit });
  const response = await middleware(new Request('https://insurance-bench-sentanis.vercel.app/research.html'));
  assert.equal(response.headers.get('location'), `${APP}/research.html`);
});

test('sign-out clears the session; missing configuration fails closed', async () => {
  const middleware = createMiddleware({ config: () => CONFIG, authKit: () => fakeAuthKit(staff).authKit });
  const logout = await middleware(new Request(`${APP}/auth/logout`));
  assert.equal(cookieValue(logout, SESSION_COOKIE), '');
  const unconfigured = createMiddleware({ config: () => authConfig({}) });
  const response = await unconfigured(new Request(`${APP}/`));
  assert.equal(response.status, 503);
  assert.throws(() => authConfig({ INSURANCE_BENCH_PUBLIC_URL: 'http://insurancebench.sentanis.ai', WORKOS_API_KEY: 'k', WORKOS_CLIENT_ID: 'client_01X', INSURANCE_BENCH_SESSION_SECRET: 's'.repeat(40) }), /HTTPS/);
  assert.throws(() => authConfig({ INSURANCE_BENCH_PUBLIC_URL: APP, WORKOS_API_KEY: 'k', WORKOS_CLIENT_ID: 'client_01X', INSURANCE_BENCH_SESSION_SECRET: 'short' }), /32/);
});
