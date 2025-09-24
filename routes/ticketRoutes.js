const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');
const authMiddleware = require('../middleware/authMiddleware');

// All user endpoints require authentication
router.use(authMiddleware);

// raise ticket
router.post('/raise', ticketController.raiseTicket);

// get user's tickets
router.get('/my-tickets', ticketController.getUserTickets);

// get a ticket by id
router.get('/:ticketId', ticketController.getTicketById);

// user reply
router.post('/:ticketId/reply', ticketController.replyToTicket);

// user approve closure
router.post('/:ticketId/approve', ticketController.userApproveClosure);

// user decline closure
router.post('/:ticketId/decline', ticketController.userDeclineClosure);

// user reopen
router.post('/:ticketId/reopen', ticketController.userReopenTicket);

module.exports = router;
