const { Supplier, PurchaseOrder } = require('../models');
const { successResponse, errorResponse } = require('../utils/response');
const { Op } = require('sequelize');

// Generate unique supplier code
const generateSupplierCode = async () => {
  const lastSupplier = await Supplier.findOne({
    order: [['id', 'DESC']],
  });

  if (!lastSupplier) {
    return 'SUP-0001';
  }

  const lastCode = lastSupplier.code;
  const lastNumber = parseInt(lastCode.split('-')[1]);
  const newNumber = lastNumber + 1;
  return `SUP-${String(newNumber).padStart(4, '0')}`;
};

// GET /api/suppliers - Get all suppliers with pagination, search, filters
exports.getAllSuppliers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      status = '',
      payment_terms = '',
      sortBy = 'created_at',
      sortOrder = 'DESC',
    } = req.query;

    const offset = (page - 1) * limit;

    // Build where clause
    const whereClause = {};

    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { code: { [Op.like]: `%${search}%` } },
        { contact_person: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }

    if (status) {
      whereClause.status = status;
    }

    if (payment_terms) {
      whereClause.payment_terms = payment_terms;
    }

    const { count, rows } = await Supplier.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [[sortBy, sortOrder]],
    });

    return successResponse(res, {
      suppliers: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error('Get all suppliers error:', error);
    return errorResponse(res, 'Failed to fetch suppliers', 500);
  }
};

// GET /api/suppliers/:id - Get supplier by ID
exports.getSupplierById = async (req, res) => {
  try {
    const { id } = req.params;

    const supplier = await Supplier.findByPk(id, {
      include: [
        {
          model: PurchaseOrder,
          as: 'purchase_orders',
          limit: 5,
          order: [['created_at', 'DESC']],
        },
      ],
    });

    if (!supplier) {
      return errorResponse(res, 'Supplier not found', 404);
    }

    return successResponse(res, { supplier });
  } catch (error) {
    console.error('Get supplier by ID error:', error);
    return errorResponse(res, 'Failed to fetch supplier', 500);
  }
};

// POST /api/suppliers - Create supplier
exports.createSupplier = async (req, res) => {
  try {
    const { name, contact_person, phone, email, address, payment_terms } = req.body;

    // Validate required fields
    if (!name) {
      return errorResponse(res, 'Supplier name is required', 400);
    }

    // Generate supplier code
    const code = await generateSupplierCode();

    const supplier = await Supplier.create({
      code,
      name,
      contact_person,
      phone,
      email,
      address,
      payment_terms: payment_terms || 'credit',
      balance: 0,
      status: 'active',
    });

    return successResponse(res, { supplier, message: 'Supplier created successfully' }, 201);
  } catch (error) {
    console.error('Create supplier error:', error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      return errorResponse(res, 'Supplier with this code already exists', 400);
    }
    return errorResponse(res, 'Failed to create supplier', 500);
  }
};

// PUT /api/suppliers/:id - Update supplier
exports.updateSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, contact_person, phone, email, address, payment_terms, status } = req.body;

    const supplier = await Supplier.findByPk(id);

    if (!supplier) {
      return errorResponse(res, 'Supplier not found', 404);
    }

    // Update supplier
    await supplier.update({
      name: name || supplier.name,
      contact_person: contact_person !== undefined ? contact_person : supplier.contact_person,
      phone: phone !== undefined ? phone : supplier.phone,
      email: email !== undefined ? email : supplier.email,
      address: address !== undefined ? address : supplier.address,
      payment_terms: payment_terms || supplier.payment_terms,
      status: status || supplier.status,
    });

    return successResponse(res, { supplier, message: 'Supplier updated successfully' });
  } catch (error) {
    console.error('Update supplier error:', error);
    return errorResponse(res, 'Failed to update supplier', 500);
  }
};

// DELETE /api/suppliers/:id - Soft delete supplier
exports.deleteSupplier = async (req, res) => {
  try {
    const { id } = req.params;

    const supplier = await Supplier.findByPk(id);

    if (!supplier) {
      return errorResponse(res, 'Supplier not found', 404);
    }

    // Check if supplier has outstanding balance
    if (parseFloat(supplier.balance) !== 0) {
      return errorResponse(
        res,
        'Cannot delete supplier with outstanding balance. Please settle the balance first.',
        400
      );
    }

    // Soft delete by setting status to inactive
    await supplier.update({ status: 'inactive' });

    return successResponse(res, { message: 'Supplier deleted successfully' });
  } catch (error) {
    console.error('Delete supplier error:', error);
    return errorResponse(res, 'Failed to delete supplier', 500);
  }
};

// GET /api/suppliers/:id/balance - Get supplier balance
exports.getSupplierBalance = async (req, res) => {
  try {
    const { id } = req.params;

    const supplier = await Supplier.findByPk(id, {
      attributes: ['id', 'code', 'name', 'balance', 'payment_terms'],
    });

    if (!supplier) {
      return errorResponse(res, 'Supplier not found', 404);
    }

    return successResponse(res, {
      balance: {
        supplier_id: supplier.id,
        supplier_code: supplier.code,
        supplier_name: supplier.name,
        balance: parseFloat(supplier.balance),
        payment_terms: supplier.payment_terms,
      },
    });
  } catch (error) {
    console.error('Get supplier balance error:', error);
    return errorResponse(res, 'Failed to fetch supplier balance', 500);
  }
};

// ===== SUPPLIER PAYMENT METHODS =====

