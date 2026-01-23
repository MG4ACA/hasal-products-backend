const { RawMaterial, RawMaterialBatch, sequelize } = require('../models');
const { successResponse, errorResponse } = require('../utils/response');
const { Op } = require('sequelize');

/**
 * Calculate weighted average cost for a material from receipt batches only
 * Formula: SUM(quantity * unit_cost) / SUM(quantity)
 * @param {number} materialId - Raw material ID
 * @returns {Promise<number>} Average cost or 0 if no receipt batches
 */
const calculateAverageCost = async materialId => {
  try {
    const costResult = await sequelize.query(
      `SELECT SUM(quantity * unit_cost) / SUM(quantity) as avg_cost
       FROM raw_material_batches
       WHERE material_id = ? AND batch_type = 'receipt'`,
      {
        replacements: [materialId],
        type: sequelize.QueryTypes.SELECT,
      }
    );
    return parseFloat(costResult[0]?.avg_cost || 0);
  } catch (error) {
    console.error('Error calculating average cost:', error);
    return 0;
  }
};

// Generate unique raw material code
const generateRawMaterialCode = async () => {
  const lastMaterial = await RawMaterial.findOne({
    order: [['id', 'DESC']],
  });

  if (!lastMaterial) {
    return 'RM-0001';
  }

  const lastCode = lastMaterial.code;
  const lastNumber = parseInt(lastCode.split('-')[1]);
  const newNumber = lastNumber + 1;
  return `RM-${String(newNumber).padStart(4, '0')}`;
};

// GET /api/raw-materials - Get all raw materials with stock calculation
exports.getAllRawMaterials = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      category = '',
      status = '',
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
      ];
    }

    if (category) {
      whereClause.category = category;
    }

    if (status) {
      whereClause.status = status;
    }

    const { count, rows } = await RawMaterial.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [[sortBy, sortOrder]],
    });

    // Calculate current stock and average cost for each material
    const materialsWithStock = await Promise.all(
      rows.map(async material => {
        const stockResult = await RawMaterialBatch.findOne({
          where: { material_id: material.id },
          attributes: [[sequelize.fn('SUM', sequelize.col('quantity')), 'total_stock']],
        });

        const totalStock = parseFloat(stockResult?.dataValues?.total_stock || 0);
        const averageCost = await calculateAverageCost(material.id);

        return {
          ...material.toJSON(),
          current_stock: totalStock,
          average_cost: averageCost,
        };
      })
    );

    return successResponse(res, {
      raw_materials: materialsWithStock,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error('Get all raw materials error:', error);
    return errorResponse(res, 'Failed to fetch raw materials', 500);
  }
};

// GET /api/raw-materials/:id - Get raw material by ID (with batches and supplier info)
exports.getRawMaterialById = async (req, res) => {
  try {
    const { id } = req.params;

    const rawMaterial = await RawMaterial.findByPk(id, {
      include: [
        {
          model: RawMaterialBatch,
          as: 'batches',
          attributes: [
            'id',
            'batch_number',
            'batch_type',
            'quantity',
            'unit_cost',
            'purchase_date',
            'expiry_date',
            'inspection_status',
            'supplier_id',
            'created_at',
          ],
          include: [
            {
              model: require('../models').Supplier,
              as: 'supplier',
              attributes: ['id', 'code', 'name'],
            },
          ],
          order: [['created_at', 'DESC']],
          limit: 10, // Show recent 10 batches
        },
      ],
    });

    if (!rawMaterial) {
      return errorResponse(res, 'Raw material not found', 404);
    }

    // Calculate current stock from all batches
    const stockResult = await RawMaterialBatch.findOne({
      where: { material_id: id },
      attributes: [[sequelize.fn('SUM', sequelize.col('quantity')), 'total_stock']],
    });

    const totalStock = parseFloat(stockResult?.dataValues?.total_stock || 0);
    const averageCost = await calculateAverageCost(id);

    return successResponse(res, {
      raw_material: {
        ...rawMaterial.toJSON(),
        current_stock: totalStock,
        average_cost: averageCost,
        RawMaterialBatches: rawMaterial.batches, // Rename for frontend compatibility
      },
    });
  } catch (error) {
    console.error('Get raw material by ID error:', error);
    return errorResponse(res, 'Failed to fetch raw material', 500);
  }
};

