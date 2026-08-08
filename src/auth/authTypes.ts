export type AuthStatus =
  | 'anonymous'
  | 'authorizing'
  | 'loading'
  | 'authenticated'
  | 'error'
  | 'expired';

export interface AuthState {
  status: AuthStatus;
  displayName: string | null;
  message: string;
}

export interface StoredToken {
  accessToken: string;
  expiresAt: number | null;
}

export interface TokenStorage {
  get(): Promise<StoredToken | null>;
  set(token: StoredToken): Promise<void>;
  clear(): Promise<void>;
}
