import React, { useEffect } from 'react';
import { useLocation, Link, useParams } from 'react-router-dom';
import confetti from 'canvas-confetti';
import {
  CheckCircle2,
  Clock,
  ArrowRight,
  LayoutDashboard,
  ShieldCheck,
  Award,
  AlertOctagon,
  ShieldAlert,
} from 'lucide-react';

export const SubmittedConfirmationPage = () => {
  const { id: testId } = useParams();
  const location = useLocation();
  const state = location.state || {};
  const isReleased = state.isReleased;
  const isDisqualified = state.isDisqualified;
  const testTitle = state.testTitle;
  const reason = state.reason;

  useEffect(() => {
    // Only fire celebration confetti if not disqualified
    if (!isDisqualified) {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch (e) {}
    }
  }, [isDisqualified]);

  if (isDisqualified) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
        <div className="glass-panel p-8 sm:p-10 rounded-3xl border border-rose-500/50 max-w-lg w-full text-center shadow-2xl shadow-rose-950/40 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-rose-600"></div>

          <div className="w-20 h-20 rounded-3xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 mx-auto mb-6 shadow-xl shadow-rose-950/50 animate-bounce">
            <AlertOctagon className="w-10 h-10" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            Disqualified from Examination
          </h1>
          <p className="text-sm text-rose-300 font-semibold mt-2">
            Zero-Tolerance Integrity Violation Detected
          </p>

          <div className="my-6 p-4 rounded-2xl bg-rose-950/30 border border-rose-500/40 text-xs text-rose-200 text-left space-y-2">
            <div className="flex items-center gap-2 text-rose-300 font-bold">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span>Immediate Kick-Out Policy Enforced</span>
            </div>
            <p>
              An unauthorized window blur, tab switch, or fullscreen exit was recorded by the proctoring engine.
            </p>
            <p className="font-semibold text-rose-100">
              Reason: <span className="capitalize">{reason ? reason.replace(/_/g, ' ') : 'Leaving examination screen'}</span>
            </p>
            <div className="mt-2 pt-2 border-t border-rose-900 flex items-center justify-between text-xs font-bold text-white">
              <span>Final Examination Score:</span>
              <span className="text-rose-400 font-mono text-sm">0 Marks (0%)</span>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <Link
              to="/student/dashboard"
              className="w-full sm:w-auto py-3 px-6 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Return to Dashboard</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="glass-panel p-8 sm:p-10 rounded-3xl border border-slate-800 max-w-lg w-full text-center shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-cyan-400 to-indigo-500"></div>

        <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto mb-6 shadow-xl shadow-emerald-500/10">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
          Assessment Completed & Graded!
        </h1>
        <p className="text-sm text-slate-300 mt-2">
          Thank you for completing <strong className="text-white">{testTitle || 'the assessment'}</strong>.
        </p>

        {/* Immediate Scorecard Preview */}
        {state.result ? (
          <div className="my-6 p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Instant Score Summary
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  state.result.isPassed
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}
              >
                {state.result.isPassed ? 'PASSED' : 'FAILED'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-black text-indigo-400 font-mono">
                  {state.result.totalMarksObtained}{' '}
                  <span className="text-sm font-normal text-slate-500">
                    / {state.result.maxMarks} Marks
                  </span>
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Percentage:{' '}
                  <strong className="text-emerald-400 font-mono">
                    {state.result.percentage}%
                  </strong>
                </p>
              </div>

              <div className="text-right text-xs text-slate-400 space-y-1">
                {state.result.mcqScore !== undefined && (
                  <p>
                    MCQ:{' '}
                    <strong className="text-slate-200">
                      {state.result.mcqScore} Marks
                    </strong>
                  </p>
                )}
                {state.result.codingScore !== undefined && (
                  <p>
                    Coding:{' '}
                    <strong className="text-slate-200">
                      {state.result.codingScore} Marks
                    </strong>
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="my-6 p-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-400 text-left space-y-2">
            <div className="flex items-center gap-2 text-slate-200 font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Answers Checked & Recorded Successfully</span>
            </div>
            <p>
              All MCQ answers and coding files have been evaluated on the server. Your scorecard is ready to view.
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center gap-3 justify-center">
          <Link
            to="/student/dashboard"
            className="w-full sm:w-auto py-3 px-6 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Return to Dashboard</span>
          </Link>

          {state.result && (
            <Link
              to={`/results/${state.result.attemptId || state.result._id}`}
              className="w-full sm:w-auto py-3 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition shadow-lg shadow-indigo-600/30"
            >
              <Award className="w-4 h-4" />
              <span>View Full Scorecard & Breakdown</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};
