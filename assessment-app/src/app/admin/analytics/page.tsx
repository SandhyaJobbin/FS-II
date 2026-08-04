'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AnalyticsPayload } from '../../../types';
import ScoreTrendChart from '../../../components/analytics/ScoreTrendChart';
import QuestionStatsTable from '../../../components/analytics/QuestionStatsTable';
import ViolationScatter from '../../../components/analytics/ViolationScatter';
import BiasSignalsPanel from '../../../components/analytics/BiasSignalsPanel';

export default function AnalyticsPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [gasUrl, setGasUrl] = useState('');
  const [payload, setPayload] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshAt, setLastRefreshAt] = useState<number>(0);
  const [refreshHint, setRefreshHint] = useState<string | null>(null);

  useEffect(() => {
    const savedUrl = localStorage.getItem('fs_gas_url') || process.env.NEXT_PUBLIC_GAS_URL || '';
    setGasUrl(savedUrl);

    const savedAuth = sessionStorage.getItem('fs_admin_authenticated');
    const savedToken = sessionStorage.getItem('fs_admin_token');
    if (savedAuth === 'true' && savedToken) {
      setIsAuthenticated(true);
      setPasscode(savedToken);
    } else {
      // Redirect unauthorized users back to the admin login page
      router.replace('/admin');
    }
  }, [router]);

  const fetchAnalytics = async (urlToUse = gasUrl, token = passcode) => {
    if (!urlToUse) {
      setError('Please configure the Apps Script Web App URL first.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const fetchUrl = `${urlToUse}${urlToUse.includes('?') ? '&' : '?'}action=adminAnalytics&token=${encodeURIComponent(token)}`;
      const res = await fetch(fetchUrl);
      const data = await res.json();

      if (data.success) {
        setPayload(data);
      } else {
        setError(data.error || 'Failed to retrieve analytics data.');
      }
    } catch (err) {
      console.error(err);
      setError('Connection failed. Verify that your Apps Script Web App is deployed with CORS enabled for access.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && gasUrl) {
      fetchAnalytics();
    }
  }, [isAuthenticated, gasUrl]);

  const handleRefresh = () => {
    const now = Date.now();
    if (now - lastRefreshAt < 3000) {
      setRefreshHint('Please wait a moment before refreshing again...');
      setTimeout(() => setRefreshHint(null), 2000);
      return;
    }
    setLastRefreshAt(now);
    fetchAnalytics();
  };

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-300">
        <div className="text-center">
          <p className="text-sm text-slate-400">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-7xl flex flex-col gap-6">
        {/* Header navigation bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
              Recruiter Analytics Dashboard
            </h1>
            {payload && (
              <p className="text-xs text-slate-400">
                Generated at {new Date(payload.generatedAt).toLocaleString()} · {payload.meta.totalAttempts} attempt(s) graded · server aggregation time: {payload.meta.aggregationMs}ms
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Link 
              href="/admin" 
              className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              ← Back to Admin
            </Link>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {refreshHint && (
          <div className="text-sm text-amber-500 bg-amber-500/10 border border-amber-500/20 px-4 py-2 rounded-lg">
            {refreshHint}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {loading && !payload ? (
          <div className="flex h-64 items-center justify-center">
            <p className="text-slate-400">Loading analytics payload...</p>
          </div>
        ) : payload ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Score Trend Card */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 flex flex-col gap-4">
              <h2 className="text-base font-bold text-white uppercase tracking-wider">Candidate Score Trend</h2>
              <ScoreTrendChart signal={payload.scoreTrend} ungradedTotal={payload.meta.ungradedTotal} />
            </div>

            {/* Violation vs Score Correlation Card */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 flex flex-col gap-4">
              <h2 className="text-base font-bold text-white uppercase tracking-wider">Violation vs. Score Correlation</h2>
              <ViolationScatter signal={payload.violationCorrelation} />
            </div>

            {/* Question Stats Card */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 flex flex-col gap-4 lg:col-span-2">
              <h2 className="text-base font-bold text-white uppercase tracking-wider">Question Performance Analytics</h2>
              <QuestionStatsTable signal={payload.questionStats} ungradedTotal={payload.meta.ungradedTotal} />
            </div>

            {/* Distribution Monitor & Fairness Signals Card */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 flex flex-col gap-4 lg:col-span-2">
              <h2 className="text-base font-bold text-white uppercase tracking-wider">Evaluation Distribution & Quality Monitor</h2>
              <BiasSignalsPanel biasSignal={payload.biasSignals} discrimination={payload.discriminationIndex} />
            </div>
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center text-slate-500">
            No analytics data loaded. Verify config connection.
          </div>
        )}
      </div>
    </div>
  );
}
