const Test = require('../models/Test');
const Question = require('../models/Question');
const TestAttempt = require('../models/TestAttempt');
const Result = require('../models/Result');

// @desc    Create a new test
// @route   POST /api/tests
// @access  Admin, Teacher
const createTest = async (req, res) => {
  try {
    const {
      title,
      description,
      subject,
      instructions,
      duration,
      startTime,
      endTime,
      testType,
      maxAttempts,
      navigationMode,
      hasNegativeMarking,
      negativeMarkValue,
      randomizeQuestions,
      randomizeOptions,
      releaseResultsMode,
      integrityPolicy,
      assignedTeacher,
      targetGroups,
    } = req.body;

    if (!title || !subject || !duration || !startTime || !endTime || !testType) {
      return res.status(400).json({
        success: false,
        message: 'Title, subject, duration, startTime, endTime, and testType are required.',
      });
    }

    const durationNum = Number(duration);
    if (isNaN(durationNum) || durationNum < 1 || durationNum > 60) {
      return res.status(400).json({
        success: false,
        message: 'Test duration must be between 1 minute and 60 minutes (1 hour).',
      });
    }

    if (new Date(endTime) <= new Date(startTime)) {
      return res.status(400).json({
        success: false,
        message: 'End time must be after the start time.',
      });
    }

    const test = await Test.create({
      title,
      description,
      subject,
      instructions,
      duration: Number(duration),
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      testType,
      maxAttempts: maxAttempts || 1,
      navigationMode: navigationMode || 'free',
      hasNegativeMarking: Boolean(hasNegativeMarking),
      negativeMarkValue: hasNegativeMarking ? Number(negativeMarkValue || 0) : 0,
      randomizeQuestions: Boolean(randomizeQuestions),
      randomizeOptions: Boolean(randomizeOptions),
      releaseResultsMode: releaseResultsMode || 'manual',
      integrityPolicy: integrityPolicy || {
        warningLimit: 3,
        actionOnLimit: 'flag_for_review',
        requireFullscreen: true,
        detectTabSwitch: true,
      },
      assignedTeacher: req.user.role === 'admin' ? (assignedTeacher || req.user._id) : req.user._id,
      createdBy: req.user._id,
      targetGroups: targetGroups || ['All Students'],
      status: 'draft',
      isPublished: false,
      questions: [],
      totalMarks: 0,
      questionCount: 0,
    });

    return res.status(201).json({
      success: true,
      message: 'Test draft created successfully.',
      test,
    });
  } catch (error) {
    console.error('Error creating test:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create test.',
      error: error.message,
    });
  }
};

// @desc    Get all tests based on role & filters
// @route   GET /api/tests
// @access  Authenticated
const getTests = async (req, res) => {
  try {
    const { status, type, search } = req.query;
    let query = {};

    if (req.user.role === 'student') {
      // Students only see published tests
      query.isPublished = true;
    } else if (req.user.role === 'teacher') {
      // Teachers see tests they created or are assigned to
      query.$or = [{ createdBy: req.user._id }, { assignedTeacher: req.user._id }];
    } // Admin sees all tests

    if (status && status !== 'all') {
      query.status = status;
    }

    if (type && type !== 'all') {
      query.testType = type;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
      ];
    }

    const tests = await Test.find(query)
      .populate('assignedTeacher', 'name email department')
      .populate('createdBy', 'name email role')
      .sort({ createdAt: -1 });

    // If student, attach attempt status if any
    if (req.user.role === 'student') {
      const studentAttempts = await TestAttempt.find({ studentId: req.user._id });
      const attemptsMap = {};
      studentAttempts.forEach((att) => {
        attemptsMap[att.testId.toString()] = att;
      });

      const studentTests = tests.map((t) => {
        const testObj = t.toObject();
        const attempt = attemptsMap[t._id.toString()];
        testObj.userAttempt = attempt
          ? {
              id: attempt._id,
              status: attempt.status,
              submittedAt: attempt.submittedAt,
            }
          : null;
        return testObj;
      });

      return res.status(200).json({
        success: true,
        tests: studentTests,
      });
    }

    return res.status(200).json({
      success: true,
      tests,
    });
  } catch (error) {
    console.error('Error fetching tests:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch tests.',
      error: error.message,
    });
  }
};

// @desc    Get single test details
// @route   GET /api/tests/:id
// @access  Authenticated
const getTestById = async (req, res) => {
  try {
    const test = await Test.findById(req.params.id)
      .populate('assignedTeacher', 'name email department')
      .populate('createdBy', 'name email role')
      .populate('questions');

    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found.',
      });
    }

    // Role check
    if (req.user.role === 'student') {
      if (!test.isPublished) {
        return res.status(403).json({
          success: false,
          message: 'This test is not published yet.',
        });
      }

      // Convert questions to safe student view (no isCorrect, no hidden test cases)
      const safeTest = test.toObject();
      if (safeTest.questions) {
        safeTest.questions = test.questions.map((q) => q.toStudentView());
      }

      return res.status(200).json({
        success: true,
        test: safeTest,
      });
    }

    return res.status(200).json({
      success: true,
      test,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve test.',
      error: error.message,
    });
  }
};

