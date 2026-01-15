const { Outlet, Route, SalesInvoice, Payment, sequelize } = require('../models');
const { successResponse, errorResponse } = require('../utils/response');
const { Op } = require('sequelize');

// Generate auto outlet code (e.g., OT-0001)
async function generateOutletCode() {
  const lastOutlet = await Outlet.findOne({
    order: [['id', 'DESC']],
  });

  if (!lastOutlet) return 'OT-0001';

  const lastCode = lastOutlet.code;
  const number = parseInt(lastCode.split('-')[1]) + 1;
  return `OT-${number.toString().padStart(4, '0')}`;
}

// Get all outlets with pagination and search
exports.getAllOutlets = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', status = '', route_id = '' } = req.query;
    const offset = (page - 1) * limit;

    const where = {};

    // Search by code, name, owner_name, phone, or email
    if (search) {
      where[Op.or] = [
        { code: { [Op.like]: `%${search}%` } },
        { name: { [Op.like]: `%${search}%` } },
        { owner_name: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }

    // Filter by status
    if (status) {
      where.status = status;
    }

    // Filter by route
    if (route_id) {
      where.route_id = route_id;
    }

    const { count, rows } = await Outlet.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['id', 'DESC']],
      include: [
        {
          model: Route,
          as: 'route',
          attributes: ['id', 'code', 'name'],
        },
      ],
    });

    return successResponse(res, {
      outlets: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit),
      },
    });
  } catch (err) {
    console.error('Error getting outlets:', err);
    return errorResponse(res, 'Failed to fetch outlets', 500);
  }
};

// Get single outlet by ID
exports.getOutletById = async (req, res) => {
  try {
    const { id } = req.params;

    const outlet = await Outlet.findByPk(id, {
      include: [
        {
          model: Route,
          as: 'route',
          attributes: ['id', 'code', 'name', 'status'],
        },
      ],
    });

    if (!outlet) {
      return errorResponse(res, 'Outlet not found', 404);
    }

    return successResponse(res, outlet);
  } catch (err) {
    console.error('Error getting outlet:', err);
    return errorResponse(res, 'Failed to fetch outlet', 500);
  }
};

// Create new outlet
exports.createOutlet = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const {
      name,
      owner_name,
      phone,
      email,
      address,
      route_id,
      default_discount,
      credit_limit,
      payment_terms,
      status,
    } = req.body;

    // Validation
    if (!name) {
      await transaction.rollback();
      return errorResponse(res, 'Outlet name is required', 400);
    }

    // Generate outlet code
    const code = await generateOutletCode();

    const outlet = await Outlet.create(
      {
        code,
        name,
        owner_name,
        phone,
        email,
        address,
        route_id,
        default_discount: default_discount || 20.0,
        credit_limit: credit_limit || 0,
        balance: 0,
        payment_terms: payment_terms || 'cash',
        status: status || 'active',
      },
      { transaction }
    );

    await transaction.commit();

    // Fetch with route
    const newOutlet = await Outlet.findByPk(outlet.id, {
      include: [{ model: Route, as: 'route', attributes: ['id', 'code', 'name'] }],
    });

    return successResponse(res, newOutlet, 'Outlet created successfully', 201);
  } catch (err) {
    await transaction.rollback();
    console.error('Error creating outlet:', err);
    return errorResponse(res, 'Failed to create outlet', 500);
  }
};

