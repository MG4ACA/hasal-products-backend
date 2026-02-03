const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const authMiddleware = require('../middleware/authMiddleware');

// All dashboard routes require authentication
router.use(authMiddleware);

// GET /api/dashboard/statistics - Get dashboard statistics
router.get('/statistics', dashboardController.getStatistics);

// GET /api/dashboard/sales-trend - Get sales trend data
router.get('/sales-trend', dashboardController.getSalesTrend);

// GET /api/dashboard/payment-breakdown - Get payment method breakdown
router.get('/payment-breakdown', dashboardController.getPaymentBreakdown);

// GET /api/dashboard/top-products - Get top selling products
router.get('/top-products', dashboardController.getTopProducts);

// GET /api/dashboard/route-sales - Get route-wise sales performance
router.get('/route-sales', dashboardController.getRouteSales);

module.exports = router;
