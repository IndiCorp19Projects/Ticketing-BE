const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// POST /api/auth/signup
router.post('/signup', authController.signup);

// POST /api/auth/login
router.post('/login', authController.login);


router.post('/logout', authController.logout);


router.get('/me', authController.me);


router.get('/executives', authController.getExecutives);

module.exports = router;
