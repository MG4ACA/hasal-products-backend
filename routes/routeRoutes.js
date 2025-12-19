const express = require('express');
const router = express.Router();
const routeController = require('../controllers/routeController');
const authMiddleware = require('../middleware/authMiddleware');
const roleCheck = require('../middleware/roleCheck');

// All routes require authentication
router.use(authMiddleware);

// Get all routes (with pagination/search)
router.get('/', routeController.getAllRoutes);

// Get single route by ID
router.get('/:id', routeController.getRouteById);

// Get route outlets
router.get('/:id/outlets', routeController.getRouteOutlets);

// Get route employees
router.get('/:id/employees', routeController.getRouteEmployees);

// Create new route (admin only)
router.post('/', roleCheck(['admin']), routeController.createRoute);

// Update route (admin only)
router.put('/:id', roleCheck(['admin']), routeController.updateRoute);

// Delete route (admin only)
router.delete('/:id', roleCheck(['admin']), routeController.deleteRoute);

module.exports = router;