// @desc    Update test
// @route   PUT /api/tests/:id
// @access  Admin, Teacher (assigned)
const updateTest = async (req, res) => {
  try {
    const test = await Test.findById(req.params.id);
    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found.',
      });
    }

    // Check permissions
    if (
      req.user.role !== 'admin' &&
      test.createdBy.toString() !== req.user._id.toString() &&
      test.assignedTeacher?.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: You are not assigned to manage this test.',
      });
    }

    const updates = req.body;
    delete updates.questions; // Questions managed through questionController
    delete updates.isPublished; // Published through publish endpoint

    if (updates.duration !== undefined) {
      const dur = Number(updates.duration);
      if (isNaN(dur) || dur < 1 || dur > 60) {
        return res.status(400).json({
          success: false,
          message: 'Test duration must be between 1 minute and 60 minutes (1 hour).',
        });
      }
      updates.duration = dur;
    }

    Object.assign(test, updates);
    await test.save();

    return res.status(200).json({
      success: true,
      message: 'Test updated successfully.',
      test,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update test.',
      error: error.message,
    });
  }
};

// @desc    Publish a test with strict 5-20 questions validation
// @route   PATCH /api/tests/:id/publish
// @access  Admin, Teacher
const publishTest = async (req, res) => {
  try {
    const test = await Test.findById(req.params.id).populate('questions');
    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found.',
      });
    }

    // Authorization
    if (
      req.user.role !== 'admin' &&
      test.createdBy.toString() !== req.user._id.toString() &&
      test.assignedTeacher?.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to publish this test.',
      });
    }

    const qCount = test.questions ? test.questions.length : 0;

    // Strict 5 to 20 questions validation requirement
    if (qCount < 5) {
      return res.status(400).json({
        success: false,
        message: `Cannot publish test: A test must contain at least 5 questions (currently has ${qCount}). Please add more questions.`,
        currentCount: qCount,
      });
    }

    if (qCount > 20) {
      return res.status(400).json({
        success: false,
        message: `Cannot publish test: A test cannot contain more than 20 questions (currently has ${qCount}). Please remove excess questions.`,
        currentCount: qCount,
      });
    }

    if (new Date(test.endTime) <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot publish test: The test end time is already in the past. Please update test schedule.',
      });
    }

    // Calculate total marks accurately
    const totalMarks = test.questions.reduce((sum, q) => sum + (q.marks || 0), 0);

    test.isPublished = true;
    test.status = 'published';
    test.publishedAt = new Date();
    test.totalMarks = Number(totalMarks.toFixed(2));
    test.questionCount = qCount;

    await test.save();

    return res.status(200).json({
      success: true,
      message: `Test published successfully with ${qCount} questions and ${totalMarks} total marks.`,
      test,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to publish test.',
      error: error.message,
    });
  }
};

// @desc    Unpublish or revert test to draft
// @route   PATCH /api/tests/:id/unpublish
// @access  Admin, Teacher
const unpublishTest = async (req, res) => {
  try {
    const test = await Test.findById(req.params.id);
    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found.',
      });
    }

    test.isPublished = false;
    test.status = 'draft';
    await test.save();

    return res.status(200).json({
      success: true,
      message: 'Test reverted to draft mode.',
      test,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to unpublish test.',
      error: error.message,
    });
  }
};

// @desc    Delete a test
// @route   DELETE /api/tests/:id
// @access  Admin, Teacher (creator)
const deleteTest = async (req, res) => {
  try {
    const test = await Test.findById(req.params.id);
    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found.',
      });
    }

    if (
      req.user.role !== 'admin' &&
      test.createdBy.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to delete this test.',
      });
    }

    // Delete associated questions
    await Question.deleteMany({ testId: test._id });
    await Test.findByIdAndDelete(test._id);

    return res.status(200).json({
      success: true,
      message: 'Test and associated questions deleted successfully.',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete test.',
      error: error.message,
    });
  }
};

// @desc    Release or withhold test results
// @route   PATCH /api/tests/:id/release-results
// @access  Admin, Teacher
const toggleReleaseResults = async (req, res) => {
  try {
    const { release } = req.body;
    const test = await Test.findById(req.params.id);
    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found.',
      });
    }

    test.isResultsReleased = Boolean(release);
    test.resultsReleasedAt = release ? new Date() : null;
    await test.save();

    // Update all existing results for this test
    await Result.updateMany(
      { testId: test._id },
      {
        $set: {
          isReleased: Boolean(release),
          releasedAt: release ? new Date() : null,
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: release
        ? 'Results have been published and are now visible to students.'
        : 'Results have been withheld from students.',
      isResultsReleased: test.isResultsReleased,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update result release status.',
      error: error.message,
    });
  }
};

module.exports = {
  createTest,
  getTests,
  getTestById,
  updateTest,
  publishTest,
  unpublishTest,
  deleteTest,
  toggleReleaseResults,
};
