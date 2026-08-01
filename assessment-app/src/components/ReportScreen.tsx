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
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center text-sm">
        <span className="font-semibold text-slate-700">{label}</span>
        <span className="font-bold tabular-nums" style={{ color }}>{value}%</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
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
  if (pct >= 70) return '#059669'; // emerald-600
  if (pct >= 50) return '#d97706'; // amber-600
  return '#dc2626';                // red-600
}

export default function ReportScreen({ report, onExit }: ReportScreenProps) {
  const tier = report.recommendationTier || 'Consider';

  const tierStyles: Record<string, string> = {
    'Strong Fit':      'text-emerald-700 border-emerald-200 bg-emerald-50',
    'Consider':        'text-amber-700 border-amber-200 bg-amber-50',
    'Not Recommended': 'text-red-700 border-red-200 bg-red-50',
  };
  const tierClass = tierStyles[tier] ?? 'text-slate-600 border-slate-200 bg-slate-50';

  const accentHex: Record<string, string> = {
    'Strong Fit':      '#059669',
    'Consider':        '#d97706',
    'Not Recommended': '#dc2626',
  };
  const accentColor = accentHex[tier] ?? '#64748b';

  const { language, research, critical } = report.traitScores;

  return (
    <div className="w-full min-h-screen bg-transparent relative flex flex-col items-center py-16 px-6 md:px-12 animate-fade-in">
      <div className="absolute top-0 left-0 right-0 h-[6px]" style={{ backgroundColor: accentColor }} />
      <div className="w-full max-w-[800px] flex flex-col gap-8">
        {/* ─── Header ──────────────────────────────────────────────────────── */}
        <motion.div
          custom={0}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="pb-8 text-center border-b border-slate-200"
        >
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-200 shadow-sm"
            style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
          >
            <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3 text-slate-900">Assessment Complete</h2>
          <p className="text-base md:text-lg text-[var(--text-secondary)]">
            Thank you for completing the Fraud Support hiring assessment.
          </p>
        </motion.div>

        <div className="flex flex-col gap-8">

          {/* ─── Candidate Info ────────────────────────────────────────────── */}
          <motion.div
            custom={1}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="bg-slate-50 border border-[var(--card-border)] rounded-xl p-6 flex flex-col gap-4 text-base"
          >
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Name</span>
              <span className="font-semibold text-slate-900">{report.name}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Email</span>
              <span className="font-semibold text-slate-900">{report.email}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Attempt ID</span>
              <span className="font-mono text-slate-700 text-sm font-semibold">{report.attemptId}</span>
            </div>
            <div className="flex justify-between items-baseline border-t border-slate-200 pt-4 mt-2">
              <span className="text-slate-800 font-bold text-lg">Overall Score</span>
              <span className="font-extrabold text-3xl tabular-nums" style={{ color: accentColor }}>
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
            className="bg-slate-50 border border-[var(--card-border)] rounded-xl p-6 flex flex-col gap-5"
          >
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)]">
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
            className="rounded-xl border p-6 flex flex-col gap-3"
            style={{ borderColor: `${accentColor}30`, background: `${accentColor}08` }}
          >
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)]">
              Out-of-the-Box Thinking
            </span>
            <blockquote className="text-slate-700 text-base leading-relaxed italic border-l-[3px] pl-4"
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
            className="bg-slate-50 border border-[var(--card-border)] rounded-xl p-6 flex flex-col gap-3"
          >
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)]">
              Advisory Recommendation
            </span>
            <span className={`self-start inline-block font-bold text-base px-5 py-2.5 rounded-lg border ${tierClass}`}>
              {tier}
            </span>
            <p className="text-slate-600 text-xs leading-relaxed mt-1">
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
              className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-5 flex items-start gap-4"
            >
              <svg className="w-6 h-6 text-amber-600 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-bold uppercase tracking-widest text-amber-700">
                  Pending Review
                </span>
                <p className="text-slate-700 text-sm leading-relaxed">
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
            className="bg-slate-50 border border-[var(--card-border)] p-4 rounded-xl flex justify-between items-center text-sm"
          >
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              <span className="text-slate-600 font-medium">Integrity Events Logged</span>
            </div>
            <span className={`font-mono font-bold text-base ${report.violationCount > 2 ? 'text-error' : 'text-slate-700'}`}>
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
            className="w-full font-bold text-lg p-5 rounded-xl bg-slate-100 border border-[var(--card-border)] text-slate-900 hover:bg-slate-200/80 cursor-pointer transition-all mt-4"
          >
            Exit Assessment
          </motion.button>
        </div>
      </div>
    </div>
  );
}