// GET /api/suppliers/:id/payments - Get all payments for a supplier
exports.getSupplierPayments = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50, start_date, end_date } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Verify supplier exists
    const supplier = await Supplier.findByPk(id);
    if (!supplier) {
      return errorResponse(res, 'Supplier not found', 404);
    }

    const where = { supplier_id: id };

    if (start_date && end_date) {
      where.payment_date = {
        [Op.between]: [start_date, end_date],
      };
    } else if (start_date) {
      where.payment_date = {
        [Op.gte]: start_date,
      };
    } else if (end_date) {
      where.payment_date = {
        [Op.lte]: end_date,
      };
    }

    const { SupplierPayment, User } = require('../models');

    const { count, rows: payments } = await SupplierPayment.findAndCountAll({
      where,
      include: [
        {
          model: Supplier,
          as: 'supplier',
          attributes: ['id', 'code', 'name'],
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'name'],
        },
      ],
      order: [
        ['payment_date', 'DESC'],
        ['created_at', 'DESC'],
      ],
      limit: parseInt(limit),
      offset,
    });

    return successResponse(res, {
      payments,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / parseInt(limit)),
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error('Get supplier payments error:', error);
    return errorResponse(res, 'Error retrieving supplier payments', 500, error.message);
  }
};

// GET /api/suppliers/payments - Get all supplier payments with filters
exports.getAllSupplierPayments = async (req, res) => {
  try {
    const {
      supplier_id,
      payment_method,
      start_date,
      end_date,
      check_status,
      page = 1,
      limit = 50,
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = {};

    if (supplier_id) {
      where.supplier_id = supplier_id;
    }

    if (payment_method) {
      where.payment_method = payment_method;
    }

    if (start_date && end_date) {
      where.payment_date = {
        [Op.between]: [start_date, end_date],
      };
    } else if (start_date) {
      where.payment_date = {
        [Op.gte]: start_date,
      };
    } else if (end_date) {
      where.payment_date = {
        [Op.lte]: end_date,
      };
    }

    // Filter by check status
    if (check_status) {
      where.payment_method = 'check';

      if (check_status === 'pending') {
        where.clearance_date = null;
      } else if (check_status === 'cleared') {
        where.clearance_date = {
          [Op.ne]: null,
        };
      } else if (check_status === 'overdue') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        where.clearance_date = null;
        where.check_date = {
          [Op.lt]: thirtyDaysAgo.toISOString().split('T')[0],
        };
      }
    }

    const { SupplierPayment, User } = require('../models');

    const { count, rows: payments } = await SupplierPayment.findAndCountAll({
      where,
      include: [
        {
          model: Supplier,
          as: 'supplier',
          attributes: ['id', 'code', 'name', 'balance'],
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'name'],
        },
      ],
      order: [
        ['payment_date', 'DESC'],
        ['created_at', 'DESC'],
      ],
      limit: parseInt(limit),
      offset,
    });

    return successResponse(res, {
      payments,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / parseInt(limit)),
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error('Get all supplier payments error:', error);
    return errorResponse(res, 'Error retrieving supplier payments', 500, error.message);
  }
};

// POST /api/suppliers/:id/payments - Create supplier payment
exports.createSupplierPayment = async (req, res) => {
  const { sequelize } = require('../models');
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { payment_date, amount, payment_method, check_number, check_date, reference, notes } =
      req.body;

    // Validation
    if (!payment_date || !amount || !payment_method) {
      await transaction.rollback();
      return errorResponse(
        res,
        'Missing required fields: payment_date, amount, payment_method',
        400
      );
    }

    if (amount <= 0) {
      await transaction.rollback();
      return errorResponse(res, 'Payment amount must be greater than 0', 400);
    }

    if (payment_method === 'check' && (!check_number || !check_date)) {
      await transaction.rollback();
      return errorResponse(res, 'Check payments require check_number and check_date', 400);
    }

    // Verify supplier exists
    const supplier = await Supplier.findByPk(id, { transaction });
    if (!supplier) {
      await transaction.rollback();
      return errorResponse(res, 'Supplier not found', 404);
    }

    // Check if payment amount exceeds balance
    if (parseFloat(amount) > parseFloat(supplier.balance)) {
      await transaction.rollback();
      return errorResponse(res, 'Payment amount exceeds supplier balance', 400);
    }

    const { SupplierPayment } = require('../models');

    // Create supplier payment
    const payment = await SupplierPayment.create(
      {
        supplier_id: id,
        payment_date,
        amount: parseFloat(amount),
        payment_method,
        check_number: payment_method === 'check' ? check_number : null,
        check_date: payment_method === 'check' ? check_date : null,
        clearance_date: null,
        reference,
        notes,
        created_by: req.user.id,
      },
      { transaction }
    );

    // Reduce supplier balance
    const newBalance = parseFloat(supplier.balance) - parseFloat(amount);
    await supplier.update({ balance: newBalance }, { transaction });

    await transaction.commit();

    // Fetch complete payment with associations
    const { User } = require('../models');
    const createdPayment = await SupplierPayment.findByPk(payment.id, {
      include: [
        {
          model: Supplier,
          as: 'supplier',
          attributes: ['id', 'code', 'name', 'balance'],
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'name'],
        },
      ],
    });

    return successResponse(res, createdPayment, 'Supplier payment created successfully', 201);
  } catch (error) {
    await transaction.rollback();
    console.error('Create supplier payment error:', error);
    return errorResponse(res, 'Error creating supplier payment', 500, error.message);
  }
};
