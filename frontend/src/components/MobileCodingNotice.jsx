import React, { useState } from 'react';
import { Laptop, X } from 'lucide-react';

export const MobileCodingNotice = () => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="md:hidden mb-3 p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-indigo-200 text-xs flex items-start gap-2.5">
      <Laptop className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="font-semibold text-white">Recommended Screen Notice</p>
        <p className="text-slate-300 mt-0.5 leading-relaxed">
          Coding questions are fully functional on mobile, but a laptop or desktop computer provides the best coding experience with keyboard shortcuts.
        </p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-slate-400 hover:text-white shrink-0 p-1"
        title="Dismiss notice"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
