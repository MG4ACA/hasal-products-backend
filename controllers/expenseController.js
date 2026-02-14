const { Expense, Vehicle, Route, User } = require('../models');
const { Op } = require('sequelize');
const { successResponse, errorResponse } = require('../utils/response');

/**
 * Get all expenses with filters and pagination
 * GET /api/expenses
 */
exports.getAllExpenses = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      vehicle_id,
      route_id,
      date_from,
      date_to,
      search,
    } = req.query;

    const offset = (page - 1) * limit;
    const where = {};

    // Apply filters
    if (category) where.category = category;
    if (vehicle_id) where.vehicle_id = vehicle_id;
    if (route_id) where.route_id = route_id;

    // Date range filter
    if (date_from || date_to) {
      where.expense_date = {};
      if (date_from) where.expense_date[Op.gte] = date_from;
      if (date_to) where.expense_date[Op.lte] = date_to;
    }

    // Search in description
    if (search) {
      where.description = { [Op.like]: `%${search}%` };
    }

    const { count, rows } = await Expense.findAndCountAll({
      where,
      distinct: true,
      include: [
        {
          model: Vehicle,
          as: 'vehicle',
          attributes: ['id', 'code', 'name', 'registration_number'],
        },
        {
          model: Route,
          as: 'route',
          attributes: ['id', 'code', 'name'],
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'full_name'],
        },
      ],
      order: [
        ['expense_date', 'DESC'],
        ['created_at', 'DESC'],
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    return successResponse(res, {
      expenses: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching expenses:', error);
    return errorResponse(res, 'Failed to fetch expenses', 500);
  }
};

/**
 * Get expense by ID
 * GET /api/expenses/:id
 */
exports.getExpenseById = async (req, res) => {
  try {
    const { id } = req.params;

    const expense = await Expense.findByPk(id, {
      include: [
        {
          model: Vehicle,
          as: 'vehicle',
          attributes: ['id', 'code', 'name', 'registration_number'],
        },
        {
          model: Route,
          as: 'route',
          attributes: ['id', 'code', 'name'],
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'full_name'],
        },
      ],
    });

    if (!expense) {
      return errorResponse(res, 'Expense not found', 404);
    }

    return successResponse(res, expense);
  } catch (error) {
    console.error('Error fetching expense:', error);
    return errorResponse(res, 'Failed to fetch expense', 500);
  }
};

/**
 * Create new expense
 * POST /api/expenses
 */
exports.createExpense = async (req, res) => {
  try {
    const { expense_date, category, amount, description, vehicle_id, route_id, distance_km } =
      req.body;

    // Validation
    if (!expense_date || !category || !amount) {
      return errorResponse(res, 'Missing required fields', 400);
    }

    if (amount <= 0) {
      return errorResponse(res, 'Amount must be greater than 0', 400);
    }

    // Vehicle-specific validation
    if (category === 'vehicle_fuel' || category === 'vehicle_repair') {
      if (!vehicle_id) {
        return errorResponse(res, 'Vehicle is required for vehicle-related expenses', 400);
      }

      // Check if vehicle exists
      const vehicle = await Vehicle.findByPk(vehicle_id);
      if (!vehicle) {
        return errorResponse(res, 'Vehicle not found', 404);
      }
    }

    // Route validation
    if (route_id) {
      const route = await Route.findByPk(route_id);
      if (!route) {
        return errorResponse(res, 'Route not found', 404);
      }
    }

    const expense = await Expense.create({
      expense_date,
      category,
      amount,
      description,
      vehicle_id: vehicle_id || null,
      route_id: route_id || null,
      distance_km: distance_km || null,
      created_by: req.user.id,
    });

    // Fetch created expense with associations
    const createdExpense = await Expense.findByPk(expense.id, {
      include: [
        { model: Vehicle, as: 'vehicle', attributes: ['id', 'code', 'name'] },
        { model: Route, as: 'route', attributes: ['id', 'code', 'name'] },
        { model: User, as: 'creator', attributes: ['id', 'username', 'full_name'] },
      ],
    });

    return successResponse(res, createdExpense, 'Expense created successfully', 201);
  } catch (error) {
    console.error('Error creating expense:', error);
    return errorResponse(res, 'Failed to create expense', 500);
  }
};

/**
 * Update expense
 * PUT /api/expenses/:id
 */
exports.updateExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const { expense_date, category, amount, description, vehicle_id, route_id, distance_km } =
      req.body;

    const expense = await Expense.findByPk(id);
    if (!expense) {
      return errorResponse(res, 'Expense not found', 404);
    }

    // Validation
    if (amount !== undefined && amount <= 0) {
      return errorResponse(res, 'Amount must be greater than 0', 400);
    }

    // Vehicle-specific validation
    if (category === 'vehicle_fuel' || category === 'vehicle_repair') {
      if (!vehicle_id) {
        return errorResponse(res, 'Vehicle is required for vehicle-related expenses', 400);
      }

      const vehicle = await Vehicle.findByPk(vehicle_id);
      if (!vehicle) {
        return errorResponse(res, 'Vehicle not found', 404);
      }
    }

    // Route validation
    if (route_id) {
      const route = await Route.findByPk(route_id);
      if (!route) {
        return errorResponse(res, 'Route not found', 404);
      }
    }

    await expense.update({
      expense_date: expense_date || expense.expense_date,
      category: category || expense.category,
      amount: amount || expense.amount,
      description: description !== undefined ? description : expense.description,
      vehicle_id: vehicle_id !== undefined ? vehicle_id : expense.vehicle_id,
      route_id: route_id !== undefined ? route_id : expense.route_id,
      distance_km: distance_km !== undefined ? distance_km : expense.distance_km,
    });

    // Fetch updated expense with associations
    const updatedExpense = await Expense.findByPk(id, {
      include: [
        { model: Vehicle, as: 'vehicle', attributes: ['id', 'code', 'name'] },
        { model: Route, as: 'route', attributes: ['id', 'code', 'name'] },
        { model: User, as: 'creator', attributes: ['id', 'username', 'full_name'] },
      ],
    });

    return successResponse(res, updatedExpense, 'Expense updated successfully');
  } catch (error) {
    console.error('Error updating expense:', error);
    return errorResponse(res, 'Failed to update expense', 500);
  }
};

