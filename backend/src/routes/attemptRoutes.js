const express = require('express');
const router = express.Router();
const {
  startTest,
  autosaveMCQ,
  autosaveCoding,
  logIntegrityEvent,
  submitTest,
  getMyAttempts,
  getAttemptById,
} = require('../controllers/attemptController');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

router.use(verifyToken);

router.get('/my-attempts', requireRole('student'), getMyAttempts);
router.get('/:attemptId', getAttemptById);
router.post('/:testId/start', requireRole('student'), startTest);
router.post('/:attemptId/save-mcq', requireRole('student'), autosaveMCQ);
router.post('/:attemptId/save-coding', requireRole('student'), autosaveCoding);
router.post('/:attemptId/integrity-event', requireRole('student'), logIntegrityEvent);
router.post('/:attemptId/submit', requireRole('student'), submitTest);

module.exports = router;
