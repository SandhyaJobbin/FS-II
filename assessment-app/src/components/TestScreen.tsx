'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Question, AnswersMap, HybridAnswer } from '../types';
import CaseDashboard from './CaseDashboard';

interface TestScreenProps {
  questions: Question[];
  onSubmit: (answers: AnswersMap) => void;
  attemptId: string;
  gasUrl: string;
}

// Module-scope cache of in-flight/completed script loads. Must live outside the
// component: StrictMode remounts re-run effects, and a component-local cache would
// be lost, re-opening the "resolved before loaded" race.
const scriptLoadPromises = new Map<string, Promise<void>>();

// --- Zone Configuration ---
interface ZoneConfig {
  badge: string;
  title: string;
  desc: string;
  timerLabel: string;
  icon: React.ReactNode;
}

const ZONE_CONFIG: Record<string, ZoneConfig> = {
  'english/grammar': {
    badge: 'Zone 1 of 8',
    title: 'English: Grammar',
    desc: 'Select the grammatically correct option for each question. Focus on subject-verb agreement, tense consistency, and proper usage.',
    timerLabel: '60s per question',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-7 h-7">
        <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
  },
  'english/sentence_correction': {
    badge: 'Zone 2 of 8',
    title: 'English: Sentence Correction',
    desc: 'You will see a poorly written sentence. Rewrite it with correct grammar, punctuation, and professional tone. Type your corrected version in the text box.',
    timerLabel: '60s per question',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-7 h-7">
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    ),
  },
  'english/macro': {
    badge: 'Zone 3 of 8',
    title: 'English: Macro Editing',
    desc: 'You will see a customer-service macro with grammar and tone issues. Rewrite the entire macro to fix errors and personalize the response. Type your improved version.',
    timerLabel: '60s per question',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-7 h-7">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  'english/reading': {
    badge: 'Zone 4 of 8',
    title: 'English: Reading Comprehension',
    desc: 'Read the passage carefully, then answer the multiple-choice questions that follow. Pay attention to details, main ideas, and implied meaning.',
    timerLabel: '180s per question',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-7 h-7">
        <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" /><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
      </svg>
    ),
  },
  'english/closure': {
    badge: 'Zone 5 of 8',
    title: 'English: Case Closure Notes',
    desc: 'Read the case scenario, select the correct case status (Open / Pending / Solved), then write a professional closure note summarizing the resolution.',
    timerLabel: '60s per question',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-7 h-7">
        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  },
  'attention/L1': {
    badge: 'Zone 6 of 8',
    title: 'Attention to Detail (L1)',
    desc: 'Review the case dashboard on the left panel and answer questions about data consistency, missing information, and discrepancies.',
    timerLabel: '120s per question',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-7 h-7">
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
  'attention/L2': {
    badge: 'Zone 7 of 8',
    title: 'Attention to Detail (L2)',
    desc: 'More complex case dashboards with multiple data tabs. Cross-reference information across tabs to find inconsistencies and answer accurately.',
    timerLabel: '120s per question',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-7 h-7">
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" />
      </svg>
    ),
  },
  'critical/': {
    badge: 'Zone 8 of 8',
    title: 'Critical Thinking Cases',
    desc: 'Analyze fraud investigation scenarios and select the best course of action. Consider risk factors, evidence quality, and proper escalation procedures.',
    timerLabel: '180s per question',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-7 h-7">
        <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
      </svg>
    ),
  },
};

function getZoneKey(q: Question): string {
  if (q.bank === 'english') return 'english/' + q.section;
  if (q.bank === 'attention') return 'attention/' + (q.level || '');
  if (q.bank === 'critical') return 'critical/';
  return q.bank + '/' + (q.section || '');
}

