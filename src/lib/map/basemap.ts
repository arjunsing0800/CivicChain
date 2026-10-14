/**
 * Shared free basemap definitions for every map surface in CivicChain.
 *
 * - Satellite: Esri World Imagery (free, no API key).
 * - Labels: Esri World Boundaries and Places reference overlay (free, no key).
 * - Street: OpenStreetMap standard tiles (free, no key).
 *
 * Leaflet maps consume the URL + attribution constants via
 * `addLeafletBasemaps()`. MapLibre maps consume the raster StyleSpecification
 * objects. Keeping them here guarantees all map sections stay in sync.
 */

/** Meerut, India — the default map focus. [lng, lat] (GeoJSON order). */
export const MEERUT_CENTER_LNGLAT = [77.7, 28.98] as [number, number];
/** Meerut, India — [lat, lng] (Leaflet order). */
export const MEERUT_CENTER_LATLNG = [28.98, 77.7] as [number, number];
/** Initial zoom requested for the Meerut default view. */
export const MEERUT_DEFAULT_ZOOM = 14;

/** Esri World Imagery tile template (free, no API key required). */
export const ESRI_IMAGERY_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

/**
 * Esri reference overlay — place names, boundaries, roads — drawn on top of
 * the satellite imagery so the "Satellite (with labels)" view stays readable.
 */
export const ESRI_REFERENCE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';

/** OpenStreetMap street tiles (free, no API key required). */
export const OSM_STREET_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/** Required Esri attribution. */
export const ESRI_ATTRIBUTION =
  'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics';
/** Required OpenStreetMap attribution. */
export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export type LeafletBasemapId = 'satellite-labels' | 'satellite' | 'street';

export const LEAFLET_BASEMAP_LABELS: Record<LeafletBasemapId, string> = {
  'satellite-labels': 'Satellite (with labels)',
  satellite: 'Satellite',
  street: 'Street (OSM)',
};

/** Minimal structural type so this module stays Leaflet-free (no CSS import). */
interface LeafletGlobal {
  tileLayer: (url: string, opts?: Record<string, unknown>) => LeafletLayerLike;
  layerGroup: (layers: LeafletLayerLike[]) => LeafletLayerLike;
  control: {
    layers: (
      base: Record<string, LeafletLayerLike>,
      overlays?: Record<string, LeafletLayerLike>,
      opts?: Record<string, unknown>,
    ) => { addTo: (map: LeafletMapLike) => unknown };
  };
}

interface LeafletLayerLike {
  addTo: (map: LeafletMapLike) => LeafletLayerLike;
  on: (event: string, cb: () => void) => LeafletLayerLike;
}

interface LeafletMapLike {
  hasLayer?: (layer: unknown) => boolean;
}

/**
 * Attach the three switchable basemaps to a Leaflet map.
 *
 * Creates two independent Esri imagery instances (one lives inside the
 * "with labels" group, one stands alone) because a single Leaflet layer
 * instance cannot reliably belong to two layer-control entries at once.
 * Adds "Satellite (with labels)" by default and wires every tile layer's
 * `tileerror` to `onTileError` so callers can show their offline banner.
 */
export function addLeafletBasemaps(
  L: LeafletGlobal,
  map: LeafletMapLike,
  onTileError?: () => void,
) {
  const imageryForLabels = L.tileLayer(ESRI_IMAGERY_URL, {
    attribution: ESRI_ATTRIBUTION,
    maxZoom: 19,
  });
  const reference = L.tileLayer(ESRI_REFERENCE_URL, {
    attribution: ESRI_ATTRIBUTION,
    maxZoom: 19,
  });
  const satelliteImagery = L.tileLayer(ESRI_IMAGERY_URL, {
    attribution: ESRI_ATTRIBUTION,
    maxZoom: 19,
  });
  const street = L.tileLayer(OSM_STREET_URL, {
    attribution: OSM_ATTRIBUTION,
    maxZoom: 19,
  });

  const satelliteWithLabels = L.layerGroup([imageryForLabels, reference]);

  if (onTileError) {
    for (const layer of [imageryForLabels, reference, satelliteImagery, street]) {
      layer.on('tileerror', onTileError);
    }
  }

  // Default view: Satellite (with labels).
  satelliteWithLabels.addTo(map);
  L.control
    .layers(
      {
        [LEAFLET_BASEMAP_LABELS['satellite-labels']]: satelliteWithLabels,
        [LEAFLET_BASEMAP_LABELS.satellite]: satelliteImagery,
        [LEAFLET_BASEMAP_LABELS.street]: street,
      },
      undefined,
      { position: 'topright' },
    )
    .addTo(map);

  return { satelliteWithLabels, satellite: satelliteImagery, street, reference };
}

/**
 * Fly a Leaflet map to the user's position with clear edge-case messaging.
 * Returns a human-readable error string when geolocation fails, or null on
 * success. Callers display the string (denied permission, timeout, etc.).
 */
export function leafletLocateErrorMessage(code: number | null): string {
  if (code === 1) return 'Location permission denied. Enable location access and try again.';
  if (code === 2) return 'Your position is unavailable. Search for an address or click the map instead.';
  if (code === 3) return 'Location request timed out. Try again.';
  return 'Could not read your location. Search for an address or click the map instead.';
}

// ---------------------------------------------------------------------------
// MapLibre raster styles (same three free basemaps, same default)
// ---------------------------------------------------------------------------

export type MaplibreBasemapId = LeafletBasemapId;

export const MAPLIBRE_BASEMAP_LABELS: Record<MaplibreBasemapId, string> = {
  ...LEAFLET_BASEMAP_LABELS,
};

/** Minimal style-spec type so this module does not depend on maplibre-gl. */
interface RasterStyleSpec {
  version: 8;
  sources: Record<string, { type: 'raster'; tiles: string[]; tileSize: number; attribution: string }>;
  layers: Array<{ id: string; type: 'raster'; source: string }>;
}

/** Satellite + Esri place/boundary labels (the default everywhere). */
export const SATELLITE_WITH_LABELS_STYLE: RasterStyleSpec = {
  version: 8,
  sources: {
    'esri-imagery': {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      attribution: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics',
    },
    'esri-reference': {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      attribution: 'Tiles © Esri',
    },
  },
  layers: [
    { id: 'esri-imagery', type: 'raster', source: 'esri-imagery' },
    { id: 'esri-reference', type: 'raster', source: 'esri-reference' },
  ],
};

/** Pure satellite imagery, no labels. */
export const SATELLITE_STYLE: RasterStyleSpec = {
  version: 8,
  sources: {
    'esri-imagery': {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      attribution: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics',
    },
  },
  layers: [{ id: 'esri-imagery', type: 'raster', source: 'esri-imagery' }],
};

/** OpenStreetMap street basemap. */
export const OSM_STREET_STYLE: RasterStyleSpec = {
  version: 8,
  sources: {
    'osm-street': {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm-street', type: 'raster', source: 'osm-street' }],
};

export const MAPLIBRE_BASEMAP_STYLES: Record<MaplibreBasemapId, RasterStyleSpec> = {
  'satellite-labels': SATELLITE_WITH_LABELS_STYLE,
  satellite: SATELLITE_STYLE,
  street: OSM_STREET_STYLE,
};
