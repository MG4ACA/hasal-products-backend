const express = require('express');
const router = express.Router();
const wastageController = require('../controllers/wastageController');
const authMiddleware = require('../middleware/authMiddleware');

// Apply authentication to all routes
router.use(authMiddleware);

// CRUD Routes
router.get('/', wastageController.getAllWastageRecords);
router.get('/:id', wastageController.getWastageRecordById);
router.post('/', wastageController.createWastageRecord);
router.put('/:id', wastageController.updateWastageRecord);
router.delete('/:id', wastageController.deleteWastageRecord);

// Reports
router.get('/reports/monthly-summary', wastageController.getMonthlyWastageSummary);
router.get('/reports/trend', wastageController.getWastageTrend);

module.exports = router;
