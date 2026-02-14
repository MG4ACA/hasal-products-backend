const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reportsController');
const authMiddleware = require('../middleware/authMiddleware');

// Apply authentication middleware to all routes
router.use(authMiddleware);

/**
 * @route   GET /api/reports/sales
 * @desc    Get comprehensive sales report
 * @query   date_from, date_to, outlet_id, route_id, product_sku_id
 * @access  Private
 */
router.get('/sales', reportsController.getSalesReport);

/**
 * @route   GET /api/reports/payments
 * @desc    Get payment collection report
 * @query   date_from, date_to, outlet_id, payment_method
 * @access  Private
 */
router.get('/payments', reportsController.getPaymentCollectionReport);

/**
 * @route   GET /api/reports/supplier-payments
 * @desc    Get supplier payment report
 * @query   date_from, date_to, supplier_id
 * @access  Private
 */
router.get('/supplier-payments', reportsController.getSupplierPaymentReport);

/**
 * @route   GET /api/reports/outlet-balance
 * @desc    Get outlet balance and aging report
 * @query   outlet_id
 * @access  Private
 */
router.get('/outlet-balance', reportsController.getOutletBalanceReport);

/**
 * @route   GET /api/reports/check-status
 * @desc    Get check status report
 * @query   date_from, date_to, status
 * @access  Private
 */
router.get('/check-status', reportsController.getCheckStatusReport);

/**
 * @route   GET /api/reports/inventory
 * @desc    Get inventory valuation report
 * @query   None
 * @access  Private
 */
router.get('/inventory', reportsController.getInventoryReport);

/**
 * @route   GET /api/reports/production
 * @desc    Get comprehensive production report
 * @query   date_from, date_to, recipe_id
 * @access  Private
 */
router.get('/production', reportsController.getProductionReport);

module.exports = router;
