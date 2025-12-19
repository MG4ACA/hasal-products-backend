const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplierController');
const authMiddleware = require('../middleware/authMiddleware');
const roleCheck = require('../middleware/roleCheck');

// All routes require authentication
router.use(authMiddleware);

// GET /api/suppliers - Get all suppliers (admin & cashier can view)
router.get('/', supplierController.getAllSuppliers);

// GET /api/suppliers/payments - Get all supplier payments
router.get(
  '/payments',
  roleCheck('admin', 'manager', 'accountant'),
  supplierController.getAllSupplierPayments
);

// GET /api/suppliers/:id - Get supplier by ID
router.get('/:id', supplierController.getSupplierById);

// GET /api/suppliers/:id/balance - Get supplier balance
router.get('/:id/balance', supplierController.getSupplierBalance);

// GET /api/suppliers/:id/payments - Get payments for specific supplier
router.get(
  '/:id/payments',
  roleCheck('admin', 'manager', 'accountant'),
  supplierController.getSupplierPayments
);

// POST /api/suppliers - Create supplier (admin only)
router.post('/', roleCheck('admin'), supplierController.createSupplier);

// POST /api/suppliers/:id/payments - Create supplier payment
router.post(
  '/:id/payments',
  roleCheck('admin', 'manager', 'accountant'),
  supplierController.createSupplierPayment
);

// PUT /api/suppliers/:id - Update supplier (admin only)
router.put('/:id', roleCheck('admin'), supplierController.updateSupplier);

// DELETE /api/suppliers/:id - Delete supplier (admin only)
router.delete('/:id', roleCheck('admin'), supplierController.deleteSupplier);

module.exports = router;
