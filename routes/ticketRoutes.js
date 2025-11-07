const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');
const combinedAuth = require('../middleware/combinedAuth'); // Use combined auth
const upload = require('../middleware/uploadMemory');

// Use combined authentication middleware
router.use(combinedAuth);

router.post('/raise', upload.array('files'), ticketController.raiseTicket);
router.get('/my-tickets', ticketController.getUserTickets);
router.get('/:ticketId', ticketController.getTicketById);
router.post('/:ticketId/reply', upload.array('files'), ticketController.replyToTicket);
router.post('/:ticketId/approve', ticketController.userApproveClosure);
router.post('/:ticketId/decline', ticketController.userDeclineClosure);
router.post('/:ticketId/reopen', ticketController.userReopenTicket);

// Admin/executive routes
router.post('/:ticketId/assign', ticketController.assignTicket);
router.get('/admin/all', ticketController.adminGetAllTickets);
router.get('/executive/my', ticketController.execGetAssignedTickets);
router.put('/:ticketId/priority', ticketController.updateTicketPriority);

router.get('/ticket/log/:ticketId', ticketController.getTicketChangeLogs);


module.exports = router;
