'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import type * as LeafletTypes from 'leaflet';
// UMD builds must be loaded on the client: leaflet.markercluster and leaflet.heat
// register themselves on the global `L`, so we embed Leaflet's UMD build (which
// assigns `window.L`) and read that same global here. This keeps Leaflet, the
// cluster plugin, and the heatmap plugin on a single L instance regardless of
// the bundler splitting ESM.
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet/dist/leaflet.js';
import 'leaflet.markercluster/dist/leaflet.markercluster.js';
import 'leaflet.heat/dist/leaflet-heat.js';
import { STATUS_COLORS } from '@/components/dashboard/mapConstants';
import {
  MEERUT_CENTER_LATLNG,
  MEERUT_DEFAULT_ZOOM,
  addLeafletBasemaps,
  leafletLocateErrorMessage,
} from '@/lib/map/basemap';
import type { IssueListItem } from '@/lib/issues/types';

/** Global Leaflet instance populated by the UMD builds above. */
const L = (globalThis as unknown as { L: typeof import('leaflet') }).L;

export type MapView = 'markers' | 'heatmap';

export interface CivicMapPoint {
  id: string;
  publicId: string;
  title: string;
  categoryLabel: string;
  displayStatus: string;
  latitude: number;
  longitude: number;
}

interface MarkerClusterLike extends LeafletTypes.Layer {
  clearLayers(): void;
  addLayers(layers: LeafletTypes.Layer[]): void;
  zoomToShowLayer(layer: LeafletTypes.Layer, cb?: () => void): void;
}

interface HeatLayerLike extends LeafletTypes.Layer {
  setLatLngs(latLngs: Array<[number, number] | [number, number, number]>): this;
  setOptions(o: Record<string, unknown>): this;
  addTo(map: LeafletTypes.Map): this;
}

const ClusterGroupL = L as typeof L & {
  markerClusterGroup: (opts?: Record<string, unknown>) => MarkerClusterLike;
  heatLayer: (latlngs: Array<[number, number] | [number, number, number]>, opts?: Record<string, unknown>) => HeatLayerLike;
};

/** Priority-aware weighting: Critical is the hottest, Low the coolest. */
const PRIORITY_WEIGHT: Record<string, number> = {
  CRITICAL: 1.0,
  HIGH: 0.75,
  MEDIUM: 0.5,
  LOW: 0.25,
};

const SEVERITY_WEIGHT: Record<string, number> = {
  CRITICAL: 1.0,
  HIGH: 0.75,
  MEDIUM: 0.5,
  LOW: 0.25,
};

const HEAT_GRADIENT: Record<number, string> = {
  0.2: 'rgba(59,130,246,0.55)',
  0.4: 'rgba(16,185,129,0.65)',
  0.6: 'rgba(250,204,21,0.8)',
  0.8: 'rgba(245,158,11,0.9)',
  1.0: 'rgba(220,38,38,0.95)',
};

function markerColor(status: string): string {
  return STATUS_COLORS[status] ?? STATUS_COLORS.active ?? '#2563eb';
}

function pointWeight(issue: IssueListItem): number {
  if (issue.priorityLevel && PRIORITY_WEIGHT[issue.priorityLevel] != null) {
    return PRIORITY_WEIGHT[issue.priorityLevel];
  }
  if (issue.severity && SEVERITY_WEIGHT[issue.severity] != null) {
    return SEVERITY_WEIGHT[issue.severity];
  }
  return 0.4;
}

function asPoint(issue: IssueListItem): CivicMapPoint {
  return {
    id: issue.id,
    publicId: issue.publicId,
    title: issue.title,
    categoryLabel: issue.categoryLabel,
    displayStatus: issue.displayStatus,
    latitude: issue.latitude!,
    longitude: issue.longitude!,
  };
}

