// routes/priorityRoutes.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/priorityController');

router.get('/', controller.listPriorities);
router.get('/:id', controller.getPriority);
router.post('/', controller.createPriority);
router.put('/:id', controller.updatePriority);
router.delete('/:id', controller.deletePriority);

module.exports = router;
