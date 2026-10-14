'use client';

import { useEffect, useRef, useState } from 'react';
import { Map, Marker, Popup, NavigationControl, GeolocateControl, type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { DEFAULT_MAPLIBRE_STYLE, MAPLIBRE_BASEMAP_STYLES } from '@/components/dashboard/mapConstants';
import type { MaplibreBasemapId } from '@/lib/map/basemap';
import { MEERUT_CENTER_LNGLAT, MEERUT_DEFAULT_ZOOM } from '@/lib/map/basemap';

const SLA_COLORS: Record<string, string> = {
  BREACHED: '#ef4444',
  AT_RISK: '#f59e0b',
  ON_TRACK: '#10b981',
  RESOLVED: '#9ca3af',
};

function slaColor(sla: string): string {
  return SLA_COLORS[sla] ?? '#2563eb';
}

export interface CommandCenterMapMarker {
  id: string;
  publicId: string;
  title: string;
  latitude: number;
  longitude: number;
  displayStatus: string;
  severityLabel: string | null;
  categoryLabel: string;
  slaState: string;
  riskLevel: string | null;
}

export function CommandCenterMap({
  markers,
  onSelect,
  selectedId,
  className,
}: {
  markers: CommandCenterMapMarker[];
  onSelect?: (id: string) => void;
  selectedId?: string | null;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [offline, setOffline] = useState(false);
  const [basemap, setBasemap] = useState<MaplibreBasemapId>('satellite-labels');

  // Default view: Meerut (28.98, 77.70) at zoom 14 on satellite-with-labels.
  const center: [number, number] =
    markers.length > 0
      ? [
          markers.reduce((s, m) => s + m.longitude, 0) / markers.length,
          markers.reduce((s, m) => s + m.latitude, 0) / markers.length,
        ]
      : MEERUT_CENTER_LNGLAT;

  const zoom = markers.length === 1 ? 15 : markers.length > 0 ? 11 : MEERUT_DEFAULT_ZOOM;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new Map({
      container: containerRef.current,
      style: DEFAULT_MAPLIBRE_STYLE as StyleSpecification,
      center,
      zoom,
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    // Built-in locate-me (handles denied permission with an error event).
    const geo = new GeolocateControl({
      positionOptions: { enableHighAccuracy: true, timeout: 10000 },
      trackUserLocation: false,
      showUserLocation: true,
    });
    map.addControl(geo, 'bottom-right');
    geo.on('error', () => setOffline(false));
    map.on('error', () => setOffline(true));
    mapRef.current = map;
    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Basemap switching (satellite-with-labels default; Satellite / Street free).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    try {
      map.setStyle(MAPLIBRE_BASEMAP_STYLES[basemap] as unknown as StyleSpecification);
    } catch {
      /* keep current style on failure */
    }
  }, [basemap]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = markers.map((marker) => {
      const popup = new Popup({ offset: 26 }).setHTML(
        `<div style="font-family:system-ui;min-width:140px">
          <strong style="font-family:monospace;font-size:11px;color:#2563eb">${marker.publicId}</strong><br/>
          <span style="font-size:13px">${marker.title}</span><br/>
          <span style="font-size:11px;color:#666">${marker.categoryLabel}</span>
          <div style="margin-top:4px;display:flex;gap:4px;flex-wrap:wrap">
            <span style="font-size:10px;padding:2px 6px;border-radius:9999px;background:${slaColor(marker.slaState)}22;color:${slaColor(marker.slaState)};border:1px solid ${slaColor(marker.slaState)}44">${marker.slaState.replace('_', ' ')}</span>
            ${marker.severityLabel ? `<span style="font-size:10px;padding:2px 6px;border-radius:9999px;background:#f3f4f6;color:#374151">${marker.severityLabel}</span>` : ''}
          </div>
        </div>`,
      );
      const el = document.createElement('div');
      el.style.cssText = `width:14px;height:14px;border-radius:50%;background:${slaColor(marker.slaState)};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.3);cursor:pointer;${marker.id === selectedId ? 'outline:3px solid #2563eb;outline-offset:2px;' : ''}`;
      el.addEventListener('click', () => onSelect?.(marker.id));
      return new Marker({ element: el })
        .setLngLat([marker.longitude, marker.latitude])
        .setPopup(popup)
        .addTo(map);
    });
    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
    };
  }, [markers, onSelect, selectedId]);

  return (
    <div className={`relative overflow-hidden rounded-xl border border-neutral-200 dark:border-dark-border bg-neutral-100 dark:bg-dark-bg ${className ?? ''}`}>
      <div ref={containerRef} className="absolute inset-0" />
      {/* Free basemap switcher: Satellite (with labels) default */}
      <div className="absolute top-3 left-3 z-10 inline-flex items-center gap-1 rounded-full bg-white/95 border border-neutral-200 p-1 shadow-sm dark:bg-dark-bg/95 dark:border-dark-border">
        {(['satellite-labels', 'satellite', 'street'] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setBasemap(id)}
            aria-pressed={basemap === id}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-full transition-colors ${
              basemap === id
                ? 'bg-brand-600 text-white'
                : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
            }`}
          >
            {id === 'satellite-labels' ? 'Satellite' : id === 'satellite' ? 'Satellite plain' : 'Street'}
          </button>
        ))}
      </div>
      {offline && (
        <div className="absolute inset-x-4 bottom-4 p-3 rounded-lg bg-white/95 dark:bg-dark-bg/95 border border-neutral-200 dark:border-dark-border text-xs text-neutral-700 dark:text-neutral-200 shadow-sm">
          Map tiles could not be loaded (offline?). Markers are still laid out by coordinate.
        </div>
      )}
    </div>
  );
}
