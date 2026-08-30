'use client';

import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import Link from 'next/link';
import { MapPin, ArrowRight, Database } from 'lucide-react';
import type { ApiIssueListResponse } from '@/lib/issues/types';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function IssuesPage() {
  const { data, isLoading, error } = useSWR<ApiIssueListResponse>(
    '/api/issues',
    fetcher,
    { refreshInterval: 30000 },
  );

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-neutral-900 dark:text-white">Civic Issues</h1>
        <p className="text-neutral-600 dark:text-neutral-400 mt-2">
          {data ? `${data.total} report${data.total === 1 ? '' : 's'} in the database` : 'Loading live issues…'}
        </p>
      </div>

      <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
        <CardContent className="p-0">
          {isLoading && !data ? (
            <div className="divide-y divide-neutral-200 dark:divide-dark-border">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 bg-neutral-100 dark:bg-dark-border animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="p-10 text-center text-sm text-red-600 dark:text-red-400">
              Failed to load issues. Please try again.
            </div>
          ) : !data || data.issues.length === 0 ? (
            <div className="p-10 text-center">
              <Database className="w-10 h-10 text-neutral-300 dark:text-neutral-600 mx-auto mb-3" />
              <p className="text-sm text-neutral-500">No civic issues reported yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-200 dark:divide-dark-border">
              {data.issues.map((issue) => (
                <Link
                  key={issue.id}
                  href={`/dashboard/issues/${issue.id}`}
                  className="flex items-center justify-between p-6 hover:bg-neutral-50 dark:hover:bg-dark-bg transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-neutral-900 dark:text-white">{issue.publicId}</span>
                        <span className="text-sm text-neutral-600 dark:text-neutral-400">{issue.categoryLabel}</span>
                        {issue.byCurrentUser && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                            YOU
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-500 mt-1">
                        {issue.location || 'Location not provided'} • {issue.reportCount} report{issue.reportCount === 1 ? '' : 's'} • {issue.timeLabel}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden md:block">
                      <p className="text-xs text-neutral-500">Severity</p>
                      <p className="font-mono text-sm font-bold text-neutral-900 dark:text-white">
                        {issue.severityLabel ?? 'Pending AI'}
                      </p>
                    </div>
                    <div className="text-right hidden md:block">
                      <p className="text-xs text-neutral-500">Promise</p>
                      <p className="text-sm text-neutral-900 dark:text-white">{issue.promiseLabel ?? '—'}</p>
                    </div>
                    <Badge variant="status" status={issue.displayStatus} size="sm" />
                    <ArrowRight className="w-4 h-4 text-neutral-400" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}