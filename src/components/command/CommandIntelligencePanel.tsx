'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Map as MapIcon, Globe } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { CommandMap, type CommandMapPoint } from '@/components/command/CommandMap';
import { cn } from '@/lib/utils';

/**
 * Command Intelligence Panel — 2D live incident map plus a reserved 3D tab.
 *
 * The 3D Earth Map visualization lives here as a named placeholder until the
 * externally-built 3D view is integrated; the live satellite Leaflet map
 * below it is the operational view and stays fully functional.
 */

interface IntelligencePanelProps {
  mapPoints: CommandMapPoint[];
  selectedId: string | null;
  onSelectIssue: (id: string | null) => void;
}

type ViewMode = '2d' | '3d';

export function CommandIntelligencePanel({
  mapPoints,
  selectedId,
  onSelectIssue,
}: IntelligencePanelProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('2d');

  return (
    <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200/80 dark:border-dark-border/80 overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
        <div>
          <CardTitle as="h2" className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
            {viewMode === '3d' ? (
              <Globe className="w-4 h-4 text-violet-500" />
            ) : (
              <MapIcon className="w-4 h-4 text-brand-500" />
            )}
            {viewMode === '3d' ? '3D Earth Map' : 'Live Incident Command Map'}
          </CardTitle>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
            {viewMode === '3d'
              ? 'Interactive 3D earth view appears here — live satellite map below'
              : 'Real-time civic activity and incident intelligence'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-0.5 rounded-lg border border-neutral-200 dark:border-dark-border p-0.5 bg-neutral-50 dark:bg-dark-bg">
            <button
              type="button"
              onClick={() => setViewMode('2d')}
              className={cn(
                'px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
                viewMode === '2d'
                  ? 'bg-white dark:bg-dark-bg-card text-neutral-900 dark:text-white shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300',
              )}
            >
              <MapIcon className="w-3.5 h-3.5 inline mr-1" />
              Map
            </button>
            <button
              type="button"
              onClick={() => setViewMode('3d')}
              className={cn(
                'px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
                viewMode === '3d'
                  ? 'bg-white dark:bg-dark-bg-card text-neutral-900 dark:text-white shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300',
              )}
            >
              <Globe className="w-3.5 h-3.5 inline mr-1" />
              3D
            </button>
          </div>
          <Link href="/admin/map" className="text-xs text-brand-600 dark:text-brand-400 flex items-center gap-1 hover:underline">
            Full map <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {viewMode === '2d' ? (
          <div className="relative h-[350px] md:h-[450px]">
            <CommandMap
              points={mapPoints}
              selectedId={selectedId}
              onSelect={(id) => onSelectIssue(id || null)}
            />
          </div>
        ) : (
          // 3D Earth Map placeholder (the 3D visualization was removed) with
          // the live satellite map below — same incidents, shared selection.
          <div className="grid gap-4 p-4">
            <div className="relative overflow-hidden rounded-xl border border-dashed border-neutral-300 dark:border-dark-border bg-neutral-50 dark:bg-dark-bg px-6 py-10 text-center">
              <div className="w-12 h-12 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center mx-auto mb-3">
                <Globe className="w-6 h-6 text-violet-500" aria-hidden="true" />
              </div>
              <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">3D Earth Map</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-sm mx-auto">
                The interactive 3D earth visualization will appear here. Meanwhile, the live
                satellite map below shows every located incident.
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">
                Live satellite map — same incidents, synced selection
              </p>
              <CommandMap
                points={mapPoints}
                selectedId={selectedId}
                onSelect={(id) => onSelectIssue(id || null)}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
