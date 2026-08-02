export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface LocationReading {
  coordinates: Coordinates;
  accuracy: number;
  measuredAt: number;
}

export type LocationStatus = 'idle' | 'locating' | 'success' | 'error';
