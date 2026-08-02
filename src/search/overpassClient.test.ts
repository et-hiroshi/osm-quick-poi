import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Fetcher } from './overpassClient';
import {
  buildConvenienceQuery,
  OverpassClient,
  OverpassError,
  overpassErrorMessage,
  parseConvenienceResponse,
} from './overpassClient';

const center = { latitude: 33.590355, longitude: 130.401716 };
const endpoints = ['https://primary.test/api', 'https://fallback.test/api'];

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => vi.useRealTimers());

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

  it.each([
    ['busy', '検索サービスが混雑しています'],
    ['bad-request', '検索要求が不正です'],
    ['timeout', '検索がタイムアウトしました'],
    ['network', '検索サービスへ接続できません'],
  ] as const)('provides a distinct user message for %s', (kind, message) => {
    expect(overpassErrorMessage(new OverpassError(kind))).toContain(message);
  });

  it('posts URL-encoded Overpass QL without a preflight-only custom header', async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        void input;
        void init;
        return jsonResponse({ elements: [] });
      },
    );
    const client = new OverpassClient(endpoints, 1_000, fetchMock as Fetcher);
    await client.search(center, 50, new AbortController().signal);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe(endpoints[0]);
    expect(request?.method).toBe('POST');
    expect(request?.headers).toBeUndefined();
    expect(request?.body).toBeInstanceOf(URLSearchParams);
    expect((request?.body as URLSearchParams).get('data')).toBe(
      buildConvenienceQuery(center, 50),
    );
  });

  it('classifies HTTP 400 as a bad request without fallback', async () => {
    const fetcher = vi.fn(async () => jsonResponse({}, 400)) as Fetcher;
    const client = new OverpassClient(endpoints, 1_000, fetcher);
    await expect(
      client.search(center, 50, new AbortController().signal),
    ).rejects.toMatchObject({
      kind: 'bad-request',
      endpoint: endpoints[0],
      status: 400,
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it.each([429, 504])(
    'falls back once after HTTP %s and succeeds',
    async (status) => {
      const fetcher = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({}, status))
        .mockResolvedValueOnce(jsonResponse({ elements: [] })) as Fetcher;
      const client = new OverpassClient(endpoints, 1_000, fetcher);

      await expect(
        client.search(center, 50, new AbortController().signal),
      ).resolves.toEqual([]);
      expect(fetcher).toHaveBeenNthCalledWith(
        1,
        endpoints[0],
        expect.any(Object),
      );
      expect(fetcher).toHaveBeenNthCalledWith(
        2,
        endpoints[1],
        expect.any(Object),
      );
    },
  );

  it('tries the fallback after a timeout and succeeds', async () => {
    vi.useFakeTimers();
    const fetcher = vi
      .fn()
      .mockImplementationOnce(
        (_input: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError')),
            );
          }),
      )
      .mockResolvedValueOnce(jsonResponse({ elements: [] })) as Fetcher;
    const client = new OverpassClient(endpoints, 100, fetcher);
    const request = client.search(center, 50, new AbortController().signal);
    const expectation = expect(request).resolves.toEqual([]);
    await vi.advanceTimersByTimeAsync(100);
    await expectation;
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('classifies a CORS-like fetch rejection as network and does not fallback', async () => {
    const fetcher = vi.fn(async () => {
      throw new TypeError('Load failed');
    }) as Fetcher;
    const client = new OverpassClient(endpoints, 1_000, fetcher);
    await expect(
      client.search(center, 50, new AbortController().signal),
    ).rejects.toMatchObject({ kind: 'network', endpoint: endpoints[0] });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('classifies invalid JSON without fallback', async () => {
    const fetcher = vi.fn(async () => new Response('{invalid')) as Fetcher;
    const client = new OverpassClient(endpoints, 1_000, fetcher);
    await expect(
      client.search(center, 50, new AbortController().signal),
    ).rejects.toMatchObject({ kind: 'invalid-json' });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('reports the final endpoint when all configured endpoints are busy', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 503))
      .mockResolvedValueOnce(jsonResponse({}, 504)) as Fetcher;
    const client = new OverpassClient(endpoints, 1_000, fetcher);
    await expect(
      client.search(center, 50, new AbortController().signal),
    ).rejects.toMatchObject({
      kind: 'busy',
      endpoint: endpoints[1],
      status: 504,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('aborts an in-progress fallback when a newer search cancels it', async () => {
    const externalController = new AbortController();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 503))
      .mockImplementationOnce(
        (_input: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError')),
            );
          }),
      ) as Fetcher;
    const client = new OverpassClient(endpoints, 1_000, fetcher);
    const request = client.search(center, 50, externalController.signal);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    externalController.abort();
    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
