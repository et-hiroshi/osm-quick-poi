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

export class OverpassError extends Error {
  constructor(
    public readonly kind: 'network' | 'http' | 'timeout' | 'invalid',
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
    private readonly endpoint: string,
    private readonly timeoutMilliseconds: number,
    private readonly fetcher: Fetcher = fetch,
  ) {}

  async search(
    center: Coordinates,
    radiusMeters: number,
    externalSignal: AbortSignal,
  ): Promise<ConveniencePoi[]> {
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
      const response = await this.fetcher(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        },
        body: new URLSearchParams({
          data: buildConvenienceQuery(center, radiusMeters),
        }),
        signal: controller.signal,
      });
      if (!response.ok) throw new OverpassError('http');

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new OverpassError('invalid');
      }
      return parseConvenienceResponse(payload, center);
    } catch (error) {
      if (timedOut) throw new OverpassError('timeout');
      if (externalSignal.aborted) throw error;
      if (error instanceof OverpassError) throw error;
      throw new OverpassError('network');
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
  if (!isResponse(payload)) throw new OverpassError('invalid');

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
    case 'timeout':
      return '周辺検索が時間切れになりました。しばらくしてから再試行してください。';
    case 'http':
      return '周辺検索サービスが応答できませんでした。しばらくしてから再試行してください。';
    case 'invalid':
      return '周辺検索の応答を読み取れませんでした。もう一度お試しください。';
    case 'network':
      return '通信できないため周辺を検索できませんでした。接続をご確認ください。';
  }
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
