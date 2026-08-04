'use client';

import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { AnalyticsPayload } from '../../types';
import LowNFallback from './LowNFallback';

interface BiasSignalsPanelProps {
  biasSignal: AnalyticsPayload['biasSignals'];
  discrimination: AnalyticsPayload['discriminationIndex'];
}

export default function BiasSignalsPanel({ biasSignal, discrimination }: BiasSignalsPanelProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  // Group distributions by window (last20 / allTime) for the bar chart
  const last20Data = biasSignal.tierDistribution.filter(item => item.window === 'last20');
  const allTimeData = biasSignal.tierDistribution.filter(item => item.window === 'allTime');

  const chartData = [
    {
      name: 'Last 20 attempts',
      'Strong Fit': last20Data.find(d => d.tier === 'Strong Fit')?.pct || 0,
      'Consider': last20Data.find(d => d.tier === 'Consider')?.pct || 0,
      'Not Recommended': last20Data.find(d => d.tier === 'Not Recommended')?.pct || 0
    },
    {
      name: 'All-time attempts',
      'Strong Fit': allTimeData.find(d => d.tier === 'Strong Fit')?.pct || 0,
      'Consider': allTimeData.find(d => d.tier === 'Consider')?.pct || 0,
      'Not Recommended': allTimeData.find(d => d.tier === 'Not Recommended')?.pct || 0
    }
  ];

  return (
    <div className="flex flex-col gap-6 w-full text-slate-300">
      {/* Bias signals section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-slate-700/50 pb-2">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Distribution Monitor</h3>
          <div className="relative">
            <button 
              className="text-slate-400 hover:text-slate-200 text-xs flex items-center gap-1 bg-slate-800 px-2 py-1 rounded"
              onClick={() => setShowTooltip(!showTooltip)}
            >
              Info ⓘ
            </button>
            {showTooltip && (
              <div className="absolute right-0 top-8 z-20 w-80 rounded-lg border border-amber-500/30 bg-slate-800 p-4 text-xs shadow-xl text-slate-300">
                This chart shows how the mix of Strong Fit / Consider / Not Recommended has shifted between the last 20 attempts and all-time. It does NOT measure bias against any protected class — this system does not collect demographic data. See v2 ADMIN2-04 for adverse-impact monitoring.
              </div>
            )}
          </div>
        </div>

        {!biasSignal.enough_data ? (
          <LowNFallback threshold={biasSignal.threshold} samples={biasSignal.samples} label="Distribution Monitor" />
        ) : (
          <div className="w-full h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                <XAxis type="number" domain={[0, 100]} stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} width={110} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }} />
                <Bar dataKey="Strong Fit" stackId="a" fill="#10b981" />
                <Bar dataKey="Consider" stackId="a" fill="#f59e0b" />
                <Bar dataKey="Not Recommended" stackId="a" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Discrimination index section */}
      <div className="flex flex-col gap-4 border-t border-slate-700/50 pt-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Discriminatory Question Monitor</h3>
        
        {!discrimination.enough_data ? (
          <LowNFallback threshold={discrimination.threshold} samples={discrimination.samples} label="Discriminatory Question Monitor" />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-700 bg-slate-900/50">
            <table className="min-w-full divide-y divide-slate-700 text-left text-xs text-slate-300">
              <thead className="bg-slate-800/80 uppercase tracking-wider text-slate-400 font-semibold">
                <tr>
                  <th className="px-3 py-2">Question ID</th>
                  <th className="px-3 py-2 text-right">Top Quartile Pass</th>
                  <th className="px-3 py-2 text-right">Bottom Quartile Pass</th>
                  <th className="px-3 py-2 text-right">Delta (Top - Bottom)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {discrimination.rows.slice(0, 5).map(row => (
                  <tr key={row.qId} className="hover:bg-slate-800/40">
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-sky-400">{row.qId}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right text-emerald-400">{row.passTop}%</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right text-slate-400">{row.passBottom}%</td>
                    <td className={`whitespace-nowrap px-3 py-2 text-right font-bold ${row.delta < 0 ? 'text-red-400' : 'text-slate-300'}`}>
                      {row.delta}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
