import './styles.css';
import { AppStore } from './app/appState';
import { APP_CONFIG } from './config/appConfig';
import { createAppShell } from './components/appShell';
import {
  getCurrentLocation,
  locationErrorMessage,
} from './geolocation/geolocationService';
import { LocationController } from './geolocation/locationController';
import { MapView } from './map/mapView';
import { registerServiceWorker } from './pwa/registerServiceWorker';
import { OverpassClient, overpassErrorMessage } from './search/overpassClient';
import { SearchController } from './search/searchController';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('App root is missing');

const store = new AppStore({
  center: APP_CONFIG.initialCenter,
  zoom: APP_CONFIG.initialZoom,
  location: null,
  locationStatus: 'idle',
  locationMessage: '起動時に現在地を確認します',
  convenienceSearch: {
    status: 'idle',
    center: null,
    radiusMeters: APP_CONFIG.convenienceSearch.radiusMeters,
    results: [],
    message: '未検索',
  },
});
const elements = createAppShell(root, store);
let tileErrorShown = false;
let searchController: SearchController | null = null;

const map = new MapView(elements.map, {
  center: store.getState().center,
  zoom: store.getState().zoom,
  tileUrl: APP_CONFIG.tileUrl,
  attribution: APP_CONFIG.attribution,
  onCenterChange: (center, zoom) => {
    store.update({ center, zoom });
    searchController?.schedule(center);
  },
  onTileError: () => {
    if (tileErrorShown) return;
    tileErrorShown = true;
    elements.systemMessage.hidden = false;
    elements.systemMessage.textContent =
      '地図画像の一部を読み込めませんでした。通信状況をご確認ください。';
  },
});

const overpassClient = new OverpassClient(
  APP_CONFIG.convenienceSearch.endpoint,
  APP_CONFIG.convenienceSearch.timeoutMilliseconds,
);
searchController = new SearchController(
  store,
  overpassClient,
  APP_CONFIG.convenienceSearch.radiusMeters,
  APP_CONFIG.convenienceSearch.debounceMilliseconds,
  overpassErrorMessage,
  (results) => map.setConveniencePois(results),
);

const controller = new LocationController(
  store,
  () =>
    getCurrentLocation(navigator.geolocation, APP_CONFIG.geolocationOptions),
  (reading, targetZoom) => {
    map.showLocationAccuracy(reading);
    map.moveTo(reading.coordinates, targetZoom);
  },
  locationErrorMessage,
);

elements.locateButton.addEventListener(
  'click',
  () => void controller.request(),
);
elements.retrySearchButton.addEventListener('click', () =>
  searchController?.retry(),
);
elements.searchResults.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const button = target.closest<HTMLButtonElement>('[data-poi-key]');
  if (button?.dataset.poiKey) map.selectConveniencePoi(button.dataset.poiKey);
});
searchController.schedule(store.getState().center);
void controller.request(APP_CONFIG.locationZoom);
void registerServiceWorker(() => {
  elements.systemMessage.hidden = false;
  elements.systemMessage.textContent =
    'オフライン利用の準備に失敗しました。地図と現在地は引き続き利用できます。';
});
