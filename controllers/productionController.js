const {
  ProductionRun,
  ProductionMaterial,
  ProductionOutput,
  Recipe,
  RecipeItem,
  Product,
  ProductSku,
  RawMaterial,
  RawMaterialBatch,
} = require('../models');
const { successResponse, errorResponse } = require('../utils/response');
const { Op } = require('sequelize');
const db = require('../models');

/**
 * Get all production runs with pagination and filters
 * GET /api/production-runs
 */
exports.getAllProductionRuns = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status = '',
      product_id = '',
      date_from = '',
      date_to = '',
    } = req.query;
    const offset = (page - 1) * limit;

    const where = {};

    // Status filter
    if (status) {
      where.status = status;
    }

    // Product filter
    if (product_id) {
      where.product_id = product_id;
    }

    // Date range filter
    if (date_from) {
      where.production_date = {
        ...where.production_date,
        [Op.gte]: new Date(date_from),
      };
    }
    if (date_to) {
      where.production_date = {
        ...where.production_date,
        [Op.lte]: new Date(date_to),
      };
    }

    const { count, rows } = await ProductionRun.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        {
          model: Recipe,
          as: 'recipe',
          attributes: ['id', 'name', 'version'],
        },
        {
          model: db.User,
          as: 'producedBy',
          attributes: ['id', 'username'],
        },
      ],
      order: [['production_date', 'DESC']],
      distinct: true,
    });

    return successResponse(res, {
      data: rows,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit),
    });
  } catch (error) {
    console.error('Error fetching production runs:', error);
    return errorResponse(res, 'Failed to fetch production runs', 500);
  }
};

/**
 * Get production run by ID with materials and outputs
 * GET /api/production-runs/:id
 */
exports.getProductionRunById = async (req, res) => {
  try {
    const { id } = req.params;

    const productionRun = await ProductionRun.findByPk(id, {
      include: [
        {
          model: Recipe,
          as: 'recipe',
          attributes: ['id', 'name', 'version', 'batch_size', 'unit'],
        },
        {
          model: db.User,
          as: 'producedBy',
          attributes: ['id', 'username'],
        },
        {
          model: ProductionMaterial,
          as: 'materials',
          include: [
            {
              model: RawMaterialBatch,
              as: 'batch',
              attributes: ['id', 'batch_number', 'expiry_date'],
              include: [
                {
                  model: RawMaterial,
                  as: 'material',
                  attributes: ['id', 'code', 'name', 'unit'],
                },
              ],
            },
          ],
        },
        {
          model: ProductionOutput,
          as: 'outputs',
          include: [
            {
              model: ProductSku,
              as: 'sku',
              attributes: ['id', 'size', 'unit', 'price'],
              include: [
                {
                  model: Product,
                  as: 'product',
                  attributes: ['id', 'code', 'name'],
                },
              ],
            },
          ],
        },
      ],
    });

    if (!productionRun) {
      return errorResponse(res, 'Production run not found', 404);
    }

    return successResponse(res, productionRun);
  } catch (error) {
    console.error('Error fetching production run:', error);
    return errorResponse(res, 'Failed to fetch production run', 500);
  }
};

/**
 * Create new production run
 * POST /api/production-runs
 */
exports.createProductionRun = async (req, res) => {
  try {
    const {
      recipe_id,
      production_date,
      batch_number,
      produced_by,
      notes,
      status = 'completed',
    } = req.body;

    // Validation
    if (!recipe_id || !batch_number || !produced_by) {
      return errorResponse(res, 'Recipe ID, batch number, and produced_by user are required', 400);
    }

    // Verify recipe exists
    const recipe = await Recipe.findByPk(recipe_id);

    if (!recipe) {
      return errorResponse(res, 'Recipe not found', 404);
    }

    // Create production run
    const productionRun = await ProductionRun.create({
      recipe_id,
      production_date: production_date || new Date(),
      batch_number,
      produced_by,
      notes,
      status,
    });

    // Fetch created production run with relations
    const createdRun = await ProductionRun.findByPk(productionRun.id, {
      include: [
        {
          model: Recipe,
          as: 'recipe',
          attributes: ['id', 'name', 'version', 'batch_size'],
        },
        {
          model: db.User,
          as: 'producedBy',
          attributes: ['id', 'username'],
        },
      ],
    });

    return successResponse(res, createdRun, 201);
  } catch (error) {
    console.error('Error creating production run:', error);
    return errorResponse(res, 'Failed to create production run', 500);
  }
};

/**
 * Update production run
 * PUT /api/production-runs/:id
 */
