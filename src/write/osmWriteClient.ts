import type { Coordinates } from '../types/location';

const API_ROOT = 'https://api.openstreetmap.org/api/0.6';

export class OsmWriteError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly outcome: 'failed' | 'unknown' = 'failed',
  ) {
    super(message);
  }
}

export interface UnknownNodeCreation {
  changesetId: number;
  coordinates: Coordinates;
  tags: Readonly<Record<string, string>>;
}

export class OsmWriteUnknownResultError extends OsmWriteError {
  constructor(readonly attemptedNode: UnknownNodeCreation) {
    super(
      `nodeの作成結果を確認できませんでした（changeset ${attemptedNode.changesetId}）。重複登録を避けるため再送しないでください。`,
      undefined,
      'unknown',
    );
  }
}

export interface CreatedConvenience {
  outcome: 'success';
  changesetId: number;
  nodeId: number;
}

export class OsmWriteClient {
  constructor(
    private readonly fetch: typeof globalThis.fetch,
    private readonly apiRoot = API_ROOT,
  ) {}

  async createConvenience(
    token: string,
    coordinates: Coordinates,
    tags: Readonly<Record<string, string>>,
  ): Promise<CreatedConvenience> {
    let changesetId: number | null = null;
    let result: CreatedConvenience | null = null;
    let failure: unknown;
    try {
      changesetId = await this.createChangeset(token);
      let nodeId: number;
      try {
        nodeId = await this.createNode(token, changesetId, coordinates, tags);
      } catch (error) {
        if (error instanceof OsmWriteError && error.status !== undefined)
          throw error;
        throw new OsmWriteUnknownResultError({
          changesetId,
          coordinates: { ...coordinates },
          tags: { ...tags },
        });
      }
      result = { outcome: 'success', changesetId, nodeId };
    } catch (error) {
      failure = error;
    }

    if (changesetId !== null) {
      try {
        await this.request(token, `/changeset/${changesetId}/close`, 'PUT');
      } catch (closeError) {
        if (!failure && result) {
          failure = new OsmWriteError(
            `node ${result.nodeId} は登録済みですが、changesetを閉じられませんでした。重複を避けるため再送しないでください。`,
            closeError instanceof OsmWriteError ? closeError.status : undefined,
          );
        }
      }
    }
    if (failure) throw failure;
    if (!result) throw new OsmWriteError('OSMへの登録を完了できませんでした。');
    return result;
  }

  private async createChangeset(token: string): Promise<number> {
    const xml = osmXml(
      `<changeset><tag k="created_by" v="OSM Quick POI"/><tag k="comment" v="コンビニを追加"/></changeset>`,
    );
    const response = await this.request(token, '/changeset/create', 'PUT', xml);
    return parseId(await response.text());
  }

  private async createNode(
    token: string,
    changesetId: number,
    coordinates: Coordinates,
    tags: Readonly<Record<string, string>>,
  ): Promise<number> {
    const tagXml = Object.entries(tags)
      .map(
        ([key, value]) =>
          `<tag k="${escapeXml(key)}" v="${escapeXml(value)}"/>`,
      )
      .join('');
    const xml = osmXml(
      `<node changeset="${changesetId}" lat="${coordinates.latitude}" lon="${coordinates.longitude}">${tagXml}</node>`,
    );
    const response = await this.request(token, '/nodes', 'POST', xml);
    return parseId(await response.text());
  }

  private async request(
    token: string,
    path: string,
    method: 'POST' | 'PUT',
    body?: string,
  ): Promise<Response> {
    const response = await this.fetch(`${this.apiRoot}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'text/xml; charset=utf-8' } : {}),
      },
      body,
    });
    if (!response.ok) {
      throw new OsmWriteError(
        response.status === 401
          ? 'OSMログインが無効です。再度ログインしてください。'
          : response.status === 403
            ? 'OSMの書き込み権限がありません。一度ログアウトし、再度ログインしてください。'
            : `OSMへの登録に失敗しました（HTTP ${response.status}）。`,
        response.status,
      );
    }
    return response;
  }
}

function osmXml(content: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><osm version="0.6" generator="OSM Quick POI">${content}</osm>`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function parseId(value: string): number {
  const id = Number(value.trim());
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new OsmWriteError('OSMから不正なIDが返されました。');
  }
  return id;
}
