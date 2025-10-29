// routes/exceptionRoutes.js
const express = require('express');
const router = express.Router();
const exceptionController = require('../controllers/exceptionController');
// const adminAuth = require('../middleware/adminAuth');

// // Apply admin authentication to all routes
// router.use(adminAuth);

// Get all exceptions


const authMiddleware = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/roleMiddleware');

router.use(authMiddleware, requireAdmin);

// Get all exceptions
router.get('/', exceptionController.getAllExceptions);

// Get exception by ID
router.get('/:id', exceptionController.getExceptionById);

// Check if specific date has exception
router.get('/check/:date', exceptionController.checkDateException);

// Get exceptions by date range
router.get('/range/date-range', exceptionController.getExceptionsByDateRange);

// Create new exception
router.post('/', exceptionController.createException);

// Update exception
router.put('/:id', exceptionController.updateException);

// Delete exception
router.delete('/:id', exceptionController.deleteException);

module.exports = router;