/**
 * Delete expense
 * DELETE /api/expenses/:id
 */
exports.deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;

    const expense = await Expense.findByPk(id);
    if (!expense) {
      return errorResponse(res, 'Expense not found', 404);
    }

    await expense.destroy();

    return successResponse(res, null, 'Expense deleted successfully');
  } catch (error) {
    console.error('Error deleting expense:', error);
    return errorResponse(res, 'Failed to delete expense', 500);
  }
};

/**
 * Get monthly expense summary
 * GET /api/expenses/reports/monthly-summary
 */
exports.getMonthlySummary = async (req, res) => {
  try {
    const { month, year, date_from, date_to } = req.query;

    let where = {};

    // Default to current month if no parameters provided
    if (month && year) {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = new Date(year, month, 0);
      const endDateStr = endDate.toISOString().split('T')[0];
      where.expense_date = { [Op.between]: [startDate, endDateStr] };
    } else if (date_from || date_to) {
      where.expense_date = {};
      if (date_from) where.expense_date[Op.gte] = date_from;
      if (date_to) where.expense_date[Op.lte] = date_to;
    } else {
      // Default to current month
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      where.expense_date = {
        [Op.between]: [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]],
      };
    }

    // Get total expenses
    const totalExpense = await Expense.sum('amount', { where });

    // Get expenses by category
    const expensesByCategory = await Expense.findAll({
      where,
      attributes: [
        'category',
        [require('sequelize').fn('SUM', require('sequelize').col('amount')), 'total_amount'],
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count'],
      ],
      group: ['category'],
      raw: true,
    });

    // Get vehicle-related expenses
    const vehicleExpenses = await Expense.sum('amount', {
      where: {
        ...where,
        category: { [Op.in]: ['vehicle_fuel', 'vehicle_repair'] },
      },
    });

    // Get expenses by vehicle (only vehicles with expenses in the date range)
    const expensesByVehicle = await Expense.findAll({
      where: {
        ...where,
        vehicle_id: { [Op.ne]: null },
      },
      attributes: [
        'vehicle_id',
        [require('sequelize').fn('SUM', require('sequelize').col('amount')), 'total_amount'],
        [require('sequelize').fn('COUNT', require('sequelize').col('Expense.id')), 'count'],
      ],
      include: [
        {
          model: Vehicle,
          as: 'vehicle',
          attributes: ['id', 'code', 'name', 'registration_number'],
        },
      ],
      group: ['vehicle_id', 'vehicle.id'],
      raw: false,
    });

    return successResponse(res, {
      period: where.expense_date,
      summary: {
        total_expenses: parseFloat(totalExpense || 0).toFixed(2),
        vehicle_expenses: parseFloat(vehicleExpenses || 0).toFixed(2),
        non_vehicle_expenses: parseFloat((totalExpense || 0) - (vehicleExpenses || 0)).toFixed(2),
      },
      by_category: expensesByCategory.map(item => ({
        category: item.category,
        total_amount: parseFloat(item.total_amount).toFixed(2),
        count: parseInt(item.count),
      })),
      by_vehicle: expensesByVehicle.map(item => ({
        vehicle_id: item.vehicle_id,
        vehicle_name: item.vehicle ? `${item.vehicle.code} - ${item.vehicle.name}` : 'Unknown',
        vehicle_registration: item.vehicle ? item.vehicle.registration_number : null,
        total_amount: parseFloat(item.dataValues.total_amount).toFixed(2),
        count: parseInt(item.dataValues.count),
      })),
    });
  } catch (error) {
    console.error('Error generating monthly summary:', error);
    return errorResponse(res, 'Failed to generate monthly summary', 500);
  }
};

/**
 * Get expense categories (for dropdowns)
 * GET /api/expenses/categories
 */
exports.getCategories = async (req, res) => {
  try {
    const categories = [
      { value: 'vehicle_fuel', label: 'Vehicle Fuel' },
      { value: 'vehicle_repair', label: 'Vehicle Repair' },
      { value: 'utility_bills', label: 'Utility Bills' },
      { value: 'store_maintenance', label: 'Store Maintenance' },
      { value: 'equipment_repair', label: 'Equipment Repair' },
      { value: 'salaries', label: 'Salaries' },
      { value: 'rent', label: 'Rent' },
      { value: 'other', label: 'Other' },
    ];

    return successResponse(res, categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    return errorResponse(res, 'Failed to fetch categories', 500);
  }
};
