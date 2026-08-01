'use client';

import React from 'react';
import { motion, Variants } from 'framer-motion';
import { CheckCircle } from '@phosphor-icons/react';

interface ThankYouScreenProps {
  candidateName?: string;
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

export default function ThankYouScreen({ candidateName, onExit }: ThankYouScreenProps) {
  return (
    <div className="w-full max-w-[580px] mx-auto animate-fade-in">
      <div className="bg-card backdrop-blur-md border border-[var(--card-border)] rounded-2xl shadow-2xl overflow-hidden">
        {/* ─── Header ──────────────────────────────────────────────────────── */}
        <motion.div
          custom={0}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="px-8 pt-8 pb-5 text-center border-b border-slate-200"
        >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-200"
            style={{ backgroundColor: '#10b98118', color: '#10b981' }}
          >
            <CheckCircle className="w-7 h-7" weight="fill" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight mb-1 text-slate-900">Assessment Submitted!</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            {candidateName ? `Nice work, ${candidateName} — ` : ''}
            Thank you for completing the Fraud Support hiring assessment.
          </p>
        </motion.div>

        <div className="px-8 py-6 flex flex-col gap-5">
          {/* ─── Confirmation / Turnaround copy ───────────────────────────── */}
          <motion.div
            custom={1}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="bg-slate-50 border border-[var(--card-border)] rounded-lg p-4 flex flex-col gap-2 text-sm"
          >
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
              What Happens Next
            </span>
            <p className="text-slate-700 leading-relaxed">
              Automated scoring runs first; open-text answers may be reviewed and adjusted by a
              recruiter. You&apos;ll receive your full results and recommendation by email within
              a few minutes.
            </p>
          </motion.div>

          {/* ─── Exit button ──────────────────────────────────────────────── */}
          <motion.button
            custom={2}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            onClick={onExit}
            className="w-full font-semibold text-[14px] p-3.5 rounded-lg bg-slate-100 border border-[var(--card-border)] text-slate-800 hover:bg-slate-200/80 cursor-pointer transition-all"
          >
            Return to Start
          </motion.button>
        </div>
      </div>
    </div>
  );
}
