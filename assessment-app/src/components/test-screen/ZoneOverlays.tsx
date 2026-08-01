'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ZoneConfig } from '../../data/zone-config';

interface ZoneOverlaysProps {
  showZoneOverlay: boolean;
  overlayPhase: 'complete' | 'brief';
  completedZoneConfig: ZoneConfig | null;
  activeZoneConfig: ZoneConfig | null;
  zoneQuestionCount: number;
  zonesDoneCount: number;
  totalZones: number;
  onBeginZone: () => void;
}

export default function ZoneOverlays({
  showZoneOverlay,
  overlayPhase,
  completedZoneConfig,
  activeZoneConfig,
  zoneQuestionCount,
  zonesDoneCount,
  totalZones,
  onBeginZone,
}: ZoneOverlaysProps) {
  return (
    <AnimatePresence mode="wait">
      {showZoneOverlay && overlayPhase === 'complete' && completedZoneConfig && (
        <motion.div
          key="zone-complete"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="absolute inset-0 z-50 flex items-center justify-center bg-[rgba(248,250,252,0.95)] backdrop-blur-xl rounded-2xl"
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.97 }}
            transition={{ delay: 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="text-center px-8 py-10 max-w-[560px] w-full"
          >
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center mx-auto mb-5 text-emerald-600 shadow-[0_0_24px_8px_rgba(16,185,129,0.14)]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-8 h-8">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <div className="inline-block text-[11px] font-bold uppercase tracking-[1.8px] text-emerald-700 bg-emerald-500/10 px-3.5 py-1 rounded-full border border-emerald-500/20 mb-4">
              Zone Complete
            </div>

            <h2 className="text-3xl font-bold mb-3 bg-gradient-to-br from-slate-900 to-slate-700 bg-clip-text text-transparent">
              {completedZoneConfig.title}
            </h2>

            <p className="text-base text-[var(--text-secondary)] leading-relaxed mb-8 max-w-[440px] mx-auto">
              Nice work — you have finished this section.
              {zonesDoneCount > 0 && ` (${zonesDoneCount} of ${totalZones} zones done)`}
            </p>

            {zonesDoneCount > 0 && (
              <div className="w-full max-w-[320px] mx-auto mb-7">
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div
                     initial={{ width: 0 }}
                     animate={{ width: `${(zonesDoneCount / totalZones) * 100}%` }}
                     transition={{ delay: 0.25, duration: 0.6, ease: 'easeOut' }}
                     className="h-full bg-linear-to-r from-emerald-400 to-[#00f2fe] rounded-full"
                  />
                </div>
              </div>
            )}

            <button
              onClick={onBeginZone}
              className="flex justify-center items-center gap-2 font-bold text-lg py-4 px-10 rounded-xl bg-gradient-to-br from-[#4facfe] to-[#00f2fe] text-[#070a13] cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_4px_15px_rgba(0,242,254,0.3)] active:translate-y-0 transition-all mx-auto"
            >
              <span>Continue to Next Zone</span>
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </motion.div>
        </motion.div>
      )}

      {showZoneOverlay && overlayPhase === 'brief' && activeZoneConfig && (
        <motion.div
          key="zone-brief"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="absolute inset-0 z-50 flex items-center justify-center bg-[rgba(248,250,252,0.95)] backdrop-blur-xl rounded-2xl overflow-y-auto py-8"
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.97 }}
            transition={{ delay: 0.1, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="text-center px-8 py-6 max-w-[650px] w-full"
          >
            {/* Animated Icon */}
            <div className="w-16 h-16 rounded-full bg-accent/[0.08] border border-accent/20 flex items-center justify-center mx-auto mb-5 text-accent animate-pulse shadow-[0_0_24px_8px_rgba(8,145,178,0.12)]">
              {activeZoneConfig.icon}
            </div>

            {/* Badge */}
            <div className="inline-block text-[11px] font-bold uppercase tracking-[1.8px] text-accent bg-accent/[0.08] px-3.5 py-1 rounded-full border border-accent/15 mb-4">
              {activeZoneConfig.badge}
            </div>

            {/* Title */}
            <h2 className="text-3xl font-bold mb-4 bg-gradient-to-br from-slate-900 to-slate-700 bg-clip-text text-transparent">
              {activeZoneConfig.title}
            </h2>

            {/* Description */}
            <p className="text-base text-[var(--text-secondary)] leading-relaxed mb-6 max-w-[500px] mx-auto">
              {activeZoneConfig.desc}
            </p>

            {/* What to do — bulleted checklist */}
            {activeZoneConfig.whatToDo.length > 0 && (
              <div className="text-left bg-slate-50 border border-[var(--card-border)] rounded-xl p-5 mb-6 max-w-[500px] mx-auto">
                <div className="text-xs font-bold uppercase tracking-[1.5px] text-accent mb-3">
                  What to do
                </div>
                <ul className="flex flex-col gap-3">
                  {activeZoneConfig.whatToDo.map((step, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm md:text-base text-slate-800 leading-relaxed">
                      <span className="text-accent font-bold shrink-0 mt-0.5">{i + 1}.</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Example */}
            {activeZoneConfig.example && (
              <div className="text-left bg-white border border-[var(--card-border)] rounded-xl p-5 mb-8 max-w-[500px] mx-auto">
                <div className="text-xs font-bold uppercase tracking-[1.5px] text-accent mb-3">
                  Example
                </div>
                {activeZoneConfig.example.before && (
                  <div className="mb-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Before</div>
                    <div className="text-sm md:text-base text-slate-700 leading-relaxed italic">
                      {activeZoneConfig.example.before}
                    </div>
                  </div>
                )}
                {activeZoneConfig.example.after && (
                  <div className={activeZoneConfig.example.before ? 'pt-3 border-t border-slate-200' : ''}>
                    <div className="text-xs font-bold uppercase tracking-wider text-emerald-600 mb-1.5">
                      {activeZoneConfig.example.before ? 'After' : 'Correct'}
                    </div>
                    <div className="text-sm md:text-base text-slate-900 leading-relaxed font-medium">
                      {activeZoneConfig.example.after}
                    </div>
                  </div>
                )}
                {activeZoneConfig.example.note && !activeZoneConfig.example.before && !activeZoneConfig.example.after && (
                  <div className="text-sm md:text-base text-slate-800 leading-relaxed">
                    {activeZoneConfig.example.note}
                  </div>
                )}
                {activeZoneConfig.example.note && (activeZoneConfig.example.before || activeZoneConfig.example.after) && (
                  <div className="text-xs md:text-sm text-slate-500 leading-relaxed italic mt-3 pt-3 border-t border-slate-200">
                    {activeZoneConfig.example.note}
                  </div>
                )}
              </div>
            )}

            {/* Meta badges */}
            <div className="flex justify-center gap-4 mb-8 flex-wrap">
              <div className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 border border-[var(--card-border)] rounded-full text-sm font-semibold text-[var(--text-secondary)]">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-accent shrink-0">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                  <rect x="9" y="3" width="6" height="4" rx="1" />
                </svg>
                <span>{zoneQuestionCount} question{zoneQuestionCount !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 border border-[var(--card-border)] rounded-full text-sm font-semibold text-[var(--text-secondary)]">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-accent shrink-0">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span>{activeZoneConfig.timerLabel}</span>
              </div>
            </div>

            <button
              onClick={onBeginZone}
              className="flex justify-center items-center gap-2 font-bold text-lg py-4 px-10 rounded-xl bg-gradient-to-br from-[#4facfe] to-[#00f2fe] text-[#070a13] cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_4px_15px_rgba(0,242,254,0.3)] active:translate-y-0 transition-all mx-auto"
            >
              <span>Begin Zone</span>
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
