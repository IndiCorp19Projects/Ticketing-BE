const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');
const authMiddleware = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMemory'); // NEW

// All user endpoints require authentication
router.use(authMiddleware);



router.post('/raise', upload.array('files'), ticketController.raiseTicket);

// get user's tickets
router.get('/my-tickets', ticketController.getUserTickets);

// get a ticket by id
router.get('/:ticketId', ticketController.getTicketById);

// user reply
router.post('/:ticketId/reply',  upload.array('files'), ticketController.replyToTicket);


// router.post('/:ticketId/reply', ticketController.replyToTicket);

// user approve closure
router.post('/:ticketId/approve', ticketController.userApproveClosure);

// user decline closure
router.post('/:ticketId/decline', ticketController.userDeclineClosure);

// user reopen
router.post('/:ticketId/reopen', ticketController.userReopenTicket);


// add:
router.post('/:ticketId/assign', authMiddleware, ticketController.assignTicket); // admin only endpoint
router.get('/admin/all', authMiddleware, ticketController.adminGetAllTickets); // existing
router.get('/executive/my',authMiddleware, ticketController.execGetAssignedTickets); // new

router.put('/:ticketId/priority', authMiddleware, ticketController.updateTicketPriority);

module.exports = router;





