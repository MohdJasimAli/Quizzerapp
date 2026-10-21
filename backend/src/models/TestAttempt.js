const mongoose = require('mongoose');

const testAttemptSchema = new mongoose.Schema(
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
    attemptNumber: {
      type: Number,
      default: 1,
    },
    startTime: {
      type: Date,
      required: true,
      default: Date.now,
    },
    deadline: {
      type: Date,
      required: true,
    },
    submittedAt: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['in_progress', 'submitted', 'timed_out', 'disqualified'],
      default: 'in_progress',
      index: true,
    },
    mcqAnswers: [
      {
        questionId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Question',
          required: true,
        },
        selectedOptionId: {
          type: String,
          default: '',
        },
        isFlagged: {
          type: Boolean,
          default: false,
        },
        savedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    codingAnswers: [
      {
        questionId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Question',
          required: true,
        },
        code: {
          type: String,
          default: '',
        },
        language: {
          type: String,
          default: 'python',
        },
        lastRunResult: {
          type: mongoose.Schema.Types.Mixed,
        },
        isFlagged: {
          type: Boolean,
          default: false,
        },
        savedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    integrityEvents: [
      {
        eventType: {
          type: String,
          enum: [
            'tab_switch',
            'fullscreen_exit',
            'window_blur',
            'copy_paste_attempt',
            'devtools_opened',
            'warning_acknowledged',
          ],
          required: true,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
        details: {
          type: String,
          default: '',
        },
      },
    ],
    violationCount: {
      type: Number,
      default: 0,
    },
    isFlaggedForReview: {
      type: Boolean,
      default: false,
    },
    submittedBySystem: {
      type: Boolean,
      default: false,
    },
    submissionReason: {
      type: String,
      enum: ['manual_submit', 'timer_expired', 'violation_limit_exceeded'],
      default: 'manual_submit',
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure uniqueness of student attempts if needed
testAttemptSchema.index({ testId: 1, studentId: 1, attemptNumber: 1 });

module.exports = mongoose.model('TestAttempt', testAttemptSchema);
