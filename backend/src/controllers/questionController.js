const Question = require('../models/Question');
const Test = require('../models/Test');

// Recalculate test total marks and question count
const updateTestMetadata = async (testId) => {
  const questions = await Question.find({ testId });
  const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 0), 0);
  const questionCount = questions.length;
  await Test.findByIdAndUpdate(testId, {
    totalMarks: Number(totalMarks.toFixed(2)),
    questionCount,
    questions: questions.map((q) => q._id),
  });
};

// @desc    Add a question to a test
// @route   POST /api/tests/:testId/questions
// @access  Admin, Teacher
const addQuestion = async (req, res) => {
  try {
    const { testId } = req.params;
    const test = await Test.findById(testId);
    if (!test) {
      return res.status(404).json({ success: false, message: 'Test not found.' });
    }

    // Permission check
    if (
      req.user.role !== 'admin' &&
      test.createdBy.toString() !== req.user._id.toString() &&
      test.assignedTeacher?.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ success: false, message: 'Unauthorized to edit this test.' });
    }

    const currentQuestionsCount = await Question.countDocuments({ testId });
    if (currentQuestionsCount >= 20) {
      return res.status(400).json({
        success: false,
        message: 'Cannot add question: Maximum limit of 20 questions per test reached.',
      });
    }

    const {
      type,
      title,
      description,
      marks,
      difficulty,
      explanation,
      mcqData,
      codingData,
    } = req.body;

    if (!type || !title || !description || marks === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Question type, title, description, and marks are required.',
      });
    }

    if (type === 'mcq') {
      if (!mcqData || !Array.isArray(mcqData.options) || mcqData.options.length < 2 || mcqData.options.length > 6) {
        return res.status(400).json({
          success: false,
          message: 'MCQ must contain between 2 and 6 options.',
        });
      }
      const hasCorrect = mcqData.options.some((opt) => opt.isCorrect);
      if (!hasCorrect) {
        return res.status(400).json({
          success: false,
          message: 'At least one option must be marked as the correct answer.',
        });
      }
    } else if (type === 'coding') {
      if (!codingData || !codingData.sampleTestCases || codingData.sampleTestCases.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Coding questions require at least one public sample test case.',
        });
      }
    }

    const question = await Question.create({
      testId,
      type,
      title,
      description,
      marks: Number(marks),
      difficulty: difficulty || 'medium',
      explanation: explanation || '',
      order: currentQuestionsCount,
      mcqData: type === 'mcq' ? mcqData : undefined,
      codingData: type === 'coding' ? codingData : undefined,
    });

    await updateTestMetadata(testId);

    return res.status(201).json({
      success: true,
      message: 'Question added successfully.',
      question,
    });
  } catch (error) {
    console.error('Error adding question:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add question.',
      error: error.message,
    });
  }
};

// @desc    Get questions for a test
// @route   GET /api/tests/:testId/questions
// @access  Authenticated
const getQuestions = async (req, res) => {
  try {
    const { testId } = req.params;
    const test = await Test.findById(testId);
    if (!test) {
      return res.status(404).json({ success: false, message: 'Test not found.' });
    }

    const questions = await Question.find({ testId }).sort({ order: 1, createdAt: 1 });

    if (req.user.role === 'student') {
      // Return student-sanitized view (no isCorrect, no hiddenTestCases, no explanation)
      const sanitized = questions.map((q) => q.toStudentView());
      return res.status(200).json({
        success: true,
        questions: sanitized,
      });
    }

    // Teacher/admin sees complete data with answers and hidden test cases
    return res.status(200).json({
      success: true,
      questions,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch questions.',
      error: error.message,
    });
  }
};

// @desc    Update a question
// @route   PUT /api/tests/:testId/questions/:questionId
// @access  Admin, Teacher
const updateQuestion = async (req, res) => {
  try {
    const { testId, questionId } = req.params;
    const test = await Test.findById(testId);
    if (!test) {
      return res.status(404).json({ success: false, message: 'Test not found.' });
    }

    // Permission check
    if (
      req.user.role !== 'admin' &&
      test.createdBy.toString() !== req.user._id.toString() &&
      test.assignedTeacher?.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ success: false, message: 'Unauthorized to edit this test.' });
    }

    const question = await Question.findOne({ _id: questionId, testId });
    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found.' });
    }

    const {
      title,
      description,
      marks,
      difficulty,
      explanation,
      mcqData,
      codingData,
      order,
    } = req.body;

    if (title !== undefined) question.title = title;
    if (description !== undefined) question.description = description;
    if (marks !== undefined) question.marks = Number(marks);
    if (difficulty !== undefined) question.difficulty = difficulty;
    if (explanation !== undefined) question.explanation = explanation;
    if (order !== undefined) question.order = Number(order);

    if (question.type === 'mcq' && mcqData) {
      if (mcqData.options && (mcqData.options.length < 2 || mcqData.options.length > 6)) {
        return res.status(400).json({
          success: false,
          message: 'MCQ must contain between 2 and 6 options.',
        });
      }
      question.mcqData = mcqData;
    }

    if (question.type === 'coding' && codingData) {
      question.codingData = codingData;
    }

    await question.save();
    await updateTestMetadata(testId);

    return res.status(200).json({
      success: true,
      message: 'Question updated successfully.',
      question,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update question.',
      error: error.message,
    });
  }
};

// @desc    Delete a question
// @route   DELETE /api/tests/:testId/questions/:questionId
// @access  Admin, Teacher
const deleteQuestion = async (req, res) => {
  try {
    const { testId, questionId } = req.params;
    const test = await Test.findById(testId);
    if (!test) {
      return res.status(404).json({ success: false, message: 'Test not found.' });
    }

    if (
      req.user.role !== 'admin' &&
      test.createdBy.toString() !== req.user._id.toString() &&
      test.assignedTeacher?.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ success: false, message: 'Unauthorized to edit this test.' });
    }

    const question = await Question.findOneAndDelete({ _id: questionId, testId });
    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found.' });
    }

    await updateTestMetadata(testId);

    return res.status(200).json({
      success: true,
      message: 'Question deleted successfully.',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete question.',
      error: error.message,
    });
  }
};

module.exports = {
  addQuestion,
  getQuestions,
  updateQuestion,
  deleteQuestion,
};
