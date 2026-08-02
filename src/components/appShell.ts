import type { AppState, AppStore } from '../app/appState';
import { formatAccuracy, formatCoordinates } from './formatters';

export interface AppElements {
  map: HTMLElement;
  locateButton: HTMLButtonElement;
  systemMessage: HTMLElement;
}

export function createAppShell(
  root: HTMLElement,
  store: AppStore,
): AppElements {
  root.innerHTML = `
    <section class="app-shell" aria-label="OSM Quick POI">
      <div class="map-wrap">
        <div id="map" aria-label="OpenStreetMap 地図"></div>
        <div class="center-pin" aria-hidden="true"><span></span></div>
        <div class="map-status" role="status" aria-live="polite">
          <span id="location-status">最終測位精度 未取得</span>
        </div>
        <button id="locate-button" class="locate-button" type="button">
          <span aria-hidden="true">◎</span><span>現在地</span>
        </button>
        <div id="system-message" class="system-message" role="status" aria-live="polite" hidden></div>
      </div>
      <section class="coordinate-panel" aria-labelledby="coordinate-title">
        <span id="coordinate-title">登録予定位置</span>
        <output id="coordinates">--</output>
        <p id="location-message" class="location-message" role="status" aria-live="polite"></p>
      </section>
    </section>`;

  const map = requiredElement<HTMLElement>(root, '#map');
  const locateButton = requiredElement<HTMLButtonElement>(
    root,
    '#locate-button',
  );
  const systemMessage = requiredElement<HTMLElement>(root, '#system-message');
  const coordinates = requiredElement<HTMLOutputElement>(root, '#coordinates');
  const accuracy = requiredElement<HTMLElement>(root, '#location-status');
  const locationMessage = requiredElement<HTMLElement>(
    root,
    '#location-message',
  );

  store.subscribe((state) =>
    render(state, locateButton, coordinates, accuracy, locationMessage),
  );
  return { map, locateButton, systemMessage };
}

function render(
  state: Readonly<AppState>,
  button: HTMLButtonElement,
  coordinates: HTMLOutputElement,
  accuracy: HTMLElement,
  message: HTMLElement,
): void {
  coordinates.value = formatCoordinates(state.center);
  accuracy.textContent = formatAccuracy(state.location);
  message.textContent = state.locationMessage;
  message.dataset.status = state.locationStatus;
  button.disabled = state.locationStatus === 'locating';
  button.setAttribute('aria-busy', String(state.locationStatus === 'locating'));
}

function requiredElement<T extends Element>(
  root: Element,
  selector: string,
): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Required UI element is missing: ${selector}`);
  return element;
}
