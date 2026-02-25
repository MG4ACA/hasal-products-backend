const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');
const authMiddleware = require('../middleware/authMiddleware');
const roleCheck = require('../middleware/roleCheck');

// All routes require authentication
router.use(authMiddleware);

// Phase 2: Return validation - Purchase history (before :id route)
router.get('/purchase-history', salesController.getPurchaseHistory);

// Get all sales invoices (with pagination/search/filter)
router.get('/', salesController.getAllInvoices);

// Get single invoice by ID with items
router.get('/:id', salesController.getInvoiceById);

// Create new sales invoice (cashier/admin)
router.post('/', roleCheck(['admin', 'cashier']), salesController.createInvoice);

// Update sales invoice (any authenticated user)
router.put('/:id', salesController.updateInvoice);

// Delete sales invoice (admin only)
router.delete('/:id', roleCheck(['admin']), salesController.deleteInvoice);

// Get invoice PDF (future)
router.get('/:id/pdf', salesController.getInvoicePDF);

// Profit routes
router.get('/:invoiceId/profit', salesController.getSaleProfit);
router.get('/profit-summary', salesController.getDailyMonthlyProfitSummary);

module.exports = router;
