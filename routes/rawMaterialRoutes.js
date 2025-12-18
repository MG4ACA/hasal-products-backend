const express = require('express');
const router = express.Router();
const rawMaterialController = require('../controllers/rawMaterialController');
const authMiddleware = require('../middleware/authMiddleware');
const roleCheck = require('../middleware/roleCheck');

// All routes require authentication
router.use(authMiddleware);

// GET /api/raw-materials - Get all raw materials
router.get('/', rawMaterialController.getAllRawMaterials);

// GET /api/raw-materials/:id - Get raw material by ID
router.get('/:id', rawMaterialController.getRawMaterialById);

// GET /api/raw-materials/:id/batches - Get batches for material
router.get('/:id/batches', rawMaterialController.getRawMaterialBatches);

// GET /api/raw-materials/:id/stock - Get current stock level
router.get('/:id/stock', rawMaterialController.getRawMaterialStock);

// POST /api/raw-materials - Create raw material (admin only)
router.post('/', roleCheck('admin'), rawMaterialController.createRawMaterial);

// PUT /api/raw-materials/:id - Update raw material (admin only)
router.put('/:id', roleCheck('admin'), rawMaterialController.updateRawMaterial);

// DELETE /api/raw-materials/:id - Delete raw material (admin only)
router.delete('/:id', roleCheck('admin'), rawMaterialController.deleteRawMaterial);

module.exports = router;