function buildPopup(p: CivicMapPoint, statusLabel?: string): string {
  return `
<div style="font-family:system-ui,-apple-system,sans-serif;min-width:200px;max-width:260px">
  <div style="font-family:ui-monospace,monospace;font-size:11px;color:#2563eb;margin-bottom:2px">${p.publicId}</div>
  <div style="font-size:13px;font-weight:600;color:#111827;line-height:1.35">${p.title}</div>
  <div style="display:flex;align-items:center;gap:6px;margin-top:5px;font-size:12px;color:#4b5563">
    <span>📁</span><span>${p.categoryLabel}</span>
  </div>
  <div style="display:flex;align-items:center;gap:6px;margin-top:3px;font-size:12px;color:#4b5563">
    <span style="width:8px;height:8px;border-radius:50%;background:${markerColor(p.displayStatus)};flex-shrink:0"></span>
    <span>${statusLabel ?? p.displayStatus}</span>
  </div>
</div>`;
}

/**
 * Live Leaflet + OpenStreetMap view of located civic reports. Markers mode draws
 * a status-colored, clustered marker for every report; heatmap mode replaces
 * them with a priority-weighted density heat layer over the same points.
 * Selecting a marker (or a row in the report list) keeps the detail panel in
 * sync and opens a tight selection popup. SSR-avoided by the wrapper's
 * `next/dynamic(..., { ssr: false })`.
 */
