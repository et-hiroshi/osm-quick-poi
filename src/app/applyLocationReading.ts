import type { AppStore } from './appState';
import type { MapViewport } from '../map/mapState';
import type { Coordinates, LocationReading } from '../types/location';

interface LocationMap {
  showLocationAccuracy(reading: LocationReading): void;
  moveTo(center: Coordinates, zoom?: number): MapViewport;
}

export function applyLocationReading(
  reading: LocationReading,
  targetZoom: number | undefined,
  map: LocationMap,
  store: AppStore,
  scheduleSearch: (center: Coordinates) => void,
): void {
  map.showLocationAccuracy(reading);
  const viewport = map.moveTo(reading.coordinates, targetZoom);
  store.update({ center: viewport.center, zoom: viewport.zoom });
  scheduleSearch(viewport.center);
}
