const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    testId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Test',
      required: true,
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    attemptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TestAttempt',
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      enum: [
        'test_started',
        'tab_switch',
        'fullscreen_exit',
        'window_blur',
        'copy_paste_attempt',
        'devtools_opened',
        'warning_acknowledged',
        'camera_permission_granted',
        'camera_permission_denied',
        'camera_disconnected',
        'retina_tracking_started',
        'retina_gaze_violation',
        'face_not_detected',
        'multiple_faces_detected',
        'code_run',
        'code_autosave',
        'mcq_autosave',
        'test_submitted',
        'auto_submitted_violation',
        'auto_submitted_timeout',
      ],
      index: true,
    },
    severity: {
      type: String,
      enum: ['info', 'warning', 'critical'],
      default: 'info',
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
      default: '',
    },
    userAgent: {
      type: String,
      default: '',
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('ActivityLog', activityLogSchema);
