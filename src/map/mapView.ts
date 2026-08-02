import L, {
  type Circle,
  type CircleMarker,
  type LayerGroup,
  type Map as LeafletMap,
  type TileLayer,
} from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Coordinates, LocationReading } from '../types/location';
import { conveniencePoiKey, type ConveniencePoi } from '../types/convenience';
import { getAccuracyVisual } from './accuracyVisual';
import {
  readMapViewport,
  preserveViewportDuringResize,
  resolveTargetZoom,
  type MapViewport,
} from './mapState';
import { bindUserMapInteractionEvents } from './userMapInteraction';

interface MapViewOptions {
  center: Coordinates;
  zoom: number;
  tileUrl: string;
  attribution: string;
  onUserInteractionStart: () => void;
  onUserViewportChange: (center: Coordinates, zoom: number) => void;
  onTileError: () => void;
}

export class MapView {
  private readonly map: LeafletMap;
  private readonly tiles: TileLayer;
  private readonly resizeObserver: ResizeObserver;
  private accuracyCircle: Circle | null = null;
  private readonly convenienceLayer: LayerGroup;
  private readonly convenienceMarkers = new Map<string, CircleMarker>();
  private selectedPoiKey: string | null = null;
  private programmaticMove = false;

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
    this.convenienceLayer = L.layerGroup().addTo(this.map);

    this.tiles.on('tileerror', options.onTileError);
    bindUserMapInteractionEvents(this.map, {
      isProgrammaticMove: () => this.programmaticMove,
      onUserInteractionStart: options.onUserInteractionStart,
      onUserInteractionEnd: (viewport) =>
        options.onUserViewportChange(viewport.center, viewport.zoom),
    });

    // Safariの表示領域変化後も、Leafletの中心とCSS中央を同じ寸法で計算する。
    this.resizeObserver = new ResizeObserver(() => {
      this.runProgrammaticMove(() => {
        preserveViewportDuringResize(this.map);
      });
    });
    this.resizeObserver.observe(element);
  }

  moveTo(center: Coordinates, zoom?: number): MapViewport {
    this.runProgrammaticMove(() => {
      this.map.setView(
        [center.latitude, center.longitude],
        resolveTargetZoom(this.map.getZoom(), zoom),
      );
    });
    return readMapViewport(this.map);
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
        .setStyle(pathOptions)
        .bringToBack();
      return;
    }

    this.accuracyCircle = L.circle(latLng, {
      ...pathOptions,
      radius: visual.radius,
      interactive: false,
    }).addTo(this.map);
    this.accuracyCircle.bringToBack();
  }

  setConveniencePois(pois: ConveniencePoi[]): void {
    this.convenienceLayer.clearLayers();
    this.convenienceMarkers.clear();
    this.selectedPoiKey = null;

    pois.forEach((poi) => {
      const marker = L.circleMarker(
        [poi.coordinates.latitude, poi.coordinates.longitude],
        convenienceMarkerStyle(false),
      )
        .bindPopup(createPoiPopup(poi), { autoPan: false })
        .addTo(this.convenienceLayer);
      this.convenienceMarkers.set(conveniencePoiKey(poi), marker);
    });
  }

  selectConveniencePoi(key: string): void {
    if (this.selectedPoiKey) {
      this.convenienceMarkers
        .get(this.selectedPoiKey)
        ?.setStyle(convenienceMarkerStyle(false));
    }
    const marker = this.convenienceMarkers.get(key);
    if (!marker) return;
    this.selectedPoiKey = key;
    marker.setStyle(convenienceMarkerStyle(true)).bringToFront().openPopup();
  }

  private runProgrammaticMove(action: () => void): void {
    this.programmaticMove = true;
    try {
      action();
    } finally {
      this.programmaticMove = false;
    }
  }
}

function convenienceMarkerStyle(selected: boolean): L.CircleMarkerOptions {
  return {
    radius: selected ? 10 : 8,
    color: '#ffffff',
    weight: selected ? 3 : 2,
    fillColor: selected ? '#b56b22' : '#4d7180',
    fillOpacity: 0.95,
  };
}

function createPoiPopup(poi: ConveniencePoi): HTMLElement {
  const content = document.createElement('div');
  content.className = 'poi-popup';
  const name = document.createElement('strong');
  name.textContent = poi.name;
  content.append(name);

  if (poi.brand && poi.brand !== poi.name) {
    const brand = document.createElement('span');
    brand.textContent = poi.brand;
    content.append(brand);
  }

  const detail = document.createElement('span');
  detail.textContent = `ピンから${Math.round(poi.distanceMeters)}m · ${poi.osmType} ${poi.osmId}`;
  content.append(detail);

  const link = document.createElement('a');
  link.href = `https://www.openstreetmap.org/${poi.osmType}/${poi.osmId}`;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'OpenStreetMapで確認';
  content.append(link);
  return content;
}
