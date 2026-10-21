import React from 'react';
import { useLocation } from 'react-router-dom';
import { Code2, ShieldCheck, Cpu } from 'lucide-react';

export const Footer = () => {
  const location = useLocation();

  if (location.pathname.includes('/take')) {
    return null; // Don't show footer in active exam session
  }

  return (
    <footer className="border-t border-slate-900 bg-slate-950 py-8 px-4 text-slate-500 text-xs">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-indigo-400" />
          <span className="font-bold text-slate-300">KAIROS TEST</span>
          <span>&mdash; Official Examination & Assessment Portal of Kairos Club</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1 text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Sandboxed Execution
          </span>
          <span className="flex items-center gap-1 text-slate-400">
            <Cpu className="w-3.5 h-3.5 text-indigo-400" /> Monaco Engine
          </span>
          <span>&copy; {new Date().getFullYear()} Kairos Club</span>
        </div>
      </div>
    </footer>
  );
};
