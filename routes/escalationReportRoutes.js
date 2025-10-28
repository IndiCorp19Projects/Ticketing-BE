// routes/escalationReportRoutes.js
const express = require('express');
const router = express.Router();
const escalationReportController = require('../controllers/escalationReportController');
const { requireAdmin } = require('../middleware/roleMiddleware');
const authMiddleware = require('../middleware/authMiddleware');
router.use(authMiddleware, requireAdmin);
const clientAuth = require('../middleware/clientAuth');

// Admin escalation reports
router.get('/admin/report',  escalationReportController.getEscalationReport);
router.get('/admin/trends',  escalationReportController.getEscalationTrends);
router.get('/admin/export', escalationReportController.exportEscalationReport);

// Client escalation reports
// router.get('/client/report', clientAuth, escalationReportController.getClientEscalationReport);

module.exports = router;