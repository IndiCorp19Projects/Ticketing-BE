// routes/escalationRoutes.js
const express = require('express');
const router = express.Router();
const escalationController = require('../controllers/escalationController');
const clientAuth = require('../middleware/clientAuth');

// Apply client authentication to all routes
router.use(clientAuth);

// router.post('/upload-image', clientAuth, escalationController.uploadEscalationImage);

// Get escalation levels
router.get('/levels', escalationController.getEscalationLevels);

// Escalate ticket
router.post('/tickets/:ticketId/escalate', escalationController.escalateTicket);
router.post('/escalate/info', escalationController.GetEscalateInfo);

// Send escalation reminder
router.post('/escalations/:escalationId/reminder', escalationController.sendEscalationReminder);

// Get escalation history for a ticket
router.get('/tickets/:ticketId/escalation-history', escalationController.getEscalationHistory);

// Get current escalation status
router.get('/tickets/:ticketId/escalation-status', escalationController.getCurrentEscalationStatus);

// Add this to your existing escalationRoutes.js file
// Add this to your existing escalationRoutes.js file
// router.get('/reports/all', escalationController.getAllEscalationReports);

module.exports = router;