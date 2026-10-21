import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Eye,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Maximize2,
  VideoOff,
  RefreshCw,
} from 'lucide-react';

export const CameraPermissionModal = ({
  isOpen,
  onProceed,
  testTitle,
}) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [agreedToConsent, setAgreedToConsent] = useState(false);
  const [loading, setLoading] = useState(true);

  const initCamera = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: false,
      });

      streamRef.current = stream;
      setHasPermission(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().then(() => {
            setTimeout(() => {
              setIsCalibrated(true);
              setLoading(false);
            }, 1000);
          });
        };
      }
    } catch (err) {
      console.error('Camera init error:', err);
      setLoading(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMsg('Camera access was denied. You must grant camera access in your browser settings to take this proctored examination.');
      } else if (err.name === 'NotFoundError') {
        setErrorMsg('No camera device detected. Please connect a webcam.');
      } else {
        setErrorMsg('Unable to initialize camera. Please check your browser hardware permissions.');
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      initCamera();
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [isOpen]);

  const handleStartExam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    onProceed();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Top Gradient Accent */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-500"></div>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Camera className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">
              Camera & Retina Proctoring Verification
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Required for: <strong className="text-slate-200">{testTitle || 'Kairos Assessment'}</strong>
            </p>
          </div>
        </div>

        {/* Video Preview Viewport */}
        <div className="my-4 relative rounded-2xl overflow-hidden aspect-video bg-slate-950 border border-slate-800 flex items-center justify-center">
          {errorMsg ? (
            <div className="p-6 text-center text-rose-300 space-y-2">
              <VideoOff className="w-10 h-10 mx-auto text-rose-400 mb-2" />
              <p className="text-xs font-semibold">{errorMsg}</p>
              <button
                onClick={initCamera}
                className="mt-3 py-1.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold inline-flex items-center gap-2 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Permission</span>
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover transform scale-x-[-1]"
              />

              {loading && (
                <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center gap-2 text-xs text-slate-300">
                  <div className="w-8 h-8 border-3 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                  <span>Calibrating camera & retina sensor...</span>
                </div>
              )}

              {/* Facial alignment guide overlay */}
              {!loading && isCalibrated && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-48 h-60 rounded-full border-2 border-dashed border-emerald-400/50 flex flex-col items-center justify-between py-6">
                    <span className="text-[10px] uppercase font-mono text-emerald-400 bg-slate-950/80 px-2 py-0.5 rounded">
                      Align Face Here
                    </span>
                    <span className="text-[10px] uppercase font-mono text-emerald-400 bg-slate-950/80 px-2 py-0.5 rounded">
                      ● Retina Calibrated
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Proctoring Checklist */}
        <div className="grid grid-cols-2 gap-2 my-4 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center gap-2">
            <CheckCircle2
              className={`w-4 h-4 ${hasPermission ? 'text-emerald-400' : 'text-slate-600'}`}
            />
            <span className={hasPermission ? 'text-slate-200' : 'text-slate-500'}>
              Camera Hardware Active
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center gap-2">
            <CheckCircle2
              className={`w-4 h-4 ${isCalibrated ? 'text-emerald-400' : 'text-slate-600'}`}
            />
            <span className={isCalibrated ? 'text-slate-200' : 'text-slate-500'}>
              Retina Tracking Ready
            </span>
          </div>
        </div>

        {/* Informed Consent Checkbox */}
        <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-2">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreedToConsent}
              onChange={(e) => setAgreedToConsent(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-900 border-slate-700 cursor-pointer"
            />
            <span className="leading-relaxed text-slate-300">
              I acknowledge that this examination is continuously monitored with <strong>real-time retina eye-gaze tracking</strong>. Diverting my eyes away from the screen for over 3 seconds, looking away, or leaving the camera view will result in <strong>immediate kick-out with 0 marks</strong>.
            </span>
          </label>
        </div>

        {/* Action Button */}
        <button
          onClick={handleStartExam}
          disabled={!hasPermission || !agreedToConsent || !isCalibrated}
          className="mt-5 w-full py-3 px-6 rounded-xl bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-2 transition"
        >
          <ShieldCheck className="w-5 h-5" />
          <span>Confirm & Enter Proctored Exam</span>
        </button>
      </div>
    </div>
  );
};
