import { describe, expect, it } from 'vitest';
import type { ConveniencePoi, SearchStatus } from '../types/convenience';
import { nearbyConveniencesForWarning } from './registrationPanel';

const poi = (distanceMeters: number): ConveniencePoi => ({
  osmType: 'node',
  osmId: distanceMeters,
  coordinates: { latitude: 35, longitude: 139 },
  name: 'コンビニ',
  brand: null,
  distanceMeters,
});

describe('nearbyConveniencesForWarning', () => {
  it.each(['idle', 'debouncing', 'loading', 'error'] as SearchStatus[])(
    '%sでは古い検索結果を警告に使わない',
    (status) => {
      expect(nearbyConveniencesForWarning(status, [poi(10)])).toEqual([]);
    },
  );

  it('検索成功時は50m以内の結果だけを警告する', () => {
    expect(
      nearbyConveniencesForWarning('success', [poi(10), poi(50), poi(51)]),
    ).toEqual([poi(10), poi(50)]);
  });
});
