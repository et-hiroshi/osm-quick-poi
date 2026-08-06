import type { ConveniencePoi, OsmObjectType } from '../types/convenience';
import type { Coordinates } from '../types/location';
import { distanceMeters } from './distance';

interface OverpassElement {
  type?: unknown;
  id?: unknown;
  lat?: unknown;
  lon?: unknown;
  center?: { lat?: unknown; lon?: unknown };
  tags?: Record<string, unknown>;
}

interface OverpassResponse {
  elements?: unknown;
}

export type Fetcher = typeof fetch;

export type OverpassErrorKind =
  'busy' | 'bad-request' | 'timeout' | 'network' | 'invalid-json' | 'http';

export class OverpassError extends Error {
  constructor(
    public readonly kind: OverpassErrorKind,
    public readonly endpoint: string | null = null,
    public readonly status: number | null = null,
  ) {
    super(kind);
  }
}

export interface ConvenienceSearchService {
  search(
    center: Coordinates,
    radiusMeters: number,
    signal: AbortSignal,
  ): Promise<ConveniencePoi[]>;
}

export class OverpassClient implements ConvenienceSearchService {
  constructor(
    private readonly endpoints: readonly string[],
    private readonly timeoutMilliseconds: number,
    private readonly fetcher: Fetcher = fetch,
  ) {
    if (endpoints.length === 0)
      throw new Error('At least one Overpass endpoint is required');
  }

  async search(
    center: Coordinates,
    radiusMeters: number,
    externalSignal: AbortSignal,
  ): Promise<ConveniencePoi[]> {
    let lastError: unknown;
    for (let index = 0; index < this.endpoints.length; index += 1) {
      const endpoint = this.endpoints[index];
      try {
        return await this.requestEndpoint(
          endpoint,
          center,
          radiusMeters,
          externalSignal,
        );
      } catch (error) {
        if (externalSignal.aborted) throw error;
        lastError = error;
        const hasFallback = index + 1 < this.endpoints.length;
        if (!hasFallback || !isFallbackEligible(error)) throw error;
      }
    }
    throw lastError;
  }

  private async requestEndpoint(
    endpoint: string,
    center: Coordinates,
    radiusMeters: number,
    externalSignal: AbortSignal,
  ): Promise<ConveniencePoi[]> {
    if (externalSignal.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    const controller = new AbortController();
    let timedOut = false;
    const abort = () => controller.abort();
    externalSignal.addEventListener('abort', abort, { once: true });
    if (externalSignal.aborted) controller.abort();
    const timeout = globalThis.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeoutMilliseconds);

    try {
      const response = await this.fetcher(endpoint, {
        method: 'POST',
        body: new URLSearchParams({
          data: buildConvenienceQuery(center, radiusMeters),
        }),
        signal: controller.signal,
      });
      if (!response.ok) throw httpError(endpoint, response.status);

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new OverpassError('invalid-json', endpoint, response.status);
      }
      return parseConvenienceResponse(payload, center);
    } catch (error) {
      if (timedOut) throw new OverpassError('timeout', endpoint);
      if (externalSignal.aborted) throw error;
      if (error instanceof OverpassError) throw error;
      throw new OverpassError('network', endpoint);
    } finally {
      globalThis.clearTimeout(timeout);
      externalSignal.removeEventListener('abort', abort);
    }
  }
}

export function buildConvenienceQuery(
  center: Coordinates,
  radiusMeters: number,
): string {
  const around = `around:${radiusMeters},${center.latitude},${center.longitude}`;
  return `[out:json][timeout:20];\n(\n  node(${around})["shop"="convenience"];\n  way(${around})["shop"="convenience"];\n  relation(${around})["shop"="convenience"];\n);\nout center tags;`;
}

export function parseConvenienceResponse(
  payload: unknown,
  searchCenter: Coordinates,
): ConveniencePoi[] {
  if (!isResponse(payload)) throw new OverpassError('invalid-json');

  return payload.elements
    .map((element) => toConveniencePoi(element, searchCenter))
    .filter((poi): poi is ConveniencePoi => poi !== null)
    .sort((left, right) => left.distanceMeters - right.distanceMeters);
}

export function overpassErrorMessage(error: unknown): string {
  if (!(error instanceof OverpassError)) {
    return '周辺検索に失敗しました。もう一度お試しください。';
  }
  switch (error.kind) {
    case 'busy':
      return '検索サービスが混雑しています。しばらくしてから再試行してください。';
    case 'bad-request':
      return '検索要求が不正です。地図を少し動かして再試行してください。';
    case 'timeout':
      return '検索がタイムアウトしました。しばらくしてから再試行してください。';
    case 'http':
      return '周辺検索サービスが応答できませんでした。しばらくしてから再試行してください。';
    case 'invalid-json':
      return '周辺検索の応答を読み取れませんでした。もう一度お試しください。';
    case 'network':
      return '検索サービスへ接続できません。しばらくしてから再試行してください。';
  }
}

function isFallbackEligible(error: unknown): boolean {
  return (
    error instanceof OverpassError &&
    // Browsers intentionally expose CORS, DNS, TLS, and offline failures as
    // the same fetch rejection.  An endpoint-specific CORS or network issue
    // must therefore be allowed to advance to the next public endpoint.
    (error.kind === 'busy' ||
      error.kind === 'timeout' ||
      error.kind === 'network')
  );
}

function httpError(endpoint: string, status: number): OverpassError {
  if (status === 400) return new OverpassError('bad-request', endpoint, status);
  if ([429, 502, 503, 504].includes(status)) {
    return new OverpassError('busy', endpoint, status);
  }
  return new OverpassError('http', endpoint, status);
}

function isResponse(
  payload: unknown,
): payload is { elements: OverpassElement[] } {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    Array.isArray((payload as OverpassResponse).elements)
  );
}

function toConveniencePoi(
  element: OverpassElement,
  searchCenter: Coordinates,
): ConveniencePoi | null {
  if (!isOsmType(element.type) || !isFiniteNumber(element.id)) return null;
  const coordinates = elementCoordinates(element);
  if (!coordinates) return null;

  return {
    osmType: element.type,
    osmId: element.id,
    coordinates,
    name: stringTag(element.tags, 'name') ?? '名称未登録',
    brand: stringTag(element.tags, 'brand'),
    distanceMeters: distanceMeters(searchCenter, coordinates),
  };
}

function elementCoordinates(element: OverpassElement): Coordinates | null {
  const latitude = element.type === 'node' ? element.lat : element.center?.lat;
  const longitude = element.type === 'node' ? element.lon : element.center?.lon;
  return isFiniteNumber(latitude) && isFiniteNumber(longitude)
    ? { latitude, longitude }
    : null;
}

function isOsmType(value: unknown): value is OsmObjectType {
  return value === 'node' || value === 'way' || value === 'relation';
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function stringTag(
  tags: Record<string, unknown> | undefined,
  key: string,
): string | null {
  const value = tags?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
