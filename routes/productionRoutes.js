const express = require('express');
const router = express.Router();
const productionController = require('../controllers/productionController');
const authMiddleware = require('../middleware/authMiddleware');
const roleCheck = require('../middleware/roleCheck');

// All routes require authentication
router.use(authMiddleware);

// Production run routes
router.get('/', productionController.getAllProductionRuns);
router.get('/:id', productionController.getProductionRunById);
router.post(
  '/',
  roleCheck(['admin', 'manager', 'production']),
  productionController.createProductionRun
);
router.put(
  '/:id',
  roleCheck(['admin', 'manager', 'production']),
  productionController.updateProductionRun
);
router.delete('/:id', roleCheck(['admin']), productionController.deleteProductionRun);

// Complete production run
router.post(
  '/:id/complete',
  roleCheck(['admin', 'manager', 'production']),
  productionController.completeProductionRun
);

// Check material availability
router.get('/:id/check-materials', productionController.checkMaterialAvailability);

// Waste and efficiency reports
router.get('/waste-cost-report', productionController.getWasteCostReport);
router.get('/efficiency-report', productionController.getEfficiencyReport);

module.exports = router;