exports.updateProductionRun = async (req, res) => {
  try {
    const { id } = req.params;
    const { production_date, quantity_to_produce, notes, status } = req.body;

    const productionRun = await ProductionRun.findByPk(id);

    if (!productionRun) {
      return errorResponse(res, 'Production run not found', 404);
    }

    // Don't allow updates if completed
    if (productionRun.status === 'completed') {
      return errorResponse(res, 'Cannot update completed production run', 400);
    }

    await productionRun.update({
      production_date,
      quantity_to_produce,
      notes,
      status,
    });

    // Fetch updated production run
    const updatedRun = await ProductionRun.findByPk(id, {
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'product_code', 'name'],
        },
        {
          model: ProductSku,
          as: 'productSku',
          attributes: ['id', 'sku_code', 'variant'],
        },
        {
          model: Recipe,
          as: 'recipe',
          attributes: ['id', 'name', 'version'],
        },
      ],
    });

    return successResponse(res, updatedRun);
  } catch (error) {
    console.error('Error updating production run:', error);
    return errorResponse(res, 'Failed to update production run', 500);
  }
};

/**
 * Delete production run
 * DELETE /api/production-runs/:id
 */
exports.deleteProductionRun = async (req, res) => {
  const transaction = await db.sequelize.transaction();

  try {
    const { id } = req.params;

    const productionRun = await ProductionRun.findByPk(id);

    if (!productionRun) {
      await transaction.rollback();
      return errorResponse(res, 'Production run not found', 404);
    }

    // Don't allow deletion if completed
    if (productionRun.status === 'completed') {
      await transaction.rollback();
      return errorResponse(res, 'Cannot delete completed production run', 400);
    }

    // Delete related materials and outputs
    await ProductionMaterial.destroy({ where: { production_run_id: id } }, { transaction });
    await ProductionOutput.destroy({ where: { production_run_id: id } }, { transaction });

    // Delete production run
    await productionRun.destroy({ transaction });

    await transaction.commit();

    return successResponse(res, { message: 'Production run deleted successfully' });
  } catch (error) {
    await transaction.rollback();
    console.error('Error deleting production run:', error);
    return errorResponse(res, 'Failed to delete production run', 500);
  }
};

/**
 * Complete production run with FIFO batch consumption
 * POST /api/production-runs/:id/complete
 */
exports.completeProductionRun = async (req, res) => {
  const transaction = await db.sequelize.transaction();

  try {
    const { id } = req.params;
    const { quantity_produced, waste_quantity = 0, waste_reason = '', outputs = [] } = req.body;

    if (!quantity_produced || quantity_produced <= 0) {
      await transaction.rollback();
      return errorResponse(res, 'Valid quantity produced is required', 400);
    }

    const productionRun = await ProductionRun.findByPk(id, {
      include: [
        {
          model: Recipe,
          as: 'recipe',
          include: [
            {
              model: RecipeItem,
              as: 'items',
              include: [
                {
                  model: RawMaterial,
                  as: 'material',
                },
              ],
            },
          ],
        },
      ],
    });

    if (!productionRun) {
      await transaction.rollback();
      return errorResponse(res, 'Production run not found', 404);
    }

    if (productionRun.status === 'completed') {
      await transaction.rollback();
      return errorResponse(res, 'Production run already completed', 400);
    }

    // Calculate scaling factor
    const scaleFactor = quantity_produced / productionRun.recipe.batch_size;

    // Process each recipe item with FIFO logic
    for (const item of productionRun.recipe.items) {
      const requiredQuantity = parseFloat(item.quantity) * scaleFactor;

      // Get available batches (FIFO: oldest first, exclude expired and disposed returns)
      const batches = await RawMaterialBatch.findAll({
        where: {
          material_id: item.material_id,
          current_quantity: { [Op.gt]: 0 },
          type: 'receipt', // Only use receipt batches
          expiry_date: { [Op.or]: [null, { [Op.gt]: new Date() }] },
        },
        order: [['created_at', 'ASC']], // FIFO: oldest first
        transaction,
      });

      let remainingQuantity = requiredQuantity;
      const materialsUsed = [];

      // Deduct from batches using FIFO
      for (const batch of batches) {
        if (remainingQuantity <= 0) break;

        const availableInBatch = parseFloat(batch.current_quantity);
        const quantityToDeduct = Math.min(remainingQuantity, availableInBatch);

        // Update batch quantity
        await batch.update(
          {
            current_quantity: parseFloat(batch.current_quantity) - quantityToDeduct,
          },
          { transaction }
        );

        // Record material usage
        materialsUsed.push({
          production_run_id: id,
          batch_id: batch.id,
          quantity_used: quantityToDeduct,
        });

        remainingQuantity -= quantityToDeduct;
      }

      // Check if we have enough materials
      if (remainingQuantity > 0) {
        await transaction.rollback();
        return errorResponse(
          res,
          `Insufficient stock for ${item.material.name}. Required: ${requiredQuantity}, Available: ${
            requiredQuantity - remainingQuantity
          }`,
          400
        );
      }

      // Bulk create production materials
      if (materialsUsed.length > 0) {
        await ProductionMaterial.bulkCreate(materialsUsed, { transaction });
      }
    }

    // Update product SKU stock
    await productionRun.productSku.update(
      {
        current_stock:
          parseFloat(productionRun.productSku.current_stock || 0) + parseFloat(quantity_produced),
      },
      { transaction }
    );

    // Create production output
    await ProductionOutput.create(
      {
        production_run_id: id,
        sku_id: outputs[0]?.sku_id || null,
        quantity_produced,
      },
      { transaction }
    );

    // Update production run status
    await productionRun.update(
      {
        status: 'completed',
      },
      { transaction }
    );

    await transaction.commit();

    // Fetch completed production run
    const completedRun = await ProductionRun.findByPk(id, {
      include: [
        {
          model: Recipe,
          as: 'recipe',
          attributes: ['id', 'name', 'version'],
        },
        {
          model: db.User,
          as: 'producedBy',
          attributes: ['id', 'username'],
        },
        {
          model: ProductionMaterial,
          as: 'materials',
          include: [
            {
              model: RawMaterialBatch,
              as: 'batch',
              attributes: ['id', 'batch_number', 'expiry_date'],
            },
          ],
        },
        {
          model: ProductionOutput,
          as: 'outputs',
          include: [
            {
              model: ProductSku,
              as: 'sku',
              attributes: ['id', 'size', 'unit', 'price'],
            },
          ],
        },
        {
          model: ProductionOutput,
          as: 'outputs',
        },
      ],
    });

    return successResponse(res, completedRun);
  } catch (error) {
    await transaction.rollback();
    console.error('Error completing production run:', error);
    return errorResponse(res, 'Failed to complete production run', 500);
  }
};

