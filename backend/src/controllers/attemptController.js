const Test = require('../models/Test');
const Question = require('../models/Question');
const TestAttempt = require('../models/TestAttempt');
const ActivityLog = require('../models/ActivityLog');
const { evaluateAttempt } = require('../services/evaluationService');

// @desc    Start or resume a test attempt
// @route   POST /api/attempts/:testId/start
// @access  Student
const startTest = async (req, res) => {
  try {
    const { testId } = req.params;
    const studentId = req.user._id;

    const test = await Test.findById(testId).populate('questions');
    if (!test) {
      return res.status(404).json({ success: false, message: 'Test not found.' });
    }

    if (!test.isPublished) {
      return res.status(403).json({
        success: false,
        message: 'This test has not been published yet.',
      });
    }

    const now = new Date();
    if (now < new Date(test.startTime)) {
      return res.status(403).json({
        success: false,
        message: `This test has not started yet. Starts at ${test.startTime.toLocaleString()}.`,
      });
    }

    if (now > new Date(test.endTime)) {
      return res.status(403).json({
        success: false,
        message: 'This test has already ended.',
      });
    }

    // Check if student was previously disqualified from this test
    const disqualifiedAttempt = await TestAttempt.findOne({
      testId,
      studentId,
      status: 'disqualified',
    });

    if (disqualifiedAttempt) {
      return res.status(403).json({
        success: false,
        isDisqualified: true,
        message: 'You have been disqualified from this assessment due to an integrity violation. Your marks are 0 and you cannot re-attempt.',
      });
    }

    // Check existing attempt
    let attempt = await TestAttempt.findOne({
      testId,
      studentId,
      status: 'in_progress',
    });

    if (attempt) {
      // Check if deadline has already passed
      const remainingSeconds = Math.max(0, Math.floor((new Date(attempt.deadline) - now) / 1000));
      if (remainingSeconds <= 0) {
        // Automatically finalize timed out attempt
        attempt.status = 'timed_out';
        attempt.submittedAt = now;
        attempt.submissionReason = 'timer_expired';
        attempt.submittedBySystem = true;
        await attempt.save();
        await evaluateAttempt(attempt._id);

        return res.status(400).json({
          success: false,
          message: 'Your test time limit has expired. Your test has been submitted.',
          isExpired: true,
        });
      }

      // Resume in-progress attempt
      const safeQuestions = test.questions.map((q) => q.toStudentView());
      return res.status(200).json({
        success: true,
        message: 'Resuming ongoing test attempt.',
        attempt,
        test: {
          id: test._id,
          title: test.title,
          instructions: test.instructions,
          duration: test.duration,
          navigationMode: test.navigationMode,
          testType: test.testType,
          totalMarks: test.totalMarks,
          integrityPolicy: test.integrityPolicy,
        },
        questions: safeQuestions,
        remainingSeconds,
      });
    }

    // Check total completed attempts
    const completedAttemptsCount = await TestAttempt.countDocuments({
      testId,
      studentId,
      status: { $in: ['submitted', 'timed_out', 'disqualified'] },
    });

    if (completedAttemptsCount >= test.maxAttempts) {
      return res.status(403).json({
        success: false,
        message: `Maximum allowed attempts (${test.maxAttempts}) reached for this test.`,
      });
    }

    // Calculate official deadline
    // min(test.endTime, now + duration minutes)
    const durationMs = test.duration * 60 * 1000;
    const testEndMs = new Date(test.endTime).getTime();
    const computedDeadlineMs = Math.min(testEndMs, now.getTime() + durationMs);
    const deadline = new Date(computedDeadlineMs);

    // Initialize answers containers
    const mcqAnswers = [];
    const codingAnswers = [];

    test.questions.forEach((q) => {
      if (q.type === 'mcq') {
        mcqAnswers.push({
          questionId: q._id,
          selectedOptionId: '',
          isFlagged: false,
        });
      } else if (q.type === 'coding') {
        const defaultLang = q.codingData?.allowedLanguages?.[0] || 'python';
        codingAnswers.push({
          questionId: q._id,
          language: defaultLang,
          code: q.codingData?.starterCode?.[defaultLang] || '',
          isFlagged: false,
        });
      }
    });

    attempt = await TestAttempt.create({
      testId,
      studentId,
      attemptNumber: completedAttemptsCount + 1,
      startTime: now,
      deadline,
      status: 'in_progress',
      mcqAnswers,
      codingAnswers,
      integrityEvents: [],
      violationCount: 0,
    });

    await ActivityLog.create({
      testId,
      studentId,
      attemptId: attempt._id,
      eventType: 'test_started',
      severity: 'info',
      details: {
        startTime: now,
        deadline,
        durationMinutes: test.duration,
      },
    });

    const safeQuestions = test.questions.map((q) => q.toStudentView());
    const remainingSeconds = Math.max(0, Math.floor((computedDeadlineMs - now.getTime()) / 1000));

    return res.status(201).json({
      success: true,
      message: 'Test started successfully.',
      attempt,
      test: {
        id: test._id,
        title: test.title,
        instructions: test.instructions,
        duration: test.duration,
        navigationMode: test.navigationMode,
        testType: test.testType,
        totalMarks: test.totalMarks,
        integrityPolicy: test.integrityPolicy,
      },
      questions: safeQuestions,
      remainingSeconds,
    });
  } catch (error) {
    console.error('Error starting test:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to start test.',
      error: error.message,
    });
  }
};

