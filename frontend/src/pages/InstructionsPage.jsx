import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getTestById } from '../services/testService';
import { startTest } from '../services/attemptService';
import { useToast } from '../context/ToastContext';
import {
  FileText,
  Clock,
  Award,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Maximize2,
  Lock,
} from 'lucide-react';

export const InstructionsPage = () => {
  const { id: testId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [test, setTest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [agreed, setAgreed] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    getTestById(testId)
      .then((res) => {
        if (res.success) setTest(res.test);
      })
      .catch((err) => {
        toast.error('Failed to load test instructions.');
      })
      .finally(() => setLoading(false));
  }, [testId]);

  const handleStartExam = async () => {
    if (!agreed) {
      toast.warning('Please confirm the academic honesty agreement to proceed.');
      return;
    }

    setIsStarting(true);

    try {
      // 1. Request fullscreen mode if supported
      try {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        } else if (document.documentElement.webkitRequestFullscreen) {
          await document.documentElement.webkitRequestFullscreen();
        }
      } catch (fsErr) {
        console.warn('Fullscreen request bypassed or blocked by user gesture:', fsErr);
      }

      // 2. Call start attempt API
      const res = await startTest(testId);
      if (res.success) {
        toast.success('Exam started! Best of luck.');
        navigate(`/tests/${testId}/take`, { state: { attemptData: res } });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not start exam session.');
    } finally {
      setIsStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-sm text-slate-400">Loading instructions...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <Link
        to="/student/dashboard"
        className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Return to Dashboard</span>
      </Link>

      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-2xl space-y-6">
        <div>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            {test?.testType} Assessment
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-2">{test?.title}</h1>
          <p className="text-sm text-slate-400 mt-0.5">{test?.subject}</p>
        </div>

        {/* Vital Info Specs Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
            <Clock className="w-4 h-4 text-indigo-400 mx-auto mb-1" />
            <p className="text-[10px] uppercase font-bold text-slate-400">Duration</p>
            <p className="text-sm font-bold text-white mt-0.5">{test?.duration} mins</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
            <Award className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
            <p className="text-[10px] uppercase font-bold text-slate-400">Max Marks</p>
            <p className="text-sm font-bold text-white mt-0.5">{test?.totalMarks} Marks</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
            <FileText className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
            <p className="text-[10px] uppercase font-bold text-slate-400">Questions</p>
            <p className="text-sm font-bold text-white mt-0.5">{test?.questionCount || test?.questions?.length || 0}</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
            <ShieldAlert className="w-4 h-4 text-amber-400 mx-auto mb-1" />
            <p className="text-[10px] uppercase font-bold text-slate-400">Integrity</p>
            <p className="text-sm font-bold text-white mt-0.5">Monitored</p>
          </div>
        </div>

        {/* General Instructions */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2 text-xs text-slate-300">
          <h3 className="font-bold text-white uppercase tracking-wider text-xs flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-400" />
            <span>Official Examination Rules</span>
          </h3>
          <div className="whitespace-pre-line leading-relaxed text-slate-300">
            {test?.instructions}
          </div>
        </div>

        {/* Anti-Cheating & Integrity Notice */}
        <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-500/30 space-y-2 text-xs text-slate-300">
          <h3 className="font-bold text-rose-300 uppercase tracking-wider text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <span>Browser-Based Integrity Deterrence</span>
          </h3>
          <p className="leading-relaxed">
            1. <strong>Fullscreen Required:</strong> You will be placed in fullscreen mode upon starting. Exiting fullscreen is recorded as a violation.
          </p>
          <p className="leading-relaxed">
            2. <strong>Tab & Window Tracking:</strong> Switching browser tabs or minimizing the examination window triggers an on-screen warning and logs an activity event.
          </p>
          <p className="leading-relaxed">
            3. <strong>Automatic Submissions:</strong> If you exceed the maximum permitted integrity warnings ({test?.integrityPolicy?.warningLimit || 3}), your test will be flagged or automatically submitted.
          </p>
          <p className="leading-relaxed">
            4. <strong>Autosave:</strong> All MCQ choices and code entries are autosaved periodically and upon navigating questions.
          </p>
        </div>

        {/* Academic Honesty Agreement */}
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <input
            type="checkbox"
            id="agreement"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="w-4 h-4 mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-950 border-slate-700 cursor-pointer"
          />
          <label htmlFor="agreement" className="text-xs text-slate-300 cursor-pointer leading-relaxed">
            I confirm that I am taking this examination independently without unauthorized aids, external assistance, or collaborative communication. I understand that violations will be reviewed by the instructor.
          </label>
        </div>

        {/* Start Button */}
        <button
          onClick={handleStartExam}
          disabled={!agreed || isStarting}
          className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]"
        >
          <Maximize2 className="w-4 h-4" />
          <span>{isStarting ? 'Initiating Examination Session...' : 'Enter Fullscreen & Begin Test'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
