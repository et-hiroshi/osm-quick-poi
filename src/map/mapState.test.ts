import { describe, expect, it, vi } from 'vitest';
import {
  bindViewportChangeEvents,
  readMapViewport,
  resolveTargetZoom,
  type MapViewport,
} from './mapState';

class FakeMap {
  center = { lat: 33.590355, lng: 130.401716 };
  zoom = 18;
  private readonly handlers = new Map<string, Array<() => void>>();

  getCenter() {
    return this.center;
  }

  getZoom() {
    return this.zoom;
  }

  on(event: 'moveend' | 'zoomend', handler: () => void) {
    const handlers = this.handlers.get(event) ?? [];
    handlers.push(handler);
    this.handlers.set(event, handlers);
  }

  emit(event: 'moveend' | 'zoomend') {
    this.handlers.get(event)?.forEach((handler) => handler());
  }
}

const initialViewport: MapViewport = {
  center: { latitude: 33.590355, longitude: 130.401716 },
  zoom: 18,
};

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

  it('notifies once for a moveend-only pan', () => {
    const map = new FakeMap();
    const onChange = vi.fn();
    bindViewportChangeEvents(map, initialViewport, 1, onChange);
    map.center = { lat: 33.591, lng: 130.401716 };
    map.emit('moveend');
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('notifies once for a zoomend-only zoom', () => {
    const map = new FakeMap();
    const onChange = vi.fn();
    bindViewportChangeEvents(map, initialViewport, 1, onChange);
    map.zoom = 19;
    map.emit('zoomend');
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('coalesces zoomend and moveend for the same final viewport', () => {
    const map = new FakeMap();
    const onChange = vi.fn();
    bindViewportChangeEvents(map, initialViewport, 1, onChange);
    map.zoom = 19;
    map.emit('zoomend');
    map.emit('moveend');
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('ignores repeated internal moveend events without a meaningful viewport change', () => {
    const map = new FakeMap();
    const onChange = vi.fn();
    bindViewportChangeEvents(map, initialViewport, 1, onChange);
    map.emit('moveend');
    map.center = { lat: 33.590356, lng: 130.401716 };
    map.emit('moveend');
    map.emit('moveend');
    expect(onChange).not.toHaveBeenCalled();
  });
});
