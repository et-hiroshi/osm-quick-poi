import type { StoredToken, TokenStorage } from './authTypes';

const DATABASE = 'osm-quick-poi-auth';
const STORE = 'credentials';
const TOKEN_KEY = 'osm-access-token';

export class IndexedDbTokenStorage implements TokenStorage {
  constructor(private readonly indexedDb: IDBFactory = indexedDB) {}

  async get(): Promise<StoredToken | null> {
    const result = await this.request('readonly', (store) =>
      store.get(TOKEN_KEY),
    );
    return isStoredToken(result) ? result : null;
  }

  async set(token: StoredToken): Promise<void> {
    await this.request('readwrite', (store) => store.put(token, TOKEN_KEY));
  }

  async clear(): Promise<void> {
    await this.request('readwrite', (store) => store.delete(TOKEN_KEY));
  }

  private async request(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest,
  ): Promise<unknown> {
    const database = await openDatabase(this.indexedDb);
    try {
      return await new Promise((resolve, reject) => {
        const transaction = database.transaction(STORE, mode);
        const request = operation(transaction.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        transaction.onabort = () => reject(transaction.error);
      });
    } finally {
      database.close();
    }
  }
}

function openDatabase(indexedDb: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDb.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function isStoredToken(value: unknown): value is StoredToken {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.accessToken === 'string' &&
    (candidate.expiresAt === null || typeof candidate.expiresAt === 'number')
  );
}
