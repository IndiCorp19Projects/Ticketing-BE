// routes/agentPerformance.js
const express = require('express');
const router = express.Router();
const agentPerformanceController = require('../controllers/agentPerformanceController');
const authMiddleware = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/roleMiddleware');

router.use(authMiddleware, requireAdmin);

// Get performance for specific agent
router.get('/agent/:agentId',  agentPerformanceController.getAgentPerformance);

// Get performance for all agents (admin only)
router.get('/all',  agentPerformanceController.getAllAgentsPerformance);

// Get performance trends for an agent
router.get('/trends/:agentId',  agentPerformanceController.getAgentPerformanceTrends);

// Get detailed ticket breakdown for an agent
router.get('/breakdown/:agentId',  agentPerformanceController.getAgentTicketBreakdown);

// Update performance metrics (admin only, typically called by cron job)
router.post('/update-metrics',  agentPerformanceController.updatePerformanceMetrics);

module.exports = router;