const express = require('express');
const router = express.Router();
const { runCodeSample } = require('../controllers/executionController');
const { verifyToken } = require('../middleware/auth');
const { executionLimiter } = require('../middleware/rateLimiter');

router.use(verifyToken);
router.post('/run', executionLimiter, runCodeSample);

module.exports = router;
