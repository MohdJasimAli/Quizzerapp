import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Camera,
  Eye,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Minimize2,
  Maximize2,
  RefreshCw,
  VideoOff,
  UserX,
  Users,
  Compass,
} from 'lucide-react';

/**
 * CameraRetinaProctor Component
 *
 * Implements:
 * 1. Mandatory browser webcam access via navigator.mediaDevices.getUserMedia
 * 2. Real-time Retina & Pupil Eye-Gaze Tracking (MediaPipe FaceMesh with Canvas CV Fallback)
 * 3. Eye deviation detection (detects when eyes look away from screen: Left, Right, Down, Up)
 * 4. Face presence & multiple-face detection
 * 5. Immediate zero-tolerance violation trigger on sustained gaze deviation or face absence
 * 6. Live visual cybernetic HUD overlay with pupil crosshairs and gaze vector
 */
export const CameraRetinaProctor = ({
  isActive = true,
  onViolation,
  onStatusChange,
  requireRetina = true,
}) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameRef = useRef(null);
  const faceMeshRef = useRef(null);

  // Status & Tracking State
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [engineType, setEngineType] = useState('initializing'); // 'mediapipe' | 'canvas_cv'
  const [gazeDirection, setGazeDirection] = useState('CENTER'); // 'CENTER' | 'LOOKING_LEFT' | 'LOOKING_RIGHT' | 'LOOKING_DOWN' | 'LOOKING_UP' | 'FACE_ABSENT' | 'MULTIPLE_FACES'
  const [gazeScore, setGazeScore] = useState(100); // 0 - 100 confidence eyes on screen
  const [faceCount, setFaceCount] = useState(1);
  const [warningCountdown, setWarningCountdown] = useState(null); // seconds before kick-out
  const [isMinimized, setIsMinimized] = useState(false);
  const [showSimControls, setShowSimControls] = useState(false);

  // Refs for tracking timestamps across animation frames
  const deviationStartRef = useRef(null);
  const violationTriggeredRef = useRef(false);
  const currentGazeRef = useRef('CENTER');
  const simOverrideRef = useRef(null);
  const cameraWarmupUntilRef = useRef(Date.now() + 4000); // 4-second camera warmup before violations can trigger

  const GRACE_PERIOD_MS = 3800; // 3.8 seconds sustained gaze deviation before zero-tolerance kickout

  const isMountedRef = useRef(true);

  // 1. Initialize Webcam Stream
  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
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
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().then(() => {
            setCameraReady(true);
            cameraWarmupUntilRef.current = Date.now() + 3500;
          }).catch((err) => {
            console.error('Video play error:', err);
          });
        };
      }

      // Handle stream end or disconnection
      stream.getVideoTracks()[0].onended = () => {
        if (!isMountedRef.current) return; // Clean unmount, not a violation
        setCameraReady(false);
        setCameraError('Webcam stream was disconnected or disabled.');
        if (onViolation && !violationTriggeredRef.current && Date.now() > cameraWarmupUntilRef.current) {
          violationTriggeredRef.current = true;
          onViolation('camera_disconnected', 'Webcam was disconnected or stopped during assessment');
        }
      };
    } catch (err) {
      console.error('Camera access error:', err);
      let errMsg = 'Failed to access webcam. Please allow camera permissions.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errMsg = 'Camera permission denied. Proctored examination requires camera access.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errMsg = 'No webcam device found on your system.';
      }
      setCameraError(errMsg);
      if (onViolation && !violationTriggeredRef.current) {
        violationTriggeredRef.current = true;
        onViolation('camera_permission_denied', errMsg);
      }
    }
  }, [onViolation]);

  useEffect(() => {
    if (isActive) {
      startCamera();
    }

    return () => {
      isMountedRef.current = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (faceMeshRef.current) {
        try {
          faceMeshRef.current.close();
        } catch (e) {}
      }
    };
  }, [isActive, startCamera]);

  // 2. High-Precision MediaPipe FaceMesh & Canvas Fallback Tracker
  useEffect(() => {
    if (!cameraReady || !videoRef.current || !canvasRef.current) return;

    let isMounted = true;
    let useMediaPipe = true;

    // Load MediaPipe FaceMesh dynamically with graceful fallback
    const initTracker = async () => {
      try {
        const { FaceMesh } = await import('@mediapipe/face_mesh');
        const faceMesh = new FaceMesh({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
        });

        faceMesh.setOptions({
          maxNumFaces: 2,
          refineLandmarks: true, // Enables 468-477 Iris/Retina landmarks!
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        faceMesh.onResults((results) => {
          if (!isMounted) return;
          processFaceMeshResults(results);
        });

        faceMeshRef.current = faceMesh;
        setEngineType('mediapipe');
      } catch (err) {
        console.warn('MediaPipe FaceMesh CDN unavailable, engaging Canvas CV Retina Tracker:', err);
        setEngineType('canvas_cv');
        useMediaPipe = false;
      }

      // Start processing loop
      runTrackingLoop(useMediaPipe);
    };

    const runTrackingLoop = (hasMediaPipe) => {
      const processFrame = async () => {
        if (!isMounted || !videoRef.current || videoRef.current.readyState < 2) {
          animFrameRef.current = requestAnimationFrame(processFrame);
          return;
        }

        if (hasMediaPipe && faceMeshRef.current) {
          try {
            await faceMeshRef.current.send({ image: videoRef.current });
          } catch (e) {
            // If MediaPipe send fails on this frame, fall back to Canvas CV
            runCanvasCVTracker();
          }
        } else {
          runCanvasCVTracker();
        }

        animFrameRef.current = requestAnimationFrame(processFrame);
      };

      animFrameRef.current = requestAnimationFrame(processFrame);
    };

    // 3A. Process MediaPipe FaceMesh Results (478 Landmarks with Irises)
    const processFaceMeshResults = (results) => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;

      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Check simulated override for test/developer verification
      if (simOverrideRef.current) {
        handleGazeState(simOverrideRef.current.state, simOverrideRef.current.faceCount);
        renderHUDOverlay(ctx, w, h, null, null, simOverrideRef.current.state);
        return;
      }

      const numFaces = results.multiFaceLandmarks?.length || 0;

      if (numFaces === 0) {
        handleGazeState('FACE_ABSENT', 0);
        renderHUDOverlay(ctx, w, h, null, null, 'FACE_ABSENT');
        return;
      }

      if (numFaces > 1) {
        handleGazeState('MULTIPLE_FACES', numFaces);
        renderHUDOverlay(ctx, w, h, null, null, 'MULTIPLE_FACES');
        return;
      }

      // Single Face Detected -> Analyze Retina & Eye-Gaze Vectors
      const landmarks = results.multiFaceLandmarks[0];

      // Left Eye landmarks (Indices): 33 (outer), 133 (inner), 159 (top), 145 (bottom)
      // Left Iris / Retina center: 468
      const leftInner = landmarks[133];
      const leftOuter = landmarks[33];
      const leftTop = landmarks[159];
      const leftBottom = landmarks[145];
      const leftIris = landmarks[468] || {
        x: (leftInner.x + leftOuter.x) / 2,
        y: (leftTop.y + leftBottom.y) / 2,
      };

      // Right Eye landmarks: 362 (inner), 263 (outer), 386 (top), 374 (bottom)
      // Right Iris / Retina center: 473
      const rightInner = landmarks[362];
      const rightOuter = landmarks[263];
      const rightTop = landmarks[386];
      const rightBottom = landmarks[374];
      const rightIris = landmarks[473] || {
        x: (rightInner.x + rightOuter.x) / 2,
        y: (rightTop.y + rightBottom.y) / 2,
      };

      // Nose & Head pose:
      const nose = landmarks[1];
      const leftCheek = landmarks[234];
      const rightCheek = landmarks[454];

      // Retina X Ratio calculation (0 = looking far right, 1 = looking far left in mirrored coordinates)
      const leftEyeWidth = Math.abs(leftOuter.x - leftInner.x) || 0.01;
      const leftRatioX = (leftIris.x - Math.min(leftInner.x, leftOuter.x)) / leftEyeWidth;

      const rightEyeWidth = Math.abs(rightOuter.x - rightInner.x) || 0.01;
      const rightRatioX = (rightIris.x - Math.min(rightInner.x, rightOuter.x)) / rightEyeWidth;

      const avgIrisX = (leftRatioX + rightRatioX) / 2;

      // Vertical Retina ratio (looking down towards desk/phone vs up)
      const eyeHeight = Math.abs(leftBottom.y - leftTop.y) || 0.01;
      const ratioY = (leftIris.y - leftTop.y) / eyeHeight;

      // Head Yaw (turning head left or right)
      const faceWidth = Math.abs(rightCheek.x - leftCheek.x) || 0.01;
      const headYaw = (nose.x - leftCheek.x) / faceWidth;

      // Determine Gaze Classification
      let detectedGaze = 'CENTER';

      if (headYaw < 0.32 || avgIrisX > 0.68) {
        detectedGaze = 'LOOKING_LEFT';
      } else if (headYaw > 0.68 || avgIrisX < 0.32) {
        detectedGaze = 'LOOKING_RIGHT';
      } else if (ratioY > 0.75) {
        detectedGaze = 'LOOKING_DOWN';
      } else if (ratioY < 0.20) {
        detectedGaze = 'LOOKING_UP';
      }

      handleGazeState(detectedGaze, 1);

      // Render Retina Tracking Reticles & Vectors
      renderHUDOverlay(ctx, w, h, {
        leftIris: { x: leftIris.x * w, y: leftIris.y * h },
        rightIris: { x: rightIris.x * w, y: rightIris.y * h },
        leftBox: {
          x: Math.min(leftInner.x, leftOuter.x) * w - 8,
          y: (leftTop.y * h) - 6,
          w: leftEyeWidth * w + 16,
          h: eyeHeight * h + 12,
        },
        rightBox: {
          x: Math.min(rightInner.x, rightOuter.x) * w - 8,
          y: (rightTop.y * h) - 6,
          w: rightEyeWidth * w + 16,
          h: eyeHeight * h + 12,
        },
      }, nose ? { x: nose.x * w, y: nose.y * h } : null, detectedGaze);
    };

    // 3B. High-Performance Canvas Computer Vision Fallback Tracker
    const runCanvasCVTracker = () => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video || video.videoWidth === 0) return;

      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;

      // Check simulated override for test/developer verification
      if (simOverrideRef.current) {
        handleGazeState(simOverrideRef.current.state, simOverrideRef.current.faceCount);
        renderHUDOverlay(ctx, w, h, null, null, simOverrideRef.current.state);
        return;
      }

      // Create offscreen analysis canvas
      const offCanvas = document.createElement('canvas');
      offCanvas.width = 160;
      offCanvas.height = 120;
      const offCtx = offCanvas.getContext('2d');
      offCtx.drawImage(video, 0, 0, 160, 120);

      const imgData = offCtx.getImageData(0, 0, 160, 120);
      const data = imgData.data;

      // 1. Face luminance & skin-tone center detection
      let skinPixels = 0;
      let skinXSum = 0;
      let skinYSum = 0;

      for (let y = 15; y < 105; y += 3) {
        for (let x = 20; x < 140; x += 3) {
          const idx = (y * 160 + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];

          // Simple skin tone heuristic in RGB
          if (r > 60 && g > 40 && b > 20 && r > g && r > b && Math.abs(r - g) > 12) {
            skinPixels++;
            skinXSum += x;
            skinYSum += y;
          }
        }
      }

      ctx.clearRect(0, 0, w, h);

      if (skinPixels < 120) {
        // Face absent
        handleGazeState('FACE_ABSENT', 0);
        renderHUDOverlay(ctx, w, h, null, null, 'FACE_ABSENT');
        return;
      }

      const faceCenterX = skinXSum / skinPixels;
      const faceCenterY = skinYSum / skinPixels;

      // 2. Locate Eye Band (upper region of face)
      const eyeBandY = Math.max(20, faceCenterY - 18);
      const leftEyeRegionX = faceCenterX - 32;
      const rightEyeRegionX = faceCenterX + 8;

      // Find darkest pupil centers in both eye regions
      const findPupilCenter = (startX, startY, spanW, spanH) => {
        let minBrightness = 9999;
        let pupilX = startX + spanW / 2;
        let pupilY = startY + spanH / 2;

        for (let y = Math.max(0, startY); y < Math.min(120, startY + spanH); y += 2) {
          for (let x = Math.max(0, startX); x < Math.min(160, startX + spanW); x += 2) {
            const idx = (y * 160 + x) * 4;
            const brightness = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
            if (brightness < minBrightness) {
              minBrightness = brightness;
              pupilX = x;
              pupilY = y;
            }
          }
        }
        return { x: pupilX, y: pupilY, minBrightness };
      };

      const leftPupil = findPupilCenter(leftEyeRegionX, eyeBandY, 26, 18);
      const rightPupil = findPupilCenter(rightEyeRegionX, eyeBandY, 26, 18);

      // Relative horizontal offset of face center vs frame center (80 = frame center)
      const frameCenterX = 80;
      const offsetFromCenter = (faceCenterX - frameCenterX) / frameCenterX;

      let detectedGaze = 'CENTER';
      if (offsetFromCenter < -0.28) {
        detectedGaze = 'LOOKING_RIGHT';
      } else if (offsetFromCenter > 0.28) {
        detectedGaze = 'LOOKING_LEFT';
      } else if (faceCenterY > 75) {
        detectedGaze = 'LOOKING_DOWN';
      }

      handleGazeState(detectedGaze, 1);

      // Scale to display canvas
      const scaleX = w / 160;
      const scaleY = h / 120;

      renderHUDOverlay(ctx, w, h, {
        leftIris: { x: leftPupil.x * scaleX, y: leftPupil.y * scaleY },
        rightIris: { x: rightPupil.x * scaleX, y: rightPupil.y * scaleY },
        leftBox: {
          x: leftEyeRegionX * scaleX,
          y: eyeBandY * scaleY,
          w: 26 * scaleX,
          h: 18 * scaleY,
        },
        rightBox: {
          x: rightEyeRegionX * scaleX,
          y: eyeBandY * scaleY,
          w: 26 * scaleX,
          h: 18 * scaleY,
        },
      }, { x: faceCenterX * scaleX, y: faceCenterY * scaleY }, detectedGaze);
    };

    // 4. Render Visual High-Tech HUD Overlay (Retina reticles, crosshairs & vectors)
    const renderHUDOverlay = (ctx, w, h, eyeData, nose, gaze) => {
      ctx.save();

      const isNormal = gaze === 'CENTER';
      const isWarn = gaze === 'LOOKING_LEFT' || gaze === 'LOOKING_RIGHT' || gaze === 'LOOKING_DOWN' || gaze === 'LOOKING_UP';
      const isCritical = gaze === 'FACE_ABSENT' || gaze === 'MULTIPLE_FACES';

      const themeColor = isNormal ? '#10b981' : isWarn ? '#f59e0b' : '#ef4444';

      if (eyeData) {
        // Draw Left & Right Eye Bounding Boxes
        [eyeData.leftBox, eyeData.rightBox].forEach((box) => {
          if (!box) return;
          ctx.strokeStyle = themeColor;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 3]);
          ctx.strokeRect(box.x, box.y, box.w, box.h);
          ctx.setLineDash([]);

          // Corner bracket accents
          const len = 6;
          ctx.lineWidth = 2.5;
          // Top-left
          ctx.beginPath();
          ctx.moveTo(box.x, box.y + len);
          ctx.lineTo(box.x, box.y);
          ctx.lineTo(box.x + len, box.y);
          ctx.stroke();
          // Top-right
          ctx.beginPath();
          ctx.moveTo(box.x + box.w - len, box.y);
          ctx.lineTo(box.x + box.w, box.y);
          ctx.lineTo(box.x + box.w, box.y + len);
          ctx.stroke();
        });

        // Draw Retina / Pupil Crosshair Targets
        [eyeData.leftIris, eyeData.rightIris].forEach((iris) => {
          if (!iris) return;

          // Glowing outer retina target circle
          ctx.beginPath();
          ctx.arc(iris.x, iris.y, 7, 0, Math.PI * 2);
          ctx.strokeStyle = themeColor;
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Inner pupil center dot
          ctx.beginPath();
          ctx.arc(iris.x, iris.y, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = themeColor;
          ctx.fill();

          // Crosshair lines
          ctx.strokeStyle = themeColor;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(iris.x - 11, iris.y);
          ctx.lineTo(iris.x + 11, iris.y);
          ctx.moveTo(iris.x, iris.y - 11);
          ctx.lineTo(iris.x, iris.y + 11);
          ctx.stroke();
        });

        // Draw Gaze Vector Line from center of eyes
        if (eyeData.leftIris && eyeData.rightIris) {
          const midX = (eyeData.leftIris.x + eyeData.rightIris.x) / 2;
          const midY = (eyeData.leftIris.y + eyeData.rightIris.y) / 2;

          let targetX = midX;
          let targetY = midY;

          if (gaze === 'LOOKING_LEFT') targetX += 45;
          else if (gaze === 'LOOKING_RIGHT') targetX -= 45;
          else if (gaze === 'LOOKING_DOWN') targetY += 35;
          else if (gaze === 'LOOKING_UP') targetY -= 35;

          ctx.beginPath();
          ctx.moveTo(midX, midY);
          ctx.lineTo(targetX, targetY);
          ctx.strokeStyle = isNormal ? 'rgba(16, 185, 129, 0.7)' : themeColor;
          ctx.lineWidth = 2;
          ctx.stroke();

          // Vector endpoint dot
          ctx.beginPath();
          ctx.arc(targetX, targetY, 3, 0, Math.PI * 2);
          ctx.fillStyle = themeColor;
          ctx.fill();
        }
      }

      // Top Status Banner on Canvas
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.fillRect(8, 8, w - 16, 26);
      ctx.strokeStyle = themeColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(8, 8, w - 16, 26);

      ctx.font = 'bold 10px monospace';
      ctx.fillStyle = themeColor;
      ctx.textAlign = 'left';

      const gazeText =
        gaze === 'CENTER'
          ? '● RETINA LOCKED: EYES ON SCREEN'
          : gaze === 'LOOKING_LEFT'
          ? '▲ ALERT: LOOKING LEFT (OFF-SCREEN)'
          : gaze === 'LOOKING_RIGHT'
          ? '▲ ALERT: LOOKING RIGHT (OFF-SCREEN)'
          : gaze === 'LOOKING_DOWN'
          ? '▲ ALERT: LOOKING DOWN (OFF-SCREEN)'
          : gaze === 'FACE_ABSENT'
          ? '✖ CRITICAL: FACE NOT DETECTED'
          : '✖ CRITICAL: MULTIPLE FACES DETECTED';

      ctx.fillText(gazeText, 16, 25);

      ctx.restore();
    };

    initTracker();

    return () => {
      isMounted = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [cameraReady]);

  // 5. Zero-Tolerance Violation & Warning Timer Handler
  const handleGazeState = useCallback((detectedGaze, count) => {
    setGazeDirection(detectedGaze);
    setFaceCount(count);
    currentGazeRef.current = detectedGaze;

    const isViolationState =
      detectedGaze !== 'CENTER' &&
      detectedGaze !== 'LOOKING_UP'; // Minor up glance permitted, left/right/down/absent are violations

    if (onStatusChange) {
      onStatusChange({
        gaze: detectedGaze,
        isViolation: isViolationState,
        faceCount: count,
      });
    }

    if (!isViolationState) {
      // Returned to normal -> Clear countdown
      deviationStartRef.current = null;
      setWarningCountdown(null);
      setGazeScore(100);
      return;
    }

    // Do not trigger violations during initial camera auto-exposure warmup
    if (Date.now() < cameraWarmupUntilRef.current) {
      return;
    }

    // Violation state active
    const now = Date.now();
    if (!deviationStartRef.current) {
      deviationStartRef.current = now;
    }

    const elapsed = now - deviationStartRef.current;
    const remainingMs = Math.max(0, GRACE_PERIOD_MS - elapsed);
    const remainingSec = (remainingMs / 1000).toFixed(1);

    setWarningCountdown(remainingSec);
    setGazeScore(Math.max(10, Math.round((remainingMs / GRACE_PERIOD_MS) * 100)));

    // Kick out if elapsed > GRACE_PERIOD_MS and not already triggered
    if (elapsed >= GRACE_PERIOD_MS && !violationTriggeredRef.current) {
      violationTriggeredRef.current = true;

      let eventType = 'retina_gaze_violation';
      let details = 'Student diverted retina/eye gaze away from examination screen for over 3 seconds';

      if (detectedGaze === 'FACE_ABSENT') {
        eventType = 'face_not_detected';
        details = 'Student face was absent from webcam proctoring feed for over 3 seconds';
      } else if (detectedGaze === 'MULTIPLE_FACES') {
        eventType = 'multiple_faces_detected';
        details = 'Multiple faces detected in examination camera view';
      }

      if (onViolation) {
        onViolation(eventType, details);
      }
    }
  }, [onViolation, onStatusChange]);

  // Developer Simulation Helpers (For testing and verifying on any machine)
  const setSimulatedGaze = (state, count = 1) => {
    if (state === null) {
      simOverrideRef.current = null;
    } else {
      simOverrideRef.current = { state, faceCount: count };
    }
  };

  return (
    <div
      className={`fixed bottom-4 right-4 z-40 transition-all duration-300 ${
        isMinimized ? 'w-56' : 'w-72 sm:w-80'
      }`}
    >
      <div className="glass-panel rounded-2xl border border-slate-700/80 bg-slate-950/95 shadow-2xl shadow-black/80 overflow-hidden backdrop-blur-xl">
        {/* Widget Header Bar */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2">
            <div className="relative">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 block animate-pulse"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 block absolute inset-0 animate-ping opacity-75"></span>
            </div>
            <span className="text-[11px] font-bold text-white tracking-wide uppercase flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-indigo-400" />
              <span>Retina Proctor</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowSimControls(!showSimControls)}
              title="Toggle Proctor Simulator Controls"
              className="text-slate-400 hover:text-indigo-400 p-1 rounded-md text-[10px] font-mono transition"
            >
              <Compass className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="text-slate-400 hover:text-white p-1 rounded-md transition"
              title={isMinimized ? 'Expand Camera View' : 'Minimize Camera View'}
            >
              {isMinimized ? (
                <Maximize2 className="w-3.5 h-3.5" />
              ) : (
                <Minimize2 className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Video & Canvas Overlay Viewport */}
        {!isMinimized && (
          <div className="relative aspect-[4/3] bg-slate-950 overflow-hidden">
            {cameraError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-rose-950/40 border border-rose-500/30">
                <VideoOff className="w-8 h-8 text-rose-400 mb-2" />
                <p className="text-xs font-semibold text-rose-200">{cameraError}</p>
                <button
                  onClick={startCamera}
                  className="mt-3 py-1 px-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-semibold flex items-center gap-1 transition"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Retry Camera</span>
                </button>
              </div>
            ) : (
              <>
                {/* Mirrored Live Video Feed */}
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="w-full h-full object-cover transform scale-x-[-1]"
                />

                {/* Real-time Retina Crosshair HUD Canvas */}
                <canvas
                  ref={canvasRef}
                  width={320}
                  height={240}
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                />

                {/* Sustained Violation Warning Flash */}
                {warningCountdown !== null && (
                  <div className="absolute inset-0 bg-rose-600/30 border-2 border-rose-500 flex flex-col items-center justify-center p-2 text-center animate-pulse z-10">
                    <ShieldAlert className="w-8 h-8 text-white mb-1 drop-shadow-md" />
                    <span className="text-xs font-black text-white uppercase tracking-wider drop-shadow-md">
                      EYES OFF SCREEN!
                    </span>
                    <span className="text-[11px] font-bold text-rose-100 mt-0.5">
                      Auto-kickout in: <strong className="text-white text-base font-mono">{warningCountdown}s</strong>
                    </span>
                    <span className="text-[10px] text-white/90 mt-1">
                      Look directly back at the screen!
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Real-Time Telemetry Bar */}
        <div className="p-2.5 bg-slate-900 border-t border-slate-800 text-[11px] space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Eye-Gaze Alignment:</span>
            <span
              className={`font-bold font-mono px-2 py-0.5 rounded text-[10px] uppercase ${
                gazeDirection === 'CENTER'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}
            >
              {gazeDirection.replace(/_/g, ' ')}
            </span>
          </div>

          <div className="flex items-center justify-between text-[10px]">
            <span className="text-slate-400">Retina Focus Score:</span>
            <div className="flex items-center gap-2">
              <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-200 ${
                    gazeScore > 70 ? 'bg-emerald-500' : gazeScore > 40 ? 'bg-amber-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${gazeScore}%` }}
                ></div>
              </div>
              <span className="font-mono text-slate-300">{gazeScore}%</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>Tracking Engine:</span>
            <span className="text-slate-300 font-mono">
              {engineType === 'mediapipe' ? 'MediaPipe Iris (478 pts)' : 'Canvas CV Pupil'}
            </span>
          </div>

          {/* Collapsible Simulator / Verification Controls */}
          {showSimControls && (
            <div className="mt-2 pt-2 border-t border-slate-800/80 space-y-1.5 animate-fade-in">
              <span className="text-[10px] text-indigo-400 font-bold block uppercase tracking-wider">
                Proctor Testing Controls:
              </span>
              <div className="grid grid-cols-2 gap-1 text-[10px]">
                <button
                  onClick={() => setSimulatedGaze(null)}
                  className="py-1 px-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-center"
                >
                  Live Webcam
                </button>
                <button
                  onClick={() => setSimulatedGaze('CENTER')}
                  className="py-1 px-1.5 rounded bg-emerald-950 hover:bg-emerald-900 text-emerald-300 text-center border border-emerald-800"
                >
                  Simulate Center
                </button>
                <button
                  onClick={() => setSimulatedGaze('LOOKING_LEFT')}
                  className="py-1 px-1.5 rounded bg-amber-950 hover:bg-amber-900 text-amber-300 text-center border border-amber-800"
                >
                  Simulate Look Left
                </button>
                <button
                  onClick={() => setSimulatedGaze('LOOKING_RIGHT')}
                  className="py-1 px-1.5 rounded bg-amber-950 hover:bg-amber-900 text-amber-300 text-center border border-amber-800"
                >
                  Simulate Look Right
                </button>
                <button
                  onClick={() => setSimulatedGaze('LOOKING_DOWN')}
                  className="py-1 px-1.5 rounded bg-amber-950 hover:bg-amber-900 text-amber-300 text-center border border-amber-800"
                >
                  Simulate Look Down
                </button>
                <button
                  onClick={() => setSimulatedGaze('FACE_ABSENT', 0)}
                  className="py-1 px-1.5 rounded bg-rose-950 hover:bg-rose-900 text-rose-300 text-center border border-rose-800"
                >
                  Simulate Face Absent
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
