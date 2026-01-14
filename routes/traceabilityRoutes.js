const express = require('express');
const router = express.Router();
const traceabilityController = require('../controllers/traceabilityController');
const authMiddleware = require('../middleware/authMiddleware');
const roleCheck = require('../middleware/roleCheck');

// All traceability endpoints require authentication
router.use(authMiddleware);

/**
 * GET /api/batches/materials/:materialId/returns-summary
 * Get returns summary for a material
 * IMPORTANT: This must come before /:id routes to avoid collision with :id parameter
 */
router.get(
  '/materials/:materialId/returns-summary',
  traceabilityController.getMaterialReturnsSummary
);

/**
 * GET /api/batches/:id/genealogy
 * Get full batch genealogy including all returns
 */
router.get('/:id/genealogy', traceabilityController.getBatchGenealogy);

/**
 * GET /api/batches/:id/origin
 * Trace a return batch back to its source receipt batch
 */
router.get('/:id/origin', traceabilityController.getReturnOrigin);

module.exports = router;
