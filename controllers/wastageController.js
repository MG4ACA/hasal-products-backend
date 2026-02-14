const db = require('../models');
const { Op } = require('sequelize');
const { successResponse, errorResponse } = require('../utils/response');

const WastageRecord = db.WastageRecord;
const RawMaterial = db.RawMaterial;
const ProductSku = db.ProductSku;
const Product = db.Product;
const User = db.User;

/**
 * Get all wastage records with pagination and filters
 */
exports.getAllWastageRecords = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      wastage_type,
      item_type,
      start_date,
      end_date,
      search,
    } = req.query;

    const offset = (page - 1) * limit;

    // Build where clause
    const where = {};

    if (wastage_type) {
      where.wastage_type = wastage_type;
    }

    if (item_type) {
      where.item_type = item_type;
    }

    if (start_date && end_date) {
      where.wastage_date = {
        [Op.between]: [start_date, end_date],
      };
    } else if (start_date) {
      where.wastage_date = {
        [Op.gte]: start_date,
      };
    } else if (end_date) {
      where.wastage_date = {
        [Op.lte]: end_date,
      };
    }

    if (search) {
      where[Op.or] = [
        { item_name: { [Op.like]: `%${search}%` } },
        { reason: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await WastageRecord.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [
        ['wastage_date', 'DESC'],
        ['created_at', 'DESC'],
      ],
      distinct: true,
      include: [
        {
          model: User,
          as: 'recordedBy',
          attributes: ['id', 'username', 'full_name'],
        },
      ],
    });

    return successResponse(res, {
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching wastage records:', error);
    return errorResponse(res, 'Failed to fetch wastage records', 500);
  }
};

/**
 * Get single wastage record by ID
 */
exports.getWastageRecordById = async (req, res) => {
  try {
    const { id } = req.params;

    const wastageRecord = await WastageRecord.findByPk(id, {
      include: [
        {
          model: User,
          as: 'recordedBy',
          attributes: ['id', 'username', 'full_name'],
        },
      ],
    });

    if (!wastageRecord) {
      return errorResponse(res, 'Wastage record not found', 404);
    }

    return successResponse(res, wastageRecord);
  } catch (error) {
    console.error('Error fetching wastage record:', error);
    return errorResponse(res, 'Failed to fetch wastage record', 500);
  }
};

/**
 * Create new wastage record
 */
exports.createWastageRecord = async (req, res) => {
  const transaction = await db.sequelize.transaction();

  try {
    const {
      wastage_type,
      item_type,
      item_id,
      quantity,
      unit,
      unit_cost,
      reason,
      detailed_notes,
      wastage_date,
      location,
    } = req.body;

    // Validate required fields
    if (!wastage_type || !item_type || !item_id || !quantity || !unit || !reason || !wastage_date) {
      await transaction.rollback();
      return errorResponse(res, 'Missing required fields', 400);
    }

    if (quantity <= 0) {
      await transaction.rollback();
      return errorResponse(res, 'Quantity must be greater than 0', 400);
    }

    // Get item details and validate
    let itemName = '';
    let actualUnitCost = parseFloat(unit_cost || 0);

    if (item_type === 'raw_material') {
      const rawMaterial = await RawMaterial.findByPk(item_id);
      if (!rawMaterial) {
        await transaction.rollback();
        return errorResponse(res, 'Raw material not found', 404);
      }
      itemName = rawMaterial.name;

      // If unit_cost not provided, try to get latest batch cost
      if (!unit_cost || unit_cost == 0) {
        const latestBatch = await db.RawMaterialBatch.findOne({
          where: { material_id: item_id, quantity: { [Op.gt]: 0 } },
          order: [['created_at', 'DESC']],
        });
        if (latestBatch) {
          actualUnitCost = parseFloat(latestBatch.unit_cost);
        }
      }
    } else if (item_type === 'finished_goods') {
      const productSku = await ProductSku.findByPk(item_id, {
        include: [{ model: Product, as: 'product' }],
      });
      if (!productSku) {
        await transaction.rollback();
        return errorResponse(res, 'Product SKU not found', 404);
      }
      itemName = `${productSku.product.name} - ${productSku.size}${productSku.unit}`;

      // Use average cost from SKU
      if (!unit_cost || unit_cost == 0) {
        actualUnitCost = parseFloat(productSku.average_cost || 0);
      }
    }

    // Calculate total cost
    const total_cost = parseFloat(quantity) * actualUnitCost;

    // Create wastage record
    const wastageRecord = await WastageRecord.create(
      {
        wastage_type,
        item_type,
        item_id,
        item_name: itemName,
        quantity,
        unit,
        unit_cost: actualUnitCost,
        total_cost,
        reason,
        detailed_notes,
        wastage_date,
        location,
        recorded_by: req.user.id,
      },
      { transaction }
    );

    // Create stock adjustment to reduce inventory
    await db.StockAdjustment.create(
      {
        adjustment_type: 'reduce',
        item_type,
        item_id,
        quantity,
        reason: `Wastage: ${wastage_type} - ${reason}`,
        notes: `Wastage Record ID: ${wastageRecord.id}`,
        created_by: req.user.id,
      },
      { transaction }
    );

    // Update stock levels
    if (item_type === 'raw_material') {
      // For raw materials, reduce from oldest batches (FIFO)
      let remainingQty = parseFloat(quantity);
      const batches = await db.RawMaterialBatch.findAll({
        where: {
          material_id: item_id,
          quantity: { [Op.gt]: 0 },
          batch_type: 'receipt',
        },
        order: [['created_at', 'ASC']],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      for (const batch of batches) {
        if (remainingQty <= 0) break;

        const batchQty = parseFloat(batch.quantity);
        const deductQty = Math.min(remainingQty, batchQty);

        await batch.update({ quantity: batchQty - deductQty }, { transaction });

        remainingQty -= deductQty;
      }

      if (remainingQty > 0) {
        await transaction.rollback();
        return errorResponse(res, 'Insufficient stock to record wastage', 400);
      }
    } else if (item_type === 'finished_goods') {
      // For finished goods, simply reduce current_stock
      const sku = await ProductSku.findByPk(item_id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      const currentStock = parseFloat(sku.current_stock);

      if (currentStock < parseFloat(quantity)) {
        await transaction.rollback();
        return errorResponse(
          res,
          `Insufficient stock. Available: ${currentStock}, Required: ${quantity}`,
          400
        );
      }

      await sku.update({ current_stock: currentStock - parseFloat(quantity) }, { transaction });
    }

    await transaction.commit();

    // Fetch the created record with associations
    const createdRecord = await WastageRecord.findByPk(wastageRecord.id, {
      include: [
        {
          model: User,
          as: 'recordedBy',
          attributes: ['id', 'username', 'full_name'],
        },
      ],
    });

    return successResponse(res, createdRecord, 'Wastage recorded successfully', 201);
  } catch (error) {
    await transaction.rollback();
    console.error('Error creating wastage record:', error);
    return errorResponse(res, 'Failed to create wastage record', 500);
  }
};

/**
 * Update wastage record
 */
exports.updateWastageRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, detailed_notes, location } = req.body;

    const wastageRecord = await WastageRecord.findByPk(id);

    if (!wastageRecord) {
      return errorResponse(res, 'Wastage record not found', 404);
    }

    // Only allow updating non-critical fields
    await wastageRecord.update({
      reason: reason || wastageRecord.reason,
      detailed_notes: detailed_notes !== undefined ? detailed_notes : wastageRecord.detailed_notes,
      location: location !== undefined ? location : wastageRecord.location,
    });

    const updatedRecord = await WastageRecord.findByPk(id, {
      include: [
        {
          model: User,
          as: 'recordedBy',
          attributes: ['id', 'username', 'full_name'],
        },
      ],
    });

    return successResponse(res, updatedRecord, 'Wastage record updated');
  } catch (error) {
    console.error('Error updating wastage record:', error);
    return errorResponse(res, 'Failed to update wastage record', 500);
  }
};

/**
 * Delete wastage record
 */
exports.deleteWastageRecord = async (req, res) => {
  try {
    const { id } = req.params;

    const wastageRecord = await WastageRecord.findByPk(id);

    if (!wastageRecord) {
      return errorResponse(res, 'Wastage record not found', 404);
    }

    await wastageRecord.destroy();

    return successResponse(res, null, 'Wastage record deleted successfully');
  } catch (error) {
    console.error('Error deleting wastage record:', error);
    return errorResponse(res, 'Failed to delete wastage record', 500);
  }
};

/**
 * Get monthly wastage summary report
 */
exports.getMonthlyWastageSummary = async (req, res) => {
  try {
    const { year, month } = req.query;

    // Default to current month if not provided
    const currentDate = new Date();
    const reportYear = year ? parseInt(year) : currentDate.getFullYear();
    const reportMonth = month ? parseInt(month) : currentDate.getMonth() + 1;

    // Calculate date range for the month
    const startDate = new Date(reportYear, reportMonth - 1, 1);
    const endDate = new Date(reportYear, reportMonth, 0, 23, 59, 59);

    // Get wastage summary by type
    const wastageByType = await WastageRecord.findAll({
      attributes: [
        'wastage_type',
        [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count'],
        [db.sequelize.fn('SUM', db.sequelize.col('quantity')), 'total_quantity'],
        [db.sequelize.fn('SUM', db.sequelize.col('total_cost')), 'total_cost'],
      ],
      where: {
        wastage_date: {
          [Op.between]: [startDate, endDate],
        },
      },
      group: ['wastage_type'],
      raw: true,
    });

    // Get wastage summary by item type
    const wastageByItemType = await WastageRecord.findAll({
      attributes: [
        'item_type',
        [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count'],
        [db.sequelize.fn('SUM', db.sequelize.col('quantity')), 'total_quantity'],
        [db.sequelize.fn('SUM', db.sequelize.col('total_cost')), 'total_cost'],
      ],
      where: {
        wastage_date: {
          [Op.between]: [startDate, endDate],
        },
      },
      group: ['item_type'],
      raw: true,
    });

    // Get top wasted items
    const topWastedItems = await WastageRecord.findAll({
      attributes: [
        'item_id',
        'item_name',
        'item_type',
        [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count'],
        [db.sequelize.fn('SUM', db.sequelize.col('quantity')), 'total_quantity'],
        [db.sequelize.fn('SUM', db.sequelize.col('total_cost')), 'total_cost'],
      ],
      where: {
        wastage_date: {
          [Op.between]: [startDate, endDate],
        },
      },
      group: ['item_id', 'item_name', 'item_type'],
      order: [[db.sequelize.literal('total_cost'), 'DESC']],
      limit: 10,
      raw: true,
    });

    // Calculate total wastage cost
    const totalWastage = await WastageRecord.sum('total_cost', {
      where: {
        wastage_date: {
          [Op.between]: [startDate, endDate],
        },
      },
    });

    // Get wastage count
    const totalRecords = await WastageRecord.count({
      where: {
        wastage_date: {
          [Op.between]: [startDate, endDate],
        },
      },
    });

    return successResponse(res, {
      period: {
        year: reportYear,
        month: reportMonth,
        start_date: startDate,
        end_date: endDate,
      },
      summary: {
        total_records: totalRecords,
        total_wastage_cost: parseFloat(totalWastage || 0).toFixed(2),
      },
      wastage_by_type: wastageByType.map(item => ({
        wastage_type: item.wastage_type,
        count: parseInt(item.count),
        total_quantity: parseFloat(item.total_quantity || 0).toFixed(2),
        total_cost: parseFloat(item.total_cost || 0).toFixed(2),
      })),
      wastage_by_item_type: wastageByItemType.map(item => ({
        item_type: item.item_type,
        count: parseInt(item.count),
        total_quantity: parseFloat(item.total_quantity || 0).toFixed(2),
        total_cost: parseFloat(item.total_cost || 0).toFixed(2),
      })),
      top_wasted_items: topWastedItems.map(item => ({
        item_id: item.item_id,
        item_name: item.item_name,
        item_type: item.item_type,
        count: parseInt(item.count),
        total_quantity: parseFloat(item.total_quantity || 0).toFixed(2),
        total_cost: parseFloat(item.total_cost || 0).toFixed(2),
      })),
    });
  } catch (error) {
    console.error('Error generating monthly wastage summary:', error);
    return errorResponse(res, 'Failed to generate wastage summary', 500);
  }
};

/**
 * Get wastage trend (monthly comparison)
 */
exports.getWastageTrend = async (req, res) => {
  try {
    const { months = 6 } = req.query;

    const monthsToShow = parseInt(months);
    const trends = [];

    for (let i = monthsToShow - 1; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);

      const year = date.getFullYear();
      const month = date.getMonth() + 1;

      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      const totalCost = await WastageRecord.sum('total_cost', {
        where: {
          wastage_date: {
            [Op.between]: [startDate, endDate],
          },
        },
      });

      const totalRecords = await WastageRecord.count({
        where: {
          wastage_date: {
            [Op.between]: [startDate, endDate],
          },
        },
      });

      trends.push({
        year,
        month,
        month_name: startDate.toLocaleString('default', { month: 'long' }),
        total_cost: parseFloat(totalCost || 0).toFixed(2),
        total_records: totalRecords,
      });
    }

    return successResponse(res, trends);
  } catch (error) {
    console.error('Error generating wastage trend:', error);
    return errorResponse(res, 'Failed to generate wastage trend', 500);
  }
};

module.exports = exports;
