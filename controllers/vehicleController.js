const { Vehicle, Route, RouteVehicleHistory, sequelize } = require('../models');
const { successResponse, errorResponse } = require('../utils/response');
const { Op } = require('sequelize');

// Generate auto vehicle code (e.g., VH-0001)
async function generateVehicleCode() {
  const lastVehicle = await Vehicle.findOne({
    order: [['id', 'DESC']],
  });

  if (!lastVehicle) return 'VH-0001';

  const lastCode = lastVehicle.code;
  const number = parseInt(lastCode.split('-')[1]) + 1;
  return `VH-${number.toString().padStart(4, '0')}`;
}

// Get all vehicles with pagination and search
exports.getAllVehicles = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', status = '' } = req.query;
    const offset = (page - 1) * limit;

    const where = {};

    // Search by code, name, or registration_number
    if (search) {
      where[Op.or] = [
        { code: { [Op.like]: `%${search}%` } },
        { name: { [Op.like]: `%${search}%` } },
        { registration_number: { [Op.like]: `%${search}%` } },
      ];
    }

    // Filter by status
    if (status) {
      where.status = status;
    }

    const { count, rows } = await Vehicle.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['id', 'DESC']],
    });

    // Get current assignment for each vehicle
    const vehiclesWithAssignment = await Promise.all(
      rows.map(async vehicle => {
        const currentAssignment = await RouteVehicleHistory.findOne({
          where: {
            vehicle_id: vehicle.id,
            is_current: true,
          },
          include: [{ model: Route, as: 'route', attributes: ['id', 'code', 'name'] }],
        });

        return {
          ...vehicle.toJSON(),
          currentAssignment: currentAssignment || null,
        };
      })
    );

    return successResponse(res, {
      vehicles: vehiclesWithAssignment,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit),
      },
    });
  } catch (err) {
    console.error('Error getting vehicles:', err);
    return errorResponse(res, 'Failed to fetch vehicles', 500);
  }
};

// Get single vehicle by ID
exports.getVehicleById = async (req, res) => {
  try {
    const { id } = req.params;

    const vehicle = await Vehicle.findByPk(id);

    if (!vehicle) {
      return errorResponse(res, 'Vehicle not found', 404);
    }

    // Get current assignment
    const currentAssignment = await RouteVehicleHistory.findOne({
      where: {
        vehicle_id: id,
        is_current: true,
      },
      include: [{ model: Route, as: 'route', attributes: ['id', 'code', 'name'] }],
    });

    return successResponse(res, {
      ...vehicle.toJSON(),
      currentAssignment: currentAssignment || null,
    });
  } catch (err) {
    console.error('Error getting vehicle:', err);
    return errorResponse(res, 'Failed to fetch vehicle', 500);
  }
};

// Create new vehicle
exports.createVehicle = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { name, registration_number, status } = req.body;

    // Validation
    if (!name) {
      await transaction.rollback();
      return errorResponse(res, 'Vehicle name is required', 400);
    }

    // Generate vehicle code
    const code = await generateVehicleCode();

    const vehicle = await Vehicle.create(
      {
        code,
        name,
        registration_number,
        status: status || 'active',
      },
      { transaction }
    );

    await transaction.commit();

    return successResponse(res, vehicle, 'Vehicle created successfully', 201);
  } catch (err) {
    await transaction.rollback();
    console.error('Error creating vehicle:', err);
    return errorResponse(res, 'Failed to create vehicle', 500);
  }
};

// Update vehicle
exports.updateVehicle = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { name, registration_number, status } = req.body;

    const vehicle = await Vehicle.findByPk(id);

    if (!vehicle) {
      await transaction.rollback();
      return errorResponse(res, 'Vehicle not found', 404);
    }

    // Update fields
    if (name) vehicle.name = name;
    if (registration_number !== undefined) vehicle.registration_number = registration_number;
    if (status) vehicle.status = status;

    await vehicle.save({ transaction });

    await transaction.commit();

    return successResponse(res, vehicle, 'Vehicle updated successfully');
  } catch (err) {
    await transaction.rollback();
    console.error('Error updating vehicle:', err);
    return errorResponse(res, 'Failed to update vehicle', 500);
  }
};

// Delete vehicle
exports.deleteVehicle = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;

    const vehicle = await Vehicle.findByPk(id);

    if (!vehicle) {
      await transaction.rollback();
      return errorResponse(res, 'Vehicle not found', 404);
    }

    // Check if vehicle has current assignment
    const currentAssignment = await RouteVehicleHistory.findOne({
      where: {
        vehicle_id: id,
        is_current: true,
      },
    });

    if (currentAssignment) {
      await transaction.rollback();
      return errorResponse(res, 'Cannot delete vehicle with active route assignment', 400);
    }

    await vehicle.destroy({ transaction });

    await transaction.commit();

    return successResponse(res, { message: 'Vehicle deleted successfully' });
  } catch (err) {
    await transaction.rollback();
    console.error('Error deleting vehicle:', err);
    return errorResponse(res, 'Failed to delete vehicle', 500);
  }
};

