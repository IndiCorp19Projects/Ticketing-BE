const express = require('express');
const router = express.Router();
const slaController = require('../controllers/slaController');

// Updated routes
router.get('/', slaController.listSLAs);
router.get('/clients', slaController.getClientsForSLA); // Changed from /users
router.get('/issue-types', slaController.getIssueTypesForSLA);
router.get('/client/:clientId', slaController.getSLAsByClient); // Changed from /user/:userId
router.get('/:id', slaController.getSLA);
router.post('/', slaController.createSLA);
router.put('/:id', slaController.updateSLA);
router.delete('/:id', slaController.deleteSLA);

// Updated route for client + issue type combination
router.get('/client/:clientId/issue-type/:issueTypeId/primary', slaController.getPrimarySLAByClientAndIssueType); // Updated function name

module.exports = router;