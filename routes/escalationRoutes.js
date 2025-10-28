// routes/escalationRoutes.js
const express = require('express');
const router = express.Router();
const escalationController = require('../controllers/escalationController');
const clientAuth = require('../middleware/clientAuth');

// Apply client authentication to all routes
router.use(clientAuth);

// Get escalation levels
router.get('/levels', escalationController.getEscalationLevels);

// Escalate ticket
router.post('/tickets/:ticketId/escalate', escalationController.escalateTicket);

// Send escalation reminder
router.post('/escalations/:escalationId/reminder', escalationController.sendEscalationReminder);

// Get escalation history for a ticket
router.get('/tickets/:ticketId/escalation-history', escalationController.getEscalationHistory);

// Get current escalation status
router.get('/tickets/:ticketId/escalation-status', escalationController.getCurrentEscalationStatus);

module.exports = router;