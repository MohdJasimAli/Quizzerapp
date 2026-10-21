import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getTestById } from '../services/testService';
import { startTest } from '../services/attemptService';
import { useToast } from '../context/ToastContext';
import { CameraPermissionModal } from '../components/CameraPermissionModal';
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
  Camera,
  Eye,
} from 'lucide-react';

export const InstructionsPage = () => {
  const { id: testId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [test, setTest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [agreed, setAgreed] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [cameraModalOpen, setCameraModalOpen] = useState(false);

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

  // Triggered AFTER user has opened webcam and verified retina tracking in modal
  const handleProceedAfterCamera = async () => {
    setCameraModalOpen(false);
    setIsStarting(true);

    try {
      // 1. Request fullscreen mode
      try {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        } else if (document.documentElement.webkitRequestFullscreen) {
          await document.documentElement.webkitRequestFullscreen();
        }
      } catch (fsErr) {
        console.warn('Fullscreen request bypassed:', fsErr);
      }

      // 2. Call start attempt API on backend
      const res = await startTest(testId);
      if (res.success) {
        toast.success('Exam started! Best of luck.');
        navigate(`/tests/${testId}/take`, {
          state: {
            attemptData: res,
            cameraAlreadyVerified: true,
          },
        });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not start exam session.');
    } finally {
      setIsStarting(false);
    }
  };

  const handleStartExamClick = () => {
    if (!agreed) {
      toast.warning('Please confirm the academic honesty agreement to proceed.');
      return;
    }

    // If test requires camera (default), prompt the webcam verification modal first
    if (test?.integrityPolicy?.requireCamera !== false) {
      setCameraModalOpen(true);
    } else {
      handleProceedAfterCamera();
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
            <ShieldAlert className="w-4 h-4 text-rose-400 mx-auto mb-1" />
            <p className="text-[10px] uppercase font-bold text-slate-400">Proctoring</p>
            <p className="text-sm font-bold text-white mt-0.5">Camera & Retina</p>
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
        <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-500/40 space-y-2.5 text-xs text-rose-200">
          <h3 className="font-bold text-rose-400 uppercase tracking-wider text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <span>Strict Zero Tolerance Integrity Policy & Automatic Kick-Out</span>
          </h3>
          <p className="leading-relaxed">
            1. <strong>Mandatory Camera & Retina Eye-Gaze Tracking:</strong> Active webcam access is mandatory. Your retina and eye gaze are monitored in real time. Looking away from the screen for over 3 seconds, looking down at notes/phone, multiple people, or leaving the frame will <strong>IMMEDIATELY kick you out, disqualify you, and award 0 marks</strong>.
          </p>
          <p className="leading-relaxed">
            2. <strong>Browser Focus & Fullscreen:</strong> Any attempt to switch browser tabs, leave or minimize the exam window, or exit fullscreen will also <strong>IMMEDIATELY terminate your examination session with 0 marks</strong>.
          </p>
          <p className="leading-relaxed">
            3. <strong>Automatic Submission on Time End:</strong> When the duration countdown expires, the test automatically finalizes and submits your current responses.
          </p>
          <p className="leading-relaxed">
            4. <strong>Autosave:</strong> All answers and code entries are autosaved in real-time.
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
            I confirm that I am taking this examination independently. I will maintain active webcam streaming and retina gaze on the screen throughout the session.
          </label>
        </div>

        {/* Step 1: Open Webcam & Start Button */}
        <button
          onClick={handleStartExamClick}
          disabled={!agreed || isStarting}
          className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]"
        >
          <Camera className="w-4 h-4" />
          <span>{isStarting ? 'Initiating Examination Session...' : 'Open Web Cam & Verify Retina Tracking'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Pre-Exam Camera & Retina Calibration Modal */}
      <CameraPermissionModal
        isOpen={cameraModalOpen}
        testTitle={test?.title}
        onProceed={handleProceedAfterCamera}
      />
    </div>
  );
};
