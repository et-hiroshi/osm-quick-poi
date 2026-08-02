import type { Coordinates } from './location';

export type OsmObjectType = 'node' | 'way' | 'relation';

export interface ConveniencePoi {
  osmType: OsmObjectType;
  osmId: number;
  coordinates: Coordinates;
  name: string;
  brand: string | null;
  distanceMeters: number;
}

export type SearchStatus =
  'idle' | 'debouncing' | 'loading' | 'success' | 'error';

export interface ConvenienceSearchState {
  status: SearchStatus;
  center: Coordinates | null;
  radiusMeters: number;
  results: ConveniencePoi[];
  message: string;
}

export function conveniencePoiKey(
  poi: Pick<ConveniencePoi, 'osmType' | 'osmId'>,
): string {
  return `${poi.osmType}/${poi.osmId}`;
}
