'use client';

import React, { useState } from 'react';
import { AnalyticsPayload, QuestionStatsRow } from '../../types';
import UngradedCaveat from './UngradedCaveat';

interface QuestionStatsTableProps {
  signal: AnalyticsPayload['questionStats'];
  ungradedTotal: number;
}

type SortField = 'qId' | 'sampleSize' | 'passRate' | 'ungraded';
type SortOrder = 'asc' | 'desc';

export default function QuestionStatsTable({ signal, ungradedTotal }: QuestionStatsTableProps) {
  const [sortField, setSortField] = useState<SortField>('passRate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const sortedRows = [...signal.rows].sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];

    if (valA === null) valA = sortOrder === 'asc' ? 9999 : -1;
    if (valB === null) valB = sortOrder === 'asc' ? 9999 : -1;

    if (typeof valA === 'string' && typeof valB === 'string') {
      return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return sortOrder === 'asc' 
      ? (valA as number) - (valB as number) 
      : (valB as number) - (valA as number);
  });

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="overflow-x-auto rounded-lg border border-slate-700 bg-slate-900/50">
        <table className="min-w-full divide-y divide-slate-700 text-left text-sm text-slate-300">
          <thead className="bg-slate-800/80 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <tr>
              <th className="cursor-pointer px-4 py-3 hover:text-slate-200" onClick={() => handleSort('qId')}>
                Question ID {sortField === 'qId' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th className="cursor-pointer px-4 py-3 hover:text-slate-200" onClick={() => handleSort('sampleSize')}>
                Graded Samples {sortField === 'sampleSize' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th className="cursor-pointer px-4 py-3 hover:text-slate-200" onClick={() => handleSort('passRate')}>
                Pass Rate {sortField === 'passRate' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th className="cursor-pointer px-4 py-3 hover:text-slate-200" onClick={() => handleSort('ungraded')}>
                Ungraded {sortField === 'ungraded' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {sortedRows.map(row => (
              <tr key={row.qId} className="hover:bg-slate-800/40">
                <td className="whitespace-nowrap px-4 py-3 font-mono font-medium text-sky-400">{row.qId}</td>
                <td className="whitespace-nowrap px-4 py-3">{row.sampleSize}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  {row.enough_data ? (
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-emerald-400">{row.passRate}%</span>
                      <div className="h-2 w-16 overflow-hidden rounded bg-slate-700">
                        <div 
                          className="h-full bg-emerald-500" 
                          style={{ width: `${row.passRate}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <span className="text-slate-500">— <span className="text-xs">(need ≥5)</span></span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-medium text-amber-500">{row.ungraded || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <UngradedCaveat ungradedCount={ungradedTotal} />
    </div>
  );
}
