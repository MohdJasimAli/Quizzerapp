const express = require('express');
const router = express.Router({ mergeParams: true });
const {
  addQuestion,
  getQuestions,
  updateQuestion,
  deleteQuestion,
} = require('../controllers/questionController');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

router.use(verifyToken);

router.get('/', getQuestions);
router.post('/', requireRole(['admin', 'teacher']), addQuestion);
router.put('/:questionId', requireRole(['admin', 'teacher']), updateQuestion);
router.delete('/:questionId', requireRole(['admin', 'teacher']), deleteQuestion);

module.exports = router;
