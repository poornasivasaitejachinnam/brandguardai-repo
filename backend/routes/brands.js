const express = require('express');
const { listBrands, createBrand, updateBrand } = require('../controllers/brandingController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.get('/', authenticate, listBrands);
router.post('/', authenticate, authorize('ADMIN'), createBrand);
router.put('/:id', authenticate, authorize('ADMIN'), updateBrand);

module.exports = router;
