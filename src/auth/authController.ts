import type { AuthState, StoredToken, TokenStorage } from './authTypes';
import { AuthRequestError, OsmAuthClient } from './osmAuthClient';

type Listener = (state: Readonly<AuthState>) => void;

export class AuthController {
  private token: StoredToken | null = null;
  private state: AuthState = {
    status: 'loading',
    displayName: null,
    message: 'ログイン状態を確認中…',
  };
  private readonly listeners = new Set<Listener>();

  constructor(
    private readonly client: OsmAuthClient,
    private readonly storage: TokenStorage,
    private readonly redirect: (url: string) => void,
    private readonly now: () => number = Date.now,
    private readonly replaceUrl: (url: string) => void = (url) =>
      history.replaceState(null, '', url),
  ) {}

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  async initialize(url: URL): Promise<void> {
    const error = url.searchParams.get('error');
    if (error) {
      this.clearCallback(url);
      this.update({
        status: 'error',
        displayName: null,
        message:
          error === 'access_denied'
            ? 'OSMログインはキャンセルされました。'
            : 'OSM認証に失敗しました。もう一度お試しください。',
      });
      return;
    }

    if (url.searchParams.has('code')) {
      this.update({ status: 'loading', message: 'OSMログインを完了中…' });
      try {
        const token = await this.client.exchangeCallback(url.searchParams);
        await this.storage.set(token);
        this.clearCallback(url);
        await this.loadUser(token);
      } catch (caught) {
        await this.storage.clear();
        this.clearCallback(url);
        this.update({
          status: 'error',
          displayName: null,
          message: authErrorMessage(caught),
        });
      }
      return;
    }

    try {
      const token = await this.storage.get();
      if (!token) {
        this.updateAnonymous();
      } else if (token.expiresAt !== null && token.expiresAt <= this.now()) {
        await this.expire();
      } else {
        await this.loadUser(token);
      }
    } catch {
      this.update({
        status: 'error',
        displayName: null,
        message: '保存したログイン情報を読み込めませんでした。',
      });
    }
  }

  async login(redirectUri: string): Promise<void> {
    this.update({
      status: 'authorizing',
      displayName: null,
      message: 'OSMへ移動します…',
    });
    try {
      this.redirect(await this.client.createAuthorizationUrl(redirectUri));
    } catch (caught) {
      this.update({
        status: 'error',
        displayName: null,
        message: authErrorMessage(caught),
      });
    }
  }

  async logout(): Promise<void> {
    await this.storage.clear();
    this.token = null;
    this.updateAnonymous('OSMからログアウトしました。');
  }

  getAccessToken(): string | null {
    return this.state.status === 'authenticated'
      ? (this.token?.accessToken ?? null)
      : null;
  }

  async handleUnauthorized(): Promise<void> {
    await this.expire();
  }

  private async loadUser(token: StoredToken): Promise<void> {
    try {
      const displayName = await this.client.fetchDisplayName(token.accessToken);
      this.token = token;
      this.update({
        status: 'authenticated',
        displayName,
        message: `${displayName} としてログイン中`,
      });
    } catch (caught) {
      if (caught instanceof AuthRequestError && caught.status === 401) {
        await this.expire();
        return;
      }
      this.update({
        status: 'error',
        displayName: null,
        message: authErrorMessage(caught),
      });
    }
  }

  private async expire(): Promise<void> {
    await this.storage.clear();
    this.token = null;
    this.update({
      status: 'expired',
      displayName: null,
      message: 'OSMログインの有効期限が切れました。再度ログインしてください。',
    });
  }

  private updateAnonymous(message = 'OSMアカウントでログインできます。'): void {
    this.update({ status: 'anonymous', displayName: null, message });
  }

  private update(patch: Partial<AuthState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener(this.state));
  }

  private clearCallback(url: URL): void {
    url.searchParams.delete('code');
    url.searchParams.delete('state');
    url.searchParams.delete('error');
    url.searchParams.delete('error_description');
    this.replaceUrl(`${url.pathname}${url.search}${url.hash}`);
  }
}

function authErrorMessage(error: unknown): string {
  return error instanceof AuthRequestError
    ? error.message
    : 'OSM認証中に通信エラーが発生しました。もう一度お試しください。';
}
