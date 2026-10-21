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
} from 'lucide-react';

export const SubmittedConfirmationPage = () => {
  const { id: testId } = useParams();
  const location = useLocation();
  const state = location.state || {};
  const isReleased = state.isReleased;
  const testTitle = state.testTitle;

  useEffect(() => {
    // Fire celebration confetti
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch (e) {}
  }, []);

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="glass-panel p-8 sm:p-10 rounded-3xl border border-slate-800 max-w-lg w-full text-center shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-cyan-400 to-indigo-500"></div>

        <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto mb-6 shadow-xl shadow-emerald-500/10">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
          Assessment Submitted!
        </h1>
        <p className="text-sm text-slate-300 mt-2">
          Thank you for completing <strong className="text-white">{testTitle || 'the assessment'}</strong>.
        </p>

        <div className="my-6 p-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-400 text-left space-y-2">
          <div className="flex items-center gap-2 text-slate-200 font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Submission Recorded Successfully</span>
          </div>
          <p>
            All MCQ answers and coding files have been finalized on the server and queued for scoring.
          </p>
          {!isReleased && (
            <p className="text-indigo-300">
              Results are currently under review by the faculty and will be announced on your student dashboard once published.
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 justify-center">
          <Link
            to="/student/dashboard"
            className="w-full sm:w-auto py-3 px-6 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Return to Dashboard</span>
          </Link>

          {isReleased && state.result && (
            <Link
              to={`/results/${state.result.attemptId || state.result._id}`}
              className="w-full sm:w-auto py-3 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition shadow-lg shadow-indigo-600/30"
            >
              <Award className="w-4 h-4" />
              <span>View Scorecard</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};
