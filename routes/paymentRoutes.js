const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const authMiddleware = require('../middleware/authMiddleware');
const roleCheck = require('../middleware/roleCheck');

// All routes require authentication
router.use(authMiddleware);

// GET /api/payments - Get all payments with filters
router.get('/', roleCheck(['admin', 'manager', 'accountant']), paymentController.getAllPayments);

// GET /api/payments/pending-checks - Get pending checks
router.get(
  '/pending-checks',
  roleCheck(['admin', 'manager', 'accountant']),
  paymentController.getPendingChecks
);

// GET /api/payments/:id - Get payment by ID
router.get('/:id', roleCheck(['admin', 'manager', 'accountant']), paymentController.getPaymentById);

// POST /api/payments - Create new payment
router.post('/', roleCheck(['admin', 'manager', 'accountant']), paymentController.createPayment);

// PUT /api/payments/:id - Update payment (clearance date)
router.put('/:id', roleCheck(['admin', 'manager', 'accountant']), paymentController.updatePayment);

// DELETE /api/payments/:id - Delete payment
router.delete('/:id', roleCheck(['admin', 'manager']), paymentController.deletePayment);

module.exports = router;
