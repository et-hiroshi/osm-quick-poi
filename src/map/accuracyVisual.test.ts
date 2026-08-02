import { describe, expect, it } from 'vitest';
import { getAccuracyVisual } from './accuracyVisual';

describe('getAccuracyVisual', () => {
  it('uses the measured accuracy as the circle radius in meters', () => {
    expect(getAccuracyVisual(23.4).radius).toBe(23.4);
  });

  it('uses a translucent deep-green fill without a category color', () => {
    expect(getAccuracyVisual(8)).toMatchObject({
      fillColor: '#0f4d3a',
      fillOpacity: 0.2,
    });
    expect(getAccuracyVisual(80)).toMatchObject({
      fillColor: '#0f4d3a',
      fillOpacity: 0.2,
    });
  });
});
