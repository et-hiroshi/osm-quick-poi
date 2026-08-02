import { describe, expect, it } from 'vitest';
import { distanceMeters } from './distance';

describe('distanceMeters', () => {
  it('calculates a plausible geodesic distance', () => {
    const distance = distanceMeters(
      { latitude: 35.681236, longitude: 139.767125 },
      { latitude: 35.681236, longitude: 139.76823 },
    );
    expect(distance).toBeGreaterThan(99);
    expect(distance).toBeLessThan(101);
  });
});