/**
 * Check material availability for production run
 * GET /api/production-runs/:id/check-materials
 */
exports.checkMaterialAvailability = async (req, res) => {
  try {
    const { id } = req.params;

    const productionRun = await ProductionRun.findByPk(id, {
      include: [
        {
          model: Recipe,
          as: 'recipe',
          include: [
            {
              model: RecipeItem,
              as: 'items',
              include: [
                {
                  model: RawMaterial,
                  as: 'rawMaterial',
                },
              ],
            },
          ],
        },
      ],
    });

    if (!productionRun) {
      return errorResponse(res, 'Production run not found', 404);
    }

    // Calculate scaling factor
    const scaleFactor = productionRun.quantity_to_produce / productionRun.recipe.batch_size;

    const materialCheck = [];

    // Check availability for each recipe item
    for (const item of productionRun.recipe.items) {
      const requiredQuantity = parseFloat(item.quantity) * scaleFactor;

      // Get available stock (sum of non-expired, non-disposed batches)
      const batches = await RawMaterialBatch.findAll({
        where: {
          raw_material_id: item.raw_material_id,
          current_quantity: { [Op.gt]: 0 },
          type: 'receipt',
          expiry_date: { [Op.or]: [null, { [Op.gt]: new Date() }] },
        },
        attributes: ['id', 'batch_number', 'current_quantity', 'expiry_date'],
        order: [['created_at', 'ASC']],
      });

      const availableQuantity = batches.reduce(
        (sum, batch) => sum + parseFloat(batch.current_quantity || 0),
        0
      );

      materialCheck.push({
        raw_material_id: item.raw_material_id,
        raw_material_code: item.rawMaterial.code,
        raw_material_name: item.rawMaterial.name,
        required_quantity: requiredQuantity.toFixed(2),
        available_quantity: availableQuantity.toFixed(2),
        unit: item.unit,
        is_sufficient: availableQuantity >= requiredQuantity,
        shortage:
          availableQuantity < requiredQuantity
            ? (requiredQuantity - availableQuantity).toFixed(2)
            : '0.00',
        batches: batches.map(b => ({
          id: b.id,
          batch_number: b.batch_number,
          available: parseFloat(b.current_quantity).toFixed(2),
          expiry_date: b.expiry_date,
        })),
      });
    }

    const allSufficient = materialCheck.every(item => item.is_sufficient);

    return successResponse(res, {
      production_run_id: id,
      quantity_to_produce: productionRun.quantity_to_produce,
      can_produce: allSufficient,
      materials: materialCheck,
    });
  } catch (error) {
    console.error('Error checking material availability:', error);
    return errorResponse(res, 'Failed to check material availability', 500);
  }
};
