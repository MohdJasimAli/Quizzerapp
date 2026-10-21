const mongoose = require('mongoose');

const testSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Test title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    subject: {
      type: String,
      required: [true, 'Subject/Topic is required'],
      trim: true,
    },
    instructions: {
      type: String,
      default: 'Please ensure you have a stable internet connection. Full-screen mode is required throughout the test. Tab switching and exiting full-screen will be recorded as integrity violations.',
    },
    duration: {
      type: Number,
      required: [true, 'Duration in minutes is required'],
      min: [1, 'Duration must be at least 1 minute'],
      max: [60, 'Duration cannot exceed 60 minutes (1 hour)'],
    },
    startTime: {
      type: Date,
      required: [true, 'Start time is required'],
    },
    endTime: {
      type: Date,
      required: [true, 'End time is required'],
    },
    testType: {
      type: String,
      enum: ['mcq', 'coding', 'mixed'],
      required: [true, 'Test type is required'],
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'completed', 'archived'],
      default: 'draft',
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
    publishedAt: {
      type: Date,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    assignedTeacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    maxAttempts: {
      type: Number,
      default: 1,
      min: 1,
    },
    navigationMode: {
      type: String,
      enum: ['free', 'linear'],
      default: 'free',
    },
    hasNegativeMarking: {
      type: Boolean,
      default: false,
    },
    negativeMarkValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    randomizeQuestions: {
      type: Boolean,
      default: false,
    },
    randomizeOptions: {
      type: Boolean,
      default: false,
    },
    releaseResultsMode: {
      type: String,
      enum: ['immediate', 'manual'],
      default: 'immediate',
    },
    isResultsReleased: {
      type: Boolean,
      default: true,
    },
    resultsReleasedAt: {
      type: Date,
    },
    integrityPolicy: {
      warningLimit: {
        type: Number,
        default: 3,
        min: 1,
        max: 10,
      },
      actionOnLimit: {
        type: String,
        enum: ['warn_only', 'flag_for_review', 'auto_submit'],
        default: 'flag_for_review',
      },
      requireFullscreen: {
        type: Boolean,
        default: true,
      },
      detectTabSwitch: {
        type: Boolean,
        default: true,
      },
    },
    totalMarks: {
      type: Number,
      default: 0,
    },
    questionCount: {
      type: Number,
      default: 0,
    },
    questions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question',
      },
    ],
    targetGroups: {
      type: [String],
      default: ['All Students'],
    },
  },
  {
    timestamps: true,
  }
);

// Custom validation method before publishing
testSchema.methods.validateForPublishing = function () {
  const count = this.questions ? this.questions.length : 0;
  if (count < 5) {
    throw new Error(`Cannot publish test: Minimum 5 questions required (currently has ${count}).`);
  }
  if (count > 20) {
    throw new Error(`Cannot publish test: Maximum 20 questions allowed (currently has ${count}).`);
  }
  if (this.endTime <= this.startTime) {
    throw new Error('Test end time must be after the start time.');
  }
  return true;
};

module.exports = mongoose.model('Test', testSchema);