// POST /api/raw-materials - Create raw material
exports.createRawMaterial = async (req, res) => {
  try {
    const { name, category, unit, reorder_level } = req.body;

    // Validate required fields
    if (!name || !unit) {
      return errorResponse(res, 'Name and unit are required', 400);
    }

    // Generate raw material code
    const code = await generateRawMaterialCode();

    const rawMaterial = await RawMaterial.create({
      code,
      name,
      category,
      unit,
      reorder_level: reorder_level || 0,
      status: 'active',
    });

    return successResponse(
      res,
      { raw_material: rawMaterial, message: 'Raw material created successfully' },
      201
    );
  } catch (error) {
    console.error('Create raw material error:', error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      return errorResponse(res, 'Raw material with this code already exists', 400);
    }
    return errorResponse(res, 'Failed to create raw material', 500);
  }
};

// PUT /api/raw-materials/:id - Update raw material
exports.updateRawMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, unit, reorder_level, status } = req.body;

    const rawMaterial = await RawMaterial.findByPk(id);

    if (!rawMaterial) {
      return errorResponse(res, 'Raw material not found', 404);
    }

    // Update raw material
    await rawMaterial.update({
      name: name || rawMaterial.name,
      category: category !== undefined ? category : rawMaterial.category,
      unit: unit || rawMaterial.unit,
      reorder_level: reorder_level !== undefined ? reorder_level : rawMaterial.reorder_level,
      status: status || rawMaterial.status,
    });

    return successResponse(res, {
      raw_material: rawMaterial,
      message: 'Raw material updated successfully',
    });
  } catch (error) {
    console.error('Update raw material error:', error);
    return errorResponse(res, 'Failed to update raw material', 500);
  }
};

// DELETE /api/raw-materials/:id - Delete raw material
exports.deleteRawMaterial = async (req, res) => {
  try {
    const { id } = req.params;

    const rawMaterial = await RawMaterial.findByPk(id);

    if (!rawMaterial) {
      return errorResponse(res, 'Raw material not found', 404);
    }

    // Check if raw material has any batches
    const batchCount = await RawMaterialBatch.count({
      where: { material_id: id },
    });

    if (batchCount > 0) {
      return errorResponse(
        res,
        'Cannot delete raw material with existing batches. Set status to inactive instead.',
        400
      );
    }

    // Soft delete by setting status to inactive
    await rawMaterial.update({ status: 'inactive' });

    return successResponse(res, { message: 'Raw material deleted successfully' });
  } catch (error) {
    console.error('Delete raw material error:', error);
    return errorResponse(res, 'Failed to delete raw material', 500);
  }
};

// GET /api/raw-materials/:id/batches - Get batches for material
exports.getRawMaterialBatches = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const rawMaterial = await RawMaterial.findByPk(id);

    if (!rawMaterial) {
      return errorResponse(res, 'Raw material not found', 404);
    }

    const { count, rows } = await RawMaterialBatch.findAndCountAll({
      where: { material_id: id },
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']],
    });

    return successResponse(res, {
      batches: rows,
      raw_material: {
        id: rawMaterial.id,
        code: rawMaterial.code,
        name: rawMaterial.name,
      },
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error('Get raw material batches error:', error);
    return errorResponse(res, 'Failed to fetch raw material batches', 500);
  }
};

// GET /api/raw-materials/:id/stock - Get current stock level
exports.getRawMaterialStock = async (req, res) => {
  try {
    const { id } = req.params;

    const rawMaterial = await RawMaterial.findByPk(id);

    if (!rawMaterial) {
      return errorResponse(res, 'Raw material not found', 404);
    }

    // Calculate total stock from all batches
    const stockResult = await RawMaterialBatch.findOne({
      where: { material_id: id },
      attributes: [[sequelize.fn('SUM', sequelize.col('quantity')), 'total_stock']],
    });

    const totalStock = parseFloat(stockResult?.dataValues?.total_stock || 0);
    const reorderLevel = parseFloat(rawMaterial.reorder_level);
    const needsReorder = totalStock <= reorderLevel;

    return successResponse(res, {
      stock: {
        raw_material_id: rawMaterial.id,
        code: rawMaterial.code,
        name: rawMaterial.name,
        unit: rawMaterial.unit,
        total_stock: totalStock,
        reorder_level: reorderLevel,
        needs_reorder: needsReorder,
        status: rawMaterial.status,
      },
    });
  } catch (error) {
    console.error('Get raw material stock error:', error);
    return errorResponse(res, 'Failed to fetch raw material stock', 500);
  }
};
