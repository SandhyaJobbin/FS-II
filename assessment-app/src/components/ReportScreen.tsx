'use client';

import React from 'react';
import { motion, Variants } from 'framer-motion';
import { Report } from '../types';

interface ReportScreenProps {
  report: Report;
  onExit: () => void;
}

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] as const },
  }),
};

function TraitBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-center text-xs">
        <span className="font-semibold text-slate-300">{label}</span>
        <span className="font-bold tabular-nums" style={{ color }}>{value}%</span>
      </div>
      <div className="h-1.5 bg-slate-900/70 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  );
}

function traitColor(pct: number): string {
  if (pct >= 70) return '#10b981'; // emerald
  if (pct >= 50) return '#f59e0b'; // amber
  return '#ef4444';                // red
}

export default function ReportScreen({ report, onExit }: ReportScreenProps) {
  // reportTier is authoritative — no (any) cast needed since types are aligned
  const tier = report.recommendationTier || 'Consider';

  const tierStyles: Record<string, string> = {
    'Strong Fit':      'text-emerald-400 border-emerald-400/30 bg-emerald-400/10',
    'Consider':        'text-amber-400 border-amber-400/30 bg-amber-400/10',
    'Not Recommended': 'text-red-400 border-red-400/30 bg-red-400/10',
  };
  const tierClass = tierStyles[tier] ?? 'text-slate-400 border-slate-400/20 bg-slate-400/10';

  const accentHex: Record<string, string> = {
    'Strong Fit':      '#10b981',
    'Consider':        '#f59e0b',
    'Not Recommended': '#ef4444',
  };
  const accentColor = accentHex[tier] ?? '#64748b';

  const { language, research, critical } = report.traitScores;

  return (
    <div className="w-full max-w-[580px] mx-auto animate-fade-in">
      <div
        className="bg-card backdrop-blur-md border border-[var(--card-border)] rounded-2xl shadow-2xl overflow-hidden"
        style={{ borderTop: `3px solid ${accentColor}` }}
      >
        {/* ─── Header ──────────────────────────────────────────────────────── */}
        <motion.div
          custom={0}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="px-8 pt-8 pb-5 text-center border-b border-slate-800/60"
        >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-800"
            style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
          >
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <h2 className="text-2xl font-bold tracking-tight mb-1">Assessment Complete</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Thank you for completing the Fraud Support hiring assessment.
          </p>
        </motion.div>

        <div className="px-8 py-6 flex flex-col gap-5">

          {/* ─── Candidate Info ────────────────────────────────────────────── */}
          <motion.div
            custom={1}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="bg-slate-950/40 border border-[var(--card-border)] rounded-lg p-4 flex flex-col gap-2.5 text-sm"
          >
            <div className="flex justify-between">
              <span className="text-slate-500">Name</span>
              <span className="font-semibold text-white">{report.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Email</span>
              <span className="font-semibold text-white">{report.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Attempt ID</span>
              <span className="font-mono text-slate-300 text-xs font-semibold">{report.attemptId}</span>
            </div>
            <div className="flex justify-between items-baseline border-t border-slate-800/60 pt-2.5 mt-0.5">
              <span className="text-slate-200 font-semibold">Overall Score</span>
              <span className="font-extrabold text-xl tabular-nums" style={{ color: accentColor }}>
                {report.overallScore}%
              </span>
            </div>
          </motion.div>

          {/* ─── Trait Scores ─────────────────────────────────────────────── */}
          <motion.div
            custom={2}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="bg-slate-950/30 border border-[var(--card-border)] rounded-lg p-4 flex flex-col gap-3"
          >
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
              Trait Scores
            </span>
            <TraitBar label="Language Expertise" value={language} color={traitColor(language)} />
            <TraitBar label="Attention to Detail & Research" value={research} color={traitColor(research)} />
            <TraitBar label="Logical & Critical Thinking" value={critical} color={traitColor(critical)} />
          </motion.div>

          {/* ─── Out-of-the-Box Thinking Insight ─────────────────────────── */}
          <motion.div
            custom={3}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="rounded-lg border p-4 flex flex-col gap-2"
            style={{ borderColor: `${accentColor}30`, background: `${accentColor}08` }}
          >
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
              Out-of-the-Box Thinking
            </span>
            <blockquote className="text-slate-300 text-sm leading-relaxed italic border-l-2 pl-3"
              style={{ borderColor: accentColor }}
            >
              "{report.narrativeInsight}"
            </blockquote>
          </motion.div>

          {/* ─── Recommendation Tier ──────────────────────────────────────── */}
          <motion.div
            custom={4}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="bg-slate-950/20 border border-[var(--card-border)] rounded-lg p-4 flex flex-col gap-2"
          >
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
              Advisory Recommendation
            </span>
            <span className={`self-start inline-block font-bold text-sm px-3.5 py-1.5 rounded-md border ${tierClass}`}>
              {tier}
            </span>
            <p className="text-slate-500 text-[10px] leading-relaxed">
              This recommendation is advisory input for the recruiting team only — it never automatically
              executes a hire or reject decision.
            </p>
          </motion.div>

          {/* ─── Ungraded Notice (Phase 10 GRADE-10) ─────────────────────── */}
          {report.ungradedCount > 0 && (
            <motion.div
              custom={5}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-4 flex items-start gap-3"
            >
              <svg className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                  Pending Review
                </span>
                <p className="text-slate-300 text-xs leading-relaxed">
                  {report.ungradedCount} open-text {report.ungradedCount === 1 ? 'answer is' : 'answers are'} pending review. Your score may be updated once a recruiter completes review.
                </p>
              </div>
            </motion.div>
          )}

          {/* ─── Integrity Index ──────────────────────────────────────────── */}
          <motion.div
            custom={6}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="bg-slate-950/20 border border-[var(--card-border)] p-3.5 rounded-lg flex justify-between items-center text-xs"
          >
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              <span className="text-slate-500 font-medium">Integrity Events Logged</span>
            </div>
            <span className={`font-mono font-bold ${report.violationCount > 2 ? 'text-error' : 'text-slate-300'}`}>
              {report.violationCount}
            </span>
          </motion.div>

          {/* ─── Exit button ──────────────────────────────────────────────── */}
          <motion.button
            custom={7}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            onClick={onExit}
            className="w-full font-semibold text-[14px] p-3.5 rounded-lg bg-slate-900/60 border border-[var(--card-border)] text-white hover:bg-slate-800/80 cursor-pointer transition-all"
          >
            Exit Assessment
          </motion.button>
        </div>
      </div>
    </div>
  );
}