// @desc    Autosave MCQ answer
// @route   POST /api/attempts/:attemptId/save-mcq
// @access  Student
const autosaveMCQ = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { questionId, selectedOptionId, isFlagged } = req.body;

    const attempt = await TestAttempt.findOne({
      _id: attemptId,
      studentId: req.user._id,
      status: 'in_progress',
    });

    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Active attempt not found.' });
    }

    // Check deadline with 30s grace period
    const graceMs = 30 * 1000;
    if (Date.now() > new Date(attempt.deadline).getTime() + graceMs) {
      attempt.status = 'timed_out';
      attempt.submittedAt = new Date();
      attempt.submissionReason = 'timer_expired';
      attempt.submittedBySystem = true;
      await attempt.save();
      await evaluateAttempt(attempt._id);

      return res.status(400).json({
        success: false,
        message: 'Deadline expired. Test submitted.',
        isExpired: true,
      });
    }

    const answerIdx = attempt.mcqAnswers.findIndex(
      (a) => a.questionId.toString() === questionId
    );

    if (answerIdx >= 0) {
      if (selectedOptionId !== undefined) {
        attempt.mcqAnswers[answerIdx].selectedOptionId = selectedOptionId;
      }
      if (isFlagged !== undefined) {
        attempt.mcqAnswers[answerIdx].isFlagged = isFlagged;
      }
      attempt.mcqAnswers[answerIdx].savedAt = new Date();
    } else {
      attempt.mcqAnswers.push({
        questionId,
        selectedOptionId: selectedOptionId || '',
        isFlagged: Boolean(isFlagged),
        savedAt: new Date(),
      });
    }

    await attempt.save();

    return res.status(200).json({
      success: true,
      message: 'MCQ answer saved.',
      savedAt: new Date(),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to save MCQ answer.',
      error: error.message,
    });
  }
};

// @desc    Autosave Coding answer
// @route   POST /api/attempts/:attemptId/save-coding
// @access  Student
const autosaveCoding = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { questionId, code, language, isFlagged, lastRunResult } = req.body;

    const attempt = await TestAttempt.findOne({
      _id: attemptId,
      studentId: req.user._id,
      status: 'in_progress',
    });

    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Active attempt not found.' });
    }

    const graceMs = 30 * 1000;
    if (Date.now() > new Date(attempt.deadline).getTime() + graceMs) {
      attempt.status = 'timed_out';
      attempt.submittedAt = new Date();
      attempt.submissionReason = 'timer_expired';
      attempt.submittedBySystem = true;
      await attempt.save();
      await evaluateAttempt(attempt._id);

      return res.status(400).json({
        success: false,
        message: 'Deadline expired. Test submitted.',
        isExpired: true,
      });
    }

    const answerIdx = attempt.codingAnswers.findIndex(
      (a) => a.questionId.toString() === questionId
    );

    if (answerIdx >= 0) {
      if (code !== undefined) attempt.codingAnswers[answerIdx].code = code;
      if (language !== undefined) attempt.codingAnswers[answerIdx].language = language;
      if (isFlagged !== undefined) attempt.codingAnswers[answerIdx].isFlagged = isFlagged;
      if (lastRunResult !== undefined) attempt.codingAnswers[answerIdx].lastRunResult = lastRunResult;
      attempt.codingAnswers[answerIdx].savedAt = new Date();
    } else {
      attempt.codingAnswers.push({
        questionId,
        code: code || '',
        language: language || 'python',
        isFlagged: Boolean(isFlagged),
        lastRunResult,
        savedAt: new Date(),
      });
    }

    await attempt.save();

    return res.status(200).json({
      success: true,
      message: 'Code autosaved.',
      savedAt: new Date(),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to autosave code.',
      error: error.message,
    });
  }
};

