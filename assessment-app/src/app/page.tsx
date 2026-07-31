'use client';

import React, { useState, useEffect } from 'react';
import WelcomeScreen from '../components/WelcomeScreen';
import AssemblyScreen from '../components/AssemblyScreen';
import TestScreen from '../components/TestScreen';
import ThankYouScreen from '../components/ThankYouScreen';
import { Question, AnswersMap } from '../types';

export default function Home() {
  const [screen, setScreen] = useState<'welcome' | 'assembly' | 'test' | 'thankyou'>('welcome');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [attemptId, setAttemptId] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gasUrl, setGasUrl] = useState('');

  // Auto-restore state on reload
  useEffect(() => {
    const savedAttemptId = localStorage.getItem('fs_attempt_id');
    const savedQuestions = localStorage.getItem('fs_questions');
    const savedName = localStorage.getItem('fs_name');
    const savedEmail = localStorage.getItem('fs_email');
    const savedTestActive = localStorage.getItem('fs_test_active');
    const savedUrl = localStorage.getItem('fs_gas_url');

    if (savedUrl) setGasUrl(savedUrl);

    if (savedAttemptId && savedQuestions && savedName && savedEmail) {
      setName(savedName);
      setEmail(savedEmail);
      setAttemptId(savedAttemptId);
      setQuestions(JSON.parse(savedQuestions));

      if (savedTestActive === 'true') {
        setScreen('test');
      } else {
        setScreen('assembly');
      }
    }
  }, []);

  const handleStartAttempt = async (candidateName: string, candidateEmail: string, url: string) => {
    setLoading(true);
    setError(null);
    setGasUrl(url);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        redirect: 'follow',
        body: JSON.stringify({
          action: 'startAttempt',
          name: candidateName,
          email: candidateEmail,
        }),
      });

      const result = await res.json();

      if (!result.success) {
        setError(result.error || 'An error occurred while starting the attempt.');
        setLoading(false);
        return;
      }

      // Save initial state
      localStorage.setItem('fs_attempt_id', result.attemptId);
      localStorage.setItem('fs_name', candidateName);
      localStorage.setItem('fs_email', candidateEmail);
      localStorage.setItem('fs_questions', JSON.stringify(result.questions));
      localStorage.setItem('fs_current_index', '0');
      localStorage.setItem('fs_answers', JSON.stringify({}));
      localStorage.setItem('fs_xp', '0');

      setName(candidateName);
      setEmail(candidateEmail);
      setAttemptId(result.attemptId);
      setQuestions(result.questions);
      setScreen('assembly');
    } catch (err) {
      console.error(err);
      setError('Connection failed. Please verify that the Apps Script URL is correct and deployed for "Anyone".');
    } finally {
      setLoading(false);
    }
  };

  const handleProceedToTest = () => {
    localStorage.setItem('fs_test_active', 'true');
    setScreen('test');
  };

  const handleResetSession = () => {
    localStorage.removeItem('fs_attempt_id');
    localStorage.removeItem('fs_questions');
    localStorage.removeItem('fs_name');
    localStorage.removeItem('fs_email');
    localStorage.removeItem('fs_test_active');
    localStorage.removeItem('fs_current_index');
    localStorage.removeItem('fs_answers');
    localStorage.removeItem('fs_xp');

    setName('');
    setEmail('');
    setAttemptId('');
    setQuestions([]);
    setScreen('welcome');
  };

  const handleTestSubmit = async (answers: AnswersMap) => {
    setScreen('welcome'); // temporarily display welcome during loading, or loading state
    setLoading(true);

    try {
      const res = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        redirect: 'follow',
        body: JSON.stringify({
          action: 'submitAnswers',
          attemptId,
          answers,
        }),
      });

      const result = await res.json();

      if (!result.success) {
        alert(result.error || 'Submission failed.');
        setScreen('test');
        setLoading(false);
        return;
      }

      setScreen('thankyou');

      // Clear session keys
      localStorage.removeItem('fs_attempt_id');
      localStorage.removeItem('fs_questions');
      localStorage.removeItem('fs_name');
      localStorage.removeItem('fs_email');
      localStorage.removeItem('fs_test_active');
      localStorage.removeItem('fs_current_index');
      localStorage.removeItem('fs_answers');
      localStorage.removeItem('fs_xp');
    } catch (err) {
      console.error(err);
      alert('Network error submitting answers. Press OK to retry.');
      setScreen('test');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center py-10">
      <div className="glass-glow-bg" />
      
      {loading && screen === 'welcome' && (
        <div className="flex flex-col items-center gap-4 text-slate-300">
          <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-semibold uppercase tracking-widest text-accent">Processing...</span>
        </div>
      )}

      {!loading && screen === 'welcome' && (
        <WelcomeScreen onStart={handleStartAttempt} loading={loading} error={error} />
      )}

      {screen === 'assembly' && (
        <AssemblyScreen
          name={name}
          attemptId={attemptId}
          questions={questions}
          onProceed={handleProceedToTest}
          onReset={handleResetSession}
        />
      )}

      {screen === 'test' && (
        <TestScreen
          questions={questions}
          attemptId={attemptId}
          gasUrl={gasUrl}
          onSubmit={handleTestSubmit}
        />
      )}

      {screen === 'thankyou' && (
        <ThankYouScreen candidateName={name} onExit={handleResetSession} />
      )}
    </div>
  );
}
