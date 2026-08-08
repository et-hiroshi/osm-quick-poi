import type { StoredToken } from './authTypes';
import { createCodeChallenge, randomUrlSafeString } from './pkce';

const AUTHORIZE_URL = 'https://www.openstreetmap.org/oauth2/authorize';
const TOKEN_URL = 'https://www.openstreetmap.org/oauth2/token';
const USER_URL = 'https://api.openstreetmap.org/api/0.6/user/details.json';
const FLOW_KEY = 'osm-oauth-pkce';

interface PendingFlow {
  state: string;
  verifier: string;
  redirectUri: string;
}

export class AuthRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

export class OsmAuthClient {
  constructor(
    private readonly clientId: string,
    private readonly session: Storage,
    private readonly crypto: Crypto,
    private readonly fetch: typeof globalThis.fetch,
    private readonly now: () => number = Date.now,
  ) {}

  isConfigured(): boolean {
    return this.clientId.length > 0;
  }

  async createAuthorizationUrl(redirectUri: string): Promise<string> {
    if (!this.isConfigured())
      throw new AuthRequestError('OAuth設定がありません。');
    const state = randomUrlSafeString(this.crypto);
    const verifier = randomUrlSafeString(this.crypto, 64);
    const challenge = await createCodeChallenge(this.crypto, verifier);
    this.session.setItem(
      FLOW_KEY,
      JSON.stringify({ state, verifier, redirectUri } satisfies PendingFlow),
    );

    const url = new URL(AUTHORIZE_URL);
    url.search = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'read_prefs write_api',
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    }).toString();
    return url.toString();
  }

  async exchangeCallback(params: URLSearchParams): Promise<StoredToken> {
    const rawFlow = this.session.getItem(FLOW_KEY);
    this.session.removeItem(FLOW_KEY);
    const flow = parsePendingFlow(rawFlow);
    const code = params.get('code');
    const state = params.get('state');
    if (!flow || !code || !state || state !== flow.state) {
      throw new AuthRequestError(
        '認証結果を確認できませんでした。もう一度お試しください。',
      );
    }

    const response = await this.fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: this.clientId,
        redirect_uri: flow.redirectUri,
        code_verifier: flow.verifier,
      }),
    });
    if (!response.ok) {
      throw new AuthRequestError(
        'OSM認証を完了できませんでした。',
        response.status,
      );
    }
    const body: unknown = await response.json();
    if (!body || typeof body !== 'object') {
      throw new AuthRequestError('OSMから不正な認証応答を受信しました。');
    }
    const token = body as Record<string, unknown>;
    if (typeof token.access_token !== 'string') {
      throw new AuthRequestError(
        'OSMからアクセストークンを取得できませんでした。',
      );
    }
    const expiresIn =
      typeof token.expires_in === 'number' ? token.expires_in : null;
    return {
      accessToken: token.access_token,
      expiresAt: expiresIn === null ? null : this.now() + expiresIn * 1000,
    };
  }

  async fetchDisplayName(accessToken: string): Promise<string> {
    const response = await this.fetch(USER_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      throw new AuthRequestError(
        response.status === 401
          ? 'OSMログインの有効期限が切れました。再度ログインしてください。'
          : 'OSMのユーザー情報を取得できませんでした。',
        response.status,
      );
    }
    const body: unknown = await response.json();
    const user = readUser(body);
    if (!user) throw new AuthRequestError('OSMのユーザー情報が不正です。');
    return user;
  }
}

function parsePendingFlow(raw: string | null): PendingFlow | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return null;
    const flow = value as Record<string, unknown>;
    if (
      typeof flow.state !== 'string' ||
      typeof flow.verifier !== 'string' ||
      typeof flow.redirectUri !== 'string'
    )
      return null;
    return flow as unknown as PendingFlow;
  } catch {
    return null;
  }
}

function readUser(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const user = (body as Record<string, unknown>).user;
  if (!user || typeof user !== 'object') return null;
  const displayName = (user as Record<string, unknown>).display_name;
  return typeof displayName === 'string' && displayName.length > 0
    ? displayName
    : null;
}
