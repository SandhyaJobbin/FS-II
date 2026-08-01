'use client';

import React from 'react';
import CaseDashboard from '../CaseDashboard';
import { Tab, TableContent } from '../../types';

interface CaseFilePanelProps {
  tabs: Tab[];
  tables?: TableContent[] | null;
  caseTitle?: string | null;
  caseId?: string | null;
}

export default function CaseFilePanel({
  tabs,
  tables,
  caseTitle,
  caseId,
}: CaseFilePanelProps) {
  return (
    <CaseDashboard
      tabs={tabs}
      tables={tables}
      caseTitle={caseTitle}
      caseId={caseId}
    />
  );
}