export default function TestScreen({ questions, onSubmit, attemptId, gasUrl }: TestScreenProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<AnswersMap>({});
  const [timerVal, setTimerVal] = useState(60);
  const [cosmeticXp, setCosmeticXp] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [animateXp, setAnimateXp] = useState(false);

  // Zone guidelines state
  const [showZoneOverlay, setShowZoneOverlay] = useState(false);
  const [activeZoneKey, setActiveZoneKey] = useState<string | null>(null);
  const [zoneQuestionCount, setZoneQuestionCount] = useState(0);
  const lastZoneKeyRef = useRef<string | null>(null);
  const [timerPaused, setTimerPaused] = useState(false);

  // Open-text state
  const [openTextValue, setOpenTextValue] = useState('');
  // Hybrid state
  const [hybridTextValue, setHybridTextValue] = useState('');

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const blurTimeRef = useRef<number | null>(null);

  const [model, setModel] = useState<any>(null);
  const [webcamActive, setWebcamActive] = useState(false);
  const [faceStatus, setFaceStatus] = useState<'detecting' | 'ok' | 'no_face' | 'multiple_faces'>('detecting');

  // Helper for silent logging
  const silentLog = (logType: string, details: Record<string, any>) => {
    if (!attemptId || !gasUrl) return;
    fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'logIntegrity',
        attemptId,
        logType,
        details: {
          timestamp: new Date().toISOString(),
          ...details
        }
      })
    }).catch(err => console.error('Silent log failed:', err));
  };

  // Loads a script exactly once and only resolves after it has actually parsed.
  // Dedupe MUST share the in-flight promise: resolving early lets a later UMD
  // bundle parse before its dependency global exists (UMD captures globals at
  // parse time), which was the blazeface `loadGraphModel of undefined` bug.
  const loadScript = (src: string): Promise<void> => {
    const cached = scriptLoadPromises.get(src);
    if (cached) return cached;
    const promise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
      if (existing) {
        // Tag exists but no cached promise (e.g. hot-reload remount). If it is
        // already loaded, resolve; otherwise wait for it.
        if (existing.dataset.loaded === 'true') {
          resolve();
        } else {
          existing.addEventListener('load', () => resolve());
          existing.addEventListener('error', (err) => reject(err));
        }
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      // Not async: preserve execution order for sequentially appended scripts,
      // so tf.min.js is guaranteed parsed before blazeface.min.js even if the
      // blazeface download finishes first.
      script.async = false;
      script.onload = () => {
        script.dataset.loaded = 'true';
        resolve();
      };
      script.onerror = (err) => reject(err);
      document.body.appendChild(script);
    });
    scriptLoadPromises.set(src, promise);
    return promise;
  };

  // Restore state from LocalStorage on mount
  useEffect(() => {
    const savedIdx = localStorage.getItem('fs_current_index');
    if (savedIdx !== null) {
      const idx = parseInt(savedIdx);
      setCurrentIdx(idx);
      // Pre-set zone key so we skip overlay on resume
      if (idx > 0 && questions[idx]) {
        lastZoneKeyRef.current = getZoneKey(questions[idx]);
      }
    }

    const savedAns = localStorage.getItem('fs_answers');
    if (savedAns !== null) setAnswers(JSON.parse(savedAns));

    const savedXp = localStorage.getItem('fs_xp');
    if (savedXp !== null) setCosmeticXp(parseInt(savedXp));

    // Right click prevention
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // INTEG-01: Tab switch with blur duration calculation
  useEffect(() => {
    const handleBlur = () => {
      blurTimeRef.current = Date.now();
    };

    const handleFocus = () => {
      if (blurTimeRef.current !== null) {
        const durationMs = Date.now() - blurTimeRef.current;
        blurTimeRef.current = null;
        silentLog('tab_switch', {
          durationMs,
          description: `Candidate switched tab / window blurred for ${Math.round(durationMs / 1000)} seconds`
        });
      }
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [attemptId, gasUrl]);

  // INTEG-02: Copy-paste attempts logged silently
  useEffect(() => {
    const handleCopyPaste = (e: Event) => {
      silentLog('copy_paste', {
        eventType: e.type,
        description: `Candidate attempted to ${e.type} content`
      });
    };

    document.addEventListener('copy', handleCopyPaste);
    document.addEventListener('cut', handleCopyPaste);
    document.addEventListener('paste', handleCopyPaste);

    return () => {
      document.removeEventListener('copy', handleCopyPaste);
      document.removeEventListener('cut', handleCopyPaste);
      document.removeEventListener('paste', handleCopyPaste);
    };
  }, [attemptId, gasUrl]);

  // INTEG-03: Dev-tools-open heuristic detection
  useEffect(() => {
    const threshold = 160;
    const checkDevTools = () => {
      const isDevToolsOpen =
        window.outerWidth - window.innerWidth > threshold ||
        window.outerHeight - window.innerHeight > threshold;
      if (isDevToolsOpen) {
        silentLog('devtools_check', {
          description: 'Developer tools opening detected'
        });
      }
    };

    window.addEventListener('resize', checkDevTools);
    const interval = setInterval(checkDevTools, 4000);

    return () => {
      window.removeEventListener('resize', checkDevTools);
      clearInterval(interval);
    };
  }, [attemptId, gasUrl]);

  // INTEG-04: Fullscreen-exit events logged silently
  useEffect(() => {
    const handleFullscreenExit = () => {
      if (!document.fullscreenElement) {
        silentLog('fullscreen_exit', {
          description: 'Candidate exited fullscreen mode'
        });
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenExit);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenExit);
    };
  }, [attemptId, gasUrl]);

  // INTEG-05: Webcam initialization
  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    const startWebcam = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, facingMode: 'user' }
        });
        if (cancelled) {
          stream.getTracks().forEach(track => track.stop());
          stream = null;
          return;
        }
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          // play() returns a promise that rejects with AbortError when the load is
          // interrupted (StrictMode double-effect / srcObject reassignment). That
          // rejection is expected and must be swallowed; other errors are real.
          const playPromise = video.play();
          if (playPromise !== undefined) {
            playPromise.catch(err => {
              if ((err as DOMException).name !== 'AbortError') {
                console.error('Webcam play failed:', err);
              }
            });
          }
          setWebcamActive(true);
        }
      } catch (err) {
        if (!cancelled) console.error('Failed to access webcam:', err);
      }
    };

    startWebcam();
    return () => {
      cancelled = true;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // INTEG-05 & INTEG-06: BlazeFace client-side face recognition
  useEffect(() => {
    let active = true;
    const initModel = async () => {
      try {
        await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js');
        // blazeface@0.0.7 UMD captures `window.tf` at PARSE time (factory args are
        // `e(t.blazeface={}, t.tf, t.tf)`). loadScript now serializes execution
        // order, so tf must be present here before the blazeface script parses.
        if (!(window as any).tf || typeof (window as any).tf.loadGraphModel !== 'function') {
          throw new Error('tf global missing loadGraphModel after tf.min.js load');
        }
        await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/blazeface@0.0.7/dist/blazeface.min.js');
        if (!active) return;
        if (!(window as any).blazeface) throw new Error('blazeface global not available after script load');
        const loadedModel = await (window as any).blazeface.load();
        if (!active) return;
        setModel(loadedModel);
      } catch (err) {
        console.error('Failed to load BlazeFace model:', err);
      }
    };

    initModel();
    return () => {
      active = false;
    };
  }, []);

  // Detection loop
  useEffect(() => {
    if (!model || !videoRef.current || !webcamActive) return;

    const interval = setInterval(async () => {
      if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) return;

      try {
        const returnTensors = false;
        const predictions = await model.estimateFaces(videoRef.current, returnTensors);

        if (predictions.length === 0) {
          setFaceStatus('no_face');
          silentLog('webcam_anomaly', {
            description: 'No face detected in webcam view'
          });
        } else if (predictions.length > 1) {
          setFaceStatus('multiple_faces');
          silentLog('webcam_anomaly', {
            description: `Multiple faces detected in webcam view: ${predictions.length} faces`
          });
        } else {
          setFaceStatus('ok');
        }
      } catch (err) {
        console.error('Face prediction error:', err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [model, webcamActive]);

  const currentQuestion = questions[currentIdx];

  // Zone transition detection
  useEffect(() => {
    if (!currentQuestion) return;

    const zoneKey = getZoneKey(currentQuestion);
    if (zoneKey !== lastZoneKeyRef.current) {
      lastZoneKeyRef.current = zoneKey;

      const config = ZONE_CONFIG[zoneKey];
      if (config) {
        // Count questions in this zone
        let count = 0;
        for (let i = currentIdx; i < questions.length; i++) {
          if (getZoneKey(questions[i]) === zoneKey) count++;
          else break;
        }
        setZoneQuestionCount(count);
        setActiveZoneKey(zoneKey);
        setShowZoneOverlay(true);
        setTimerPaused(true);
      }
    }

    // Restore open_text / hybrid values from saved answers
    if (currentQuestion.response_type === 'open_text') {
      const saved = answers[currentQuestion.id];
      setOpenTextValue(typeof saved === 'string' ? saved : '');
    } else if (currentQuestion.response_type === 'hybrid') {
      const saved = answers[currentQuestion.id];
      if (saved && typeof saved === 'object' && !Array.isArray(saved) && 'text' in saved) {
        setHybridTextValue((saved as HybridAnswer).text);
      } else {
        setHybridTextValue('');
      }
    }
  }, [currentIdx, currentQuestion]);

  // Set up timer when current question changes (only when not paused by overlay)
  useEffect(() => {
    if (!currentQuestion || timerPaused) return;

    // Timer configuration based on bank/section
    let duration = 60;
    if (currentQuestion.bank === 'english') {
      duration = currentQuestion.section === 'reading' ? 180 : 60;
    } else if (currentQuestion.bank === 'attention') {
      duration = 120;
    } else if (currentQuestion.bank === 'critical') {
      duration = 180;
    }

    setTimerVal(duration);
    setErrorMsg(null);

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setTimerVal((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          // Auto submit answer when timer expires
          handleNext(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentIdx, currentQuestion, timerPaused]);

  const handleBeginZone = useCallback(() => {
    setShowZoneOverlay(false);
    setTimerPaused(false);
  }, []);

  if (!currentQuestion) return null;

  const progressPercent = Math.round((currentIdx / questions.length) * 100);

  // Get active Level Label
  let levelName = 'Level 1: English Proficiency';
  if (currentQuestion.bank === 'attention') {
    levelName = 'Level 2: Attention to Detail';
  } else if (currentQuestion.bank === 'critical') {
    levelName = 'Level 3: Critical Thinking';
  }

  // Timer warning classes
  let timerColor = 'text-accent border-accent/20';
  let pulseClass = '';
  if (timerVal <= 10) {
    timerColor = 'text-error border-error/30 bg-error/5';
    pulseClass = 'animate-pulse';
  } else if (timerVal <= 20) {
    timerColor = 'text-amber-500 border-amber-500/30 bg-amber-500/5';
  }

  const currentSelection = answers[currentQuestion.id] || null;

  const handleOptionClick = (letter: string) => {
    const isMulti = currentQuestion.response_type === 'mcq_multi';

    if (currentQuestion.response_type === 'hybrid') {
      // For hybrid, store the MCQ selection while preserving text
      const existingHybrid = (currentSelection && typeof currentSelection === 'object' && !Array.isArray(currentSelection))
        ? currentSelection as HybridAnswer : { selected: '', text: hybridTextValue };
      const updatedAnswer: HybridAnswer = { ...existingHybrid, selected: letter };
      const updatedAnswers = { ...answers, [currentQuestion.id]: updatedAnswer };
      setAnswers(updatedAnswers);
      localStorage.setItem('fs_answers', JSON.stringify(updatedAnswers));
      return;
    }

    let newSelection: string | string[];

    if (isMulti) {
      const currentArr = Array.isArray(currentSelection) ? currentSelection : [];
      if (currentArr.includes(letter)) {
        newSelection = currentArr.filter((l) => l !== letter);
      } else {
        newSelection = [...currentArr, letter];
      }
    } else {
      newSelection = letter;
    }

    const updatedAnswers = { ...answers, [currentQuestion.id]: newSelection };
    setAnswers(updatedAnswers);
    localStorage.setItem('fs_answers', JSON.stringify(updatedAnswers));
  };

  const handleOpenTextChange = (value: string) => {
    setOpenTextValue(value);
    const updatedAnswers = { ...answers, [currentQuestion.id]: value };
    setAnswers(updatedAnswers);
    localStorage.setItem('fs_answers', JSON.stringify(updatedAnswers));
  };

  const handleHybridTextChange = (value: string) => {
    setHybridTextValue(value);
    const existingHybrid = (currentSelection && typeof currentSelection === 'object' && !Array.isArray(currentSelection))
      ? currentSelection as HybridAnswer : { selected: '', text: '' };
    const updatedAnswer: HybridAnswer = { ...existingHybrid, text: value };
    const updatedAnswers = { ...answers, [currentQuestion.id]: updatedAnswer };
    setAnswers(updatedAnswers);
    localStorage.setItem('fs_answers', JSON.stringify(updatedAnswers));
  };

  const handleNext = (isTimeout = false) => {
    if (!isTimeout) {
      // Validate based on response type
      if (currentQuestion.response_type === 'open_text') {
        if (!openTextValue.trim()) {
          setErrorMsg('Please type your corrected answer to proceed.');
          return;
        }
      } else if (currentQuestion.response_type === 'hybrid') {
        const hybrid = currentSelection as HybridAnswer | null;
        if (!hybrid?.selected) {
          setErrorMsg('Please select a case status to proceed.');
          return;
        }
        if (!hybridTextValue.trim()) {
          setErrorMsg('Please write a closure note to proceed.');
          return;
        }
      } else {
        if (!currentSelection) {
          setErrorMsg('Please select an answer to proceed.');
          return;
        }
      }
    }

    setErrorMsg(null);

    // Save and persist Index
    const nextIdx = currentIdx + 1;
    localStorage.setItem('fs_current_index', nextIdx.toString());

    // Cosmetic XP increment
    if (!isTimeout) {
      setCosmeticXp((prev) => {
        const val = prev + 100;
        localStorage.setItem('fs_xp', val.toString());
        return val;
      });
      setAnimateXp(true);
      setTimeout(() => setAnimateXp(false), 200);
    }

    if (nextIdx >= questions.length) {
      if (timerRef.current) clearInterval(timerRef.current);
      onSubmit(answers);
    } else {
      setCurrentIdx(nextIdx);
    }
  };

  const hasTabs = !!currentQuestion.tabs && currentQuestion.tabs.length > 0;
  const isOpenText = currentQuestion.response_type === 'open_text';
  const isHybrid = currentQuestion.response_type === 'hybrid';
  const isMulti = currentQuestion.response_type === 'mcq_multi';
  const showMCQ = !isOpenText; // hybrid + mcq_single + mcq_multi all show MCQ

  // For hybrid, get selected letter
  const hybridSelected = (isHybrid && currentSelection && typeof currentSelection === 'object' && !Array.isArray(currentSelection))
    ? (currentSelection as HybridAnswer).selected : null;

  // Get active zone config for overlay
  const activeZoneConfig = activeZoneKey ? ZONE_CONFIG[activeZoneKey] : null;

  return (
    <>
      <motion.div
        layout
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={`w-full mx-auto px-4 ${hasTabs ? 'max-w-[1560px]' : 'max-w-[650px]'}`}
      >
        <div className="bg-card backdrop-blur-md border border-[var(--card-border)] rounded-2xl p-6 md:p-8 shadow-2xl relative overflow-hidden before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:height-[3px] before:bg-linear-to-r before:from-[#4facfe] before:to-[#00f2fe] flex flex-col gap-6">
          
          {/* Zone Guidelines Overlay */}
          <AnimatePresence>
            {showZoneOverlay && activeZoneConfig && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 z-50 flex items-center justify-center bg-[rgba(7,10,19,0.94)] backdrop-blur-xl rounded-2xl"
              >
                <motion.div
                  initial={{ opacity: 0, y: 24, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -12, scale: 0.97 }}
                  transition={{ delay: 0.1, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  className="text-center px-8 py-10 max-w-[420px] w-full"
                >
                  {/* Animated Icon */}
                  <div className="w-16 h-16 rounded-full bg-accent/[0.08] border border-accent/20 flex items-center justify-center mx-auto mb-5 text-accent animate-pulse shadow-[0_0_24px_8px_rgba(0,242,254,0.12)]">
                    {activeZoneConfig.icon}
                  </div>

                  {/* Badge */}
                  <div className="inline-block text-[11px] font-bold uppercase tracking-[1.8px] text-accent bg-accent/[0.08] px-3.5 py-1 rounded-full border border-accent/15 mb-4">
                    {activeZoneConfig.badge}
                  </div>

                  {/* Title */}
                  <h2 className="text-[22px] font-bold mb-3 bg-gradient-to-br from-white to-slate-400 bg-clip-text text-transparent">
                    {activeZoneConfig.title}
                  </h2>

                  {/* Description */}
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-6 max-w-[360px] mx-auto">
                    {activeZoneConfig.desc}
                  </p>

                  {/* Meta badges */}
                  <div className="flex justify-center gap-3 mb-7">
                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/60 border border-[var(--card-border)] rounded-full text-[13px] font-semibold text-[var(--text-secondary)]">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-accent shrink-0">
                        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                        <rect x="9" y="3" width="6" height="4" rx="1" />
                      </svg>
                      <span>{zoneQuestionCount} question{zoneQuestionCount !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/60 border border-[var(--card-border)] rounded-full text-[13px] font-semibold text-[var(--text-secondary)]">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-accent shrink-0">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      <span>{activeZoneConfig.timerLabel}</span>
                    </div>
                  </div>

                  {/* Begin button */}
                  <button
                    onClick={handleBeginZone}
                    className="flex justify-center items-center gap-2 font-semibold text-[15px] py-3.5 px-8 rounded-lg bg-gradient-to-br from-[#4facfe] to-[#00f2fe] text-[#070a13] cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_4px_15px_rgba(0,242,254,0.3)] active:translate-y-0 transition-all mx-auto"
                  >
                    <span>Begin Zone</span>
                    <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Header Section */}
          <div className="flex flex-wrap justify-between items-center gap-4 pb-5 border-b border-slate-800/60">
            <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-accent">
                {levelName}
              </span>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 bg-slate-900/60 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-linear-to-r from-[#4facfe] to-[#00f2fe] rounded-full shadow-[0_0_8px_var(--accent-glow)] transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span className="text-[11px] text-[var(--text-secondary)] font-semibold whitespace-nowrap">
                  Q{currentIdx + 1} of {questions.length}
                </span>
              </div>
            </div>

            <div className="flex gap-3 items-center">
              {/* XP Badge */}
              <motion.div
                animate={{ scale: animateXp ? 1.15 : 1 }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-amber-500/20 bg-amber-500/5 text-amber-500 font-bold text-xs"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="12 2 2 7 12 12 22 7 12 2" />
                  <polyline points="2 12 12 17 22 12" />
                  <polyline points="2 17 12 22 22 17" />
                </svg>
                <span>{cosmeticXp} XP</span>
              </motion.div>

              {/* Countdown timer */}
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold transition-all ${timerColor} ${pulseClass}`}>
                <svg className="w-4 h-4 animate-spin-slow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span>{showZoneOverlay ? '--' : timerVal}s</span>
              </div>
            </div>
          </div>

          {/* Main Body Columns */}
          <div className={`grid gap-6 items-start ${hasTabs ? 'grid-cols-1 lg:grid-cols-[1.6fr_1fr]' : 'grid-cols-1'}`}>

            {/* Dashboard (Left Column) */}
            {hasTabs && currentQuestion.tabs && (
              <div className="animate-fade-in w-full">
                <CaseDashboard
                  tabs={currentQuestion.tabs}
                  tables={currentQuestion.tables}
                  caseTitle={currentQuestion.case_title}
                  caseId={currentQuestion.case_id}
                />
              </div>
            )}

            {/* Question and options (Right Column) */}
            <div className={`flex flex-col gap-5 w-full ${hasTabs ? 'lg:sticky lg:top-6' : ''}`}>
              <h3 className="text-base font-semibold leading-relaxed text-white whitespace-pre-wrap">
                {currentQuestion.stem}
              </h3>

              {/* MCQ Options (for mcq_single, mcq_multi, hybrid) */}
              {showMCQ && currentQuestion.options.length > 0 && (
                <div className="flex flex-col gap-3">
                  {currentQuestion.options.map((opt) => {
                    let isSelected = false;
                    if (isHybrid) {
                      isSelected = hybridSelected === opt.letter;
                    } else if (isMulti) {
                      isSelected = Array.isArray(currentSelection) && currentSelection.includes(opt.letter);
                    } else {
                      isSelected = currentSelection === opt.letter;
                    }

                    return (
                      <button
                        key={opt.letter}
                        type="button"
                        onClick={() => handleOptionClick(opt.letter)}
                        className={`flex items-start text-left gap-3.5 p-4 rounded-xl border transition-all cursor-pointer select-none ${
                          isSelected
                            ? 'bg-accent/5 border-accent shadow-[0_0_8px_rgba(0,242,254,0.08)]'
                            : 'bg-white/[0.01] border-[var(--card-border)] hover:bg-white/[0.03] hover:border-accent/30'
                        }`}
                      >
                        <input
                          type={isMulti ? 'checkbox' : 'radio'}
                          checked={isSelected}
                          readOnly
                          className="mt-1 cursor-pointer accent-accent"
                        />
                        <span className="font-bold text-accent text-sm uppercase">{opt.letter}.</span>
                        <span className="text-slate-300 text-sm leading-normal font-medium">{opt.text}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Open Text Textarea (Sentence Correction / Macro) */}
              {isOpenText && (
                <div className="flex flex-col gap-2">
                  <label className="text-[12px] font-bold uppercase tracking-[1px] text-accent">
                    Your Answer
                  </label>
                  <textarea
                    value={openTextValue}
                    onChange={(e) => handleOpenTextChange(e.target.value)}
                    rows={5}
                    placeholder="Type your corrected version here..."
                    className="w-full bg-slate-900/60 border border-[var(--card-border)] rounded-xl px-4 py-3.5 text-white text-sm leading-relaxed font-medium outline-none transition-all resize-y min-h-[100px] placeholder:text-slate-600 placeholder:italic focus:border-accent focus:shadow-[0_0_0_3px_rgba(0,242,254,0.1)] focus:bg-slate-900/80"
                  />
                </div>
              )}

              {/* Hybrid: Closure Note Textarea (below MCQ) */}
              {isHybrid && (
                <div className="flex flex-col gap-2 border-t border-dashed border-white/[0.08] pt-4 mt-1">
                  <label className="text-[12px] font-bold uppercase tracking-[1px] text-accent">
                    Closure Note
                  </label>
                  <textarea
                    value={hybridTextValue}
                    onChange={(e) => handleHybridTextChange(e.target.value)}
                    rows={4}
                    placeholder="Write a professional closure note for this case..."
                    className="w-full bg-slate-900/60 border border-[var(--card-border)] rounded-xl px-4 py-3.5 text-white text-sm leading-relaxed font-medium outline-none transition-all resize-y min-h-[80px] placeholder:text-slate-600 placeholder:italic focus:border-accent focus:shadow-[0_0_0_3px_rgba(0,242,254,0.1)] focus:bg-slate-900/80"
                  />
                </div>
              )}

              {errorMsg && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-xs leading-relaxed">
                  {errorMsg}
                </div>
              )}

              <button
                onClick={() => handleNext(false)}
                className="flex justify-center items-center gap-2 font-semibold text-[15px] p-3.5 rounded-lg bg-linear-to-br from-[#4facfe] to-[#00f2fe] text-[#070a13] cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_4px_15px_rgba(0,242,254,0.3)] active:translate-y-0 disabled:opacity-50 transition-all w-full mt-2"
              >
                <span>{currentIdx === questions.length - 1 ? 'Submit Assessment' : 'Submit Answer'}</span>
                <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Floating PIP Webcam Proctor Widget */}
      <div className="fixed bottom-4 right-4 z-50 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-2 shadow-2xl flex flex-col gap-2 w-[160px] animate-fade-in transition-all hover:border-accent/40">
        <div className="relative aspect-video w-full bg-slate-950 rounded-lg overflow-hidden border border-slate-900">
          <video
            ref={videoRef}
            muted
            playsInline
            className="w-full h-full object-cover scale-x-[-1]"
          />
          <div className="absolute top-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-950/80 border border-slate-850 backdrop-blur-xs">
            <span className={`w-1.5 h-1.5 rounded-full ${
              faceStatus === 'ok' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' :
              faceStatus === 'detecting' ? 'bg-amber-500 shadow-[0_0_8px_#f59e0b]' :
              'bg-red-500 shadow-[0_0_8px_#ef4444]'
            }`} />
            <span className="text-[8px] font-bold text-slate-300 uppercase tracking-wider">
              {faceStatus === 'ok' ? 'Secure' :
               faceStatus === 'detecting' ? 'Scan' :
               faceStatus === 'no_face' ? 'No Face' : 'Multi-Face'}
            </span>
          </div>
        </div>
        <div className="text-[9px] text-slate-400 font-bold tracking-wider text-center uppercase">
          Proctor Active
        </div>
      </div>
    </>
  );
}
