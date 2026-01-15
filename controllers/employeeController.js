const { Employee, Route, SalesInvoice, sequelize } = require('../models');
const { successResponse, errorResponse } = require('../utils/response');
const { Op } = require('sequelize');

// Generate auto employee code (e.g., EMP-0001)
async function generateEmployeeCode() {
  const lastEmployee = await Employee.findOne({
    order: [['id', 'DESC']],
  });

  if (!lastEmployee) return 'EMP-0001';

  const lastCode = lastEmployee.code;
  const number = parseInt(lastCode.split('-')[1]) + 1;
  return `EMP-${number.toString().padStart(4, '0')}`;
}

// Get all employees with pagination and search
exports.getAllEmployees = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', status = '', type = '', route_id = '' } = req.query;
    const offset = (page - 1) * limit;

    const where = {};

    // Search by code, name, phone, or email
    if (search) {
      where[Op.or] = [
        { code: { [Op.like]: `%${search}%` } },
        { name: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }

    // Filter by status
    if (status) {
      where.status = status;
    }

    // Filter by type
    if (type) {
      where.type = type;
    }

    // Filter by assigned route
    if (route_id) {
      where.assigned_route_id = route_id;
    }

    const { count, rows } = await Employee.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['id', 'DESC']],
      include: [
        {
          model: Route,
          as: 'assignedRoute',
          attributes: ['id', 'code', 'name', 'status'],
        },
      ],
    });

    return successResponse(res, {
      employees: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit),
      },
    });
  } catch (err) {
    console.error('Error getting employees:', err);
    return errorResponse(res, 'Failed to fetch employees', 500);
  }
};

// Get single employee by ID
exports.getEmployeeById = async (req, res) => {
  try {
    const { id } = req.params;

    const employee = await Employee.findByPk(id, {
      include: [
        {
          model: Route,
          as: 'assignedRoute',
          attributes: ['id', 'code', 'name', 'status'],
        },
      ],
    });

    if (!employee) {
      return errorResponse(res, 'Employee not found', 404);
    }

    return successResponse(res, employee);
  } catch (err) {
    console.error('Error getting employee:', err);
    return errorResponse(res, 'Failed to fetch employee', 500);
  }
};

// Create new employee
exports.createEmployee = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { name, type, phone, email, assigned_route_id, status } = req.body;

    // Validation
    if (!name) {
      await transaction.rollback();
      return errorResponse(res, 'Employee name is required', 400);
    }

    if (!type) {
      await transaction.rollback();
      return errorResponse(res, 'Employee type is required', 400);
    }

    // Validate type
    const validTypes = ['sales_ref', 'driver', 'warehouse', 'other'];
    if (!validTypes.includes(type)) {
      await transaction.rollback();
      return errorResponse(res, `Employee type must be one of: ${validTypes.join(', ')}`, 400);
    }

    // Generate employee code
    const code = await generateEmployeeCode();

    const employee = await Employee.create(
      {
        code,
        name,
        type,
        phone,
        email,
        assigned_route_id,
        status: status || 'active',
      },
      { transaction }
    );

    await transaction.commit();

    // Fetch with route
    const newEmployee = await Employee.findByPk(employee.id, {
      include: [{ model: Route, as: 'assignedRoute', attributes: ['id', 'code', 'name'] }],
    });

    return successResponse(res, newEmployee, 'Employee created successfully', 201);
  } catch (err) {
    await transaction.rollback();
    console.error('Error creating employee:', err);
    return errorResponse(res, 'Failed to create employee', 500);
  }
};

// Update employee
exports.updateEmployee = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { name, type, phone, email, assigned_route_id, status } = req.body;

    const employee = await Employee.findByPk(id);

    if (!employee) {
      await transaction.rollback();
      return errorResponse(res, 'Employee not found', 404);
    }

    // Validate type if provided
    if (type) {
      const validTypes = ['sales_ref', 'driver', 'warehouse', 'other'];
      if (!validTypes.includes(type)) {
        await transaction.rollback();
        return errorResponse(res, `Employee type must be one of: ${validTypes.join(', ')}`, 400);
      }
    }

    // Update fields
    if (name) employee.name = name;
    if (type) employee.type = type;
    if (phone !== undefined) employee.phone = phone;
    if (email !== undefined) employee.email = email;
    if (assigned_route_id !== undefined) employee.assigned_route_id = assigned_route_id;
    if (status) employee.status = status;

    await employee.save({ transaction });

    await transaction.commit();

    // Fetch with route
    const updatedEmployee = await Employee.findByPk(id, {
      include: [{ model: Route, as: 'assignedRoute', attributes: ['id', 'code', 'name'] }],
    });

    return successResponse(res, updatedEmployee, 'Employee updated successfully');
  } catch (err) {
    await transaction.rollback();
    console.error('Error updating employee:', err);
    return errorResponse(res, 'Failed to update employee', 500);
  }
};

// Soft delete employee (set status to inactive)
exports.deleteEmployee = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;

    const employee = await Employee.findByPk(id);

    if (!employee) {
      await transaction.rollback();
      return errorResponse(res, 'Employee not found', 404);
    }

    // Soft delete - set status to inactive
    employee.status = 'inactive';
    await employee.save({ transaction });

    await transaction.commit();

    return successResponse(res, { message: 'Employee deleted successfully' });
  } catch (err) {
    await transaction.rollback();
    console.error('Error deleting employee:', err);
    return errorResponse(res, 'Failed to delete employee', 500);
  }
};

// Get employee performance (for sales_ref type)
exports.getEmployeePerformance = async (req, res) => {
  try {
    const { id } = req.params;
    const { start_date, end_date } = req.query;

    const employee = await Employee.findByPk(id);

    if (!employee) {
      return errorResponse(res, 'Employee not found', 404);
    }

    if (employee.type !== 'sales_ref') {
      return errorResponse(
        res,
        'Performance tracking is only available for sales representatives',
        400
      );
    }

    // Build date filter
    const where = { sales_ref_id: id };
    if (start_date && end_date) {
      where.invoice_date = {
        [Op.between]: [start_date, end_date],
      };
    }

    // Get invoices
    const invoices = await SalesInvoice.findAll({
      where,
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'total_invoices'],
        [sequelize.fn('SUM', sequelize.col('total_amount')), 'total_sales'],
        [sequelize.fn('AVG', sequelize.col('total_amount')), 'average_sale'],
      ],
    });

    const performance = {
      employee: {
        id: employee.id,
        code: employee.code,
        name: employee.name,
        type: employee.type,
      },
      period: {
        start_date: start_date || 'All time',
        end_date: end_date || 'Present',
      },
      metrics: {
        total_invoices: parseInt(invoices[0]?.dataValues.total_invoices || 0),
        total_sales: parseFloat(invoices[0]?.dataValues.total_sales || 0),
        average_sale: parseFloat(invoices[0]?.dataValues.average_sale || 0),
      },
    };

    return successResponse(res, performance);
  } catch (err) {
    console.error('Error getting employee performance:', err);
    return errorResponse(res, 'Failed to fetch employee performance', 500);
  }
};
