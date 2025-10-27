const express = require('express');
const router = express.Router();
const clientTicketController = require('../controllers/clientTicketController');
const clientAuth = require('../middleware/clientAuth');
const upload = require('../middleware/uploadMemory');

// Apply client authentication to all routes
router.use(clientAuth);

router.post('/raise', upload.array('files'), clientTicketController.raiseTicket);
router.get('/my-tickets', clientTicketController.getClientTickets);
router.get('/:ticketId', clientTicketController.getTicketById);
router.post('/:ticketId/reply', upload.array('files'), clientTicketController.replyToTicket);
router.put('/:ticketId/assign-user', clientTicketController.assignToClientUser);

module.exports = router;