import React from 'react';
import { AlertOctagon, ShieldAlert, Maximize2 } from 'lucide-react';

export const IntegrityWarningModal = ({
  isOpen,
  violationCount,
  warningLimit = 3,
  eventType,
  onAcknowledge,
  autoSubmitted = false,
}) => {
  if (!isOpen) return null;

  const eventMessages = {
    tab_switch: 'Tab switch / focus loss detected. Leaving the examination page is recorded as an integrity violation.',
    fullscreen_exit: 'Fullscreen mode was exited. Fullscreen is mandatory during the assessment.',
    window_blur: 'Window lost active focus. Another application or browser window may have been accessed.',
    retina_gaze_violation: 'Retina eye-gaze tracking detected you were looking away from the screen for over 3 seconds.',
    face_not_detected: 'Your face was not detected in the camera feed for over 3 seconds.',
    multiple_faces_detected: 'Multiple faces were detected in the examination camera view.',
    camera_disconnected: 'Webcam feed was disconnected or turned off during the examination.',
    camera_permission_denied: 'Camera permission was denied. Proctored examination requires active camera access.',
  };

  const message = eventMessages[eventType] || 'Integrity anomaly detected and recorded on the server.';
  const warningsLeft = Math.max(0, warningLimit - violationCount);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-rose-500/40 rounded-2xl max-w-md w-full p-6 shadow-2xl shadow-rose-950/50 flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4 animate-bounce">
          <AlertOctagon className="w-8 h-8" />
        </div>

        <h3 className="text-xl font-bold text-white mb-1">
          {autoSubmitted ? 'Assessment Auto-Submitted' : 'Test Integrity Warning'}
        </h3>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-950/80 border border-rose-500/50 text-rose-300 text-xs font-semibold my-2">
          <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
          <span>
            Violation {violationCount} of {warningLimit}
          </span>
        </div>

        <p className="text-sm text-slate-300 mt-2 leading-relaxed">
          {message}
        </p>

        {autoSubmitted ? (
          <div className="mt-4 p-3 rounded-xl bg-rose-950/40 border border-rose-900 text-xs text-rose-200">
            You have reached the maximum allowed integrity violations. Your test has been finalized and automatically submitted for teacher review.
          </div>
        ) : (
          <div className="mt-4 p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300 text-left w-full space-y-1">
            <p className="font-semibold text-slate-200">Important Reminders:</p>
            <p>&bull; Remain in full-screen mode at all times.</p>
            <p>&bull; Do not use external tabs, developer tools, or background windows.</p>
            <p>&bull; Warnings remaining before review action: <strong className="text-rose-400">{warningsLeft}</strong></p>
          </div>
        )}

        <button
          onClick={onAcknowledge}
          className="mt-6 w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition"
        >
          {autoSubmitted ? (
            'View Submission'
          ) : (
            <>
              <Maximize2 className="w-4 h-4" />
              <span>Acknowledge & Return to Full Screen</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
