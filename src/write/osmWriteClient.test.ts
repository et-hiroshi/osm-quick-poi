import { describe, expect, it, vi } from 'vitest';
import { OsmWriteClient } from './osmWriteClient';

const coordinates = { latitude: 35.1234567, longitude: 139.7654321 };

describe('OsmWriteClient', () => {
  it('changesetを作成し、nodeを作成してchangesetを閉じる', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('123', { status: 200 }))
      .mockResolvedValueOnce(new Response('456', { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    const client = new OsmWriteClient(fetchMock, 'https://api.test/api/0.6');

    await expect(
      client.createConvenience('token', coordinates, {
        shop: 'convenience',
        name: 'A&B',
      }),
    ).resolves.toEqual({ changesetId: 123, nodeId: 456 });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      'https://api.test/api/0.6/changeset/create',
      'https://api.test/api/0.6/nodes',
      'https://api.test/api/0.6/changeset/123/close',
    ]);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'PUT' });
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'POST' });
    expect(String(fetchMock.mock.calls[1][1]?.body)).toContain(
      'lat="35.1234567" lon="139.7654321"',
    );
    expect(String(fetchMock.mock.calls[1][1]?.body)).toContain('v="A&amp;B"');
    expect(fetchMock.mock.calls[2][1]).toMatchObject({ method: 'PUT' });
    fetchMock.mock.calls.forEach(([, init]) =>
      expect(init?.headers).toMatchObject({ Authorization: 'Bearer token' }),
    );
  });

  it('node作成失敗時もchangesetを閉じる', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('123', { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    await expect(
      new OsmWriteClient(
        fetchMock,
        'https://api.test/api/0.6',
      ).createConvenience('token', coordinates, { shop: 'convenience' }),
    ).rejects.toMatchObject({ status: 500 });
    expect(String(fetchMock.mock.calls[2][0])).toContain(
      '/changeset/123/close',
    );
  });

  it('401を再ログイン可能なエラーとして返す', async () => {
    const client = new OsmWriteClient(
      vi.fn<typeof fetch>(async () => new Response(null, { status: 401 })),
      'https://api.test/api/0.6',
    );
    await expect(
      client.createConvenience('expired', coordinates, {
        shop: 'convenience',
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        status: 401,
        message: expect.stringContaining('再度ログイン'),
      }),
    );
  });

  it('node作成後にcloseだけ失敗した場合は再送を止める', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('123', { status: 200 }))
      .mockResolvedValueOnce(new Response('456', { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }));

    await expect(
      new OsmWriteClient(
        fetchMock,
        'https://api.test/api/0.6',
      ).createConvenience('token', coordinates, { shop: 'convenience' }),
    ).rejects.toEqual(
      expect.objectContaining({
        message: expect.stringContaining('再送しないでください'),
      }),
    );
  });
});
