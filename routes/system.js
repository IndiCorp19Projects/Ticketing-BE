// routes/system.js
const express = require('express');
const router = express.Router();
// const { authenticateToken } = require('../middleware/auth');
 const { requireAdmin } = require('../middleware/roleMiddleware');
const authMiddleware = require('../middleware/authMiddleware');

const systemController = require('../controllers/systemController');

// Admin routes for system management
router.post('/register', authMiddleware, requireAdmin, systemController.registerSystem);
router.get('/all', authMiddleware, requireAdmin, systemController.getSystems);
router.patch('/:systemId/status', authMiddleware, requireAdmin, systemController.updateSystemStatus);

module.exports = router;