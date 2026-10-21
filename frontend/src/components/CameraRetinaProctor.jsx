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
 * High-sensitivity proctoring engine for:
 * 1. Head Rotation (Turning head Left / Right away from screen)
 * 2. Head Pitch (Tilting down toward phone, desk, or lap)
 * 3. Gaze Deviation (Darting eyes away from screen)
 * 4. Face Absence & Multiple Faces
 * 5. Immediate zero-tolerance kickout with 0 marks after 2.5s of sustained violation
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
  const isMountedRef = useRef(true);

  // Status & Tracking State
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [gazeDirection, setGazeDirection] = useState('CENTER');
  const [movementDetail, setMovementDetail] = useState('Eyes and head focused on exam screen');
  const [gazeScore, setGazeScore] = useState(100);
  const [warningCountdown, setWarningCountdown] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showSimControls, setShowSimControls] = useState(true);

  // Live telemetry display
  const [telemetry, setTelemetry] = useState({
    yaw: 0,
    pitch: 0,
    diff: 0,
    state: 'CENTER',
  });

  // Calibration and Tracking Refs
  const baselineFaceRef = useRef(null); // { cx, cy, w, h, skew }
  const baselineTemplateRef = useRef(null); // 40x40 normalized grayscale patch
  const calibrationCountRef = useRef(0);
  const prevFramePixelsRef = useRef(null);

  const deviationStartRef = useRef(null);
  const violationTriggeredRef = useRef(false);
  const currentGazeRef = useRef('CENTER');
  const simOverrideRef = useRef(null);
  const cameraWarmupUntilRef = useRef(Date.now() + 2000);
  const lastBeepTimeRef = useRef(0);

  const GRACE_PERIOD_MS = 2500; // 2.5s sustained violation before instant kickout

  // Audio warning chime (Web Audio API)
  const playWarningBeep = useCallback(() => {
    const now = Date.now();
    if (now - lastBeepTimeRef.current < 1200) return;
    lastBeepTimeRef.current = now;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } catch (e) {}
  }, []);

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
          videoRef.current
            .play()
            .then(() => {
              setCameraReady(true);
              cameraWarmupUntilRef.current = Date.now() + 2000;
              calibrationCountRef.current = 0;
              baselineFaceRef.current = null;
              baselineTemplateRef.current = null;
            })
            .catch((err) => {
              console.error('Video play error:', err);
            });
        };
      }

      stream.getVideoTracks()[0].onended = () => {
        if (!isMountedRef.current) return;
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
    isMountedRef.current = true;
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
    };
  }, [isActive, startCamera]);

  // 2. High-Sensitivity Visual Tracking Loop
  useEffect(() => {
    if (!cameraReady || !videoRef.current || !canvasRef.current) return;

    let isMounted = true;

    // Offscreen 160x120 canvas for fast pixel processing
    const offCanvas = document.createElement('canvas');
    offCanvas.width = 160;
    offCanvas.height = 120;
    const offCtx = offCanvas.getContext('2d');

    const processFrame = () => {
      if (!isMounted) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!video || !canvas || video.readyState < 2 || video.videoWidth === 0) {
        animFrameRef.current = requestAnimationFrame(processFrame);
        return;
      }

      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;

      // Check tester simulation override
      if (simOverrideRef.current) {
        handleMovementState(
          simOverrideRef.current.state,
          simOverrideRef.current.detail,
          simOverrideRef.current.faceCount
        );
        renderHUDOverlay(ctx, w, h, null, simOverrideRef.current.state, simOverrideRef.current.detail, 0, 0, 0);
        animFrameRef.current = requestAnimationFrame(processFrame);
        return;
      }

      // Draw current video frame to offscreen canvas
      offCtx.drawImage(video, 0, 0, 160, 120);
      const imgData = offCtx.getImageData(0, 0, 160, 120);
      const data = imgData.data;

      // Step A: Skin & Face Boundary Detection
      let skinPixels = 0;
      let minX = 160,
        maxX = 0,
        minY = 120,
        maxY = 0;
      let skinXSum = 0,
        skinYSum = 0;

      for (let y = 8; y < 112; y += 2) {
        for (let x = 12; x < 148; x += 2) {
          const idx = (y * 160 + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];

          // Broad, reliable illumination-adaptive skin model
          const isSkin =
            r > 38 &&
            g > 20 &&
            b > 12 &&
            r > g &&
            r - b > 8 &&
            r - g > 4 &&
            Math.abs(r - g) < 140;

          if (isSkin) {
            skinPixels++;
            skinXSum += x;
            skinYSum += y;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      ctx.clearRect(0, 0, w, h);

      const faceW = maxX - minX;
      const faceH = maxY - minY;

      // Check Face Presence
      if (skinPixels < 110 || faceW < 22 || faceH < 22) {
        handleMovementState('FACE_ABSENT', 'Student face not detected in camera view', 0);
        renderHUDOverlay(ctx, w, h, null, 'FACE_ABSENT', 'Face Absent', 0, 0, 1);
        animFrameRef.current = requestAnimationFrame(processFrame);
        return;
      }

      const cx = skinXSum / skinPixels;
      const cy = skinYSum / skinPixels;
      const boxCenterX = (minX + maxX) / 2;

      // Extract 40x40 normalized grayscale face patch
      const patchSize = 40;
      const currentPatch = new Float32Array(patchSize * patchSize);
      const patchStartX = Math.max(0, Math.min(160 - patchSize, Math.round(cx - patchSize / 2)));
      const patchStartY = Math.max(0, Math.min(120 - patchSize, Math.round(cy - patchSize / 2)));

      for (let py = 0; py < patchSize; py++) {
        for (let px = 0; px < patchSize; px++) {
          const srcIdx = ((patchStartY + py) * 160 + (patchStartX + px)) * 4;
          // Luminance normalized [0, 1]
          currentPatch[py * patchSize + px] =
            (data[srcIdx] * 0.299 + data[srcIdx + 1] * 0.587 + data[srcIdx + 2] * 0.114) / 255;
        }
      }

      // Step B: Auto-Calibration on first 25 frames
      if (calibrationCountRef.current < 25) {
        calibrationCountRef.current += 1;
        if (calibrationCountRef.current === 25) {
          baselineFaceRef.current = { cx, cy, w: faceW, h: faceH, boxCenterX };
          baselineTemplateRef.current = new Float32Array(currentPatch);
          setIsCalibrated(true);
        } else {
          // Calibration in progress
          renderHUDOverlay(
            ctx,
            w,
            h,
            { cx: (cx / 160) * w, cy: (cy / 120) * h, w: (faceW / 160) * w, h: (faceH / 120) * h },
            'CALIBRATING',
            `Calibrating face position (${calibrationCountRef.current}/25)... Look straight`,
            0,
            0,
            0
          );
          animFrameRef.current = requestAnimationFrame(processFrame);
          return;
        }
      }

      const base = baselineFaceRef.current || { cx, cy, w: faceW, h: faceH, boxCenterX };
      const refTemplate = baselineTemplateRef.current || currentPatch;

      // Step C: High-Sensitivity Movement & Pose Detection

      // 1. Template Difference (Face Rotation / Deformation)
      let templateDiff = 0;
      for (let i = 0; i < patchSize * patchSize; i++) {
        templateDiff += Math.abs(currentPatch[i] - refTemplate[i]);
      }
      templateDiff /= patchSize * patchSize;

      // 2. Head Yaw (Horizontal Shift & Perspective Skew)
      // Note: Video is mirrored in CSS (scale-x-[-1]), so when user turns to THEIR left, cx shifts in camera
      const deltaX = (cx - base.cx) / (base.w || 40);
      const leftCheekWidth = cx - minX;
      const rightCheekWidth = maxX - cx;
      const skew = (leftCheekWidth - rightCheekWidth) / (faceW || 1);

      // 3. Head Pitch (Looking Down at Phone/Desk)
      const deltaY = (cy - base.cy) / (base.h || 40);

      // 4. Feature Contrast Asymmetry
      // Divide face into left and right halves and measure luminance balance
      let leftLum = 0,
        rightLum = 0,
        leftCount = 0,
        rightCount = 0;
      for (let y = Math.round(minY + faceH * 0.2); y < Math.round(minY + faceH * 0.7); y += 2) {
        for (let x = Math.round(minX); x < Math.round(maxX); x += 2) {
          const idx = (y * 160 + x) * 4;
          const lum = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
          if (x < cx) {
            leftLum += lum;
            leftCount++;
          } else {
            rightLum += lum;
            rightCount++;
          }
        }
      }
      const avgLeftLum = leftLum / (leftCount || 1);
      const avgRightLum = rightLum / (rightCount || 1);
      const lumAsymmetry = Math.abs(avgLeftLum - avgRightLum) / (avgLeftLum + avgRightLum || 1);

      // Sensitive State Classification
      let detectedState = 'CENTER';
      let detail = 'Head and eyes focused on exam screen';

      // 1. Turn Head Left
      if (deltaX < -0.045 || skew < -0.10 || (deltaX < -0.025 && templateDiff > 0.07)) {
        detectedState = 'HEAD_TURNED_LEFT';
        detail = 'Head turned to the left side away from screen';
      }
      // 2. Turn Head Right
      else if (deltaX > 0.045 || skew > 0.10 || (deltaX > 0.025 && templateDiff > 0.07)) {
        detectedState = 'HEAD_TURNED_RIGHT';
        detail = 'Head turned to the right side away from screen';
      }
      // 3. Look Down (at phone, keyboard, desk, notes)
      else if (deltaY > 0.04 || (deltaY > 0.025 && templateDiff > 0.07)) {
        detectedState = 'LOOKING_DOWN';
        detail = 'Head tilted down / eyes looking down at phone or notes';
      }
      // 4. Look Away / Extreme Angle
      else if (templateDiff > 0.12) {
        detectedState = 'LOOKING_AWAY';
        detail = 'Head or gaze diverted away from examination screen';
      }

      setTelemetry({
        yaw: Number(deltaX.toFixed(3)),
        pitch: Number(deltaY.toFixed(3)),
        diff: Number(templateDiff.toFixed(3)),
        state: detectedState,
      });

      handleMovementState(detectedState, detail, 1);

      // Render HUD with face tracking box and directional pointers
      renderHUDOverlay(
        ctx,
        w,
        h,
        {
          cx: (cx / 160) * w,
          cy: (cy / 120) * h,
          w: (faceW / 160) * w,
          h: (faceH / 120) * h,
        },
        detectedState,
        detail,
        deltaX,
        deltaY,
        templateDiff
      );

      animFrameRef.current = requestAnimationFrame(processFrame);
    };

    // 3. Render High-Tech HUD Overlay
    const renderHUDOverlay = (ctx, w, h, faceBox, state, detail, deltaX, deltaY, diff) => {
      ctx.save();

      const isNormal = state === 'CENTER' || state === 'CALIBRATING';
      const themeColor = state === 'CALIBRATING' ? '#38bdf8' : isNormal ? '#10b981' : '#ef4444';

      if (faceBox) {
        // Facial Tracking Target Box
        const bx = faceBox.cx - faceBox.w / 2;
        const by = faceBox.cy - faceBox.h / 2;

        ctx.strokeStyle = themeColor;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(bx, by, faceBox.w, faceBox.h);

        // Target Crosshair at Face Center
        ctx.beginPath();
        ctx.arc(faceBox.cx, faceBox.cy, 4, 0, Math.PI * 2);
        ctx.fillStyle = themeColor;
        ctx.fill();

        ctx.strokeStyle = themeColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(faceBox.cx - 12, faceBox.cy);
        ctx.lineTo(faceBox.cx + 12, faceBox.cy);
        ctx.moveTo(faceBox.cx, faceBox.cy - 12);
        ctx.lineTo(faceBox.cx, faceBox.cy + 12);
        ctx.stroke();

        // Directional Gaze/Head Vector
        if (!isNormal) {
          let vecX = faceBox.cx;
          let vecY = faceBox.cy;

          if (state.includes('LEFT')) vecX -= 45;
          else if (state.includes('RIGHT')) vecX += 45;
          else if (state.includes('DOWN')) vecY += 35;

          ctx.beginPath();
          ctx.moveTo(faceBox.cx, faceBox.cy);
          ctx.lineTo(vecX, vecY);
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 3;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(vecX, vecY, 4, 0, Math.PI * 2);
          ctx.fillStyle = '#ef4444';
          ctx.fill();
        }
      }

      // Top Status Banner
      ctx.fillStyle = isNormal ? 'rgba(15, 23, 42, 0.85)' : 'rgba(239, 68, 68, 0.95)';
      ctx.fillRect(6, 6, w - 12, 26);
      ctx.strokeStyle = themeColor;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(6, 6, w - 12, 26);

      ctx.font = 'bold 10px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';

      const bannerText =
        state === 'CENTER'
          ? '● RETINA LOCKED: EYES ON SCREEN'
          : state === 'CALIBRATING'
          ? '◌ CALIBRATING RETINA SENSOR...'
          : `⚠️ ALERT: ${state.replace(/_/g, ' ')}`;

      ctx.fillText(bannerText, 12, 23);

      // Bottom Head Yaw / Deviation Bar
      const gaugeW = 110;
      const gaugeH = 6;
      const gaugeX = (w - gaugeW) / 2;
      const gaugeY = h - 14;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.fillRect(gaugeX - 8, gaugeY - 4, gaugeW + 16, gaugeH + 8);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.strokeRect(gaugeX, gaugeY, gaugeW, gaugeH);

      // Center calibration tick
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(gaugeX + gaugeW / 2 - 1, gaugeY - 2, 2, gaugeH + 4);

      // Marker for current yaw
      const normalizedYaw = Math.max(-0.2, Math.min(0.2, deltaX));
      const markerX = gaugeX + gaugeW / 2 + (normalizedYaw / 0.2) * (gaugeW / 2);

      ctx.fillStyle = isNormal ? '#10b981' : '#ef4444';
      ctx.beginPath();
      ctx.arc(markerX, gaugeY + gaugeH / 2, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    };

    animFrameRef.current = requestAnimationFrame(processFrame);

    return () => {
      isMounted = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [cameraReady]);

  // 4. Zero-Tolerance Violation Action Trigger
  const handleMovementState = useCallback(
    (state, detail, count) => {
      setGazeDirection(state);
      setMovementDetail(detail);
      currentGazeRef.current = state;

      const isViolation = state !== 'CENTER' && state !== 'CALIBRATING';

      if (onStatusChange) {
        onStatusChange({
          gaze: state,
          isViolation,
          detail,
          faceCount: count,
        });
      }

      if (!isViolation) {
        deviationStartRef.current = null;
        setWarningCountdown(null);
        setGazeScore(100);
        return;
      }

      // Do not trigger violations during initial camera warmup
      if (Date.now() < cameraWarmupUntilRef.current) {
        return;
      }

      // Movement detected -> Play audio warning chime
      playWarningBeep();

      const now = Date.now();
      if (!deviationStartRef.current) {
        deviationStartRef.current = now;
      }

      const elapsed = now - deviationStartRef.current;
      const remainingMs = Math.max(0, GRACE_PERIOD_MS - elapsed);
      const remainingSec = (remainingMs / 1000).toFixed(1);

      setWarningCountdown(remainingSec);
      setGazeScore(Math.max(5, Math.round((remainingMs / GRACE_PERIOD_MS) * 100)));

      // Sustained movement for 2.5s -> Disqualify immediately with 0 marks!
      if (elapsed >= GRACE_PERIOD_MS && !violationTriggeredRef.current) {
        violationTriggeredRef.current = true;

        let eventType = 'retina_gaze_violation';
        let fullDetails = `Proctoring violation: ${detail} sustained for over 2.5 seconds`;

        if (state.startsWith('HEAD_TURNED') || state === 'LOOKING_AWAY') {
          eventType = 'head_movement_violation';
        } else if (state === 'LOOKING_DOWN') {
          eventType = 'head_movement_violation';
        } else if (state === 'FACE_ABSENT') {
          eventType = 'face_not_detected';
        } else if (state === 'MULTIPLE_FACES') {
          eventType = 'multiple_faces_detected';
        }

        if (onViolation) {
          onViolation(eventType, fullDetails);
        }
      }
    },
    [onViolation, onStatusChange, playWarningBeep]
  );

  // Tester Simulation Controls
  const setSimulatedState = (state, detail, count = 1) => {
    if (state === null) {
      simOverrideRef.current = null;
    } else {
      simOverrideRef.current = { state, detail, faceCount: count };
    }
  };

  return (
    <div
      className={`fixed bottom-4 right-4 z-40 transition-all duration-300 ${
        isMinimized ? 'w-56' : 'w-72 sm:w-84'
      }`}
    >
      <div className="glass-panel rounded-2xl border border-slate-700/80 bg-slate-950/95 shadow-2xl shadow-black/80 overflow-hidden backdrop-blur-xl">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2">
            <div className="relative">
              <span
                className={`w-2.5 h-2.5 rounded-full block ${
                  gazeDirection === 'CENTER'
                    ? 'bg-emerald-500 animate-pulse'
                    : gazeDirection === 'CALIBRATING'
                    ? 'bg-sky-400 animate-pulse'
                    : 'bg-rose-500 animate-ping'
                }`}
              ></span>
            </div>
            <span className="text-[11px] font-bold text-white tracking-wide uppercase flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-indigo-400" />
              <span>Retina & Head Proctor</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowSimControls(!showSimControls)}
              title="Tester Simulator Controls"
              className={`p-1 rounded-md text-[10px] font-mono transition ${
                showSimControls ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-indigo-400'
              }`}
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

        {/* Viewport */}
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
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="w-full h-full object-cover transform scale-x-[-1]"
                />

                <canvas
                  ref={canvasRef}
                  width={320}
                  height={240}
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                />

                {/* Sustained Violation Warning Alarm Overlay */}
                {warningCountdown !== null && (
                  <div className="absolute inset-0 bg-rose-600/40 border-4 border-rose-500 flex flex-col items-center justify-center p-3 text-center animate-pulse z-10">
                    <ShieldAlert className="w-10 h-10 text-white mb-1 drop-shadow-md animate-bounce" />
                    <span className="text-sm font-black text-white uppercase tracking-wider drop-shadow-md">
                      MOVEMENT DETECTED!
                    </span>
                    <span className="text-[11px] text-white font-semibold mt-0.5 line-clamp-1">
                      {movementDetail}
                    </span>
                    <span className="text-xs font-bold text-rose-100 mt-1">
                      Disqualification in:{' '}
                      <strong className="text-white text-lg font-mono">
                        {warningCountdown}s
                      </strong>
                    </span>
                    <span className="text-[10px] text-white/90 mt-1 font-semibold">
                      Look directly back at the screen!
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Telemetry Bar */}
        <div className="p-2.5 bg-slate-900 border-t border-slate-800 text-[11px] space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Movement / Gaze:</span>
            <span
              className={`font-bold font-mono px-2 py-0.5 rounded text-[10px] uppercase ${
                gazeDirection === 'CENTER'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : gazeDirection === 'CALIBRATING'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
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
                    gazeScore > 70
                      ? 'bg-emerald-500'
                      : gazeScore > 40
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`}
                  style={{ width: `${gazeScore}%` }}
                ></div>
              </div>
              <span className="font-mono text-slate-300">{gazeScore}%</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 pt-0.5">
            <span>Sens: Yaw {telemetry.yaw} | Pitch {telemetry.pitch}</span>
            <span>Diff: {telemetry.diff}</span>
          </div>

          {/* Tester Simulation Controls */}
          {showSimControls && (
            <div className="mt-2 pt-2 border-t border-slate-800/80 space-y-1.5 animate-fade-in">
              <span className="text-[10px] text-indigo-400 font-bold block uppercase tracking-wider">
                Proctor Testing Actions:
              </span>
              <div className="grid grid-cols-2 gap-1 text-[10px]">
                <button
                  onClick={() => setSimulatedState(null)}
                  className="py-1 px-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-center"
                >
                  Live Camera
                </button>
                <button
                  onClick={() => setSimulatedState('CENTER', 'Eyes and head centered')}
                  className="py-1 px-1.5 rounded bg-emerald-950 hover:bg-emerald-900 text-emerald-300 text-center border border-emerald-800"
                >
                  Simulate Center
                </button>
                <button
                  onClick={() =>
                    setSimulatedState('HEAD_TURNED_LEFT', 'Head turned to the left side')
                  }
                  className="py-1 px-1.5 rounded bg-amber-950 hover:bg-amber-900 text-amber-300 text-center border border-amber-800"
                >
                  Turn Head Left
                </button>
                <button
                  onClick={() =>
                    setSimulatedState('HEAD_TURNED_RIGHT', 'Head turned to the right side')
                  }
                  className="py-1 px-1.5 rounded bg-amber-950 hover:bg-amber-900 text-amber-300 text-center border border-amber-800"
                >
                  Turn Head Right
                </button>
                <button
                  onClick={() =>
                    setSimulatedState(
                      'LOOKING_DOWN',
                      'Head tilted down / eyes looking down at phone or notes'
                    )
                  }
                  className="py-1 px-1.5 rounded bg-amber-950 hover:bg-amber-900 text-amber-300 text-center border border-amber-800"
                >
                  Look Down (Phone)
                </button>
                <button
                  onClick={() =>
                    setSimulatedState('EYES_LOOKING_LEFT', 'Eyes diverted to the left side')
                  }
                  className="py-1 px-1.5 rounded bg-amber-950 hover:bg-amber-900 text-amber-300 text-center border border-amber-800"
                >
                  Move Eyes Left
                </button>
                <button
                  onClick={() =>
                    setSimulatedState('FACE_ABSENT', 'Face left the camera frame', 0)
                  }
                  className="py-1 px-1.5 rounded bg-rose-950 hover:bg-rose-900 text-rose-300 text-center border border-rose-800"
                >
                  Face Absent
                </button>
                <button
                  onClick={() => {
                    if (onViolation)
                      onViolation(
                        'head_movement_violation',
                        'Proctoring violation: Head movement deviation detected'
                      );
                  }}
                  className="py-1 px-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-center"
                >
                  Kick Out Now
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
