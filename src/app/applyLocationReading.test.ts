import { describe, expect, it, vi } from 'vitest';
import { AppStore } from './appState';
import { applyLocationReading } from './applyLocationReading';

describe('applyLocationReading', () => {
  it('explicitly schedules one search from the actual map center', () => {
    const reading = {
      coordinates: { latitude: 33.5, longitude: 130.4 },
      accuracy: 8,
      measuredAt: 1,
    };
    const store = new AppStore({
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
    const map = {
      showLocationAccuracy: vi.fn(),
      moveTo: vi.fn(() => ({
        center: { latitude: 33.500001, longitude: 130.400001 },
        zoom: 19,
      })),
    };
    const scheduleSearch = vi.fn();

    applyLocationReading(reading, 19, map, store, scheduleSearch);

    expect(map.showLocationAccuracy).toHaveBeenCalledWith(reading);
    expect(map.moveTo).toHaveBeenCalledWith(reading.coordinates, 19);
    expect(scheduleSearch).toHaveBeenCalledOnce();
    expect(scheduleSearch).toHaveBeenCalledWith({
      latitude: 33.500001,
      longitude: 130.400001,
    });
    expect(store.getState()).toMatchObject({
      center: { latitude: 33.500001, longitude: 130.400001 },
      zoom: 19,
    });
  });
});
