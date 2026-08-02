import { describe, expect, it } from 'vitest';
import { formatAccuracy, formatCoordinates } from './formatters';

describe('display formatters', () => {
  it('formats coordinates to practical precision', () => {
    expect(
      formatCoordinates({ latitude: 33.12345678, longitude: 130.98765432 }),
    ).toBe('33.123457, 130.987654');
  });

  it('rounds the latest measurement accuracy', () => {
    expect(
      formatAccuracy({
        coordinates: { latitude: 33, longitude: 130 },
        accuracy: 8.4,
        measuredAt: 1,
      }),
    ).toBe('最終測位精度 ±8m');
    expect(formatAccuracy(null)).toBe('最終測位精度 未取得');
  });
});
