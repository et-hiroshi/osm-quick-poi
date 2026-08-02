import type { Coordinates } from '../types/location';

export interface MapViewport {
  center: Coordinates;
  zoom: number;
}

interface MapStateSource {
  getCenter(): { lat: number; lng: number };
  getZoom(): number;
}

export function readMapViewport(map: MapStateSource): MapViewport {
  const center = map.getCenter();
  return {
    center: { latitude: center.lat, longitude: center.lng },
    zoom: map.getZoom(),
  };
}

export function resolveTargetZoom(
  currentZoom: number,
  requestedZoom?: number,
): number {
  return requestedZoom ?? currentZoom;
}
