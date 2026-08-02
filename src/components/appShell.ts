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
        <div class="center-target" aria-hidden="true">
          <svg class="pin-marker" viewBox="0 0 28 38">
            <path d="M14 1C6.8 1 1 6.8 1 14c0 9.7 13 23 13 23s13-13.3 13-23C27 6.8 21.2 1 14 1Z" />
            <circle cx="14" cy="14" r="4" />
          </svg>
          <span class="center-crosshair"></span>
        </div>
        <button id="locate-button" class="locate-button" type="button">
          <span aria-hidden="true">◎</span><span>現在地</span>
        </button>
        <div id="system-message" class="system-message" role="status" aria-live="polite" hidden></div>
      </div>
      <section class="coordinate-panel" aria-labelledby="coordinate-title">
        <div class="coordinate-heading">
          <span id="coordinate-title">登録予定位置</span>
          <span class="zoom-detail" data-development-detail>ズーム <output id="zoom-level">--</output></span>
        </div>
        <output id="coordinates">--</output>
        <span id="location-status" class="visually-hidden" aria-live="polite">最終測位精度 未取得</span>
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
  const zoomLevel = requiredElement<HTMLOutputElement>(root, '#zoom-level');
  const accuracy = requiredElement<HTMLElement>(root, '#location-status');
  const locationMessage = requiredElement<HTMLElement>(
    root,
    '#location-message',
  );

  store.subscribe((state) =>
    render(
      state,
      locateButton,
      coordinates,
      zoomLevel,
      accuracy,
      locationMessage,
    ),
  );
  return { map, locateButton, systemMessage };
}

function render(
  state: Readonly<AppState>,
  button: HTMLButtonElement,
  coordinates: HTMLOutputElement,
  zoomLevel: HTMLOutputElement,
  accuracy: HTMLElement,
  message: HTMLElement,
): void {
  coordinates.value = formatCoordinates(state.center);
  zoomLevel.value = String(state.zoom);
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
