const express = require('express');
const batchController = require('../controllers/batchController');
const authMiddleware = require('../middleware/authMiddleware');
const roleCheck = require('../middleware/roleCheck');

const router = express.Router();

// All batch routes require authentication
router.use(authMiddleware);

/**
 * POST /api/raw-material-batches/:id/approve-inspection
 * Approve or reject QC inspection for a batch
 * Roles: admin
 */
router.post('/:id/approve-inspection', roleCheck('admin'), batchController.approveInspection);

/**
 * POST /api/raw-material-batches/:id/reject-inspection
 * Reject batch during inspection
 * Roles: admin
 */
router.post('/:id/reject-inspection', roleCheck('admin'), batchController.rejectInspection);

/**
 * GET /api/raw-material-batches/:id
 * Get batch details
 */
router.get('/:id', batchController.getBatchById);

/**
 * GET /api/raw-material-batches/material/:materialId
 * Get all batches for a material
 */
router.get('/material/:materialId', batchController.getBatchesByMaterial);

/**
 * GET /api/raw-material-batches/inspection/pending
 * Get pending inspection batches (QC queue)
 */
router.get('/inspection/pending', batchController.getPendingInspectionBatches);

module.exports = router;
