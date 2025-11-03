const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');

// Client routes
router.get('/', clientController.listClients);
router.get('/stats/:id', clientController.getClientStats);
router.get('/:id', clientController.getClient);
router.post('/', clientController.createClient);
router.put('/:id', clientController.updateClient);
router.delete('/:id', clientController.deleteClient);
router.post('/:id/resend-credentials', clientController.resendCredentials); // New route

module.exports = router;