'use client';

import React, { useState, useEffect } from 'react';

interface WelcomeScreenProps {
  onStart: (name: string, email: string, gasUrl: string) => void;
  loading: boolean;
  error: string | null;
}

export default function WelcomeScreen({ onStart, loading, error }: WelcomeScreenProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  // Pre-populated from NEXT_PUBLIC_GAS_URL env var in production; stays editable for dev/testing
  const [gasUrl, setGasUrl] = useState(process.env.NEXT_PUBLIC_GAS_URL || '');

  useEffect(() => {
    const savedGasUrl = localStorage.getItem('fs_gas_url');
    if (savedGasUrl) {
      setGasUrl(savedGasUrl);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !gasUrl.trim()) return;
    localStorage.setItem('fs_gas_url', gasUrl.trim());
    onStart(name.trim(), email.trim(), gasUrl.trim());
  };

  return (
    <div className="w-full max-w-[500px] mx-auto animate-fade-in">
      <div className="bg-card backdrop-blur-md border border-[var(--card-border)] rounded-2xl p-8 md:p-10 shadow-2xl relative overflow-hidden before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:height-[3px] before:bg-linear-to-r before:from-[#4facfe] before:to-[#00f2fe]">
        
        <div className="text-center mb-8">
          <div className="inline-block text-[11px] font-bold uppercase tracking-wider text-accent bg-accent/10 border border-accent/20 px-3 py-1.5 rounded-full mb-4">
            Fraud Support Role
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2 text-slate-900">
            Investigation Assessment
          </h1>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            Evaluate your grammatical accuracy, research depth, and risk judgement under ambiguous fraud scenarios.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Full Name
            </label>
            <input
              type="text"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={loading}
              className="bg-slate-50 border border-[var(--card-border)] rounded-lg p-3 text-[15px] text-slate-900 placeholder-slate-400 outline-hidden focus:border-accent focus:shadow-[0_0_0_3px_rgba(0,242,254,0.15)] transition-all shadow-inner"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Email Address
            </label>
            <input
              type="email"
              placeholder="john.doe@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              className="bg-slate-50 border border-[var(--card-border)] rounded-lg p-3 text-[15px] text-slate-900 placeholder-slate-400 outline-hidden focus:border-accent focus:shadow-[0_0_0_3px_rgba(0,242,254,0.15)] transition-all shadow-inner"
            />
            <span className="text-[10px] text-slate-500">
              One official attempt per email. Repeat attempts are blocked.
            </span>
          </div>

          {!process.env.NEXT_PUBLIC_GAS_URL && (
            <div className="border-t border-slate-200 pt-5 mt-2 flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Apps Script Web App URL
              </label>
              <input
                type="url"
                placeholder="https://script.google.com/macros/s/.../exec"
                value={gasUrl}
                onChange={(e) => setGasUrl(e.target.value)}
                required
                disabled={loading}
                className="bg-slate-50 border border-[var(--card-border)] rounded-lg p-3 text-[15px] text-slate-900 placeholder-slate-400 outline-hidden focus:border-accent focus:shadow-[0_0_0_3px_rgba(0,242,254,0.15)] transition-all shadow-inner"
              />
              <span className="text-[10px] text-slate-500">
                Enter your deployed Google Apps Script Web App URL to link this frontend.
              </span>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-xs leading-relaxed">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex justify-center items-center gap-2 font-semibold text-[15px] p-3.5 rounded-lg bg-linear-to-br from-[#4facfe] to-[#00f2fe] text-[#070a13] cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_4px_15px_rgba(0,242,254,0.3)] active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed transition-all w-full mt-2"
          >
            <span>{loading ? 'Registering & Assembling...' : 'Begin Assessment'}</span>
            {!loading && (
              <svg className="w-[18px] h-[18px] transition-transform group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
