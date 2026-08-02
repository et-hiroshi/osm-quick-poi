import { ACCURACY_VISUAL_CONFIG } from '../config/appConfig';

export interface AccuracyVisual {
  radius: number;
  fillColor: string;
  fillOpacity: number;
}

export function getAccuracyVisual(accuracyMeters: number): AccuracyVisual {
  return {
    radius: accuracyMeters,
    fillColor: ACCURACY_VISUAL_CONFIG.fill,
    fillOpacity: ACCURACY_VISUAL_CONFIG.fillOpacity,
  };
}
