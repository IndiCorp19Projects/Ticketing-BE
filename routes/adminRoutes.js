const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');
const authMiddleware = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/roleMiddleware');

router.use(authMiddleware, requireAdmin);

// get all tickets
router.get('/tickets', ticketController.adminGetAllTickets);

// get by id
router.get('/tickets/:ticketId', ticketController.getTicketById);

// admin reply
router.post('/tickets/:ticketId/reply', ticketController.replyToTicket);

// request to close (admin)
router.post('/tickets/:ticketId/request-close', ticketController.adminRequestClose);

// admin update status (not to Closed)
router.patch('/tickets/:ticketId/status', ticketController.adminUpdateStatus);

module.exports = router;
