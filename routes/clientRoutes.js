const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');

// Client routes
router.get('/', clientController.listClients);
router.get('/stats/:id', clientController.getClientStats);
router.get('/settings/:id', clientController.getClientSettings); // NEW ROUTE
router.get('/:id', clientController.getClient);
router.post('/', clientController.createClient);
router.put('/:id', clientController.updateClient);
router.patch('/settings/:id', clientController.updateClientSettings); // NEW ROUTE
router.delete('/:id', clientController.deleteClient);
router.post('/:id/resend-credentials', clientController.resendCredentials);

module.exports = router;