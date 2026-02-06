const { Route, Outlet, Employee, sequelize } = require('../models');
const { successResponse, errorResponse } = require('../utils/response');
const { Op } = require('sequelize');

// Generate auto route code (e.g., RT-0001)
async function generateRouteCode() {
  const lastRoute = await Route.findOne({
    order: [['id', 'DESC']],
  });

  if (!lastRoute) return 'RT-0001';

  const lastCode = lastRoute.code;
  const number = parseInt(lastCode.split('-')[1]) + 1;
  return `RT-${number.toString().padStart(4, '0')}`;
}

// Get all routes with pagination and search
exports.getAllRoutes = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', status = '' } = req.query;
    const offset = (page - 1) * limit;

    const where = {};

    // Search by code or name
    if (search) {
      where[Op.or] = [
        { code: { [Op.like]: `%${search}%` } },
        { name: { [Op.like]: `%${search}%` } },
      ];
    }

    // Filter by status
    if (status) {
      where.status = status;
    }

    const { count, rows } = await Route.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['id', 'DESC']],
      include: [
        {
          model: Outlet,
          as: 'outlets',
          attributes: ['id', 'code', 'name', 'status'],
        },
        {
          model: Employee,
          as: 'salesRep',
          attributes: ['id', 'code', 'name', 'type', 'status'],
        },
      ],
    });

    return successResponse(res, {
      routes: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit),
      },
    });
  } catch (err) {
    console.error('Error getting routes:', err);
    return errorResponse(res, 'Failed to fetch routes', 500);
  }
};

// Get single route by ID
exports.getRouteById = async (req, res) => {
  try {
    const { id } = req.params;

    const route = await Route.findByPk(id, {
      include: [
        {
          model: Outlet,
          as: 'outlets',
          attributes: ['id', 'code', 'name', 'owner_name', 'phone', 'address', 'status'],
        },
        {
          model: Employee,
          as: 'salesRep',
          attributes: ['id', 'code', 'name', 'type', 'phone', 'status'],
        },
      ],
    });

    if (!route) {
      return errorResponse(res, 'Route not found', 404);
    }

    return successResponse(res, route);
  } catch (err) {
    console.error('Error getting route:', err);
    return errorResponse(res, 'Failed to fetch route', 500);
  }
};

// Create new route
exports.createRoute = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { name, description, status, territory_length, sales_ref_id } = req.body;

    // Validation
    if (!name) {
      await transaction.rollback();
      return errorResponse(res, 'Route name is required', 400);
    }

    if (!sales_ref_id) {
      await transaction.rollback();
      return errorResponse(res, 'Sales representative is required', 400);
    }

    // Verify sales rep exists and is a sales_ref type
    const salesRep = await Employee.findByPk(sales_ref_id);
    if (!salesRep) {
      await transaction.rollback();
      return errorResponse(res, 'Sales representative not found', 404);
    }

    if (salesRep.type !== 'sales_ref') {
      await transaction.rollback();
      return errorResponse(res, 'Selected employee must be a sales representative', 400);
    }

    if (salesRep.status !== 'active') {
      await transaction.rollback();
      return errorResponse(res, 'Sales representative must be active', 400);
    }

    // Validate territory_length if provided
    if (territory_length !== undefined && territory_length !== null) {
      const length = parseFloat(territory_length);
      if (isNaN(length) || length < 0 || length > 150) {
        await transaction.rollback();
        return errorResponse(res, 'Territory length must be between 0 and 150 km', 400);
      }
    }

    // Generate route code
    const code = await generateRouteCode();

    const route = await Route.create(
      {
        code,
        name,
        description,
        status: status || 'active',
        territory_length: territory_length ? parseFloat(territory_length) : null,
        sales_ref_id,
      },
      { transaction }
    );

    await transaction.commit();

    return successResponse(res, route, 'Route created successfully', 201);
  } catch (err) {
    await transaction.rollback();
    console.error('Error creating route:', err);
    return errorResponse(res, 'Failed to create route', 500);
  }
};

