const express = require('express');
const router = express.Router();
const workingHoursController = require('../controllers/workingHoursController');
const { requireAdmin } = require('../middleware/roleMiddleware');
const authMiddleware = require('../middleware/authMiddleware');
router.use(authMiddleware, requireAdmin);

// GET /api/working-hours - Get all working hours
router.get('/',  workingHoursController.getWorkingHours);

// POST /api/working-hours - Create new working hours
router.post('/',  workingHoursController.createWorkingHours);

// PUT /api/working-hours/:id - Update working hours
router.put('/:id',  workingHoursController.updateWorkingHours);

// DELETE /api/working-hours/:id - Delete working hours
router.delete('/:id',  workingHoursController.deleteWorkingHours);

// PATCH /api/working-hours/:id/set-default - Set as default working hours
router.patch('/:id/set-default',  workingHoursController.setDefaultWorkingHours);

module.exports = router;