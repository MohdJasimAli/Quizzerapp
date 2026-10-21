const express = require('express');
const router = express.Router();
const {
  getAttemptResult,
  getTestResults,
  manualEvaluate,
  exportResultsCSV,
} = require('../controllers/resultController');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

router.use(verifyToken);

router.get('/attempt/:attemptId', getAttemptResult);
router.get('/test/:testId', requireRole(['admin', 'teacher']), getTestResults);
router.get('/test/:testId/export-csv', requireRole(['admin', 'teacher']), exportResultsCSV);
router.put('/:resultId/manual-evaluate', requireRole(['admin', 'teacher']), manualEvaluate);

module.exports = router;