// Update route
exports.updateRoute = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { name, description, status, territory_length, sales_ref_id } = req.body;

    const route = await Route.findByPk(id);

    if (!route) {
      await transaction.rollback();
      return errorResponse(res, 'Route not found', 404);
    }

    // Validate sales_ref_id if provided
    if (sales_ref_id !== undefined) {
      if (!sales_ref_id) {
        await transaction.rollback();
        return errorResponse(res, 'Sales representative is required', 400);
      }

      const salesRep = await Employee.findByPk(sales_ref_id);
      if (!salesRep) {
        await transaction.rollback();
        return errorResponse(res, 'Sales representative not found', 404);
      }

      if (salesRep.type !== 'sales_ref') {
        await transaction.rollback();
        return errorResponse(res, 'Selected employee must be a sales representative', 400);
      }

      if (salesRep.status !== 'active') {
        await transaction.rollback();
        return errorResponse(res, 'Sales representative must be active', 400);
      }
    }

    // Validate territory_length if provided
    if (territory_length !== undefined && territory_length !== null) {
      const length = parseFloat(territory_length);
      if (isNaN(length) || length < 0 || length > 150) {
        await transaction.rollback();
        return errorResponse(res, 'Territory length must be between 0 and 150 km', 400);
      }
    }

    // Update fields
    if (name) route.name = name;
    if (description !== undefined) route.description = description;
    if (status) route.status = status;
    if (territory_length !== undefined)
      route.territory_length = territory_length ? parseFloat(territory_length) : null;
    if (sales_ref_id !== undefined) route.sales_ref_id = sales_ref_id;

    await route.save({ transaction });

    await transaction.commit();

    return successResponse(res, route, 'Route updated successfully');
  } catch (err) {
    await transaction.rollback();
    console.error('Error updating route:', err);
    return errorResponse(res, 'Failed to update route', 500);
  }
};

// Delete route
exports.deleteRoute = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;

    const route = await Route.findByPk(id, {
      include: [
        { model: Outlet, as: 'outlets' },
        { model: Employee, as: 'salesRep' },
      ],
    });

    if (!route) {
      await transaction.rollback();
      return errorResponse(res, 'Route not found', 404);
    }

    // Check if route has outlets or employees
    if (route.outlets && route.outlets.length > 0) {
      await transaction.rollback();
      return errorResponse(res, 'Cannot delete route with existing outlets', 400);
    }

    if (route.employees && route.employees.length > 0) {
      await transaction.rollback();
      return errorResponse(res, 'Cannot delete route with assigned employees', 400);
    }

    await route.destroy({ transaction });

    await transaction.commit();

    return successResponse(res, { message: 'Route deleted successfully' });
  } catch (err) {
    await transaction.rollback();
    console.error('Error deleting route:', err);
    return errorResponse(res, 'Failed to delete route', 500);
  }
};

// Get route outlets
exports.getRouteOutlets = async (req, res) => {
  try {
    const { id } = req.params;

    const route = await Route.findByPk(id);

    if (!route) {
      return errorResponse(res, 'Route not found', 404);
    }

    const outlets = await Outlet.findAll({
      where: { route_id: id },
      order: [['name', 'ASC']],
    });

    return successResponse(res, outlets);
  } catch (err) {
    console.error('Error getting route outlets:', err);
    return errorResponse(res, 'Failed to fetch route outlets', 500);
  }
};

// Get route employees
exports.getRouteEmployees = async (req, res) => {
  try {
    const { id } = req.params;

    const route = await Route.findByPk(id);

    if (!route) {
      return errorResponse(res, 'Route not found', 404);
    }

    const employees = await Employee.findAll({
      where: { assigned_route_id: id },
      order: [['name', 'ASC']],
    });

    return successResponse(res, employees);
  } catch (err) {
    console.error('Error getting route employees:', err);
    return errorResponse(res, 'Failed to fetch route employees', 500);
  }
};
