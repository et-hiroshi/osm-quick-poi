import { describe, expect, it, vi } from 'vitest';
import { bindUserMapInteractionEvents } from './userMapInteraction';

type EventName = 'dragstart' | 'dragend' | 'moveend' | 'zoomstart' | 'zoomend';

class FakeInteractionMap {
  center = { lat: 33.590355, lng: 130.401716 };
  zoom = 18;
  private readonly handlers = new Map<EventName, Array<() => void>>();

  getCenter() {
    return this.center;
  }

  getZoom() {
    return this.zoom;
  }

  on(event: EventName, handler: () => void) {
    const handlers = this.handlers.get(event) ?? [];
    handlers.push(handler);
    this.handlers.set(event, handlers);
  }

  emit(event: EventName) {
    this.handlers.get(event)?.forEach((handler) => handler());
  }
}

function setup() {
  const map = new FakeInteractionMap();
  const onStart = vi.fn();
  const onEnd = vi.fn();
  let programmatic = false;
  bindUserMapInteractionEvents(map, {
    isProgrammaticMove: () => programmatic,
    onUserInteractionStart: onStart,
    onUserInteractionEnd: onEnd,
  });
  return {
    map,
    onStart,
    onEnd,
    setProgrammatic: (value: boolean) => {
      programmatic = value;
    },
  };
}

describe('user map interaction events', () => {
  it('snapshots once after a user drag reaches moveend', () => {
    const { map, onStart, onEnd } = setup();
    map.emit('dragstart');
    map.center = { lat: 33.591, lng: 130.402 };
    map.emit('dragend');
    map.emit('moveend');
    map.emit('moveend');

    expect(onStart).toHaveBeenCalledOnce();
    expect(onEnd).toHaveBeenCalledOnce();
    expect(onEnd).toHaveBeenCalledWith({
      center: { latitude: 33.591, longitude: 130.402 },
      zoom: 18,
    });
  });

  it('snapshots once after a user zoom reaches zoomend', () => {
    const { map, onEnd } = setup();
    map.emit('zoomstart');
    map.zoom = 19;
    map.emit('zoomend');
    map.emit('moveend');
    expect(onEnd).toHaveBeenCalledOnce();
  });

  it('ignores programmatic zoom and move events', () => {
    const { map, onStart, onEnd, setProgrammatic } = setup();
    setProgrammatic(true);
    map.emit('zoomstart');
    map.zoom = 19;
    map.center = { lat: 33.591, lng: 130.402 };
    map.emit('zoomend');
    map.emit('moveend');
    setProgrammatic(false);

    expect(onStart).not.toHaveBeenCalled();
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('ignores unlimited resize-style moveend events and coordinate drift', () => {
    const { map, onEnd } = setup();
    for (let index = 1; index <= 20; index += 1) {
      map.center = {
        lat: 33.590355 + index / 1_000_000,
        lng: 130.401716,
      };
      map.emit('moveend');
    }
    expect(onEnd).not.toHaveBeenCalled();
  });
});
