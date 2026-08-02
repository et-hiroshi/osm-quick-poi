import type {
  Coordinates,
  LocationReading,
  LocationStatus,
} from '../types/location';
import type { ConvenienceSearchState } from '../types/convenience';

export interface AppState {
  center: Coordinates;
  zoom: number;
  location: LocationReading | null;
  locationStatus: LocationStatus;
  locationMessage: string;
  convenienceSearch: ConvenienceSearchState;
}

type Listener = (state: Readonly<AppState>) => void;

export class AppStore {
  private state: AppState;
  private readonly listeners = new Set<Listener>();

  constructor(initialState: AppState) {
    this.state = initialState;
  }

  getState(): Readonly<AppState> {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  update(patch: Partial<AppState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener(this.state));
  }
}
