const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplierController');
const supplierPaymentController = require('../controllers/supplierPaymentController');
const authMiddleware = require('../middleware/authMiddleware');
const roleCheck = require('../middleware/roleCheck');

// All routes require authentication
router.use(authMiddleware);

// GET /api/suppliers - Get all suppliers (admin & cashier can view)
router.get('/', supplierController.getAllSuppliers);

// GET /api/suppliers/:id - Get supplier by ID
router.get('/:id', supplierController.getSupplierById);

// GET /api/suppliers/:id/balance - Get supplier balance
router.get('/:id/balance', supplierController.getSupplierBalance);

// GET /api/suppliers/:id/purchase-orders - Get purchase orders for supplier
router.get('/:id/purchase-orders', supplierController.getSupplierPurchaseOrders);

// GET /api/suppliers/:id/payments/summary - Get payment summary for supplier (must be before /:id/payments)
router.get(
  '/:id/payments/summary',
  roleCheck(['admin', 'manager', 'accountant']),
  supplierPaymentController.getSupplierPaymentSummary
);

// GET /api/suppliers/:id/payments - Get payments for specific supplier
router.get(
  '/:id/payments',
  roleCheck(['admin', 'manager', 'accountant']),
  supplierPaymentController.getSupplierPayments
);

// POST /api/suppliers - Create supplier (admin only)
router.post('/', roleCheck(['admin']), supplierController.createSupplier);

// POST /api/suppliers/:id/payments - Create supplier payment
router.post(
  '/:id/payments',
  roleCheck(['admin', 'manager', 'accountant']),
  supplierPaymentController.createSupplierPayment
);

// PUT /api/suppliers/:id/payments/:paymentId - Update supplier payment (check clearance)
router.put(
  '/:id/payments/:paymentId',
  roleCheck(['admin', 'manager', 'accountant']),
  supplierPaymentController.updatePayment
);

// DELETE /api/suppliers/:id/payments/:paymentId - Delete supplier payment
router.delete(
  '/:id/payments/:paymentId',
  roleCheck(['admin', 'manager']),
  supplierPaymentController.deletePayment
);

// PUT /api/suppliers/:id - Update supplier (admin only)
router.put('/:id', roleCheck(['admin']), supplierController.updateSupplier);

// DELETE /api/suppliers/:id - Delete supplier (admin only)
router.delete('/:id', roleCheck(['admin']), supplierController.deleteSupplier);

module.exports = router;
