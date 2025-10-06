const express = require('express');
const router = express.Router();
const controller = require('../controllers/slaController');

// All admin endpoints (protect with auth/isAdmin middleware as needed)
router.get('/', controller.listSLAs);        // GET /admin/slas?includeInactive=true
router.get('/:id', controller.getSLA);       // GET /admin/slas/:id
router.post('/', controller.createSLA);      // POST /admin/slas
router.put('/:id', controller.updateSLA);    // PUT /admin/slas/:id
router.delete('/:id', controller.deleteSLA); // DELETE /admin/slas/:id  (soft-delete)

module.exports = router;
