import { describe, expect, it, vi } from 'vitest';
import { AppStore } from './appState';

describe('AppStore', () => {
  it('updates the central registration coordinate and zoom', () => {
    const store = new AppStore({
      center: { latitude: 0, longitude: 0 },
      zoom: 10,
      location: null,
      locationStatus: 'idle',
      locationMessage: '',
    });
    const listener = vi.fn();
    store.subscribe(listener);
    store.update({ center: { latitude: 33.1, longitude: 130.2 }, zoom: 18 });
    expect(store.getState()).toMatchObject({
      center: { latitude: 33.1, longitude: 130.2 },
      zoom: 18,
    });
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
