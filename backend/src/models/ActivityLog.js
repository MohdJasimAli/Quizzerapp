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
