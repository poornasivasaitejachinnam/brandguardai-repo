const express = require('express');
const {
  listOrganizations,
  createOrganization,
  updateOrganization,
} = require('../controllers/brandingController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.get('/', authenticate, listOrganizations);
router.post('/', authenticate, authorize('ADMIN'), createOrganization);
router.put('/:id', authenticate, authorize('ADMIN'), updateOrganization);

module.exports = router;
