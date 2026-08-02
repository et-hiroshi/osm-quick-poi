import type { AppState, AppStore } from '../app/appState';
import { conveniencePoiKey } from '../types/convenience';
import { formatAccuracy, formatCoordinates } from './formatters';

export interface AppElements {
  map: HTMLElement;
  locateButton: HTMLButtonElement;
  systemMessage: HTMLElement;
  retrySearchButton: HTMLButtonElement;
  searchResults: HTMLElement;
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
        <section class="search-panel" aria-labelledby="search-title">
          <div class="search-heading">
            <h2 id="search-title">周辺コンビニ</h2>
            <button id="retry-search" class="retry-search" type="button" hidden>再試行</button>
          </div>
          <p id="search-message" class="search-message" role="status" aria-live="polite">未検索</p>
          <ul id="search-results" class="search-results" aria-label="周辺コンビニ検索結果"></ul>
        </section>
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
  const retrySearchButton = requiredElement<HTMLButtonElement>(
    root,
    '#retry-search',
  );
  const searchResults = requiredElement<HTMLElement>(root, '#search-results');
  const searchMessage = requiredElement<HTMLElement>(root, '#search-message');

  store.subscribe((state) =>
    render(
      state,
      locateButton,
      coordinates,
      zoomLevel,
      accuracy,
      locationMessage,
      searchMessage,
      searchResults,
      retrySearchButton,
    ),
  );
  return {
    map,
    locateButton,
    systemMessage,
    retrySearchButton,
    searchResults,
  };
}

function render(
  state: Readonly<AppState>,
  button: HTMLButtonElement,
  coordinates: HTMLOutputElement,
  zoomLevel: HTMLOutputElement,
  accuracy: HTMLElement,
  message: HTMLElement,
  searchMessage: HTMLElement,
  searchResults: HTMLElement,
  retrySearchButton: HTMLButtonElement,
): void {
  coordinates.value = formatCoordinates(state.center);
  zoomLevel.value = String(state.zoom);
  accuracy.textContent = formatAccuracy(state.location);
  message.textContent = state.locationMessage;
  message.dataset.status = state.locationStatus;
  button.disabled = state.locationStatus === 'locating';
  button.setAttribute('aria-busy', String(state.locationStatus === 'locating'));
  renderConvenienceSearch(
    state,
    searchMessage,
    searchResults,
    retrySearchButton,
  );
}

function renderConvenienceSearch(
  state: Readonly<AppState>,
  message: HTMLElement,
  resultsElement: HTMLElement,
  retryButton: HTMLButtonElement,
): void {
  const search = state.convenienceSearch;
  message.textContent = search.message;
  message.dataset.status = search.status;
  retryButton.hidden = search.status !== 'error';
  resultsElement.replaceChildren();

  if (search.status !== 'success') return;
  search.results.forEach((poi) => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.poiKey = conveniencePoiKey(poi);
    button.className = 'search-result';

    const name = document.createElement('strong');
    name.textContent = poi.name;
    const detail = document.createElement('span');
    detail.textContent = `ピンから${Math.round(poi.distanceMeters)}m · ${poi.osmType} ${poi.osmId}`;
    button.append(name);
    if (poi.brand && poi.brand !== poi.name) {
      const brand = document.createElement('span');
      brand.textContent = poi.brand;
      button.append(brand);
    }
    button.append(detail);
    item.append(button);
    resultsElement.append(item);
  });
}

function requiredElement<T extends Element>(
  root: Element,
  selector: string,
): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Required UI element is missing: ${selector}`);
  return element;
}
