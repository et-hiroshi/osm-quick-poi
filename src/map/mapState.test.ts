import { describe, expect, it, vi } from 'vitest';
import {
  preserveViewportDuringResize,
  readMapViewport,
  resolveTargetZoom,
} from './mapState';

describe('map state', () => {
  it('uses the post-operation map center and zoom as its only source', () => {
    const getCenter = vi.fn(() => ({ lat: 33.590355, lng: 130.401716 }));
    const getZoom = vi.fn(() => 18);

    expect(readMapViewport({ getCenter, getZoom })).toEqual({
      center: { latitude: 33.590355, longitude: 130.401716 },
      zoom: 18,
    });
    expect(getCenter).toHaveBeenCalledOnce();
    expect(getZoom).toHaveBeenCalledOnce();
  });

  it('keeps the current zoom unless an initial zoom is requested', () => {
    expect(resolveTargetZoom(17)).toBe(17);
    expect(resolveTargetZoom(17, 19)).toBe(19);
  });

  it('restores the exact center after invalidateSize changes it', () => {
    let center = { lat: 33.590355, lng: 130.401716 };
    let zoom = 18;
    const map = {
      getCenter: () => center,
      getZoom: () => zoom,
      invalidateSize: vi.fn(() => {
        center = { lat: 33.590365, lng: 130.401726 };
      }),
      setView: vi.fn((target: [number, number], targetZoom: number) => {
        center = { lat: target[0], lng: target[1] };
        zoom = targetZoom;
      }),
    };

    const before = preserveViewportDuringResize(map);
    expect(readMapViewport(map)).toEqual(before);
    expect(map.invalidateSize).toHaveBeenCalledWith({ pan: false });
    expect(map.setView).toHaveBeenCalledWith([33.590355, 130.401716], 18, {
      animate: false,
    });
  });
});
