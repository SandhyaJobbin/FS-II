'use client';

import React from 'react';
import { Question } from '../../types';

interface ScenarioBlockProps {
  currentQuestion: Question;
}

export default function ScenarioBlock({ currentQuestion }: ScenarioBlockProps) {
  if (currentQuestion.section !== 'reading' && currentQuestion.bank !== 'critical') {
    return null;
  }

  const tab = currentQuestion.tabs?.[0];

  return (
    <div className="bg-card border border-[var(--card-border)] rounded-2xl shadow-2xl overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200 bg-slate-50">
        <div className="w-9 h-9 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
            <path d="M4 4h16v16H4z" opacity="0" />
            <path d="M22 6l-10 7L2 6" />
            <path d="M2 6h20v12H2z" />
          </svg>
        </div>
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-wider text-accent">
            {tab?.name || 'Scenario'}
          </div>
          <div className="text-base md:text-lg font-bold text-slate-900 truncate mt-1">
            {currentQuestion.case_title || 'Case Details'}
          </div>
        </div>
      </div>
      <div className="p-6 md:p-8 text-base md:text-lg text-slate-800 leading-loose whitespace-pre-wrap max-h-[600px] overflow-y-auto">
        {tab?.content}
      </div>
    </div>
  );
}
