import type { StyleSpecification } from 'maplibre-gl';
import {
  MAPLIBRE_BASEMAP_STYLES,
  OSM_STREET_STYLE,
  SATELLITE_STYLE,
  SATELLITE_WITH_LABELS_STYLE,
} from '@/lib/map/basemap';

/** CARTO Voyager raster tile style — kept for backwards compatibility. */
export const CARTO_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    'carto-voyager': {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors © CARTO',
    },
  },
  layers: [{ id: 'carto-voyager', type: 'raster', source: 'carto-voyager' }],
};

/**
 * Default MapLibre basemap: Esri satellite + place/boundary labels.
 * Use `MAPLIBRE_BASEMAP_STYLES[id]` with `map.setStyle()` to switch.
 */
export const DEFAULT_MAPLIBRE_STYLE = SATELLITE_WITH_LABELS_STYLE as unknown as StyleSpecification;

export { MAPLIBRE_BASEMAP_STYLES, OSM_STREET_STYLE, SATELLITE_STYLE, SATELLITE_WITH_LABELS_STYLE };

/** Status → marker color mapping used by the civic map surfaces. */
export const STATUS_COLORS: Record<string, string> = {
  resolved: '#10b981',
  rejected: '#9ca3af',
  brokenPromise: '#ef4444',
  atRisk: '#f59e0b',
  verificationPending: '#8b5cf6',
  promised: '#06b6d4',
  assigned: '#8b5cf6',
  onTrack: '#10b981',
  active: '#2563eb',
  partiallyResolved: '#f59e0b',
};
