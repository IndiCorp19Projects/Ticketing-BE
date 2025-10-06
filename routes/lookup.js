// routes/lookup.js
const express = require('express');
const router = express.Router();
const lookup = require('../controllers/lookupController');

router.post('/category', lookup.createCategory);
router.get('/categories', lookup.listCategories);

router.post('/subcategory', lookup.createSubCategory);
router.get('/categories/:categoryId/subcategories', lookup.listSubCategoriesForCategory);

router.post('/priority', lookup.createPriority);
router.get('/priorities', lookup.listPriorities);

router.post('/issue-type', lookup.createIssueType);
router.get('/subcategories/:subcategoryId/issuetypes', lookup.listIssueTypesForSubCategory);

module.exports = router;
