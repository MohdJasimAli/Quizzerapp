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
  Volume2,
} from 'lucide-react';

/**
 * CameraRetinaProctor Component
 *
 * Implements high-precision detection for:
 * 1. Head Movement & Head Rotation (Turning head left, right, or tilting down at phone/desk)
 * 2. Eye & Retina Gaze Tracking (Diverting eyes left, right, or down away from screen)
 * 3. Face Presence & Multiple Faces
 * 4. Excessive Head Movement / Restlessness
 * 5. Zero-tolerance kick-out with 0 marks on sustained movement away from screen (2.5s)
 * 6. Visual HUD overlay with real-time head yaw gauge, eye crosshairs, and live status
 * 7. Simulation testing controls for instantaneous verification
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
  const isMountedRef = useRef(true);

  // Status & Tracking State
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [engineType, setEngineType] = useState('initializing'); // 'mediapipe' | 'canvas_cv'
  const [gazeDirection, setGazeDirection] = useState('CENTER');
  const [movementDetail, setMovementDetail] = useState('Head and eyes focused on exam screen');
  const [gazeScore, setGazeScore] = useState(100);
  const [faceCount, setFaceCount] = useState(1);
  const [warningCountdown, setWarningCountdown] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showSimControls, setShowSimControls] = useState(false);
  const [currentYawValue, setCurrentYawValue] = useState(0.5);

  // Baseline calibration refs
  const baselineHeadXRef = useRef(null);
  const baselineHeadYRef = useRef(null);
  const baselineEyeYRef = useRef(null);
  const calibrationFramesRef = useRef(0);
  const prevEyeMidRef = useRef(null);
  const motionHistoryRef = useRef([]);

  const deviationStartRef = useRef(null);
  const violationTriggeredRef = useRef(false);
  const lastBeepTimeRef = useRef(0);
  const simOverrideRef = useRef(null);
  const cameraWarmupUntilRef = useRef(Date.now() + 3000);

  // Sustained movement threshold before zero-tolerance disqualification
  const GRACE_PERIOD_MS = 2500; // 2.5 seconds sustained movement away from screen

  // Audio warning tone helper (Web Audio API)
  const playWarningBeep = useCallback(() => {
    const now = Date.now();
    if (now - lastBeepTimeRef.current < 1500) return; // Debounce audio
    lastBeepTimeRef.current = now;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } catch (e) {
      // AudioContext may be restricted by browser policy before first click
    }
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
              cameraWarmupUntilRef.current = Date.now() + 3000;
            })
            .catch((err) => {
              console.error('Video play error:', err);
            });
        };
      }

      // Handle stream end or disconnection
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
      if (faceMeshRef.current) {
        try {
          faceMeshRef.current.close();
        } catch (e) {}
      }
    };
  }, [isActive, startCamera]);

  // 2. Movement & Eye Tracking Loop
  useEffect(() => {
    if (!cameraReady || !videoRef.current || !canvasRef.current) return;

    let isMounted = true;
    let useMediaPipe = false;

    const initTracker = async () => {
      try {
        // Attempt to load MediaPipe FaceMesh safely
        const mpModule = await import('@mediapipe/face_mesh');
        const FaceMeshConstructor =
          mpModule.FaceMesh || mpModule.default?.FaceMesh || mpModule.default || window.FaceMesh;

        if (typeof FaceMeshConstructor === 'function') {
          const faceMesh = new FaceMeshConstructor({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
          });

          faceMesh.setOptions({
            maxNumFaces: 2,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });

          faceMesh.onResults((results) => {
            if (!isMounted) return;
            processFaceMeshResults(results);
          });

          faceMeshRef.current = faceMesh;
          setEngineType('mediapipe');
          useMediaPipe = true;
        } else {
          setEngineType('canvas_cv');
        }
      } catch (err) {
        console.warn('Using native high-precision CV Tracker:', err);
        setEngineType('canvas_cv');
        useMediaPipe = false;
      }

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
            runCanvasCVTracker();
          }
        } else {
          runCanvasCVTracker();
        }

        animFrameRef.current = requestAnimationFrame(processFrame);
      };

      animFrameRef.current = requestAnimationFrame(processFrame);
    };

    // 3A. Process MediaPipe FaceMesh Results (When Available)
    const processFaceMeshResults = (results) => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;

      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      if (simOverrideRef.current) {
        handleMovementState(
          simOverrideRef.current.state,
          simOverrideRef.current.detail,
          simOverrideRef.current.faceCount
        );
        renderHUDOverlay(ctx, w, h, null, null, simOverrideRef.current.state, simOverrideRef.current.detail, 0.5);
        return;
      }

      const numFaces = results.multiFaceLandmarks?.length || 0;

      if (numFaces === 0) {
        handleMovementState('FACE_ABSENT', 'Student face not detected in camera view', 0);
        renderHUDOverlay(ctx, w, h, null, null, 'FACE_ABSENT', 'Face Absent', 0.5);
        return;
      }

      if (numFaces > 1) {
        handleMovementState('MULTIPLE_FACES', 'Multiple people detected in camera view', numFaces);
        renderHUDOverlay(ctx, w, h, null, null, 'MULTIPLE_FACES', 'Multiple Faces', 0.5);
        return;
      }

      const landmarks = results.multiFaceLandmarks[0];

      // Eyes
      const leftInner = landmarks[133];
      const leftOuter = landmarks[33];
      const leftTop = landmarks[159];
      const leftBottom = landmarks[145];
      const leftIris = landmarks[468] || {
        x: (leftInner.x + leftOuter.x) / 2,
        y: (leftTop.y + leftBottom.y) / 2,
      };

      const rightInner = landmarks[362];
      const rightOuter = landmarks[263];
      const rightTop = landmarks[386];
      const rightBottom = landmarks[374];
      const rightIris = landmarks[473] || {
        x: (rightInner.x + rightOuter.x) / 2,
        y: (rightTop.y + rightBottom.y) / 2,
      };

      // Head Features
      const nose = landmarks[1];
      const leftCheek = landmarks[234];
      const rightCheek = landmarks[454];

      if (calibrationFramesRef.current < 20) {
        baselineHeadXRef.current = nose.x;
        baselineHeadYRef.current = nose.y;
        calibrationFramesRef.current += 1;
      }

      const baseHeadY = baselineHeadYRef.current ?? nose.y;

      // 1. HEAD YAW (Turning Head Left / Right)
      const faceWidth = Math.abs(rightCheek.x - leftCheek.x) || 0.01;
      const headYaw = (nose.x - leftCheek.x) / faceWidth; // ~0.50 center
      setCurrentYawValue(headYaw);

      // 2. HEAD PITCH (Tilting Head Down)
      const headPitchDelta = nose.y - baseHeadY;

      // 3. EYE GAZE RATIOS
      const leftEyeWidth = Math.abs(leftOuter.x - leftInner.x) || 0.01;
      const leftRatioX = (leftIris.x - Math.min(leftInner.x, leftOuter.x)) / leftEyeWidth;

      const rightEyeWidth = Math.abs(rightOuter.x - rightInner.x) || 0.01;
      const rightRatioX = (rightIris.x - Math.min(rightInner.x, rightOuter.x)) / rightEyeWidth;

      const avgIrisX = (leftRatioX + rightRatioX) / 2;
      const eyeHeight = Math.abs(leftBottom.y - leftTop.y) || 0.01;
      const ratioY = (leftIris.y - leftTop.y) / eyeHeight;

      let detectedState = 'CENTER';
      let detail = 'Head and eyes focused on exam screen';

      // Sensitive check for head turn or eye movement
      if (headYaw < 0.40) {
        detectedState = 'HEAD_TURNED_LEFT';
        detail = 'Head turned to the left side away from screen';
      } else if (headYaw > 0.60) {
        detectedState = 'HEAD_TURNED_RIGHT';
        detail = 'Head turned to the right side away from screen';
      } else if (headPitchDelta > 0.05 || ratioY > 0.65) {
        detectedState = 'LOOKING_DOWN';
        detail = 'Head tilted down / eyes looking down at desk or phone';
      } else if (avgIrisX > 0.58) {
        detectedState = 'EYES_LOOKING_LEFT';
        detail = 'Eyes diverted to the left side';
      } else if (avgIrisX < 0.42) {
        detectedState = 'EYES_LOOKING_RIGHT';
        detail = 'Eyes diverted to the right side';
      }

      handleMovementState(detectedState, detail, 1);

      renderHUDOverlay(
        ctx,
        w,
        h,
        {
          leftIris: { x: leftIris.x * w, y: leftIris.y * h },
          rightIris: { x: rightIris.x * w, y: rightIris.y * h },
          leftBox: {
            x: Math.min(leftInner.x, leftOuter.x) * w - 6,
            y: leftTop.y * h - 6,
            w: leftEyeWidth * w + 12,
            h: eyeHeight * h + 12,
          },
          rightBox: {
            x: Math.min(rightInner.x, rightOuter.x) * w - 6,
            y: rightTop.y * h - 6,
            w: rightEyeWidth * w + 12,
            h: eyeHeight * h + 12,
          },
        },
        nose ? { x: nose.x * w, y: nose.y * h } : null,
        detectedState,
        detail,
        headYaw
      );
    };

    // 3B. High-Precision Native Canvas Computer Vision Engine
    const runCanvasCVTracker = () => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video || video.videoWidth === 0) return;

      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;

      if (simOverrideRef.current) {
        handleMovementState(
          simOverrideRef.current.state,
          simOverrideRef.current.detail,
          simOverrideRef.current.faceCount
        );
        renderHUDOverlay(ctx, w, h, null, null, simOverrideRef.current.state, simOverrideRef.current.detail, 0.5);
        return;
      }

      const offCanvas = document.createElement('canvas');
      offCanvas.width = 160;
      offCanvas.height = 120;
      const offCtx = offCanvas.getContext('2d');
      offCtx.drawImage(video, 0, 0, 160, 120);

      const imgData = offCtx.getImageData(0, 0, 160, 120);
      const data = imgData.data;

      // 1. Skin & Face Region Segmentation
      let skinPixels = 0;
      let minX = 160,
        maxX = 0,
        minY = 120,
        maxY = 0;
      let skinXSum = 0,
        skinYSum = 0;

      for (let y = 10; y < 115; y += 2) {
        for (let x = 15; x < 145; x += 2) {
          const idx = (y * 160 + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];

          // Robust illumination-invariant skin detector
          const isSkin =
            r > 45 &&
            g > 25 &&
            b > 15 &&
            r > g &&
            r - b > 10 &&
            r - g > 6 &&
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

      // Check Face Presence
      const faceW = maxX - minX;
      const faceH = maxY - minY;

      if (skinPixels < 130 || faceW < 24 || faceH < 24) {
        handleMovementState('FACE_ABSENT', 'Student face not detected in camera view', 0);
        renderHUDOverlay(ctx, w, h, null, null, 'FACE_ABSENT', 'Face Absent', 0.5);
        return;
      }

      const faceCenterX = skinXSum / skinPixels;
      const faceCenterY = skinYSum / skinPixels;
      const boxCenterX = (minX + maxX) / 2;

      // 2. Locate Eyes in Upper 22% - 48% of the Face
      const eyeTopY = Math.round(minY + faceH * 0.2);
      const eyeBottomY = Math.round(minY + faceH * 0.48);
      const leftEyeStartX = Math.round(minX + faceW * 0.12);
      const leftEyeEndX = Math.round(minX + faceW * 0.48);
      const rightEyeStartX = Math.round(minX + faceW * 0.52);
      const rightEyeEndX = Math.round(minX + faceW * 0.88);

      // Find Darkest Pupil Valley (3x3 kernel minimum luminance)
      const findDarkestFeature = (startX, endX, startY, endY) => {
        let minLum = 9999;
        let bestX = Math.round((startX + endX) / 2);
        let bestY = Math.round((startY + endY) / 2);

        for (let y = Math.max(0, startY); y < Math.min(120, endY); y += 2) {
          for (let x = Math.max(0, startX); x < Math.min(160, endX); x += 2) {
            let kernelLum = 0;
            let sampleCount = 0;

            for (let ky = -1; ky <= 1; ky++) {
              for (let kx = -1; kx <= 1; kx++) {
                const py = y + ky;
                const px = x + kx;
                if (px >= 0 && px < 160 && py >= 0 && py < 120) {
                  const idx = (py * 160 + px) * 4;
                  kernelLum += data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
                  sampleCount++;
                }
              }
            }

            const avgLum = kernelLum / (sampleCount || 1);
            if (avgLum < minLum) {
              minLum = avgLum;
              bestX = x;
              bestY = y;
            }
          }
        }
        return { x: bestX, y: bestY };
      };

      const leftPupil = findDarkestFeature(leftEyeStartX, leftEyeEndX, eyeTopY, eyeBottomY);
      const rightPupil = findDarkestFeature(rightEyeStartX, rightEyeEndX, eyeTopY, eyeBottomY);

      // Calibrate Baseline Eye Level during initial 20 frames
      const eyeMidY = (leftPupil.y + rightPupil.y) / 2;
      const eyeMidX = (leftPupil.x + rightPupil.x) / 2;

      if (calibrationFramesRef.current < 20) {
        baselineHeadXRef.current = faceCenterX;
        baselineHeadYRef.current = faceCenterY;
        baselineEyeYRef.current = eyeMidY;
        calibrationFramesRef.current += 1;
      }

      const baseEyeY = baselineEyeYRef.current ?? eyeMidY;

      // 3. HEAD YAW (Turning Head Left / Right via Margin Symmetry)
      const distLeft = leftPupil.x - minX;
      const distRight = maxX - rightPupil.x;
      const marginSum = distLeft + distRight || 1;
      const headYaw = distLeft / marginSum; // ~0.50 at center
      setCurrentYawValue(headYaw);

      // Eye Midpoint Offset from Bounding Box Center
      const eyeOffsetFromBoxCenter = (eyeMidX - boxCenterX) / faceW;

      // 4. HEAD PITCH (Tilting Head Down / Desk)
      const eyeDeltaFromBaseline = (eyeMidY - baseEyeY) / faceH;
      const eyeRatioFromTop = (eyeMidY - minY) / faceH;

      // 5. EYE / RETINA GAZE RATIO (Inside Eye Sockets)
      const leftEyeW = leftEyeEndX - leftEyeStartX || 1;
      const pupilRatioL = (leftPupil.x - leftEyeStartX) / leftEyeW;

      const rightEyeW = rightEyeEndX - rightEyeStartX || 1;
      const pupilRatioR = (rightPupil.x - rightEyeStartX) / rightEyeW;
      const avgPupilRatio = (pupilRatioL + pupilRatioR) / 2;

      // 6. FRAME-TO-FRAME HEAD MOVEMENT VELOCITY
      let headVelocity = 0;
      if (prevEyeMidRef.current) {
        headVelocity = Math.hypot(
          eyeMidX - prevEyeMidRef.current.x,
          eyeMidY - prevEyeMidRef.current.y
        );
      }
      prevEyeMidRef.current = { x: eyeMidX, y: eyeMidY };

      motionHistoryRef.current.push(headVelocity);
      if (motionHistoryRef.current.length > 10) {
        motionHistoryRef.current.shift();
      }
      const avgMotion =
        motionHistoryRef.current.reduce((a, b) => a + b, 0) /
        (motionHistoryRef.current.length || 1);

      // Sensitive Classification of Movement
      let detectedState = 'CENTER';
      let detail = 'Head and eyes focused on exam screen';

      if (headYaw < 0.38 || eyeOffsetFromBoxCenter < -0.07) {
        detectedState = 'HEAD_TURNED_LEFT';
        detail = 'Head turned to the left side away from screen';
      } else if (headYaw > 0.62 || eyeOffsetFromBoxCenter > 0.07) {
        detectedState = 'HEAD_TURNED_RIGHT';
        detail = 'Head turned to the right side away from screen';
      } else if (eyeRatioFromTop > 0.48 || eyeDeltaFromBaseline > 0.07) {
        detectedState = 'LOOKING_DOWN';
        detail = 'Head tilted down / eyes looking down at phone or notes';
      } else if (avgPupilRatio < 0.37) {
        detectedState = 'EYES_LOOKING_LEFT';
        detail = 'Eyes / retina gaze diverted to the left';
      } else if (avgPupilRatio > 0.63) {
        detectedState = 'EYES_LOOKING_RIGHT';
        detail = 'Eyes / retina gaze diverted to the right';
      } else if (avgMotion > 5.2) {
        detectedState = 'HEAD_MOVEMENT_EXCESSIVE';
        detail = 'Excessive head movement / constant looking around';
      }

      handleMovementState(detectedState, detail, 1);

      // Scale to Canvas Coordinates
      const scaleX = w / 160;
      const scaleY = h / 120;

      renderHUDOverlay(
        ctx,
        w,
        h,
        {
          leftIris: { x: leftPupil.x * scaleX, y: leftPupil.y * scaleY },
          rightIris: { x: rightPupil.x * scaleX, y: rightPupil.y * scaleY },
          leftBox: {
            x: leftEyeStartX * scaleX,
            y: eyeTopY * scaleY,
            w: leftEyeW * scaleX,
            h: (eyeBottomY - eyeTopY) * scaleY,
          },
          rightBox: {
            x: rightEyeStartX * scaleX,
            y: eyeTopY * scaleY,
            w: rightEyeW * scaleX,
            h: (eyeBottomY - eyeTopY) * scaleY,
          },
        },
        { x: faceCenterX * scaleX, y: faceCenterY * scaleY },
        detectedState,
        detail,
        headYaw
      );
    };

    // 4. Render High-Tech Proctor HUD Overlay
    const renderHUDOverlay = (ctx, w, h, eyeData, centerPoint, state, detail, yaw = 0.5) => {
      ctx.save();

      const isNormal = state === 'CENTER';
      const themeColor = isNormal ? '#10b981' : '#ef4444';

      if (eyeData) {
        // Eye Bounding Boxes
        [eyeData.leftBox, eyeData.rightBox].forEach((box) => {
          if (!box) return;
          ctx.strokeStyle = themeColor;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 3]);
          ctx.strokeRect(box.x, box.y, box.w, box.h);
          ctx.setLineDash([]);
        });

        // Retina & Pupil Crosshairs
        [eyeData.leftIris, eyeData.rightIris].forEach((iris) => {
          if (!iris) return;
          ctx.beginPath();
          ctx.arc(iris.x, iris.y, 7, 0, Math.PI * 2);
          ctx.strokeStyle = themeColor;
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(iris.x, iris.y, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = themeColor;
          ctx.fill();

          ctx.strokeStyle = themeColor;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(iris.x - 9, iris.y);
          ctx.lineTo(iris.x + 9, iris.y);
          ctx.moveTo(iris.x, iris.y - 9);
          ctx.lineTo(iris.x, iris.y + 9);
          ctx.stroke();
        });

        // Gaze Vector Pointer
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
          ctx.arc(targetX, targetY, 3.5, 0, Math.PI * 2);
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

      const bannerText =
        state === 'CENTER'
          ? '● RETINA LOCKED: EYES ON SCREEN'
          : `⚠️ ALERT: ${state.replace(/_/g, ' ')}`;

      ctx.fillText(bannerText, 12, 23);

      // Bottom Head Yaw Gauge Bar
      const gaugeW = 100;
      const gaugeH = 6;
      const gaugeX = (w - gaugeW) / 2;
      const gaugeY = h - 14;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
      ctx.fillRect(gaugeX - 10, gaugeY - 4, gaugeW + 20, gaugeH + 8);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.strokeRect(gaugeX, gaugeY, gaugeW, gaugeH);

      // Center mark
      ctx.fillStyle = '#64748b';
      ctx.fillRect(gaugeX + gaugeW / 2 - 1, gaugeY - 2, 2, gaugeH + 4);

      // Yaw position indicator
      const clampedYaw = Math.max(0.1, Math.min(0.9, yaw));
      const markerX = gaugeX + clampedYaw * gaugeW;
      ctx.fillStyle = isNormal ? '#10b981' : '#ef4444';
      ctx.beginPath();
      ctx.arc(markerX, gaugeY + gaugeH / 2, 4, 0, Math.PI * 2);
      ctx.fill();

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

  // 5. Zero-Tolerance Violation Trigger
  const handleMovementState = useCallback(
    (state, detail, count) => {
      setGazeDirection(state);
      setMovementDetail(detail);
      setFaceCount(count);
      currentGazeRef.current = state;

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

      // Do not trigger violations during initial camera warmup
      if (Date.now() < cameraWarmupUntilRef.current) {
        return;
      }

      // Movement detected -> Play audio warning tone
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
        let fullDetails = `Proctoring violation: ${detail} for over 2.5 seconds`;

        if (state.startsWith('HEAD_TURNED') || state === 'HEAD_MOVEMENT_EXCESSIVE') {
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

                {/* Sustained Violation Warning Alarm */}
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

          <p className="text-[10px] text-slate-400 truncate">
            Status: <span className="text-slate-200">{movementDetail}</span>
          </p>

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
