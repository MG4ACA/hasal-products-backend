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
