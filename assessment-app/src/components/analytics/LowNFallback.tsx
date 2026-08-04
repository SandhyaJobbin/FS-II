'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface LowNFallbackProps {
  threshold: number;
  samples: number;
  label?: string;
}

const fadeUp = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0 }
};

export default function LowNFallback({ threshold, samples, label = 'Not Enough Data Yet' }: LowNFallbackProps) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-5 flex items-start gap-4 w-full"
    >
      <svg className="w-6 h-6 text-amber-600 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-bold uppercase tracking-widest text-amber-700">
          {label}
        </span>
        <p className="text-slate-300 text-sm leading-relaxed">
          Need ≥{threshold} samples — currently {samples}.
        </p>
      </div>
    </motion.div>
  );
}
