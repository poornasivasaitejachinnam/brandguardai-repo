const express = require('express');
const {
  listGuidelines,
  createGuideline,
  updateGuideline,
  listRules,
  createRule,
  updateRule,
} = require('../controllers/guidelineController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.get('/', authenticate, listGuidelines);
router.post('/', authenticate, authorize('ADMIN'), createGuideline);
router.put('/:id', authenticate, authorize('ADMIN'), updateGuideline);
router.get('/:id/rules', authenticate, listRules);
router.post('/:id/rules', authenticate, authorize('ADMIN'), createRule);
router.put('/rules/:ruleId', authenticate, authorize('ADMIN'), updateRule);

module.exports = router;
