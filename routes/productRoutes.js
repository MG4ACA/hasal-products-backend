const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const authMiddleware = require('../middleware/authMiddleware');
const roleCheck = require('../middleware/roleCheck');

// All routes require authentication
router.use(authMiddleware);

// Product routes
router.get('/', productController.getAllProducts);
router.get('/:id', productController.getProductById);
router.post('/', roleCheck(['admin', 'manager']), productController.createProduct);
router.put('/:id', roleCheck(['admin', 'manager']), productController.updateProduct);
router.delete('/:id', roleCheck(['admin']), productController.deleteProduct);

// SKU routes
router.post('/:id/skus', roleCheck(['admin', 'manager']), productController.addSku);
router.put('/:productId/skus/:skuId', roleCheck(['admin', 'manager']), productController.updateSku);
router.delete('/:productId/skus/:skuId', roleCheck(['admin']), productController.deleteSku);

// Stock routes
router.get('/:id/stock', productController.getProductStock);

// Profit routes
router.get('/profit-summary', productController.getProfitSummary);
router.get('/:productId/skus/:skuId/profit', productController.getSkuProfit);

module.exports = router;
