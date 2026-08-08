import { describe, expect, it, vi } from 'vitest';
import { AuthController } from './authController';
import type { AuthState, StoredToken, TokenStorage } from './authTypes';
import { OsmAuthClient } from './osmAuthClient';

class MemoryTokenStorage implements TokenStorage {
  constructor(public token: StoredToken | null = null) {}
  async get(): Promise<StoredToken | null> {
    return this.token;
  }
  async set(token: StoredToken): Promise<void> {
    this.token = token;
  }
  async clear(): Promise<void> {
    this.token = null;
  }
}

class MemorySessionStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number {
    return this.values.size;
  }
  clear(): void {
    this.values.clear();
  }
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.values.delete(key);
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function createHarness(
  fetchImplementation: typeof fetch,
  token: StoredToken | null = null,
  now = 1_000,
) {
  const storage = new MemoryTokenStorage(token);
  const session = new MemorySessionStorage();
  const redirect = vi.fn();
  const replaceUrl = vi.fn();
  const client = new OsmAuthClient(
    'client-id',
    session,
    globalThis.crypto,
    fetchImplementation,
    () => now,
  );
  const controller = new AuthController(
    client,
    storage,
    redirect,
    () => now,
    replaceUrl,
  );
  let state: Readonly<AuthState> | null = null;
  controller.subscribe((next) => {
    state = next;
  });
  return {
    client,
    controller,
    redirect,
    replaceUrl,
    session,
    storage,
    state: () => state as unknown as Readonly<AuthState>,
  };
}

describe('AuthController', () => {
  it('PKCEで初回ログインし、コールバック後にユーザー名を表示する', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.includes('/oauth2/token')) {
        return Response.json({ access_token: 'new-token', expires_in: 3600 });
      }
      return Response.json({ user: { display_name: 'mapper' } });
    });
    const harness = createHarness(fetchMock);
    const redirectUri = 'https://example.test/osm-quick-poi/';

    await harness.controller.login(redirectUri);
    const authorizationUrl = new URL(String(harness.redirect.mock.calls[0][0]));
    expect(authorizationUrl.searchParams.get('code_challenge_method')).toBe(
      'S256',
    );
    expect(authorizationUrl.searchParams.get('scope')).toBe(
      'read_prefs write_api',
    );

    const callback = new URL(redirectUri);
    callback.searchParams.set('code', 'authorization-code');
    callback.searchParams.set(
      'state',
      authorizationUrl.searchParams.get('state') ?? '',
    );
    await harness.controller.initialize(callback);

    expect(harness.storage.token?.accessToken).toBe('new-token');
    expect(harness.state()).toMatchObject({
      status: 'authenticated',
      displayName: 'mapper',
    });
    expect(harness.controller.getAccessToken()).toBe('new-token');
    const tokenRequest = fetchMock.mock.calls[0][1];
    expect(String(tokenRequest?.body)).toContain('code_verifier=');
  });

  it('リロード後に保存トークンでログインを維持する', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({ user: { display_name: 'reloaded-user' } }),
    );
    const harness = createHarness(fetchMock, {
      accessToken: 'saved-token',
      expiresAt: null,
    });

    await harness.controller.initialize(new URL('https://example.test/app/'));

    expect(harness.state()).toMatchObject({
      status: 'authenticated',
      displayName: 'reloaded-user',
    });
    expect(fetchMock.mock.calls[0][1]?.headers).toEqual({
      Authorization: 'Bearer saved-token',
    });
  });

  it('ログアウト時に保存トークンを削除する', async () => {
    const harness = createHarness(vi.fn(), {
      accessToken: 'saved-token',
      expiresAt: null,
    });

    await harness.controller.logout();

    expect(harness.storage.token).toBeNull();
    expect(harness.state().status).toBe('anonymous');
  });

  it('期限切れトークンを削除して再ログインを案内する', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const harness = createHarness(
      fetchMock,
      { accessToken: 'expired-token', expiresAt: 999 },
      1_000,
    );

    await harness.controller.initialize(new URL('https://example.test/app/'));

    expect(harness.storage.token).toBeNull();
    expect(harness.state().status).toBe('expired');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('APIの401を失効として処理する', async () => {
    const fetchMock = vi.fn<typeof fetch>(
      async () => new Response(null, { status: 401 }),
    );
    const harness = createHarness(fetchMock, {
      accessToken: 'revoked-token',
      expiresAt: null,
    });

    await harness.controller.initialize(new URL('https://example.test/app/'));

    expect(harness.storage.token).toBeNull();
    expect(harness.state().status).toBe('expired');
  });

  it('認証キャンセルとstate不一致を安全に処理する', async () => {
    const cancelled = createHarness(vi.fn());
    await cancelled.controller.initialize(
      new URL('https://example.test/app/?error=access_denied'),
    );
    expect(cancelled.state()).toMatchObject({
      status: 'error',
      message: 'OSMログインはキャンセルされました。',
    });

    const invalid = createHarness(vi.fn());
    await invalid.controller.initialize(
      new URL('https://example.test/app/?code=code&state=invalid'),
    );
    expect(invalid.storage.token).toBeNull();
    expect(invalid.state().status).toBe('error');
  });
});
