const express = require('express');
const router = express.Router();
const vehicleController = require('../controllers/vehicleController');
const authMiddleware = require('../middleware/authMiddleware');
const roleCheck = require('../middleware/roleCheck');

// All routes require authentication
router.use(authMiddleware);

// Get all vehicles (with pagination/search)
router.get('/', vehicleController.getAllVehicles);

// Get single vehicle by ID
router.get('/:id', vehicleController.getVehicleById);

// Get vehicle assignment history
router.get('/:id/history', vehicleController.getVehicleAssignmentHistory);

// Create new vehicle (admin only)
router.post('/', roleCheck(['admin']), vehicleController.createVehicle);

// Assign vehicle to route (admin only)
router.post('/:id/assign', roleCheck(['admin']), vehicleController.assignVehicleToRoute);

// Unassign vehicle from route (admin only)
router.post('/:id/unassign', roleCheck(['admin']), vehicleController.unassignVehicleFromRoute);

// Update vehicle (admin only)
router.put('/:id', roleCheck(['admin']), vehicleController.updateVehicle);

// Delete vehicle (admin only)
router.delete('/:id', roleCheck(['admin']), vehicleController.deleteVehicle);

module.exports = router;
