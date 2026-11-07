const express = require('express');
const {
  listReviews,
  assignReviewer,
  approveSubmission,
  rejectSubmission,
  requestChanges,
  addComment,
} = require('../controllers/reviewController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.get('/', authenticate, authorize('REVIEWER', 'ADMIN'), listReviews);
router.post('/:id/assign', authenticate, authorize('ADMIN'), assignReviewer);
router.put('/:id/approve', authenticate, authorize('REVIEWER', 'ADMIN'), approveSubmission);
router.put('/:id/reject', authenticate, authorize('REVIEWER', 'ADMIN'), rejectSubmission);
router.put('/:id/changes-requested', authenticate, authorize('REVIEWER', 'ADMIN'), requestChanges);
router.post('/:id/comments', authenticate, authorize('REVIEWER', 'ADMIN'), addComment);

module.exports = router;
