const Test = require('../models/Test');
const Question = require('../models/Question');
const TestAttempt = require('../models/TestAttempt');
const Result = require('../models/Result');
const { evaluateTestCases } = require('./codeExecutionService');

/**
 * Automatically evaluates a completed test attempt
 */
const evaluateAttempt = async (attemptId, evaluatedByUserId = null) => {
  const attempt = await TestAttempt.findById(attemptId);
  if (!attempt) {
    throw new Error('Test attempt not found');
  }

  const test = await Test.findById(attempt.testId).populate('questions');
  if (!test) {
    throw new Error('Test not found');
  }

  const questions = test.questions;
  const isDisqualified = attempt.status === 'disqualified';
  let totalMarksObtained = 0;
  let maxMarks = 0;
  let mcqScore = 0;
  let codingScore = 0;
  const questionEvaluations = [];

  for (const q of questions) {
    maxMarks += q.marks;

    if (isDisqualified) {
      questionEvaluations.push({
        questionId: q._id,
        questionType: q.type,
        questionTitle: q.title,
        allocatedMarks: q.marks,
        marksAwarded: 0,
        isEvaluated: true,
        teacherFeedback: 'Disqualified: 0 marks awarded due to integrity policy violation.',
      });
      continue;
    }

    if (q.type === 'mcq') {
      // Find student answer
      const studentAns = attempt.mcqAnswers.find(
        (a) => a.questionId.toString() === q._id.toString()
      );
      const selectedOptionId = studentAns ? studentAns.selectedOptionId : '';
      
      const correctOption = q.mcqData?.options?.find((opt) => opt.isCorrect);
      const correctOptionId = correctOption ? correctOption.id : null;
      
      let marksAwarded = 0;
      let isCorrect = false;

      if (selectedOptionId) {
        if (selectedOptionId === correctOptionId) {
          marksAwarded = q.marks;
          isCorrect = true;
        } else {
          // Negative marking deduction if applicable
          const penalty = q.mcqData?.negativeMarks || (test.hasNegativeMarking ? test.negativeMarkValue : 0);
          marksAwarded = penalty > 0 ? -penalty : 0;
          isCorrect = false;
        }
      }

      mcqScore += marksAwarded;
      totalMarksObtained += marksAwarded;

      questionEvaluations.push({
        questionId: q._id,
        questionType: 'mcq',
        questionTitle: q.title,
        allocatedMarks: q.marks,
        marksAwarded: Number(marksAwarded.toFixed(2)),
        isEvaluated: true,
        mcqSelectedOption: selectedOptionId,
        mcqCorrectOption: correctOptionId,
        mcqIsCorrect: isCorrect,
      });
    } else if (q.type === 'coding') {
      const studentCodeAns = attempt.codingAnswers.find(
        (a) => a.questionId.toString() === q._id.toString()
      );

      const code = studentCodeAns?.code || '';
      const language = studentCodeAns?.language || 'python';

      // Combine sample and hidden test cases for full evaluation
      const allTestCases = [
        ...(q.codingData?.sampleTestCases || []).map((tc) => ({
          ...tc.toObject ? tc.toObject() : tc,
          isSample: true,
        })),
        ...(q.codingData?.hiddenTestCases || []).map((tc) => ({
          ...tc.toObject ? tc.toObject() : tc,
          isSample: false,
        })),
      ];

      let marksAwarded = 0;
      let evalDetails = [];
      let passedCount = 0;

      if (code.trim() && allTestCases.length > 0) {
        const evalResult = await evaluateTestCases({
          language,
          code,
          testCases: allTestCases,
          timeLimit: q.codingData?.timeLimit || 2,
          memoryLimit: q.codingData?.memoryLimit || 256,
        });

        passedCount = evalResult.passedCount;
        evalDetails = evalResult.results;

        // Partial marks based on passed test cases ratio
        const ratio = evalResult.totalCount > 0 ? passedCount / evalResult.totalCount : 0;
        marksAwarded = Number((ratio * q.marks).toFixed(2));
      }

      codingScore += marksAwarded;
      totalMarksObtained += marksAwarded;

      questionEvaluations.push({
        questionId: q._id,
        questionType: 'coding',
        questionTitle: q.title,
        allocatedMarks: q.marks,
        marksAwarded: marksAwarded,
        isEvaluated: true,
        codingLanguage: language,
        codingCode: code,
        testCasesTotal: allTestCases.length,
        testCasesPassed: passedCount,
        testCasesDetails: evalDetails,
      });
    }
  }

  // Clamp total marks to 0 if negative marking brought it below zero
  totalMarksObtained = Math.max(0, Number(totalMarksObtained.toFixed(2)));
  const percentage = maxMarks > 0 ? Number(((totalMarksObtained / maxMarks) * 100).toFixed(2)) : 0;
  const isPassed = percentage >= 40; // 40% passing standard

  // Results are released immediately so students can see their score right after test submission
  const shouldRelease = true;

  // Upsert result
  const result = await Result.findOneAndUpdate(
    { attemptId: attempt._id },
    {
      attemptId: attempt._id,
      testId: test._id,
      studentId: attempt.studentId,
      totalMarksObtained,
      maxMarks,
      percentage,
      isPassed: isDisqualified ? false : isPassed,
      mcqScore: Math.max(0, Number(mcqScore.toFixed(2))),
      codingScore: Math.max(0, Number(codingScore.toFixed(2))),
      questionEvaluations,
      isDisqualified,
      disqualificationReason: attempt.disqualificationReason || (isDisqualified ? 'Exam integrity violation' : ''),
      isReleased: true,
      releasedAt: new Date(),
      evaluatedAt: new Date(),
      evaluatedBy: evaluatedByUserId,
    },
    { upsert: true, new: true }
  );

  return result;
};

module.exports = {
  evaluateAttempt,
};
