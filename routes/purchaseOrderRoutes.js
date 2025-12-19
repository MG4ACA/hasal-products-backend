const express = require('express');
const router = express.Router();
const purchaseOrderController = require('../controllers/purchaseOrderController');
const authMiddleware = require('../middleware/authMiddleware');
const roleCheck = require('../middleware/roleCheck');

// All routes require authentication
router.use(authMiddleware);

/**
 * @route   GET /api/purchase-orders
 * @desc    Get all purchase orders with pagination and filters
 * @access  Private (Admin, Cashier)
 */
router.get('/', purchaseOrderController.getAllPurchaseOrders);

/**
 * @route   GET /api/purchase-orders/:id
 * @desc    Get purchase order by ID with items
 * @access  Private (Admin, Cashier)
 */
router.get('/:id', purchaseOrderController.getPurchaseOrderById);

/**
 * @route   POST /api/purchase-orders
 * @desc    Create new purchase order
 * @access  Private (Admin only)
 */
router.post('/', roleCheck(['admin']), purchaseOrderController.createPurchaseOrder);

/**
 * @route   PUT /api/purchase-orders/:id
 * @desc    Update purchase order
 * @access  Private (Admin only)
 */
router.put('/:id', roleCheck(['admin']), purchaseOrderController.updatePurchaseOrder);

/**
 * @route   DELETE /api/purchase-orders/:id
 * @desc    Delete purchase order
 * @access  Private (Admin only)
 */
router.delete('/:id', roleCheck(['admin']), purchaseOrderController.deletePurchaseOrder);

/**
 * @route   POST /api/purchase-orders/:id/receive
 * @desc    Receive purchase order (create batches, update stock)
 * @access  Private (Admin only)
 */
router.post('/:id/receive', roleCheck(['admin']), purchaseOrderController.receivePurchaseOrder);

/**
 * @route   PUT /api/purchase-orders/:id/status
 * @desc    Update purchase order status
 * @access  Private (Admin only)
 */
router.put('/:id/status', roleCheck(['admin']), purchaseOrderController.updatePurchaseOrderStatus);

module.exports = router;
