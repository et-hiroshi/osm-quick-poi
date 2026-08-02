import { describe, expect, it, vi } from 'vitest';
import { readMapViewport, resolveTargetZoom } from './mapState';

describe('readMapViewport', () => {
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
});
