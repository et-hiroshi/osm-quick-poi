import type { AppStore } from '../app/appState';
import type { LocationReading } from '../types/location';

export type Locate = () => Promise<LocationReading>;
export type MoveMap = (reading: LocationReading) => void;

export class LocationController {
  private locating = false;

  constructor(
    private readonly store: AppStore,
    private readonly locate: Locate,
    private readonly moveMap: MoveMap,
    private readonly errorMessage: (error: unknown) => string,
  ) {}

  async request(): Promise<void> {
    if (this.locating) return;
    this.locating = true;
    this.store.update({
      locationStatus: 'locating',
      locationMessage: '現在地を取得しています…',
    });

    try {
      const reading = await this.locate();
      this.moveMap(reading);
      this.store.update({
        center: reading.coordinates,
        location: reading,
        locationStatus: 'success',
        locationMessage: '現在地を取得しました',
      });
    } catch (error) {
      this.store.update({
        locationStatus: 'error',
        locationMessage: this.errorMessage(error),
      });
    } finally {
      this.locating = false;
    }
  }
}
