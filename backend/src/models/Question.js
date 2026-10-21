const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema(
  {
    testId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Test',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['mcq', 'coding'],
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Question title is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Question description is required'],
    },
    marks: {
      type: Number,
      required: [true, 'Marks are required'],
      min: [0.5, 'Marks must be at least 0.5'],
      default: 5,
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium',
    },
    explanation: {
      type: String,
      default: '',
    },
    order: {
      type: Number,
      default: 0,
    },
    // MCQ Specific fields
    mcqData: {
      options: [
        {
          id: { type: String, required: true },
          text: { type: String, required: true },
          isCorrect: { type: Boolean, default: false },
        },
      ],
      negativeMarks: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
    // Coding Specific fields
    codingData: {
      allowedLanguages: {
        type: [String],
        default: ['python', 'java', 'c', 'cpp'],
      },
      starterCode: {
        python: { type: String, default: '# Write your code here\ndef solution():\n    pass\n\nif __name__ == "__main__":\n    solution()\n' },
        java: { type: String, default: 'import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        // Write your code here\n    }\n}\n' },
        c: { type: String, default: '#include <stdio.h>\n\nint main() {\n    // Write your code here\n    return 0;\n}\n' },
        cpp: { type: String, default: '#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your code here\n    return 0;\n}\n' },
      },
      sampleTestCases: [
        {
          input: { type: String, default: '' },
          expectedOutput: { type: String, required: true },
          explanation: { type: String, default: '' },
        },
      ],
      hiddenTestCases: [
        {
          input: { type: String, default: '' },
          expectedOutput: { type: String, required: true },
          marksWeight: { type: Number, default: 1 },
        },
      ],
      timeLimit: {
        type: Number,
        default: 2, // seconds
      },
      memoryLimit: {
        type: Number,
        default: 256, // MB
      },
    },
  },
  {
    timestamps: true,
  }
);

// Method to return safe question object for student (strips isCorrect & hiddenTestCases)
questionSchema.methods.toStudentView = function () {
  const obj = this.toObject();
  
  // MCQ: strip isCorrect
  if (obj.type === 'mcq' && obj.mcqData?.options) {
    obj.mcqData.options = obj.mcqData.options.map(opt => ({
      id: opt.id,
      text: opt.text,
      // isCorrect omitted
    }));
  }

  // Coding: strip hiddenTestCases
  if (obj.type === 'coding' && obj.codingData) {
    delete obj.codingData.hiddenTestCases;
  }

  // Explanation omitted until results released
  delete obj.explanation;

  return obj;
};

module.exports = mongoose.model('Question', questionSchema);
