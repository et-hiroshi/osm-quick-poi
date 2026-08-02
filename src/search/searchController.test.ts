import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppStore } from '../app/appState';
import type { ConveniencePoi } from '../types/convenience';
import type { Coordinates } from '../types/location';
import type { ConvenienceSearchService } from './overpassClient';
import { SearchController } from './searchController';

const initialCenter = { latitude: 35, longitude: 139 };

function createStore() {
  return new AppStore({
    center: initialCenter,
    zoom: 16,
    location: null,
    locationStatus: 'idle',
    locationMessage: '',
    convenienceSearch: {
      status: 'idle',
      center: null,
      radiusMeters: 50,
      results: [],
      message: '未検索',
    },
  });
}

function poi(id: number): ConveniencePoi {
  return {
    osmType: 'node',
    osmId: id,
    coordinates: initialCenter,
    name: `店${id}`,
    brand: null,
    distanceMeters: id,
  };
}

afterEach(() => vi.useRealTimers());

describe('SearchController', () => {
  it('always advances from debouncing to loading after the delay', async () => {
    vi.useFakeTimers();
    const service: ConvenienceSearchService = {
      search: vi.fn(() => new Promise<ConveniencePoi[]>(() => undefined)),
    };
    const store = createStore();
    const controller = new SearchController(
      store,
      service,
      50,
      900,
      () => 'error',
      vi.fn(),
    );

    controller.schedule(initialCenter);
    expect(store.getState().convenienceSearch.status).toBe('debouncing');
    await vi.advanceTimersByTimeAsync(899);
    expect(store.getState().convenienceSearch.status).toBe('debouncing');
    await vi.advanceTimersByTimeAsync(1);
    expect(store.getState().convenienceSearch.status).toBe('loading');
  });

  it('debounces repeated map updates and searches only the latest center', async () => {
    vi.useFakeTimers();
    const service: ConvenienceSearchService = { search: vi.fn(async () => []) };
    const store = createStore();
    const controller = new SearchController(
      store,
      service,
      50,
      900,
      () => 'error',
      vi.fn(),
    );
    const latestCenter = { latitude: 35.1, longitude: 139.1 };

    controller.schedule(initialCenter);
    await vi.advanceTimersByTimeAsync(600);
    controller.cancelForUserInteraction();
    expect(store.getState().convenienceSearch).toMatchObject({
      status: 'idle',
      message: '地図の操作完了を待っています',
    });
    controller.schedule(latestCenter);
    await vi.advanceTimersByTimeAsync(899);
    expect(service.search).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(service.search).toHaveBeenCalledOnce();
    expect(service.search).toHaveBeenCalledWith(
      latestCenter,
      50,
      expect.any(AbortSignal),
    );
  });

  it('does not allow an old response to replace the latest results', async () => {
    vi.useFakeTimers();
    const pending: Array<(results: ConveniencePoi[]) => void> = [];
    const service: ConvenienceSearchService = {
      search: vi.fn(
        () =>
          new Promise<ConveniencePoi[]>((resolve) => {
            pending.push(resolve);
          }),
      ),
    };
    const store = createStore();
    const onResults = vi.fn();
    const controller = new SearchController(
      store,
      service,
      50,
      900,
      () => 'error',
      onResults,
    );

    controller.schedule(initialCenter);
    await vi.advanceTimersByTimeAsync(900);
    const latestCenter: Coordinates = { latitude: 36, longitude: 140 };
    controller.schedule(latestCenter);
    await vi.advanceTimersByTimeAsync(900);
    pending[1]([poi(2)]);
    await Promise.resolve();
    pending[0]([poi(1)]);
    await Promise.resolve();

    expect(store.getState().convenienceSearch).toMatchObject({
      status: 'success',
      center: latestCenter,
      results: [{ osmId: 2 }],
    });
    expect(onResults).toHaveBeenCalledTimes(1);
  });

  it('moves to an error state without changing the map center', async () => {
    vi.useFakeTimers();
    const store = createStore();
    const service: ConvenienceSearchService = {
      search: vi.fn(async () => {
        throw new Error('network details');
      }),
    };
    const controller = new SearchController(
      store,
      service,
      50,
      900,
      () => '周辺検索に失敗しました',
      vi.fn(),
    );
    controller.schedule(initialCenter);
    await vi.advanceTimersByTimeAsync(900);

    expect(store.getState()).toMatchObject({
      center: initialCenter,
      zoom: 16,
      convenienceSearch: {
        status: 'error',
        message: '周辺検索に失敗しました',
      },
    });
  });

  it('reaches the explicit zero-results success state', async () => {
    vi.useFakeTimers();
    const store = createStore();
    const service: ConvenienceSearchService = {
      search: vi.fn(async () => []),
    };
    const controller = new SearchController(
      store,
      service,
      50,
      900,
      () => 'error',
      vi.fn(),
    );
    controller.schedule(initialCenter);
    await vi.advanceTimersByTimeAsync(900);

    expect(store.getState().convenienceSearch).toMatchObject({
      status: 'success',
      results: [],
      message: '半径50m以内にコンビニ登録なし',
    });
  });
});
