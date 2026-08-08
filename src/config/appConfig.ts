export const APP_CONFIG = {
  appName: 'OSM Quick POI',
  initialCenter: { latitude: 35.681236, longitude: 139.767125 },
  initialZoom: 14,
  locationZoom: 19,
  tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  geolocationOptions: {
    enableHighAccuracy: true,
    timeout: 12_000,
    maximumAge: 0,
  } satisfies PositionOptions,
  convenienceSearch: {
    endpoints: [
      'https://overpass-api.de/api/interpreter',
      'https://lz4.overpass-api.de/api/interpreter',
    ],
    radiusMeters: 50,
    debounceMilliseconds: 900,
    timeoutMilliseconds: 12_000,
  },
  // Public OAuth client: PKCE is used and no client secret is shipped.
  osmOAuthClientId: 'DNHlSu1DURzGA_dmO-cdLUI9jSCqCJ8EOBxaqBg4tL0',
} as const;

export const ACCURACY_VISUAL_CONFIG = {
  fill: '#0f4d3a',
  fillOpacity: 0.2,
} as const;
