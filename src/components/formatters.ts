import type { Coordinates, LocationReading } from '../types/location';

export function formatCoordinates(coordinates: Coordinates): string {
  return `${coordinates.latitude.toFixed(6)}, ${coordinates.longitude.toFixed(6)}`;
}

export function formatAccuracy(location: LocationReading | null): string {
  return location
    ? `最終測位精度 ±${Math.round(location.accuracy)}m`
    : '最終測位精度 未取得';
}
