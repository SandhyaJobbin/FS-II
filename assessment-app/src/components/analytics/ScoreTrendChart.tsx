'use client';

import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { AnalyticsPayload } from '../../types';
import LowNFallback from './LowNFallback';
import UngradedCaveat from './UngradedCaveat';

interface ScoreTrendChartProps {
  signal: AnalyticsPayload['scoreTrend'];
  ungradedTotal: number;
}

export default function ScoreTrendChart({ signal, ungradedTotal }: ScoreTrendChartProps) {
  if (!signal.enough_data) {
    return <LowNFallback threshold={signal.threshold} samples={signal.samples} label="Score Trend" />;
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="w-full h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={signal.points} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <XAxis 
              dataKey="date" 
              stroke="#94a3b8" 
              fontSize={12} 
              tickLine={false} 
              axisLine={false} 
            />
            <YAxis 
              domain={[0, 100]} 
              stroke="#94a3b8" 
              fontSize={12} 
              tickLine={false} 
              axisLine={false} 
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
              labelStyle={{ color: '#94a3b8', fontWeight: 'bold' }}
              itemStyle={{ color: '#38bdf8' }}
            />
            <Line 
              type="monotone" 
              dataKey="avgScore" 
              name="Avg Score" 
              stroke="#0284c7" 
              strokeWidth={3} 
              dot={{ r: 4, stroke: '#38bdf8', strokeWidth: 2 }} 
              activeDot={{ r: 6 }} 
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <UngradedCaveat ungradedCount={ungradedTotal} />
    </div>
  );
}
