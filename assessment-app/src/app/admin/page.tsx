'use client';

import React, { useState, useEffect } from 'react';
import ReportScreen from '../../components/ReportScreen';
import { Report } from '../../types';

interface CandidateRow {
  attemptId: string;
  name: string;
  email: string;
  startTime: string;
  endTime: string;
  status: string;
  overallScore: number | string;
  violationCount: number;
  recommendation?: string;
  recommendationTier?: string;
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [gasUrl, setGasUrl] = useState('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Load configuration/URL on mount
  useEffect(() => {
    const savedUrl = localStorage.getItem('fs_gas_url') || process.env.NEXT_PUBLIC_GAS_URL || '';
    setGasUrl(savedUrl);

    const savedAuth = sessionStorage.getItem('fs_admin_authenticated');
    const savedToken = sessionStorage.getItem('fs_admin_token');
    if (savedAuth === 'true' && savedToken) {
      setIsAuthenticated(true);
      setPasscode(savedToken);
    }
  }, []);

  // Fetch candidates from backend
  const fetchCandidates = async (urlToUse = gasUrl) => {
    if (!urlToUse) {
      setError('Please configure the Apps Script Web App URL first.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = sessionStorage.getItem('fs_admin_token') || passcode;
      const fetchUrl = `${urlToUse}${urlToUse.includes('?') ? '&' : '?'}action=adminListCandidates&token=${encodeURIComponent(token)}`;
      const res = await fetch(fetchUrl);
      const data = await res.json();

      if (data.success) {
        setCandidates(data.list || []);
      } else {
        setError(data.error || 'Failed to retrieve candidates list.');
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
      fetchCandidates();
    }
  }, [isAuthenticated, gasUrl]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gasUrl) {
      setError('Please configure the Apps Script Web App URL first.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const fetchUrl = `${gasUrl}${gasUrl.includes('?') ? '&' : '?'}action=adminListCandidates&token=${encodeURIComponent(passcode)}`;
      const res = await fetch(fetchUrl);
      const data = await res.json();

      if (data.success) {
        setIsAuthenticated(true);
        sessionStorage.setItem('fs_admin_authenticated', 'true');
        sessionStorage.setItem('fs_admin_token', passcode);
        setCandidates(data.list || []);
      } else {
        setError(data.error || 'Invalid passcode.');
      }
    } catch (err) {
      console.error(err);
      setError('Connection failed. Verify that your Apps Script Web App is deployed with CORS enabled for access.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('fs_admin_authenticated');
    sessionStorage.removeItem('fs_admin_token');
    setCandidates([]);
  };

  const handleResetAttempt = async (email: string) => {
    if (!window.confirm(`Are you sure you want to reset and delete all attempts for ${email}?`)) {
      return;
    }

    setLoading(true);
    setError(null);
    setActionMessage(null);

    try {
      const res = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        redirect: 'follow',
        body: JSON.stringify({
          action: 'adminResetAttempt',
          email,
          token: sessionStorage.getItem('fs_admin_token') || passcode,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setActionMessage(data.message || 'Attempt reset successfully.');
        // Refresh list
        await fetchCandidates();
      } else {
        setError(data.error || 'Failed to reset attempt.');
      }
    } catch (err) {
      console.error(err);
      setError('Failed to communicate reset request to server.');
    } finally {
      setLoading(false);
    }
  };

  const handleViewReport = async (attemptId: string) => {
    setLoadingReport(true);
    setError(null);
    try {
      const token = sessionStorage.getItem('fs_admin_token') || passcode;
      const fetchUrl = `${gasUrl}${gasUrl.includes('?') ? '&' : '?'}action=getAttemptReport&attemptId=${attemptId}&token=${encodeURIComponent(token)}`;
      const res = await fetch(fetchUrl);
      const data = await res.json();

      if (data.success && data.report) {
        setSelectedReport(data.report);
      } else {
        setError(data.error || 'Failed to fetch candidate report.');
      }
    } catch (err) {
      console.error(err);
      setError('Error connecting to fetch attempt report.');
    } finally {
      setLoadingReport(false);
    }
  };

  const filteredCandidates = candidates.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.attemptId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen w-full flex justify-center items-center py-10">
        <div className="glass-glow-bg" />
        <div className="w-full max-w-[450px] mx-auto bg-card backdrop-blur-md border border-[var(--card-border)] rounded-2xl p-8 md:p-10 shadow-2xl relative overflow-hidden before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:height-[3px] before:bg-linear-to-r before:from-[#ff4b2b] before:to-[#ff416c]">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold tracking-tight mb-2 bg-linear-to-br from-white to-slate-400 bg-clip-text text-transparent">
              Recruiter Admin Login
            </h1>
            <p className="text-xs text-[var(--text-secondary)]">
              Authorized personnel only. Access requires the administrative secret token.
            </p>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                Admin Passcode
              </label>
              <input
                type="password"
                placeholder="Enter token passcode"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                required
                className="bg-slate-900/60 border border-[var(--card-border)] rounded-lg p-3 text-sm text-white outline-hidden focus:border-[#ff416c] focus:shadow-[0_0_0_3px_rgba(255,65,108,0.15)] transition-all"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                Apps Script Web App URL
              </label>
              <input
                type="url"
                placeholder="https://script.google.com/macros/s/.../exec"
                value={gasUrl}
                onChange={(e) => {
                  setGasUrl(e.target.value);
                  localStorage.setItem('fs_gas_url', e.target.value.trim());
                }}
                required
                className="bg-slate-900/60 border border-[var(--card-border)] rounded-lg p-3 text-xs text-white outline-hidden focus:border-[#ff416c] transition-all"
              />
            </div>

            {error && <div className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 p-2.5 rounded">{error}</div>}

            <button
              type="submit"
              className="font-bold text-sm p-3 rounded-lg bg-linear-to-br from-[#ff4b2b] to-[#ff416c] text-white cursor-pointer hover:shadow-[0_4px_15px_rgba(255,65,108,0.3)] hover:-translate-y-0.5 active:translate-y-0 transition-all w-full mt-2"
            >
              Verify & Enter
            </button>
          </form>
          
          <div className="text-center mt-6">
            <a href="/" className="text-xs text-slate-500 hover:text-white transition-colors">
              &larr; Back to Candidate Portal
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full max-w-[1200px] mx-auto px-4 py-8 flex flex-col gap-6">
      <div className="glass-glow-bg" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card backdrop-blur-md border border-[var(--card-border)] p-6 rounded-xl shadow-xl">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded-full">
            Recruiter Workspace
          </span>
          <h1 className="text-2xl font-extrabold text-white mt-2">Fraud Support Assessment Panel</h1>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => fetchCandidates()}
            disabled={loading}
            className="px-4 py-2 text-xs font-semibold rounded bg-slate-900 border border-[var(--card-border)] text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {loading ? 'Refreshing...' : 'Refresh List'}
          </button>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-xs font-semibold rounded bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="bg-card backdrop-blur-md border border-[var(--card-border)] rounded-xl shadow-xl overflow-hidden flex flex-col">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:max-w-md">
            <input
              type="text"
              placeholder="Search by candidate name, email, or attempt ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950/60 border border-[var(--card-border)] rounded-lg py-2 px-3 pl-9 text-xs text-white placeholder-slate-500 outline-hidden focus:border-accent transition-all"
            />
            <span className="absolute left-3 top-2.5 text-slate-500">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
          </div>
          <span className="text-xs text-slate-400">
            Showing {filteredCandidates.length} of {candidates.length} attempts
          </span>
        </div>

        {/* Notices */}
        {error && <div className="m-4 p-3 bg-red-500/10 border border-red-500/25 text-red-400 text-xs rounded">{error}</div>}
        {actionMessage && <div className="m-4 p-3 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs rounded">{actionMessage}</div>}

        {/* Table container */}
        <div className="overflow-x-auto">
          {loading && candidates.length === 0 ? (
            <div className="py-20 flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-3 border-accent border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-slate-400 font-semibold tracking-wider uppercase">Loading candidate directory...</span>
            </div>
          ) : filteredCandidates.length === 0 ? (
            <div className="py-20 text-center text-slate-500 text-sm">
              No attempts matched your criteria.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase font-bold tracking-widest text-slate-500 bg-slate-950/20">
                  <th className="py-3 px-4">Candidate / Email</th>
                  <th className="py-3 px-4">Attempt ID</th>
                  <th className="py-3 px-4">Date / Time</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">Score</th>
                  <th className="py-3 px-4 text-center">Advisory Tier</th>
                  <th className="py-3 px-4 text-center">Integrity Warnings</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 text-xs">
                {filteredCandidates.map((row) => {
                  const isSubmitted = row.status === 'submitted';
                  const recTier = row.recommendationTier || row.recommendation || '-';
                  const tierColorMap: Record<string, string> = {
                    'Strong Fit': 'text-emerald-400 bg-emerald-400/5 border border-emerald-400/20',
                    'Consider': 'text-amber-400 bg-amber-400/5 border border-amber-400/20',
                    'Not Recommended': 'text-red-400 bg-red-400/5 border border-red-400/20',
                  };
                  const hasViolations = row.violationCount >= 3;
                  const formattedDate = row.startTime ? new Date(row.startTime).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : '-';

                  return (
                    <tr key={row.attemptId} className="hover:bg-slate-900/10 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-200">{row.name}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{row.email}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[10px] text-slate-400">{row.attemptId}</td>
                      <td className="py-3.5 px-4 text-slate-400">{formattedDate}</td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          row.status === 'active' 
                            ? 'text-sky-400 bg-sky-400/5 border-sky-400/20' 
                            : 'text-emerald-400 bg-emerald-400/5 border-emerald-400/20'
                        }`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-extrabold text-white text-sm">
                        {isSubmitted ? `${row.overallScore}%` : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {isSubmitted ? (
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${tierColorMap[recTier] || 'text-slate-400'}`}>
                            {recTier}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold ${
                          hasViolations 
                            ? 'text-red-400 bg-red-400/10 border border-red-500/30 font-bold animate-pulse' 
                            : 'text-slate-400 bg-slate-900/80 border border-slate-800'
                        }`}>
                          {hasViolations && (
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                          )}
                          {row.violationCount}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right flex justify-end gap-2">
                        {isSubmitted && (
                          <button
                            onClick={() => handleViewReport(row.attemptId)}
                            className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-slate-800 hover:bg-slate-700 text-white rounded transition-colors cursor-pointer"
                          >
                            View Report
                          </button>
                        )}
                        <button
                          onClick={() => handleResetAttempt(row.email)}
                          className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded transition-colors cursor-pointer"
                        >
                          Reset Attempt
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Overlay Modal for Detailed Report */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-[620px] bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl p-2 my-8">
            <button
              onClick={() => setSelectedReport(null)}
              className="absolute top-4 right-4 z-10 p-2 bg-slate-900/80 border border-slate-800 rounded-full text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="max-h-[85vh] overflow-y-auto px-4 py-6">
              <ReportScreen report={selectedReport} onExit={() => setSelectedReport(null)} />
            </div>
          </div>
        </div>
      )}
      
      {loadingReport && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/40 backdrop-blur-xs">
          <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-white font-bold tracking-widest uppercase mt-4">Loading Report Detail...</span>
        </div>
      )}
      
      <div className="text-center mt-4">
        <a href="/" className="text-xs text-slate-500 hover:text-white transition-colors">
          &larr; Back to Candidate Portal
        </a>
      </div>
    </div>
  );
}
