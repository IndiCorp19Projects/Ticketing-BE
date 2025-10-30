// routes/clientAuthRoutes.js
const express = require('express');
const router = express.Router();
const clientAuthController = require('../controllers/clientAuthController');


router.post('/register', clientAuthController.register);
router.post('/login', clientAuthController.login);
router.post('/logout', clientAuthController.logout);

module.exports = router;