// @desc    Log an integrity event (tab switch, window blur, fullscreen exit)
// @route   POST /api/attempts/:attemptId/integrity-event
// @access  Student
const logIntegrityEvent = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { eventType, details } = req.body;

    const attempt = await TestAttempt.findOne({
      _id: attemptId,
      studentId: req.user._id,
      status: 'in_progress',
    });

    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Active attempt not found.' });
    }

    const test = await Test.findById(attempt.testId);
    if (!test) {
      return res.status(404).json({ success: false, message: 'Associated test not found.' });
    }

    attempt.integrityEvents.push({
      eventType,
      details: details || '',
      timestamp: new Date(),
    });

    attempt.violationCount += 1;

    // IMMEDIATE DISQUALIFICATION POLICY:
    // Any violation kicks student out of test immediately and sets marks to 0
    attempt.status = 'disqualified';
    attempt.isDisqualified = true;
    attempt.disqualificationReason = details || `Integrity violation: ${eventType.replace(/_/g, ' ')}`;
    attempt.submittedAt = new Date();
    attempt.submissionReason = 'disqualification';
    attempt.submittedBySystem = true;
    attempt.isFlaggedForReview = true;

    await attempt.save();

    // Save to centralized ActivityLog as Critical
    await ActivityLog.create({
      testId: test._id,
      studentId: req.user._id,
      attemptId: attempt._id,
      eventType: 'auto_submitted_violation',
      severity: 'critical',
      details: {
        violationCount: attempt.violationCount,
        disqualification: true,
        reason: attempt.disqualificationReason,
      },
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

    // Evaluate attempt - sets 0 marks across all questions!
    const result = await evaluateAttempt(attempt._id);

    return res.status(200).json({
      success: true,
      disqualified: true,
      autoSubmitted: true,
      violationCount: attempt.violationCount,
      message: 'Violation detected: You have been immediately disqualified from this test and your marks have been set to 0.',
      reason: attempt.disqualificationReason,
      result: result.toStudentView ? result.toStudentView(true) : null,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to record integrity event.',
      error: error.message,
    });
  }
};

// @desc    Submit test attempt
// @route   POST /api/attempts/:attemptId/submit
// @access  Student
const submitTest = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { isAutoSubmit, reason } = req.body;

    const attempt = await TestAttempt.findOne({
      _id: attemptId,
      studentId: req.user._id,
    });

    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Attempt not found.' });
    }

    if (attempt.status !== 'in_progress') {
      return res.status(400).json({
        success: false,
        message: `Test is already ${attempt.status}. Accidental duplicate submission prevented.`,
      });
    }

    const test = await Test.findById(attempt.testId);

    // Update attempt status
    attempt.status = isAutoSubmit && reason === 'timer_expired' ? 'timed_out' : 'submitted';
    attempt.submittedAt = new Date();
    attempt.submissionReason = reason || (isAutoSubmit ? 'timer_expired' : 'manual_submit');
    attempt.submittedBySystem = Boolean(isAutoSubmit);
    await attempt.save();

    // Log submission in activity logs
    await ActivityLog.create({
      testId: attempt.testId,
      studentId: req.user._id,
      attemptId: attempt._id,
      eventType: isAutoSubmit ? 'auto_submitted_timeout' : 'test_submitted',
      severity: 'info',
      details: {
        reason: attempt.submissionReason,
        submittedAt: attempt.submittedAt,
      },
    });

    // Run evaluation service
    const result = await evaluateAttempt(attempt._id);

    return res.status(200).json({
      success: true,
      message: 'Test submitted and evaluated successfully.',
      attempt: {
        id: attempt._id,
        status: attempt.status,
        submittedAt: attempt.submittedAt,
        violationCount: attempt.violationCount,
      },
      isReleased: result.isReleased,
      result: result.toStudentView ? result.toStudentView(result.isReleased) : null,
    });
  } catch (error) {
    console.error('Error submitting test:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit test.',
      error: error.message,
    });
  }
};

// @desc    Get student's test attempts with evaluated scores
// @route   GET /api/attempts/my-attempts
// @access  Student
const getMyAttempts = async (req, res) => {
  try {
    const attempts = await TestAttempt.find({ studentId: req.user._id })
      .populate('testId', 'title subject duration totalMarks isResultsReleased testType')
      .sort({ createdAt: -1 });

    const Result = require('../models/Result');
    const attemptIds = attempts.map((a) => a._id);
    const results = await Result.find({ attemptId: { $in: attemptIds } });
    
    const resultsMap = {};
    results.forEach((r) => {
      resultsMap[r.attemptId.toString()] = {
        totalMarksObtained: r.totalMarksObtained,
        maxMarks: r.maxMarks,
        percentage: r.percentage,
        isPassed: r.isPassed,
        isDisqualified: r.isDisqualified,
        disqualificationReason: r.disqualificationReason,
      };
    });

    const attemptsWithResults = attempts.map((att) => {
      const attObj = att.toObject();
      attObj.result = resultsMap[att._id.toString()] || null;
      return attObj;
    });

    return res.status(200).json({
      success: true,
      attempts: attemptsWithResults,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch attempts.',
      error: error.message,
    });
  }
};

// @desc    Get attempt details by ID
// @route   GET /api/attempts/:attemptId
// @access  Authenticated
const getAttemptById = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const attempt = await TestAttempt.findById(attemptId)
      .populate('testId', 'title subject duration totalMarks isResultsReleased testType')
      .populate('studentId', 'name email rollNumber department');

    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Attempt not found.' });
    }

    // Role check: student can only view their own attempt
    if (req.user.role === 'student' && attempt.studentId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    return res.status(200).json({
      success: true,
      attempt,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve attempt.',
      error: error.message,
    });
  }
};

module.exports = {
  startTest,
  autosaveMCQ,
  autosaveCoding,
  logIntegrityEvent,
  submitTest,
  getMyAttempts,
  getAttemptById,
};