// Assign vehicle to route
exports.assignVehicleToRoute = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params; // vehicle_id
    const { route_id, assigned_date } = req.body;

    // Validation
    if (!route_id) {
      await transaction.rollback();
      return errorResponse(res, 'Route ID is required', 400);
    }

    // Check if vehicle exists
    const vehicle = await Vehicle.findByPk(id);
    if (!vehicle) {
      await transaction.rollback();
      return errorResponse(res, 'Vehicle not found', 404);
    }

    // Check if route exists
    const route = await Route.findByPk(route_id);
    if (!route) {
      await transaction.rollback();
      return errorResponse(res, 'Route not found', 404);
    }

    // Check if vehicle already has current assignment
    const currentAssignment = await RouteVehicleHistory.findOne({
      where: {
        vehicle_id: id,
        is_current: true,
      },
    });

    if (currentAssignment) {
      await transaction.rollback();
      return errorResponse(
        res,
        'Vehicle already assigned to a route. Unassign first before reassigning.',
        400
      );
    }

    // Check if route already has a vehicle assigned
    const routeCurrentVehicle = await RouteVehicleHistory.findOne({
      where: {
        route_id,
        is_current: true,
      },
    });

    if (routeCurrentVehicle) {
      await transaction.rollback();
      return errorResponse(res, 'Route already has a vehicle assigned', 400);
    }

    // Create assignment
    const assignment = await RouteVehicleHistory.create(
      {
        route_id,
        vehicle_id: id,
        assigned_date: assigned_date || new Date().toISOString().split('T')[0],
        is_current: true,
      },
      { transaction }
    );

    await transaction.commit();

    // Fetch complete assignment info
    const newAssignment = await RouteVehicleHistory.findByPk(assignment.id, {
      include: [
        { model: Route, as: 'route', attributes: ['id', 'code', 'name'] },
        { model: Vehicle, as: 'vehicle', attributes: ['id', 'code', 'name'] },
      ],
    });

    return successResponse(res, newAssignment, 'Vehicle assigned to route successfully', 201);
  } catch (err) {
    await transaction.rollback();
    console.error('Error assigning vehicle:', err);
    return errorResponse(res, 'Failed to assign vehicle to route', 500);
  }
};

// Unassign vehicle from route
exports.unassignVehicleFromRoute = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params; // vehicle_id
    const { unassigned_date } = req.body;

    // Check if vehicle exists
    const vehicle = await Vehicle.findByPk(id);
    if (!vehicle) {
      await transaction.rollback();
      return errorResponse(res, 'Vehicle not found', 404);
    }

    // Find current assignment
    const currentAssignment = await RouteVehicleHistory.findOne({
      where: {
        vehicle_id: id,
        is_current: true,
      },
    });

    if (!currentAssignment) {
      await transaction.rollback();
      return errorResponse(res, 'Vehicle is not currently assigned to any route', 400);
    }

    // Update assignment
    currentAssignment.is_current = false;
    currentAssignment.unassigned_date = unassigned_date || new Date().toISOString().split('T')[0];
    await currentAssignment.save({ transaction });

    await transaction.commit();

    // Fetch complete assignment info
    const updatedAssignment = await RouteVehicleHistory.findByPk(currentAssignment.id, {
      include: [
        { model: Route, as: 'route', attributes: ['id', 'code', 'name'] },
        { model: Vehicle, as: 'vehicle', attributes: ['id', 'code', 'name'] },
      ],
    });

    return successResponse(res, updatedAssignment, 'Vehicle unassigned from route successfully');
  } catch (err) {
    await transaction.rollback();
    console.error('Error unassigning vehicle:', err);
    return errorResponse(res, 'Failed to unassign vehicle from route', 500);
  }
};

// Get vehicle assignment history
exports.getVehicleAssignmentHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const vehicle = await Vehicle.findByPk(id);
    if (!vehicle) {
      return errorResponse(res, 'Vehicle not found', 404);
    }

    const { count, rows } = await RouteVehicleHistory.findAndCountAll({
      where: { vehicle_id: id },
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['assigned_date', 'DESC']],
      include: [{ model: Route, as: 'route', attributes: ['id', 'code', 'name'] }],
    });

    return successResponse(res, {
      history: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit),
      },
    });
  } catch (err) {
    console.error('Error getting vehicle assignment history:', err);
    return errorResponse(res, 'Failed to fetch vehicle assignment history', 500);
  }
};