export function CivicMapInner({
  issues,
  selectedId,
  focus,
  onSelectImage,
  view = 'markers',
  className,
}: {
  issues: IssueListItem[];
  selectedId: string | null;
  focus?: IssueListItem | null;
  onSelectImage?: (id: string | null) => void;
  view?: MapView;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletTypes.Map | null>(null);
  const clusterRef = useRef<MarkerClusterLike | null>(null);
  const heatRef = useRef<HeatLayerLike | null>(null);
  const markersRef = useRef<Map<string, LeafletTypes.Marker>>(new Map());
  const pointsRef = useRef<CivicMapPoint[]>([]);
  const lastKeyRef = useRef<string>('');
  const onSelectRef = useRef(onSelectImage);
  const locateMarkerRef = useRef<LeafletTypes.Marker | null>(null);
  const [offline, setOffline] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  useEffect(() => {
    onSelectRef.current = onSelectImage;
  });

  const located = useMemo(
    () =>
      issues
        .filter((i) => i.latitude != null && i.longitude != null && Number.isFinite(i.latitude) && Number.isFinite(i.longitude))
        .map(asPoint),
    [issues],
  );

  const pointsKey = useMemo(
    () => located.map((p) => `${p.id}:${p.latitude}:${p.longitude}:${p.displayStatus}:${p.categoryLabel}`).join('|'),
    [located],
  );

  // Default view is Meerut (28.98, 77.70) at zoom 14 on satellite-with-labels.
  // Once located reports arrive, the marker effect below fits the view to them.
  const center: [number, number] =
    located.length > 0
      ? [located.reduce((s, p) => s + p.latitude, 0) / located.length, located.reduce((s, p) => s + p.longitude, 0) / located.length]
      : [MEERUT_CENTER_LATLNG[0], MEERUT_CENTER_LATLNG[1]];

  // Weighted heat data shared between the layer's data-sync and enable effects.
  const heatData = useMemo<Array<[number, number, number]>>(() => {
    const byId = new Map(issues.map((i) => [i.id, i]));
    return located.map((p) => {
      const issue = byId.get(p.id);
      const intensity = issue ? pointWeight(issue) : 0.4;
      return [p.latitude, p.longitude, intensity];
    });
  }, [located, issues]);

  // Build + own the base map once for the lifetime of the mount.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center,
      zoom: located.length === 1 ? 14 : located.length > 0 ? 12 : MEERUT_DEFAULT_ZOOM,
      zoomControl: false,
      attributionControl: true,
      maxZoom: 19,
    });
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Free basemaps: Satellite (with labels) is the default; the layer
    // control offers Satellite without labels + Street (OSM) as alternatives.
    addLeafletBasemaps(L as never, map as never, () => setOffline(true));
    map.on('error', () => setOffline(true));

    const cluster = ClusterGroupL.markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 55,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      disableClusteringAtZoom: 16,
      iconCreateFunction: (clust: { getChildCount: () => number }) => {
        const count = clust.getChildCount();
        let size = 38;
        if (count >= 20) size = 54;
        else if (count >= 5) size = 46;
        return L.divIcon({
          html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:rgba(63,83,236,0.9);border:3px solid rgba(255,255,255,0.9);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:${count >= 10 ? 12 : 13}px;font-family:system-ui;box-shadow:0 2px 8px rgba(0,0,0,0.3)">${count}</div>`,
          className: 'marker-cluster-civic',
          iconSize: L.point(size, size),
        });
      },
    });

    const heat = ClusterGroupL.heatLayer([], {
      radius: 28,
      blur: 20,
      maxZoom: 16,
      max: 1.0,
      minOpacity: 0.4,
      gradient: HEAT_GRADIENT,
    });

    map.addLayer(cluster as LeafletTypes.Layer);
    map.addLayer(heat);

    mapRef.current = map;
    clusterRef.current = cluster;
    heatRef.current = heat;
    // StrictMode (dev) double-mounts: a fresh map must not be short-circuited
    // by the key guard carried over from the previous mount.
    lastKeyRef.current = '';

    return () => {
      markersRef.current.clear();
      locateMarkerRef.current?.remove();
      locateMarkerRef.current = null;
      cluster.clearLayers?.();
      map.remove();
      mapRef.current = null;
      clusterRef.current = null;
      heatRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // (Re)build markers whenever the located set (or its status colours) change.
  const selectedPoint = selectedId ? located.find((p) => p.id === selectedId) ?? null : null;
  useEffect(() => {
    const map = mapRef.current;
    const cluster = clusterRef.current;
    if (!map || !cluster) return;
    if (pointsKey === lastKeyRef.current) return;
    lastKeyRef.current = pointsKey;

    cluster.clearLayers?.();
    markersRef.current.clear();
    pointsRef.current = located;

    if (located.length === 0) return;

    const markers = located.map((p) => {
      const color = markerColor(p.displayStatus);
      const r = 7;
      const el = L.divIcon({
        html: `<div style="width:${r * 2}px;height:${r * 2}px;border-radius:50%;background:${color};border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.35)"></div>`,
        className: '',
        iconSize: L.point(r * 2, r * 2),
        iconAnchor: L.point(r, r),
      });
      const m = L.marker([p.latitude, p.longitude], { icon: el });
      m.bindPopup(buildPopup(p), {
        maxWidth: 280,
        minWidth: 220,
        closeButton: true,
        autoClose: false,
        closeOnClick: false,
        className: 'civic-popup',
      });
      m.on('click', () => onSelectRef.current?.(p.id));
      return m;
    });

    cluster.addLayers(markers);
    markersRef.current = new Map(markers.map((m, i) => [located[i].id, m]));

    if (located.length === 1) {
      map.setView([located[0].latitude, located[0].longitude], 14);
    } else {
      const bounds = L.latLngBounds(located.map((p) => [p.latitude, p.longitude] as [number, number]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointsKey]);

  // Keep the heat layer's weighted data in sync with the located set (only
  // while it is attached, otherwise setLatLngs redraws against a detached map).
  useEffect(() => {
    const heat = heatRef.current;
    if (!heat || view !== 'heatmap') return;
    heat.setLatLngs(heatData);
  }, [view, heatData]);

  // Toggle markers vs. heatmap layers with the active view.
  useEffect(() => {
    const map = mapRef.current;
    const cluster = clusterRef.current;
    const heat = heatRef.current;
    if (!map || !cluster || !heat) return;
    if (view === 'heatmap') {
      map.removeLayer(cluster);
      if (!map.hasLayer(heat)) {
        map.addLayer(heat);
        heat.setLatLngs(heatData);
      }
    } else {
      map.removeLayer(heat);
      if (!map.hasLayer(cluster)) map.addLayer(cluster);
    }
  }, [view, heatData]);

  // Selection: fly to + open a tight popup on the selected report (revealing it
  // if it lives inside a cluster).
  useEffect(() => {
    const map = mapRef.current;
    const cluster = clusterRef.current;
    if (!map) return;
    if (!selectedPoint) return;
    const mk = markersRef.current.get(selectedPoint.id);
    map.flyTo([selectedPoint.latitude, selectedPoint.longitude], Math.max(map.getZoom(), 14), {
      duration: reduce ? 0 : 0.9,
    });
    const reveal = () => {
      try {
        mk?.openPopup();
      } catch {
        /* popup may not be attached yet under clustering */
      }
    };
    if (mk && cluster) {
      cluster.zoomToShowLayer(mk, reveal);
    } else {
      reveal();
    }
  }, [selectedId, selectedPoint, reduce]);

  // External navigation (normally from a report-list click): fly to + select.
  const focusId = focus?.id ?? '';
  useEffect(() => {
    const map = mapRef.current;
    const target = focusId ? pointsRef.current.find((p) => p.id === focusId) : null;
    if (!map || !target) return;
    map.flyTo([target.latitude, target.longitude], Math.max(map.getZoom(), 14), {
      duration: reduce ? 0 : 0.9,
    });
    onSelectRef.current?.(target.id);
  }, [focusId, reduce]);

  // "Locate me": center on the user's position, with explicit messaging for
  // denied permission / timeout / unsupported browsers.
  const handleLocate = () => {
    const map = mapRef.current;
    if (!map) return;
    if (!('geolocation' in navigator)) {
      setLocateError('Geolocation is not available in this browser.');
      return;
    }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude, longitude } = pos.coords;
        map.flyTo([latitude, longitude], Math.max(map.getZoom(), 15), {
          duration: reduce ? 0 : 0.9,
        });
        locateMarkerRef.current?.remove();
        const dot = L.divIcon({
          html: '<div style="width:16px;height:16px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,0.4)"></div>',
          className: '',
          iconSize: L.point(16, 16),
          iconAnchor: L.point(8, 8),
        });
        locateMarkerRef.current = L.marker([latitude, longitude], { icon: dot })
          .addTo(map)
          .bindPopup('You are here')
          .openPopup();
      },
      (err) => {
        setLocating(false);
        setLocateError(leafletLocateErrorMessage(err.code));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  return (
    <div className={className ?? 'relative w-full h-full min-h-[300px]'} role="region" aria-label="Civic issues map">
      <style>{`
        .marker-cluster-small,.marker-cluster-medium,.marker-cluster-large{background:transparent!important}
        .marker-cluster-civic div{width:100%;height:100%;border-radius:50%}
        .civic-popup .leaflet-popup-content-wrapper{border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,0.15);padding:0}
        .civic-popup .leaflet-popup-content{margin:12px 14px}
        .leaflet-control-layers{background:rgba(255,255,255,0.95);border-radius:10px;font-size:12px}
      `}</style>
      <div ref={containerRef} className="absolute inset-0" />
      {/* Locate-me control */}
      <button
        type="button"
        onClick={handleLocate}
        disabled={locating}
        aria-label="Center the map on my location"
        title="Locate me"
        className="absolute bottom-4 right-4 z-[500] inline-flex items-center gap-1.5 rounded-full bg-white/95 border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 shadow-sm hover:bg-white disabled:opacity-60 dark:bg-dark-bg/95 dark:text-neutral-200 dark:border-dark-border"
      >
        {locating ? 'Locating…' : '◎ Locate me'}
      </button>
      {locateError && (
        <div className="absolute inset-x-4 bottom-14 p-2.5 rounded-lg bg-white/95 border border-amber-200 text-xs text-amber-800 shadow-sm dark:bg-dark-bg/95 dark:text-amber-200 dark:border-amber-800">
          {locateError}
        </div>
      )}
      {offline && (
        <div className="absolute inset-x-4 bottom-4 p-3 rounded-lg bg-neutral-900/85 dark:bg-dark-bg/85 border border-neutral-200 dark:border-dark-border text-xs text-white dark:text-neutral-200">
          Map tiles could not be loaded (offline?). Report positions are still laid out by coordinate.
        </div>
      )}
    </div>
  );
}
