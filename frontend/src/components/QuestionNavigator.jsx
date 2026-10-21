import React from 'react';
import { Flag, CheckCircle2, Circle, Bookmark } from 'lucide-react';

export const QuestionNavigator = ({
  questions = [],
  currentIndex,
  onSelectQuestion,
  answers = {}, // map questionId -> { isAnswered: boolean, isFlagged: boolean }
}) => {
  const totalQuestions = questions.length;
  const answeredCount = Object.values(answers).filter((a) => a?.isAnswered).length;
  const flaggedCount = Object.values(answers).filter((a) => a?.isFlagged).length;
  const remainingCount = totalQuestions - answeredCount;

  return (
    <div className="flex flex-col gap-4">
      {/* Quick Summary Pill Bar */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="bg-emerald-950/40 border border-emerald-500/20 rounded-lg p-2">
          <p className="text-emerald-400 font-bold text-sm">{answeredCount}</p>
          <p className="text-emerald-400/80 text-[10px] uppercase font-semibold">Answered</p>
        </div>
        <div className="bg-amber-950/40 border border-amber-500/20 rounded-lg p-2">
          <p className="text-amber-400 font-bold text-sm">{flaggedCount}</p>
          <p className="text-amber-400/80 text-[10px] uppercase font-semibold">Flagged</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-2">
          <p className="text-slate-300 font-bold text-sm">{remainingCount}</p>
          <p className="text-slate-400 text-[10px] uppercase font-semibold">Pending</p>
        </div>
      </div>

      {/* Grid of Question buttons */}
      <div className="grid grid-cols-5 gap-2">
        {questions.map((q, idx) => {
          const ansInfo = answers[q._id] || {};
          const isAnswered = ansInfo.isAnswered;
          const isFlagged = ansInfo.isFlagged;
          const isCurrent = idx === currentIndex;

          let btnClass = 'bg-slate-900/80 text-slate-300 border-slate-800 hover:border-slate-700';

          if (isCurrent) {
            btnClass = 'bg-indigo-600 text-white border-indigo-400 ring-2 ring-indigo-500/50 shadow-lg shadow-indigo-600/30';
          } else if (isFlagged) {
            btnClass = 'bg-amber-950/60 text-amber-200 border-amber-500/50';
          } else if (isAnswered) {
            btnClass = 'bg-emerald-950/60 text-emerald-200 border-emerald-500/50';
          }

          return (
            <button
              key={q._id}
              onClick={() => onSelectQuestion(idx)}
              className={`relative h-11 w-full rounded-xl border flex flex-col items-center justify-center font-bold text-sm transition transform active:scale-95 ${btnClass}`}
              title={`Question ${idx + 1} (${q.type.toUpperCase()} - ${q.marks} Marks)`}
            >
              <span>{idx + 1}</span>
              {/* Type pill or flag indicator */}
              <div className="absolute top-1 right-1 flex items-center gap-0.5">
                {isFlagged && <div className="w-2 h-2 rounded-full bg-amber-400"></div>}
                {isAnswered && !isCurrent && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>}
              </div>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="border-t border-slate-800 pt-3 text-[11px] text-slate-400 flex flex-wrap gap-x-4 gap-y-1.5">
        <span className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-md bg-indigo-600 border border-indigo-400"></div> Current
        </span>
        <span className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-md bg-emerald-950 border border-emerald-500"></div> Answered
        </span>
        <span className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-md bg-amber-950 border border-amber-500"></div> Flagged
        </span>
        <span className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-md bg-slate-900 border border-slate-800"></div> Unanswered
        </span>
      </div>
    </div>
  );
};
