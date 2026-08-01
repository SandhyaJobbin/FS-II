'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { MagnifyingGlass } from '@phosphor-icons/react';
import { Tab, TableContent } from '../types';
import { mergeSections } from './case-dashboard/parser';
import {
  IdentityCard, ReviewCard, BookingCard, PropertyCard, ConnectedCard, ReportsCard, ReferenceDataCard,
} from './case-dashboard/DashboardCards';

interface CaseDashboardProps {
  tabs: Tab[];
  tables?: TableContent[] | null;
  caseTitle?: string | null;
  caseId?: string | null;
}

export default function CaseDashboard({ tabs, tables, caseTitle, caseId }: CaseDashboardProps) {
  const sections = useMemo(() => mergeSections(tabs), [tabs]);

  if (!tabs || tabs.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="bg-card border border-[var(--card-border)] rounded-2xl w-full shadow-2xl overflow-hidden"
    >
      {/* Dashboard header */}
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0">
            <MagnifyingGlass weight="duotone" className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-wider text-accent">Case Review Dashboard</div>
            <div className="text-base md:text-lg font-bold text-slate-900 truncate">{caseTitle || 'Investigation Case File'}</div>
          </div>
        </div>
        {caseId && (
          <span className="text-sm font-mono text-slate-650 bg-slate-100 border border-slate-200 rounded-full px-3 py-1 shrink-0">
            {caseId}
          </span>
        )}
      </div>

      {/* Evidence grid — every section always renders; missing data shows as "Not available" */}
      <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <IdentityCard section={sections.identity} />
        <ReviewCard section={sections.review} />
        <BookingCard section={sections.booking} />
        <PropertyCard section={sections.property} />
        <ConnectedCard section={sections.connected} />
        <ReportsCard section={sections.reports} />
        <div className="md:col-span-2">
          <ReferenceDataCard tables={tables} />
        </div>
      </div>
    </motion.div>
  );
}
