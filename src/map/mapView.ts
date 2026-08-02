import L, {
  type Circle,
  type Map as LeafletMap,
  type TileLayer,
} from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Coordinates, LocationReading } from '../types/location';
import { getAccuracyVisual } from './accuracyVisual';
import { readMapViewport, resolveTargetZoom } from './mapState';

interface MapViewOptions {
  center: Coordinates;
  zoom: number;
  tileUrl: string;
  attribution: string;
  onCenterChange: (center: Coordinates, zoom: number) => void;
  onTileError: () => void;
}

export class MapView {
  private readonly map: LeafletMap;
  private readonly tiles: TileLayer;
  private readonly resizeObserver: ResizeObserver;
  private accuracyCircle: Circle | null = null;

  constructor(element: HTMLElement, options: MapViewOptions) {
    this.map = L.map(element, {
      center: [options.center.latitude, options.center.longitude],
      zoom: options.zoom,
      zoomControl: true,
      attributionControl: false,
      dragging: true,
      touchZoom: true,
      scrollWheelZoom: true,
    });

    this.tiles = L.tileLayer(options.tileUrl, {
      attribution: options.attribution,
      maxZoom: 19,
    }).addTo(this.map);
    L.control.attribution({ position: 'topright' }).addTo(this.map);
    L.control
      .scale({ position: 'bottomleft', metric: true, imperial: false })
      .addTo(this.map);

    this.tiles.on('tileerror', options.onTileError);
    const updateCenter = () => {
      const viewport = readMapViewport(this.map);
      options.onCenterChange(viewport.center, viewport.zoom);
    };
    this.map.on('moveend zoomend', updateCenter);

    // Safariの表示領域変化後も、Leafletの中心とCSS中央を同じ寸法で計算する。
    this.resizeObserver = new ResizeObserver(() => {
      this.map.invalidateSize({ pan: false });
    });
    this.resizeObserver.observe(element);
  }

  moveTo(center: Coordinates, zoom?: number): void {
    this.map.setView(
      [center.latitude, center.longitude],
      resolveTargetZoom(this.map.getZoom(), zoom),
    );
  }

  showLocationAccuracy(reading: LocationReading): void {
    const visual = getAccuracyVisual(reading.accuracy);
    const latLng: L.LatLngExpression = [
      reading.coordinates.latitude,
      reading.coordinates.longitude,
    ];
    const pathOptions = {
      fillColor: visual.fillColor,
      fillOpacity: visual.fillOpacity,
      stroke: false,
    };

    if (this.accuracyCircle) {
      this.accuracyCircle
        .setLatLng(latLng)
        .setRadius(visual.radius)
        .setStyle(pathOptions);
      return;
    }

    this.accuracyCircle = L.circle(latLng, {
      ...pathOptions,
      radius: visual.radius,
      interactive: false,
    }).addTo(this.map);
  }
}
