const express = require('express');
const {
  listContent,
  listCategories,
  createSubmission,
  retryAnalysis,
  resubmit,
  getSubmission,
} = require('../controllers/contentController');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();
router.get('/', authenticate, listContent);
router.get('/categories', authenticate, listCategories);
router.post('/', authenticate, authorize('CONTENT_CREATOR'), upload.single('file'), createSubmission);
router.post('/:id/analyze', authenticate, retryAnalysis);
router.put('/:id/resubmit', authenticate, authorize('CONTENT_CREATOR'), resubmit);
router.get('/:id', authenticate, getSubmission);

module.exports = router;
