const Question = require('../models/Question');
const { runCode, evaluateTestCases } = require('../services/codeExecutionService');

// @desc    Run code against sample test cases or custom input
// @route   POST /api/execution/run
// @access  Authenticated
const runCodeSample = async (req, res) => {
  try {
    const { questionId, language, code, customInput } = req.body;

    if (!language || !code) {
      return res.status(400).json({
        success: false,
        message: 'Language and code are required.',
      });
    }

    // If custom input provided directly (e.g. ad-hoc playground or student testing custom cases)
    if (customInput !== undefined && !questionId) {
      const execResult = await runCode({
        language,
        code,
        stdin: customInput,
        timeLimit: 3,
      });

      return res.status(200).json({
        success: true,
        result: execResult,
      });
    }

    if (!questionId) {
      return res.status(400).json({
        success: false,
        message: 'Question ID or custom input is required.',
      });
    }

    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found.',
      });
    }

    const sampleCases = (question.codingData?.sampleTestCases || []).map((tc) => ({
      input: tc.input || '',
      expectedOutput: tc.expectedOutput || '',
      explanation: tc.explanation || '',
      isSample: true,
    }));

    if (sampleCases.length === 0) {
      // Just run with empty stdin if no sample cases defined
      const singleRun = await runCode({
        language,
        code,
        stdin: '',
        timeLimit: question.codingData?.timeLimit || 2,
      });
      return res.status(200).json({
        success: true,
        results: [
          {
            testCaseIndex: 1,
            isSample: true,
            status: singleRun.status,
            passed: singleRun.status === 'Accepted',
            actualOutput: singleRun.stdout,
            errorMessage: singleRun.stderr || singleRun.compileOutput,
            executionTime: singleRun.time,
          },
        ],
        passedCount: singleRun.status === 'Accepted' ? 1 : 0,
        totalCount: 1,
      });
    }

    const evalResult = await evaluateTestCases({
      language,
      code,
      testCases: sampleCases,
      timeLimit: question.codingData?.timeLimit || 2,
      memoryLimit: question.codingData?.memoryLimit || 256,
    });

    return res.status(200).json({
      success: true,
      results: evalResult.results,
      passedCount: evalResult.passedCount,
      totalCount: evalResult.totalCount,
      percentagePassed: evalResult.percentagePassed,
    });
  } catch (error) {
    console.error('Execution error:', error);
    return res.status(500).json({
      success: false,
      message: 'Code execution error.',
      error: error.message,
    });
  }
};

module.exports = {
  runCodeSample,
};
