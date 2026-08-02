import { describe, expect, it } from 'vitest';
import { APP_CONFIG } from './appConfig';

describe('APP_CONFIG', () => {
  it('contains valid map and geolocation defaults', () => {
    expect(APP_CONFIG.tileUrl).toContain('openstreetmap.org');
    expect(APP_CONFIG.attribution).toContain('OpenStreetMap');
    expect(APP_CONFIG.initialZoom).toBeLessThan(APP_CONFIG.locationZoom);
    expect(APP_CONFIG.geolocationOptions.enableHighAccuracy).toBe(true);
    expect(APP_CONFIG.convenienceSearch).toMatchObject({
      radiusMeters: 50,
      debounceMilliseconds: 900,
    });
    expect(APP_CONFIG.convenienceSearch.endpoints).toHaveLength(2);
    APP_CONFIG.convenienceSearch.endpoints.forEach((endpoint) =>
      expect(endpoint).toMatch(/^https:/),
    );
  });
});
