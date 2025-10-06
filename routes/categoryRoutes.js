// routes/categoryRoutes.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/categoryController');
// optional: add auth middleware here, e.g. isAdmin
router.get('/', controller.listCategories);
router.get('/:id', controller.getCategory);
router.post('/', controller.createCategory);
router.put('/:id', controller.updateCategory);
router.delete('/:id', controller.deleteCategory);

module.exports = router;
