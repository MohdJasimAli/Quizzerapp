const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema(
  {
    attemptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TestAttempt',
      required: true,
      unique: true,
      index: true,
    },
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
    totalMarksObtained: {
      type: Number,
      required: true,
      default: 0,
    },
    maxMarks: {
      type: Number,
      required: true,
      default: 0,
    },
    percentage: {
      type: Number,
      default: 0,
    },
    isPassed: {
      type: Boolean,
      default: false,
    },
    mcqScore: {
      type: Number,
      default: 0,
    },
    codingScore: {
      type: Number,
      default: 0,
    },
    questionEvaluations: [
      {
        questionId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Question',
          required: true,
        },
        questionType: {
          type: String,
          enum: ['mcq', 'coding'],
          required: true,
        },
        questionTitle: {
          type: String,
        },
        allocatedMarks: {
          type: Number,
          default: 0,
        },
        marksAwarded: {
          type: Number,
          default: 0,
        },
        isEvaluated: {
          type: Boolean,
          default: false,
        },
        mcqSelectedOption: {
          type: String,
        },
        mcqCorrectOption: {
          type: String,
        },
        mcqIsCorrect: {
          type: Boolean,
        },
        codingLanguage: {
          type: String,
        },
        codingCode: {
          type: String,
        },
        testCasesTotal: {
          type: Number,
          default: 0,
        },
        testCasesPassed: {
          type: Number,
          default: 0,
        },
        testCasesDetails: [
          {
            testCaseIndex: Number,
            isSample: Boolean,
            passed: Boolean,
            input: String,
            expectedOutput: String,
            actualOutput: String,
            errorMessage: String,
            executionTime: Number,
          },
        ],
        manualMarksOverride: {
          type: Number,
        },
        teacherFeedback: {
          type: String,
          default: '',
        },
        evaluatedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
      },
    ],
    isReleased: {
      type: Boolean,
      default: false,
      index: true,
    },
    releasedAt: {
      type: Date,
    },
    evaluatedAt: {
      type: Date,
      default: Date.now,
    },
    evaluatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Method to safe-strip results for student if not yet released
resultSchema.methods.toStudentView = function (isReleased) {
  const obj = this.toObject();
  if (!isReleased) {
    // Only return minimal completion info, no answers or question breakdown
    return {
      _id: obj._id,
      attemptId: obj.attemptId,
      testId: obj.testId,
      studentId: obj.studentId,
      isReleased: false,
      message: 'Test submitted successfully. Results will be available once released by the teacher/admin.',
    };
  }

  // If released, strip hidden test case actual inputs/expectedOutputs if any
  if (obj.questionEvaluations) {
    obj.questionEvaluations = obj.questionEvaluations.map(q => {
      if (q.testCasesDetails) {
        q.testCasesDetails = q.testCasesDetails.map(tc => {
          if (!tc.isSample) {
            // Hidden test case: hide actual input/expected output
            return {
              testCaseIndex: tc.testCaseIndex,
              isSample: false,
              passed: tc.passed,
              executionTime: tc.executionTime,
            };
          }
          return tc;
        });
      }
      return q;
    });
  }

  return obj;
};

module.exports = mongoose.model('Result', resultSchema);
