const Result = require('../models/Result');
const Test = require('../models/Test');
const TestAttempt = require('../models/TestAttempt');

// @desc    Get result by attempt ID
// @route   GET /api/results/attempt/:attemptId
// @access  Authenticated
const getAttemptResult = async (req, res) => {
  try {
    const { attemptId } = req.params;

    const result = await Result.findOne({ attemptId })
      .populate('testId', 'title subject duration totalMarks isResultsReleased releaseResultsMode')
      .populate('studentId', 'name email rollNumber department batch');

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Result not found. It may still be processing.',
      });
    }

    const test = result.testId;

    // Check student authorization & result release status
    if (req.user.role === 'student') {
      if (result.studentId._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }

      // Students can immediately see their score and detailed evaluation upon submission
      return res.status(200).json({
        success: true,
        isReleased: true,
        isDisqualified: Boolean(result.isDisqualified),
        result: result.toStudentView(true),
      });
    }

    // Admin & Teacher get full result including evaluations
    return res.status(200).json({
      success: true,
      isReleased: result.isReleased,
      result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch result.',
      error: error.message,
    });
  }
};

// @desc    Get all results for a test
// @route   GET /api/results/test/:testId
// @access  Admin, Teacher
const getTestResults = async (req, res) => {
  try {
    const { testId } = req.params;

    const test = await Test.findById(testId);
    if (!test) {
      return res.status(404).json({ success: false, message: 'Test not found.' });
    }

    const results = await Result.find({ testId })
      .populate('studentId', 'name email rollNumber department batch')
      .populate('attemptId', 'violationCount isFlaggedForReview submissionReason submittedAt status')
      .sort({ totalMarksObtained: -1 });

    const totalSubmissions = results.length;
    const avgScore = totalSubmissions > 0
      ? Number((results.reduce((sum, r) => sum + r.totalMarksObtained, 0) / totalSubmissions).toFixed(2))
      : 0;
    const passCount = results.filter((r) => r.isPassed).length;
    const highestScore = totalSubmissions > 0
      ? Math.max(...results.map((r) => r.totalMarksObtained))
      : 0;

    return res.status(200).json({
      success: true,
      test: {
        id: test._id,
        title: test.title,
        subject: test.subject,
        totalMarks: test.totalMarks,
        isResultsReleased: test.isResultsReleased,
      },
      stats: {
        totalSubmissions,
        avgScore,
        passCount,
        passPercentage: totalSubmissions > 0 ? Number(((passCount / totalSubmissions) * 100).toFixed(1)) : 0,
        highestScore,
      },
      results,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch test results.',
      error: error.message,
    });
  }
};

// @desc    Teacher manual evaluation / score override
// @route   PUT /api/results/:resultId/manual-evaluate
// @access  Admin, Teacher
const manualEvaluate = async (req, res) => {
  try {
    const { resultId } = req.params;
    const { questionId, manualMarks, feedback } = req.body;

    const result = await Result.findById(resultId);
    if (!result) {
      return res.status(404).json({ success: false, message: 'Result not found.' });
    }

    const evalItem = result.questionEvaluations.find(
      (qe) => qe.questionId.toString() === questionId
    );

    if (!evalItem) {
      return res.status(404).json({ success: false, message: 'Question evaluation not found.' });
    }

    if (manualMarks !== undefined) {
      if (manualMarks < 0 || manualMarks > evalItem.allocatedMarks) {
        return res.status(400).json({
          success: false,
          message: `Marks must be between 0 and maximum question marks (${evalItem.allocatedMarks}).`,
        });
      }
      evalItem.marksAwarded = Number(manualMarks);
      evalItem.manualMarksOverride = Number(manualMarks);
    }

    if (feedback !== undefined) {
      evalItem.teacherFeedback = feedback;
    }

    evalItem.evaluatedBy = req.user._id;

    // Recalculate totals
    let newTotal = 0;
    let newCodingScore = 0;
    let newMcqScore = 0;

    result.questionEvaluations.forEach((qe) => {
      newTotal += qe.marksAwarded;
      if (qe.questionType === 'coding') newCodingScore += qe.marksAwarded;
      if (qe.questionType === 'mcq') newMcqScore += qe.marksAwarded;
    });

    result.totalMarksObtained = Math.max(0, Number(newTotal.toFixed(2)));
    result.codingScore = Math.max(0, Number(newCodingScore.toFixed(2)));
    result.mcqScore = Math.max(0, Number(newMcqScore.toFixed(2)));
    result.percentage = result.maxMarks > 0 ? Number(((result.totalMarksObtained / result.maxMarks) * 100).toFixed(2)) : 0;
    result.isPassed = result.percentage >= 40;
    result.evaluatedBy = req.user._id;

    await result.save();

    return res.status(200).json({
      success: true,
      message: 'Evaluation updated successfully.',
      result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update evaluation.',
      error: error.message,
    });
  }
};

// @desc    Export test results as CSV
// @route   GET /api/results/test/:testId/export-csv
// @access  Admin, Teacher
const exportResultsCSV = async (req, res) => {
  try {
    const { testId } = req.params;
    const test = await Test.findById(testId);
    if (!test) {
      return res.status(404).json({ success: false, message: 'Test not found.' });
    }

    const results = await Result.find({ testId })
      .populate('studentId', 'name email rollNumber department batch')
      .populate('attemptId', 'violationCount isFlaggedForReview submissionReason submittedAt status');

    const headers = [
      'Roll Number',
      'Student Name',
      'Email',
      'Department',
      'Batch',
      'MCQ Score',
      'Coding Score',
      'Total Marks Obtained',
      'Max Marks',
      'Percentage (%)',
      'Status',
      'Integrity Violations',
      'Flagged for Review',
      'Submitted At',
    ];

    const rows = results.map((r) => [
      `"${r.studentId?.rollNumber || 'N/A'}"`,
      `"${r.studentId?.name || 'N/A'}"`,
      `"${r.studentId?.email || 'N/A'}"`,
      `"${r.studentId?.department || 'N/A'}"`,
      `"${r.studentId?.batch || 'N/A'}"`,
      r.mcqScore,
      r.codingScore,
      r.totalMarksObtained,
      r.maxMarks,
      r.percentage,
      r.isPassed ? 'PASSED' : 'FAILED',
      r.attemptId?.violationCount || 0,
      r.attemptId?.isFlaggedForReview ? 'YES' : 'NO',
      `"${r.attemptId?.submittedAt ? new Date(r.attemptId.submittedAt).toISOString() : 'N/A'}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

    const filename = `KairosTest_${test.title.replace(/[^a-zA-Z0-9]/g, '_')}_Results.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csvContent);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to export CSV.',
      error: error.message,
    });
  }
};

module.exports = {
  getAttemptResult,
  getTestResults,
  manualEvaluate,
  exportResultsCSV,
};
