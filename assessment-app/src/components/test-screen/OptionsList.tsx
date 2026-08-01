'use client';

import React from 'react';
import { Question } from '../../types';

interface OptionsListProps {
  currentQuestion: Question;
  currentSelection: any;
  isMulti: boolean;
  isHybrid: boolean;
  hybridSelected: string | null;
  onOptionClick: (letter: string) => void;
}

export default function OptionsList({
  currentQuestion,
  currentSelection,
  isMulti,
  isHybrid,
  hybridSelected,
  onOptionClick,
}: OptionsListProps) {
  if (currentQuestion.options.length === 0) {
    return null;
  }

  return (
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
            onClick={() => onOptionClick(opt.letter)}
            className={`flex items-start text-left gap-4 p-5 rounded-xl border transition-all cursor-pointer select-none ${
              isSelected
                ? 'bg-accent/5 border-accent shadow-[0_0_8px_rgba(8,145,178,0.08)]'
                : 'bg-slate-50 border-[var(--card-border)] hover:bg-slate-100/60 hover:border-accent/30'
            }`}
          >
            <input
              type={isMulti ? 'checkbox' : 'radio'}
              checked={isSelected}
              readOnly
              className="mt-1 cursor-pointer accent-accent scale-125"
            />
            <span className="font-bold text-accent text-base uppercase">{opt.letter}.</span>
            <span className="text-slate-700 text-base leading-relaxed font-medium">{opt.text}</span>
          </button>
        );
      })}
    </div>
  );
}
