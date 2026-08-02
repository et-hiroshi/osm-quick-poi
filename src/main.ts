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

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('App root is missing');

const store = new AppStore({
  center: APP_CONFIG.initialCenter,
  zoom: APP_CONFIG.initialZoom,
  location: null,
  locationStatus: 'idle',
  locationMessage: '起動時に現在地を確認します',
});
const elements = createAppShell(root, store);
let tileErrorShown = false;

const map = new MapView(elements.map, {
  center: store.getState().center,
  zoom: store.getState().zoom,
  tileUrl: APP_CONFIG.tileUrl,
  attribution: APP_CONFIG.attribution,
  onCenterChange: (center, zoom) => store.update({ center, zoom }),
  onTileError: () => {
    if (tileErrorShown) return;
    tileErrorShown = true;
    elements.systemMessage.hidden = false;
    elements.systemMessage.textContent =
      '地図画像の一部を読み込めませんでした。通信状況をご確認ください。';
  },
});

const controller = new LocationController(
  store,
  () =>
    getCurrentLocation(navigator.geolocation, APP_CONFIG.geolocationOptions),
  (reading) => map.moveTo(reading.coordinates, APP_CONFIG.locationZoom),
  locationErrorMessage,
);

elements.locateButton.addEventListener(
  'click',
  () => void controller.request(),
);
void controller.request();
void registerServiceWorker(() => {
  elements.systemMessage.hidden = false;
  elements.systemMessage.textContent =
    'オフライン利用の準備に失敗しました。地図と現在地は引き続き利用できます。';
});
