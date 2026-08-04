'use client';

import React from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { AnalyticsPayload } from '../../types';
import LowNFallback from './LowNFallback';

interface ViolationScatterProps {
  signal: AnalyticsPayload['violationCorrelation'];
}

export default function ViolationScatter({ signal }: ViolationScatterProps) {
  if (!signal.enough_data) {
    return <LowNFallback threshold={signal.threshold} samples={signal.samples} label="Violation vs. Score" />;
  }

  const getInterpretationColor = (interp?: string) => {
    if (interp === 'strong') return 'text-red-400 border-red-500/30 bg-red-500/10';
    if (interp === 'moderate') return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
    return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-slate-700 bg-slate-800/30">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Pearson Correlation (r)</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{signal.r !== null ? signal.r : '—'}</span>
            <span className="text-xs text-slate-400">over {signal.samples} samples</span>
          </div>
        </div>
        <div className={`px-3 py-1.5 rounded-lg border text-sm font-semibold uppercase tracking-wider ${getInterpretationColor(signal.interpretation)}`}>
          {signal.interpretation} Correlation
        </div>
      </div>

      <div className="w-full h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <XAxis 
              type="number" 
              dataKey="v" 
              name="Violations" 
              stroke="#94a3b8" 
              fontSize={12} 
              tickLine={false} 
              axisLine={false}
            />
            <YAxis 
              type="number" 
              dataKey="s" 
              name="Score" 
              domain={[0, 100]} 
              stroke="#94a3b8" 
              fontSize={12} 
              tickLine={false} 
              axisLine={false}
            />
            <Tooltip 
              cursor={{ strokeDasharray: '3 3' }}
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
              itemStyle={{ color: '#0284c7' }}
            />
            <Scatter 
              name="Attempts" 
              data={signal.points} 
              fill="#f43f5e" 
              line={false} 
              shape="circle"
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
