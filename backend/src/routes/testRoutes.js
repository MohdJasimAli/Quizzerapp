const express = require('express');
const router = express.Router();
const {
  createTest,
  getTests,
  getTestById,
  updateTest,
  publishTest,
  unpublishTest,
  deleteTest,
  toggleReleaseResults,
} = require('../controllers/testController');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

router.use(verifyToken);

router.get('/', getTests);
router.post('/', requireRole(['admin', 'teacher']), createTest);
router.get('/:id', getTestById);
router.put('/:id', requireRole(['admin', 'teacher']), updateTest);
router.patch('/:id/publish', requireRole(['admin', 'teacher']), publishTest);
router.patch('/:id/unpublish', requireRole(['admin', 'teacher']), unpublishTest);
router.patch('/:id/release-results', requireRole(['admin', 'teacher']), toggleReleaseResults);
router.delete('/:id', requireRole(['admin', 'teacher']), deleteTest);

module.exports = router;
