// routes/subCategoryRoutes.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/subCategoryController');

router.get('/', controller.listSubCategories);
router.get('/:id', controller.getSubCategory);
router.post('/', controller.createSubCategory);
router.put('/:id', controller.updateSubCategory);
router.delete('/:id', controller.deleteSubCategory);

module.exports = router;
