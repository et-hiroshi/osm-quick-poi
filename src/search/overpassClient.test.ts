import { describe, expect, it, vi } from 'vitest';
import type { Fetcher } from './overpassClient';
import {
  buildConvenienceQuery,
  OverpassClient,
  OverpassError,
  parseConvenienceResponse,
} from './overpassClient';

const center = { latitude: 33.590355, longitude: 130.401716 };

describe('Overpass convenience search', () => {
  it('builds a query for node, way and relation around the central pin', () => {
    const query = buildConvenienceQuery(center, 50);
    expect(query).toContain('node(around:50,33.590355,130.401716)');
    expect(query).toContain('way(around:50,33.590355,130.401716)');
    expect(query).toContain('relation(around:50,33.590355,130.401716)');
    expect(query).toContain('["shop"="convenience"]');
    expect(query).toContain('out center tags');
  });

  it('converts all OSM object types, uses centers, defaults names and sorts by distance', () => {
    const results = parseConvenienceResponse(
      {
        elements: [
          {
            type: 'relation',
            id: 30,
            center: { lat: 33.591, lon: 130.401716 },
            tags: { name: '遠い店' },
          },
          {
            type: 'way',
            id: 20,
            center: { lat: 33.590455, lon: 130.401716 },
            tags: { brand: 'テストブランド' },
          },
          {
            type: 'node',
            id: 10,
            lat: 33.590555,
            lon: 130.401716,
            tags: { name: 'ノード店' },
          },
          { type: 'way', id: 40, tags: { name: '位置なし' } },
        ],
      },
      center,
    );

    expect(results.map(({ osmType, osmId }) => [osmType, osmId])).toEqual([
      ['way', 20],
      ['node', 10],
      ['relation', 30],
    ]);
    expect(results[0]).toMatchObject({
      coordinates: { latitude: 33.590455, longitude: 130.401716 },
      name: '名称未登録',
      brand: 'テストブランド',
    });
    expect(results[0].distanceMeters).toBeLessThan(results[1].distanceMeters);
  });

  it('rejects invalid response JSON shapes', () => {
    expect(() => parseConvenienceResponse({ remark: 'busy' }, center)).toThrow(
      OverpassError,
    );
  });

  it('transitions a stalled request to a timeout error', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
    ) as unknown as Fetcher;
    const client = new OverpassClient('https://example.test/api', 100, fetcher);
    const request = client.search(center, 50, new AbortController().signal);
    const expectation = expect(request).rejects.toMatchObject({
      kind: 'timeout',
    });
    await vi.advanceTimersByTimeAsync(100);
    await expectation;
    vi.useRealTimers();
  });
});
