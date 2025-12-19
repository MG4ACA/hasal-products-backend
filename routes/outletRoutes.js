const express = require('express');
const router = express.Router();
const outletController = require('../controllers/outletController');
const paymentController = require('../controllers/paymentController');
const authMiddleware = require('../middleware/authMiddleware');
const roleCheck = require('../middleware/roleCheck');

// All routes require authentication
router.use(authMiddleware);

// Get all outlets (with pagination/search/filter)
router.get('/', outletController.getAllOutlets);

// Get single outlet by ID
router.get('/:id', outletController.getOutletById);

// Get outlet balance
router.get('/:id/balance', outletController.getOutletBalance);

// Get outlet invoices
router.get('/:id/invoices', outletController.getOutletInvoices);

// Get outlet payments
router.get('/:id/payments', outletController.getOutletPayments);

// Get outstanding invoices for outlet
router.get(
  '/:outlet_id/outstanding-invoices',
  roleCheck(['admin', 'manager', 'accountant']),
  paymentController.getOutstandingInvoices
);

// Create new outlet (admin only)
router.post('/', roleCheck(['admin']), outletController.createOutlet);

// Update outlet (admin only)
router.put('/:id', roleCheck(['admin']), outletController.updateOutlet);

// Delete outlet (admin only)
router.delete('/:id', roleCheck(['admin']), outletController.deleteOutlet);

module.exports = router;
