const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employeeController');
const authMiddleware = require('../middleware/authMiddleware');
const roleCheck = require('../middleware/roleCheck');

// All routes require authentication
router.use(authMiddleware);

// Get all employees (with pagination/search/filter)
router.get('/', employeeController.getAllEmployees);

// Get single employee by ID
router.get('/:id', employeeController.getEmployeeById);

// Get employee performance (sales_ref only)
router.get('/:id/performance', employeeController.getEmployeePerformance);

// Create new employee (admin only)
router.post('/', roleCheck(['admin']), employeeController.createEmployee);

// Update employee (admin only)
router.put('/:id', roleCheck(['admin']), employeeController.updateEmployee);

// Soft delete employee (admin only)
router.delete('/:id', roleCheck(['admin']), employeeController.deleteEmployee);

module.exports = router;
