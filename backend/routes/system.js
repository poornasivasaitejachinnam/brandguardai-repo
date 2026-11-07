const express = require('express');
const {
  listUsers,
  updateUser,
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  listAuditLogs,
  getAnalytics,
  listReports,
  generateReport,
  exportReportCsv,
} = require('../controllers/systemController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.get('/users', authenticate, authorize('ADMIN'), listUsers);
router.put('/users/:id', authenticate, authorize('ADMIN'), updateUser);
router.get('/notifications', authenticate, listNotifications);
router.put('/notifications/read-all', authenticate, markAllNotificationsRead);
router.put('/notifications/:id/read', authenticate, markNotificationRead);
router.get('/analytics', authenticate, getAnalytics);
router.get('/reports', authenticate, authorize('ADMIN'), listReports);
router.post('/reports', authenticate, authorize('ADMIN'), generateReport);
router.get('/reports/:id/export.csv', authenticate, authorize('ADMIN'), exportReportCsv);
router.get('/audit-logs', authenticate, authorize('ADMIN'), listAuditLogs);

module.exports = router;
