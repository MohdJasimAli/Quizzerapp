const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  getActivityLogs,
} = require('../controllers/adminController');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

router.use(verifyToken);

// Teacher can access student user list and activity logs for their tests
router.get('/users', requireRole(['admin', 'teacher']), getUsers);
router.get('/activity-logs', requireRole(['admin', 'teacher']), getActivityLogs);

// Admin-only routes
router.get('/stats', requireRole('admin'), getDashboardStats);
router.post('/users', requireRole('admin'), createUser);
router.put('/users/:id', requireRole('admin'), updateUser);
router.delete('/users/:id', requireRole('admin'), deleteUser);

module.exports = router;
