import type { Coordinates } from '../types/location';
import { distanceMeters } from '../search/distance';

export interface MapViewport {
  center: Coordinates;
  zoom: number;
}

interface MapStateSource {
  getCenter(): { lat: number; lng: number };
  getZoom(): number;
}

interface MapEventSource extends MapStateSource {
  on(event: 'moveend' | 'zoomend', handler: () => void): unknown;
}

export function bindViewportChangeEvents(
  map: MapEventSource,
  initialViewport: MapViewport,
  minimumCenterChangeMeters: number,
  onChange: (viewport: MapViewport) => void,
): void {
  let lastViewport = initialViewport;
  const notifyIfChanged = () => {
    const viewport = readMapViewport(map);
    const centerChanged =
      distanceMeters(lastViewport.center, viewport.center) >=
      minimumCenterChangeMeters;
    if (!centerChanged && viewport.zoom === lastViewport.zoom) return;
    lastViewport = viewport;
    onChange(viewport);
  };

  map.on('moveend', notifyIfChanged);
  map.on('zoomend', notifyIfChanged);
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
