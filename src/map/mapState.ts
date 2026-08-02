import type { Coordinates } from '../types/location';

export interface MapViewport {
  center: Coordinates;
  zoom: number;
}

interface MapStateSource {
  getCenter(): { lat: number; lng: number };
  getZoom(): number;
}

interface ResizableMap extends MapStateSource {
  invalidateSize(options: { pan: false }): unknown;
  setView(
    center: [number, number],
    zoom: number,
    options: { animate: false },
  ): unknown;
}

export function readMapViewport(map: MapStateSource): MapViewport {
  const center = map.getCenter();
  return {
    center: { latitude: center.lat, longitude: center.lng },
    zoom: map.getZoom(),
  };
}

export function preserveViewportDuringResize(map: ResizableMap): MapViewport {
  const viewport = readMapViewport(map);
  map.invalidateSize({ pan: false });
  map.setView(
    [viewport.center.latitude, viewport.center.longitude],
    viewport.zoom,
    { animate: false },
  );
  return viewport;
}

export function resolveTargetZoom(
  currentZoom: number,
  requestedZoom?: number,
): number {
  return requestedZoom ?? currentZoom;
}
