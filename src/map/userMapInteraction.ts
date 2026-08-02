import { readMapViewport, type MapViewport } from './mapState';

type InteractionEvent =
  'dragstart' | 'dragend' | 'moveend' | 'zoomstart' | 'zoomend';

interface InteractionMap {
  getCenter(): { lat: number; lng: number };
  getZoom(): number;
  on(event: InteractionEvent, handler: () => void): unknown;
}

interface InteractionCallbacks {
  isProgrammaticMove: () => boolean;
  onUserInteractionStart: () => void;
  onUserInteractionEnd: (viewport: MapViewport) => void;
}

export function bindUserMapInteractionEvents(
  map: InteractionMap,
  callbacks: InteractionCallbacks,
): void {
  let dragActive = false;
  let dragEnded = false;
  let zoomActive = false;

  const startInteraction = () => {
    if (!dragActive && !zoomActive) callbacks.onUserInteractionStart();
  };
  const finishInteraction = () => {
    if (!dragActive && !zoomActive) return;
    dragActive = false;
    dragEnded = false;
    zoomActive = false;
    callbacks.onUserInteractionEnd(readMapViewport(map));
  };

  map.on('dragstart', () => {
    startInteraction();
    dragActive = true;
    dragEnded = false;
  });
  map.on('dragend', () => {
    if (dragActive) dragEnded = true;
  });
  map.on('moveend', () => {
    if (dragActive && dragEnded) finishInteraction();
  });
  map.on('zoomstart', () => {
    if (callbacks.isProgrammaticMove()) return;
    startInteraction();
    zoomActive = true;
  });
  map.on('zoomend', () => {
    if (zoomActive) finishInteraction();
  });
}
