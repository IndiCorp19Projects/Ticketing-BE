// routes/issueTypeRoutes.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/issueTypeController');

router.get('/', controller.listIssueTypes);
router.get('/:id', controller.getIssueType);
router.post('/', controller.createIssueType);
router.put('/:id', controller.updateIssueType);
router.delete('/:id', controller.deleteIssueType);

module.exports = router;

// routes/sla.js - Add new routes
