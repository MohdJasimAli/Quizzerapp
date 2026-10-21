import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';

export const Timer = ({ deadline, onExpire }) => {
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(() => {
    const remaining = Math.max(0, Math.floor((new Date(deadline).getTime() - Date.now()) / 1000));
    return remaining;
  });

  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now();
      const end = new Date(deadline).getTime();
      const diff = Math.max(0, Math.floor((end - now) / 1000));

      setTimeLeftSeconds(diff);

      if (diff <= 0) {
        if (onExpire) {
          onExpire();
        }
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [deadline, onExpire]);

  const hours = Math.floor(timeLeftSeconds / 3600);
  const minutes = Math.floor((timeLeftSeconds % 3600) / 60);
  const seconds = timeLeftSeconds % 60;

  const formattedTime = [
    hours > 0 ? String(hours).padStart(2, '0') : null,
    String(minutes).padStart(2, '0'),
    String(seconds).padStart(2, '0'),
  ]
    .filter(Boolean)
    .join(':');

  const isUrgent = timeLeftSeconds <= 60; // < 1 min
  const isWarning = timeLeftSeconds <= 300 && !isUrgent; // < 5 min

  return (
    <div
      className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-sm font-mono font-semibold transition-all ${
        isUrgent
          ? 'bg-rose-950/80 border-rose-500/60 text-rose-300 animate-pulse shadow-lg shadow-rose-950/50'
          : isWarning
          ? 'bg-amber-950/70 border-amber-500/50 text-amber-300'
          : 'bg-slate-900 border-slate-800 text-slate-200'
      }`}
    >
      {isUrgent ? (
        <AlertTriangle className="w-4 h-4 text-rose-400" />
      ) : (
        <Clock className={`w-4 h-4 ${isWarning ? 'text-amber-400' : 'text-indigo-400'}`} />
      )}
      <span>{formattedTime}</span>
      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-sans font-normal hidden sm:inline">
        remaining
      </span>
    </div>
  );
};
