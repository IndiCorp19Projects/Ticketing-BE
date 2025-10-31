const express = require('express');
const router = express.Router();
const slaController = require('../controllers/slaController');

// Existing routes
router.get('/', slaController.listSLAs);
router.get('/users', slaController.getUsersForSLA);
router.get('/issue-types', slaController.getIssueTypesForSLA);
router.get('/user/:userId', slaController.getSLAsByUser);
// router.get('/issue-type/:issueTypeId', slaController.getSLAsByIssueType);
router.get('/:id', slaController.getSLA);
router.post('/', slaController.createSLA);
router.put('/:id', slaController.updateSLA);
router.delete('/:id', slaController.deleteSLA);

// New routes for user + issue type combination
// router.get('/user/:userId/issue-type/:issueTypeId/all', slaController.getSLAForUserAndIssueType);
router.get('/user/:userId/issue-type/:issueTypeId/primary', slaController.getPrimarySLAForUserAndIssueType);

module.exports = router;