// Update outlet
exports.updateOutlet = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const {
      name,
      owner_name,
      phone,
      email,
      address,
      route_id,
      default_discount,
      credit_limit,
      payment_terms,
      status,
    } = req.body;

    const outlet = await Outlet.findByPk(id);

    if (!outlet) {
      await transaction.rollback();
      return errorResponse(res, 'Outlet not found', 404);
    }

    // Update fields
    if (name) outlet.name = name;
    if (owner_name !== undefined) outlet.owner_name = owner_name;
    if (phone !== undefined) outlet.phone = phone;
    if (email !== undefined) outlet.email = email;
    if (address !== undefined) outlet.address = address;
    if (route_id !== undefined) outlet.route_id = route_id;
    if (default_discount !== undefined) outlet.default_discount = default_discount;
    if (credit_limit !== undefined) outlet.credit_limit = credit_limit;
    if (payment_terms) outlet.payment_terms = payment_terms;
    if (status) outlet.status = status;

    await outlet.save({ transaction });

    await transaction.commit();

    // Fetch with route
    const updatedOutlet = await Outlet.findByPk(id, {
      include: [{ model: Route, as: 'route', attributes: ['id', 'code', 'name'] }],
    });

    return successResponse(res, updatedOutlet, 'Outlet updated successfully');
  } catch (err) {
    await transaction.rollback();
    console.error('Error updating outlet:', err);
    return errorResponse(res, 'Failed to update outlet', 500);
  }
};

// Delete outlet
exports.deleteOutlet = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;

    const outlet = await Outlet.findByPk(id, {
      include: [
        { model: SalesInvoice, as: 'invoices' },
        { model: Payment, as: 'payments' },
      ],
    });

    if (!outlet) {
      await transaction.rollback();
      return errorResponse(res, 'Outlet not found', 404);
    }

    // Check if outlet has invoices or payments
    if (outlet.invoices && outlet.invoices.length > 0) {
      await transaction.rollback();
      return errorResponse(res, 'Cannot delete outlet with existing invoices', 400);
    }

    if (outlet.payments && outlet.payments.length > 0) {
      await transaction.rollback();
      return errorResponse(res, 'Cannot delete outlet with existing payments', 400);
    }

    await outlet.destroy({ transaction });

    await transaction.commit();

    return successResponse(res, { message: 'Outlet deleted successfully' });
  } catch (err) {
    await transaction.rollback();
    console.error('Error deleting outlet:', err);
    return errorResponse(res, 'Failed to delete outlet', 500);
  }
};

// Get outlet balance details
exports.getOutletBalance = async (req, res) => {
  try {
    const { id } = req.params;

    const outlet = await Outlet.findByPk(id, {
      attributes: ['id', 'code', 'name', 'credit_limit', 'balance', 'payment_terms'],
    });

    if (!outlet) {
      return errorResponse(res, 'Outlet not found', 404);
    }

    const balanceInfo = {
      outlet: {
        id: outlet.id,
        code: outlet.code,
        name: outlet.name,
      },
      credit_limit: parseFloat(outlet.credit_limit),
      current_balance: parseFloat(outlet.balance),
      available_credit: parseFloat(outlet.credit_limit) - parseFloat(outlet.balance),
      payment_terms: outlet.payment_terms,
    };

    return successResponse(res, balanceInfo);
  } catch (err) {
    console.error('Error getting outlet balance:', err);
    return errorResponse(res, 'Failed to fetch outlet balance', 500);
  }
};

// Get outlet invoices
exports.getOutletInvoices = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const outlet = await Outlet.findByPk(id);

    if (!outlet) {
      return errorResponse(res, 'Outlet not found', 404);
    }

    const { count, rows } = await SalesInvoice.findAndCountAll({
      where: { outlet_id: id },
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['invoice_date', 'DESC']],
    });

    return successResponse(res, {
      invoices: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit),
      },
    });
  } catch (err) {
    console.error('Error getting outlet invoices:', err);
    return errorResponse(res, 'Failed to fetch outlet invoices', 500);
  }
};

// Get outlet payments
exports.getOutletPayments = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const outlet = await Outlet.findByPk(id);

    if (!outlet) {
      return errorResponse(res, 'Outlet not found', 404);
    }

    const { count, rows } = await Payment.findAndCountAll({
      where: { outlet_id: id },
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['payment_date', 'DESC']],
    });

    return successResponse(res, {
      payments: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit),
      },
    });
  } catch (err) {
    console.error('Error getting outlet payments:', err);
    return errorResponse(res, 'Failed to fetch outlet payments', 500);
  }
};
