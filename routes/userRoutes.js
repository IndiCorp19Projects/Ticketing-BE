const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// Admin middleware (you might want to add proper admin authentication)
const requireAdmin = (req, res, next) => {
  // Here you would check if the user is admin
  // For now, we'll assume all authenticated users can access
  next();
};

// User management routes
router.post('/users', requireAdmin, userController.createUser);
router.get('/users', requireAdmin, userController.getAllUsers);
router.get('/users/:id', requireAdmin, userController.getUserById);
router.put('/users/:id', requireAdmin, userController.updateUser);
router.delete('/users/:id', requireAdmin, userController.deleteUser);

module.exports = router;