import { describe, expect, it, vi } from 'vitest';
import { AppStore } from '../app/appState';
import type { LocationReading } from '../types/location';
import { LocationController } from './locationController';

function store() {
  return new AppStore({
    center: { latitude: 35, longitude: 139 },
    zoom: 14,
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

const reading: LocationReading = {
  coordinates: { latitude: 33.5, longitude: 130.4 },
  accuracy: 7.6,
  measuredAt: 123,
};

describe('LocationController', () => {
  it('uses the requested default zoom for initial location', async () => {
    const appStore = store();
    const moveMap = vi.fn();
    await new LocationController(
      appStore,
      async () => reading,
      moveMap,
      () => 'error',
    ).request(19);
    expect(moveMap).toHaveBeenCalledWith(reading, 19);
    expect(appStore.getState()).toMatchObject({
      center: { latitude: 35, longitude: 139 },
      zoom: 14,
      location: reading,
      locationStatus: 'success',
    });
  });

  it('leaves zoom selection to the map when recentering', async () => {
    const appStore = store();
    appStore.update({ zoom: 17 });
    const moveMap = vi.fn();
    await new LocationController(
      appStore,
      async () => reading,
      moveMap,
      () => 'error',
    ).request();
    expect(moveMap).toHaveBeenCalledWith(reading, undefined);
    expect(appStore.getState().zoom).toBe(17);
  });

  it('preserves center and zoom on failure', async () => {
    const appStore = store();
    await new LocationController(
      appStore,
      async () => {
        throw new Error('technical');
      },
      vi.fn(),
      () => '利用者向けエラー',
    ).request();
    expect(appStore.getState()).toMatchObject({
      center: { latitude: 35, longitude: 139 },
      zoom: 14,
      locationStatus: 'error',
      locationMessage: '利用者向けエラー',
    });
  });

  it('prevents concurrent requests', async () => {
    let resolve!: (value: LocationReading) => void;
    const locate = vi.fn(
      () =>
        new Promise<LocationReading>((done) => {
          resolve = done;
        }),
    );
    const controller = new LocationController(
      store(),
      locate,
      vi.fn(),
      () => 'error',
    );
    const first = controller.request();
    const second = controller.request();
    expect(locate).toHaveBeenCalledTimes(1);
    resolve(reading);
    await Promise.all([first, second]);
  });
});
