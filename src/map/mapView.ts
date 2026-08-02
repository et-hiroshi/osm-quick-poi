import L, { type Map as LeafletMap, type TileLayer } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Coordinates } from '../types/location';

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

  constructor(element: HTMLElement, options: MapViewOptions) {
    this.map = L.map(element, {
      center: [options.center.latitude, options.center.longitude],
      zoom: options.zoom,
      zoomControl: true,
      attributionControl: true,
      dragging: true,
      touchZoom: true,
      scrollWheelZoom: true,
    });

    this.tiles = L.tileLayer(options.tileUrl, {
      attribution: options.attribution,
      maxZoom: 19,
    }).addTo(this.map);

    this.tiles.on('tileerror', options.onTileError);
    this.map.on('moveend zoomend', () => {
      const center = this.map.getCenter();
      options.onCenterChange(
        { latitude: center.lat, longitude: center.lng },
        this.map.getZoom(),
      );
    });
  }

  moveTo(center: Coordinates, zoom: number): void {
    this.map.setView([center.latitude, center.longitude], zoom);
  }
}
