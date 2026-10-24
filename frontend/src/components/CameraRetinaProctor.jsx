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
 * 1. High-precision Retina & Eye-Gaze Tracking (MediaPipe Iris Refinement with Canvas CV Fallback)
 * 2. Real-time pupil crosshairs and gaze direction vectors
 * 3. Immediate detection when the student is NOT looking in front (looking left, right, down, or away)
 * 4. Progressive enforcement: 2 warnings, 3rd violation ends test with 0 marks
 * 5. Audio chime and live countdown before violation is logged
 */
export const CameraRetinaProctor = ({
  isActive = true,
  onViolation,
  onStatusChange,
  requireRetina = true,
  currentViolationCount = 0,
}) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameRef = useRef(null);
  const faceMeshRef = useRef(null);
  const cameraHelperRef = useRef(null);
  const isMountedRef = useRef(true);

  // Status & Tracking State
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [engineType, setEngineType] = useState('initializing'); // 'mediapipe_iris' | 'canvas_pupil'
  const [gazeDirection, setGazeDirection] = useState('CENTER');
  const [movementDetail, setMovementDetail] = useState('Looking in front at the test screen');
  const [gazeScore, setGazeScore] = useState(100);
  const [faceCount, setFaceCount] = useState(1);
  const [warningCountdown, setWarningCountdown] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showSimControls, setShowSimControls] = useState(true);

  // Live Eye Metrics
  const [eyeMetrics, setEyeMetrics] = useState({
    irisX: 0.5,
    irisY: 0.5,
    headYaw: 0.5,
    state: 'CENTER',
  });

  // Tracking Refs
  const deviationStartRef = useRef(null);
  const violationCooldownRef = useRef(Date.now() + 3500); // 3.5s initial warmup before violations log
  const simOverrideRef = useRef(null);
  const lastBeepTimeRef = useRef(0);

  // 2.0s of continuous looking away triggers the warning/disqualification
  const SUSTAINED_VIOLATION_MS = 2000;

  // Warning chime via Web Audio API
  const playWarningBeep = useCallback(() => {
    const now = Date.now();
    if (now - lastBeepTimeRef.current < 1500) return;
    lastBeepTimeRef.current = now;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(480, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.16);

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
              violationCooldownRef.current = Date.now() + 3500;
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
        if (onViolation && Date.now() > violationCooldownRef.current) {
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
      if (onViolation) {
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
      if (cameraHelperRef.current) {
        try {
          cameraHelperRef.current.stop();
        } catch (e) {}
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

  // 2. High-Precision Eye Tracking Engine
  useEffect(() => {
    if (!cameraReady || !videoRef.current || !canvasRef.current) return;

    let isMounted = true;
    let usingMediaPipe = false;

    const initEngine = async () => {
      // Check if MediaPipe FaceMesh is available globally on window or npm
      if (typeof window !== 'undefined' && window.FaceMesh) {
        try {
          const faceMesh = new window.FaceMesh({
            locateFile: (file) => `/mediapipe/face_mesh/${file}`,
          });

          faceMesh.setOptions({
            maxNumFaces: 2,
            refineLandmarks: true, // Enables Iris landmarks (468: left iris, 473: right iris)
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });

          faceMesh.onResults((results) => {
            if (!isMounted) return;
            processMediaPipeResults(results);
          });

          faceMeshRef.current = faceMesh;
          setEngineType('mediapipe_iris');
          usingMediaPipe = true;

          // Process video frames
          const sendFrameLoop = async () => {
            if (!isMounted) return;
            const video = videoRef.current;
            if (video && video.readyState >= 2 && video.videoWidth > 0) {
              try {
                await faceMesh.send({ image: video });
              } catch (e) {
                runCanvasEyeTracker();
              }
            }
            animFrameRef.current = requestAnimationFrame(sendFrameLoop);
          };

          animFrameRef.current = requestAnimationFrame(sendFrameLoop);
          return;
        } catch (err) {
          console.warn('MediaPipe initialization fallback to Canvas CV:', err);
        }
      }

      // Fallback: Native Canvas Pupil & Sclera Tracker
      setEngineType('canvas_pupil');
      const canvasLoop = () => {
        if (!isMounted) return;
        runCanvasEyeTracker();
        animFrameRef.current = requestAnimationFrame(canvasLoop);
      };
      animFrameRef.current = requestAnimationFrame(canvasLoop);
    };

    // 3A. Process MediaPipe 468 Landmarks with Dedicated Iris Refinement
    const processMediaPipeResults = (results) => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;

      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Simulation override check
      if (simOverrideRef.current) {
        handleEyeGazeState(
          simOverrideRef.current.state,
          simOverrideRef.current.detail,
          simOverrideRef.current.faceCount
        );
        renderOverlayHUD(ctx, w, h, null, null, simOverrideRef.current.state, simOverrideRef.current.detail);
        return;
      }

      const numFaces = results.multiFaceLandmarks?.length || 0;

      if (numFaces === 0) {
        handleEyeGazeState('FACE_ABSENT', 'Student face not detected in camera view', 0);
        renderOverlayHUD(ctx, w, h, null, null, 'FACE_ABSENT', 'Face Not Detected');
        return;
      }

      if (numFaces > 1) {
        handleEyeGazeState('MULTIPLE_FACES', 'Multiple people detected in examination view', numFaces);
        renderOverlayHUD(ctx, w, h, null, null, 'MULTIPLE_FACES', 'Multiple People Detected');
        return;
      }

      const landmarks = results.multiFaceLandmarks[0];

      // Eyes and Iris Landmarks
      const leftInner = landmarks[133];
      const leftOuter = landmarks[33];
      const leftTop = landmarks[159];
      const leftBottom = landmarks[145];
      // Landmark 468 is the Left Iris Center
      const leftIris = landmarks[468] || {
        x: (leftInner.x + leftOuter.x) / 2,
        y: (leftTop.y + leftBottom.y) / 2,
      };

      const rightInner = landmarks[362];
      const rightOuter = landmarks[263];
      const rightTop = landmarks[386];
      const rightBottom = landmarks[374];
      // Landmark 473 is the Right Iris Center
      const rightIris = landmarks[473] || {
        x: (rightInner.x + rightOuter.x) / 2,
        y: (rightTop.y + rightBottom.y) / 2,
      };

      // Head Landmarks
      const nose = landmarks[1];
      const leftCheek = landmarks[234];
      const rightCheek = landmarks[454];

      // 1. HORIZONTAL RETINA & EYE GAZE RATIO
      // Measure iris position between inner and outer eye corners
      const leftEyeWidth = Math.abs(leftOuter.x - leftInner.x) || 0.001;
      const leftIrisRatio = (leftIris.x - Math.min(leftInner.x, leftOuter.x)) / leftEyeWidth;

      const rightEyeWidth = Math.abs(rightOuter.x - rightInner.x) || 0.001;
      const rightIrisRatio = (rightIris.x - Math.min(rightInner.x, rightOuter.x)) / rightEyeWidth;

      const avgIrisX = (leftIrisRatio + rightIrisRatio) / 2; // ~0.50 when looking in front

      // 2. VERTICAL EYE GAZE RATIO (Looking down at phone / notes)
      const leftEyeHeight = Math.abs(leftBottom.y - leftTop.y) || 0.001;
      const leftIrisRatioY = (leftIris.y - leftTop.y) / leftEyeHeight;

      const rightEyeHeight = Math.abs(rightBottom.y - rightTop.y) || 0.001;
      const rightIrisRatioY = (rightIris.y - rightTop.y) / rightEyeHeight;

      const avgIrisY = (leftIrisRatioY + rightIrisRatioY) / 2; // ~0.50 when looking in front

      // 3. HEAD YAW (Turning Head Left / Right)
      const faceWidth = Math.abs(rightCheek.x - leftCheek.x) || 0.001;
      const headYaw = (nose.x - leftCheek.x) / faceWidth; // ~0.50 when facing in front

      setEyeMetrics({
        irisX: Number(avgIrisX.toFixed(2)),
        irisY: Number(avgIrisY.toFixed(2)),
        headYaw: Number(headYaw.toFixed(2)),
        state: 'CENTER',
      });

      // Strict Classification of "Seeing In Front" vs Looking Away
      let detectedState = 'CENTER';
      let detail = 'Looking directly in front at test screen';

      // A. Eyes diverted Left
      if (avgIrisX > 0.59) {
        detectedState = 'EYES_LOOKING_LEFT';
        detail = 'Eyes diverted to the left away from screen';
      }
      // B. Eyes diverted Right
      else if (avgIrisX < 0.41) {
        detectedState = 'EYES_LOOKING_RIGHT';
        detail = 'Eyes diverted to the right away from screen';
      }
      // C. Eyes looking Down (Phone / Desk / Keyboard / Notes)
      else if (avgIrisY > 0.65) {
        detectedState = 'LOOKING_DOWN';
        detail = 'Eyes looking down at phone, notes, or desk';
      }
      // D. Head Turned Left
      else if (headYaw < 0.38) {
        detectedState = 'HEAD_TURNED_LEFT';
        detail = 'Head turned to the left side away from screen';
      }
      // E. Head Turned Right
      else if (headYaw > 0.62) {
        detectedState = 'HEAD_TURNED_RIGHT';
        detail = 'Head turned to the right side away from screen';
      }

      handleEyeGazeState(detectedState, detail, 1);

      renderOverlayHUD(
        ctx,
        w,
        h,
        {
          leftIris: { x: leftIris.x * w, y: leftIris.y * h },
          rightIris: { x: rightIris.x * w, y: rightIris.y * h },
          leftBox: {
            x: Math.min(leftInner.x, leftOuter.x) * w - 4,
            y: leftTop.y * h - 4,
            w: leftEyeWidth * w + 8,
            h: leftEyeHeight * h + 8,
          },
          rightBox: {
            x: Math.min(rightInner.x, rightOuter.x) * w - 4,
            y: rightTop.y * h - 4,
            w: rightEyeWidth * w + 8,
            h: rightEyeHeight * h + 8,
          },
        },
        nose ? { x: nose.x * w, y: nose.y * h } : null,
        detectedState,
        detail
      );
    };

    // 3B. High-Precision Native Canvas Pupil & Sclera Tracker (Fallback Engine)
    const runCanvasEyeTracker = () => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video || video.readyState < 2 || video.videoWidth === 0) return;

      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;

      if (simOverrideRef.current) {
        handleEyeGazeState(
          simOverrideRef.current.state,
          simOverrideRef.current.detail,
          simOverrideRef.current.faceCount
        );
        renderOverlayHUD(ctx, w, h, null, null, simOverrideRef.current.state, simOverrideRef.current.detail);
        return;
      }

      // Draw downscaled frame (160x120) for fast pixel scanning
      const off = document.createElement('canvas');
      off.width = 160;
      off.height = 120;
      const offCtx = off.getContext('2d');
      offCtx.drawImage(video, 0, 0, 160, 120);

      const imgData = offCtx.getImageData(0, 0, 160, 120);
      const data = imgData.data;

      let skinPixels = 0;
      let minX = 160,
        maxX = 0,
        minY = 120,
        maxY = 0;
      let sumX = 0,
        sumY = 0;

      for (let y = 10; y < 110; y += 2) {
        for (let x = 15; x < 145; x += 2) {
          const idx = (y * 160 + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];

          const isSkin =
            r > 40 &&
            g > 20 &&
            b > 12 &&
            r > g &&
            r - b > 8 &&
            r - g > 5 &&
            Math.abs(r - g) < 135;

          if (isSkin) {
            skinPixels++;
            sumX += x;
            sumY += y;
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

      if (skinPixels < 110 || faceW < 24 || faceH < 24) {
        handleEyeGazeState('FACE_ABSENT', 'Student face not detected in camera view', 0);
        renderOverlayHUD(ctx, w, h, null, null, 'FACE_ABSENT', 'Face Not Detected');
        return;
      }

      const cx = sumX / skinPixels;
      const cy = sumY / skinPixels;

      // Locate Eye Sockets in upper 22% - 46% of Face
      const eyeTop = Math.round(minY + faceH * 0.22);
      const eyeBottom = Math.round(minY + faceH * 0.46);
      const leftEyeStart = Math.round(minX + faceW * 0.12);
      const leftEyeEnd = Math.round(minX + faceW * 0.48);
      const rightEyeStart = Math.round(minX + faceW * 0.52);
      const rightEyeEnd = Math.round(minX + faceW * 0.88);

      const findPupilCenter = (x1, x2, y1, y2) => {
        let minBrightness = 9999;
        let px = (x1 + x2) / 2;
        let py = (y1 + y2) / 2;

        for (let y = Math.max(0, y1); y < Math.min(120, y2); y += 2) {
          for (let x = Math.max(0, x1); x < Math.min(160, x2); x += 2) {
            const idx = (y * 160 + x) * 4;
            const b = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
            if (b < minBrightness) {
              minBrightness = b;
              px = x;
              py = y;
            }
          }
        }
        return { x: px, y: py };
      };

      const leftPupil = findPupilCenter(leftEyeStart, leftEyeEnd, eyeTop, eyeBottom);
      const rightPupil = findPupilCenter(rightEyeStart, rightEyeEnd, eyeTop, eyeBottom);

      const leftEyeSpan = leftEyeEnd - leftEyeStart || 1;
      const leftRatio = (leftPupil.x - leftEyeStart) / leftEyeSpan;

      const rightEyeSpan = rightEyeEnd - rightEyeStart || 1;
      const rightRatio = (rightPupil.x - rightEyeStart) / rightEyeSpan;

      const avgPupilRatio = (leftRatio + rightRatio) / 2;
      const verticalRatio = ((leftPupil.y + rightPupil.y) / 2 - eyeTop) / (eyeBottom - eyeTop || 1);

      let detectedState = 'CENTER';
      let detail = 'Looking directly in front at test screen';

      if (avgPupilRatio < 0.38) {
        detectedState = 'EYES_LOOKING_LEFT';
        detail = 'Eyes diverted to the left';
      } else if (avgPupilRatio > 0.62) {
        detectedState = 'EYES_LOOKING_RIGHT';
        detail = 'Eyes diverted to the right';
      } else if (verticalRatio > 0.68) {
        detectedState = 'LOOKING_DOWN';
        detail = 'Eyes looking down at phone or notes';
      }

      setEyeMetrics({
        irisX: Number(avgPupilRatio.toFixed(2)),
        irisY: Number(verticalRatio.toFixed(2)),
        headYaw: 0.5,
        state: detectedState,
      });

      handleEyeGazeState(detectedState, detail, 1);

      const sx = w / 160;
      const sy = h / 120;

      renderOverlayHUD(
        ctx,
        w,
        h,
        {
          leftIris: { x: leftPupil.x * sx, y: leftPupil.y * sy },
          rightIris: { x: rightPupil.x * sx, y: rightPupil.y * sy },
          leftBox: {
            x: leftEyeStart * sx,
            y: eyeTop * sy,
            w: leftEyeSpan * sx,
            h: (eyeBottom - eyeTop) * sy,
          },
          rightBox: {
            x: rightEyeStart * sx,
            y: eyeTop * sy,
            w: rightEyeSpan * sx,
            h: (eyeBottom - eyeTop) * sy,
          },
        },
        { x: cx * sx, y: cy * sy },
        detectedState,
        detail
      );
    };

    // 4. Render High-Tech Eye & Retina HUD
    const renderOverlayHUD = (ctx, w, h, eyeData, centerPoint, state, detail) => {
      ctx.save();

      const isNormal = state === 'CENTER';
      const themeColor = isNormal ? '#10b981' : '#ef4444';

      if (eyeData) {
        // Eye Sockets Target Bounding Boxes
        [eyeData.leftBox, eyeData.rightBox].forEach((box) => {
          if (!box) return;
          ctx.strokeStyle = themeColor;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 3]);
          ctx.strokeRect(box.x, box.y, box.w, box.h);
          ctx.setLineDash([]);
        });

        // Retina Iris Crosshairs
        [eyeData.leftIris, eyeData.rightIris].forEach((iris) => {
          if (!iris) return;

          // Outer Iris Ring
          ctx.beginPath();
          ctx.arc(iris.x, iris.y, 8, 0, Math.PI * 2);
          ctx.strokeStyle = themeColor;
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Center Pupil Dot
          ctx.beginPath();
          ctx.arc(iris.x, iris.y, 3, 0, Math.PI * 2);
          ctx.fillStyle = themeColor;
          ctx.fill();

          // Crosshairs
          ctx.strokeStyle = themeColor;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(iris.x - 12, iris.y);
          ctx.lineTo(iris.x + 12, iris.y);
          ctx.moveTo(iris.x, iris.y - 12);
          ctx.lineTo(iris.x, iris.y + 12);
          ctx.stroke();
        });

        // Gaze Direction Pointer
        if (eyeData.leftIris && eyeData.rightIris) {
          const midX = (eyeData.leftIris.x + eyeData.rightIris.x) / 2;
          const midY = (eyeData.leftIris.y + eyeData.rightIris.y) / 2;

          let targetX = midX;
          let targetY = midY;

          if (state.includes('LEFT')) targetX += 45;
          else if (state.includes('RIGHT')) targetX -= 45;
          else if (state.includes('DOWN')) targetY += 35;

          ctx.beginPath();
          ctx.moveTo(midX, midY);
          ctx.lineTo(targetX, targetY);
          ctx.strokeStyle = themeColor;
          ctx.lineWidth = 2.5;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(targetX, targetY, 4, 0, Math.PI * 2);
          ctx.fillStyle = themeColor;
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

      const bannerText = isNormal
        ? '● RETINA LOCKED: SEEING IN FRONT'
        : `⚠️ NOT IN FRONT: ${state.replace(/_/g, ' ')}`;

      ctx.fillText(bannerText, 12, 23);

      ctx.restore();
    };

    initEngine();

    return () => {
      isMounted = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [cameraReady]);

  // 5. Warning Counter & Violation Action
  const handleEyeGazeState = useCallback(
    (state, detail, count) => {
      setGazeDirection(state);
      setMovementDetail(detail);
      setFaceCount(count);

      const isViolation = state !== 'CENTER';

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

      // Warmup check
      if (Date.now() < violationCooldownRef.current) {
        return;
      }

      // Play audio chime
      playWarningBeep();

      const now = Date.now();
      if (!deviationStartRef.current) {
        deviationStartRef.current = now;
      }

      const elapsed = now - deviationStartRef.current;
      const remainingMs = Math.max(0, SUSTAINED_VIOLATION_MS - elapsed);
      const remainingSec = (remainingMs / 1000).toFixed(1);

      setWarningCountdown(remainingSec);
      setGazeScore(Math.max(5, Math.round((remainingMs / SUSTAINED_VIOLATION_MS) * 100)));

      // Sustained not seeing in front for 2.0s -> Trigger violation!
      if (elapsed >= SUSTAINED_VIOLATION_MS) {
        // Reset deviation timer and grant a 3.5s cooldown after violation fires
        deviationStartRef.current = null;
        setWarningCountdown(null);
        violationCooldownRef.current = Date.now() + 3500;

        let eventType = 'retina_gaze_violation';
        let fullDetails = `Proctoring violation: Student not looking in front (${detail})`;

        if (state.startsWith('HEAD_TURNED')) {
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

  const warningsLeft = Math.max(0, 2 - currentViolationCount);

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
                    : 'bg-rose-500 animate-ping'
                }`}
              ></span>
            </div>
            <span className="text-[11px] font-bold text-white tracking-wide uppercase flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-indigo-400" />
              <span>Eye & Retina Proctor</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span
              className={`text-[9px] font-bold font-mono px-1.5 py-0.5 rounded ${
                currentViolationCount === 0
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  : currentViolationCount === 1
                  ? 'bg-amber-950 text-amber-300 border border-amber-800'
                  : 'bg-rose-950 text-rose-300 border border-rose-800 animate-pulse'
              }`}
            >
              Warn: {currentViolationCount}/2
            </span>
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

                {/* Not Looking In Front Warning Countdown Alarm */}
                {warningCountdown !== null && (
                  <div className="absolute inset-0 bg-rose-600/40 border-4 border-rose-500 flex flex-col items-center justify-center p-3 text-center animate-pulse z-10">
                    <ShieldAlert className="w-10 h-10 text-white mb-1 drop-shadow-md animate-bounce" />
                    <span className="text-sm font-black text-white uppercase tracking-wider drop-shadow-md">
                      LOOK DIRECTLY IN FRONT!
                    </span>
                    <span className="text-[11px] text-white font-semibold mt-0.5 line-clamp-1">
                      {movementDetail}
                    </span>
                    <span className="text-xs font-bold text-rose-100 mt-1">
                      Integrity Warning in:{' '}
                      <strong className="text-white text-lg font-mono">
                        {warningCountdown}s
                      </strong>
                    </span>
                    <span className="text-[10px] text-amber-200 mt-1 font-semibold">
                      {currentViolationCount === 0 && 'Warning 1 of 2 will be issued'}
                      {currentViolationCount === 1 && 'FINAL WARNING 2 of 2 will be issued'}
                      {currentViolationCount >= 2 && '🚨 3RD VIOLATION = DISQUALIFICATION (0 MARKS)!'}
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
            <span className="text-slate-400">Gaze Status:</span>
            <span
              className={`font-bold font-mono px-2 py-0.5 rounded text-[10px] uppercase ${
                gazeDirection === 'CENTER'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse'
              }`}
            >
              {gazeDirection.replace(/_/g, ' ')}
            </span>
          </div>

          <div className="flex items-center justify-between text-[10px]">
            <span className="text-slate-400">Retina Focus:</span>
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
            <span>Iris X: {eyeMetrics.irisX} | Y: {eyeMetrics.irisY}</span>
            <span className="text-indigo-400">Engine: {engineType}</span>
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
                  onClick={() => setSimulatedState('CENTER', 'Seeing in front directly')}
                  className="py-1 px-1.5 rounded bg-emerald-950 hover:bg-emerald-900 text-emerald-300 text-center border border-emerald-800"
                >
                  Seeing In Front
                </button>
                <button
                  onClick={() =>
                    setSimulatedState('EYES_LOOKING_LEFT', 'Eyes looking to the left side')
                  }
                  className="py-1 px-1.5 rounded bg-amber-950 hover:bg-amber-900 text-amber-300 text-center border border-amber-800"
                >
                  Eyes Look Left
                </button>
                <button
                  onClick={() =>
                    setSimulatedState('EYES_LOOKING_RIGHT', 'Eyes looking to the right side')
                  }
                  className="py-1 px-1.5 rounded bg-amber-950 hover:bg-amber-900 text-amber-300 text-center border border-amber-800"
                >
                  Eyes Look Right
                </button>
                <button
                  onClick={() =>
                    setSimulatedState(
                      'LOOKING_DOWN',
                      'Eyes looking down at phone or notes'
                    )
                  }
                  className="py-1 px-1.5 rounded bg-amber-950 hover:bg-amber-900 text-amber-300 text-center border border-amber-800"
                >
                  Look Down (Phone)
                </button>
                <button
                  onClick={() =>
                    setSimulatedState('HEAD_TURNED_LEFT', 'Head turned away from screen')
                  }
                  className="py-1 px-1.5 rounded bg-amber-950 hover:bg-amber-900 text-amber-300 text-center border border-amber-800"
                >
                  Turn Head Away
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
                        'retina_gaze_violation',
                        'Proctoring violation: Student not seeing in front'
                      );
                  }}
                  className="py-1 px-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-center"
                >
                  Trigger Warning Now
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
