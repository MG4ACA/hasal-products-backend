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
const { generateFinishedGoodsBatchNumber } = require('../utils/batchNumberGenerator');

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
      recipe_id = '',
      search = '',
      date_from = '',
      date_to = '',
    } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    const { sequelize } = db;
    const { Op } = require('sequelize');

    // Status filter
    if (status) {
      where.status = status;
    }

    // Recipe filter
    if (recipe_id) {
      where.recipe_id = recipe_id;
    }

    // Product filter (through recipe -> productSku -> product relationship)
    if (product_id) {
      where[Op.and] = sequelize.where(
        sequelize.col('recipe->productSku->product.id'),
        Op.eq,
        product_id
      );
    }

    // Search filter (search in batch_number)
    if (search) {
      where.batch_number = {
        [Op.like]: `%${search}%`,
      };
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

    const includeOptions = [
      {
        model: Recipe,
        as: 'recipe',
        attributes: ['id', 'name', 'version', 'expected_yield', 'yield_unit', 'product_sku_id'],
        required: product_id ? true : false,
        include: [
          {
            model: ProductSku,
            as: 'productSku',
            attributes: ['id', 'size', 'unit'],
            required: product_id ? true : false,
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
      {
        model: db.User,
        as: 'producedBy',
        attributes: ['id', 'username'],
      },
    ];

    const { count, rows } = await ProductionRun.findAndCountAll({
      where,
      include: includeOptions,
      limit: parseInt(limit),
      offset: parseInt(offset),
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
          attributes: ['id', 'name', 'version', 'expected_yield', 'yield_unit'],
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
              attributes: ['id', 'batch_number', 'expiry_date', 'unit_cost'],
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

    // Calculate actual cost for each material based on batch unit_cost (FIFO)
    const materialsWithCosts = [];
    if (productionRun.materials && productionRun.materials.length > 0) {
      for (const material of productionRun.materials) {
        // Use the actual unit_cost from the batch that was consumed (FIFO principle)
        const unitCost = parseFloat(material.batch?.unit_cost || 0);
        const totalCost = unitCost * parseFloat(material.quantity_used || 0);

        materialsWithCosts.push({
          ...material.toJSON(),
          average_cost: unitCost,
          cost: totalCost,
          unit: material.batch?.material?.unit || 'kg',
        });
      }
    }

    const productionData = {
      ...productionRun.toJSON(),
      materials: materialsWithCosts,
    };

    return successResponse(res, productionData);
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
      expected_quantity,
      notes,
      status = 'planned',
    } = req.body;

    // Validation
    if (!recipe_id || !produced_by) {
      return errorResponse(res, 'Recipe ID and produced_by user are required', 400);
    }

    if (!expected_quantity || expected_quantity <= 0) {
      return errorResponse(res, 'Expected quantity is required and must be greater than 0', 400);
    }

    // Verify recipe exists
    const recipe = await Recipe.findByPk(recipe_id);

    if (!recipe) {
      return errorResponse(res, 'Recipe not found', 404);
    }

    // Auto-generate batch number if not provided
    const { generateProductionBatchNumber } = require('../utils/batchNumberGenerator');
    let finalBatchNumber = batch_number;
    if (!finalBatchNumber) {
      finalBatchNumber = await generateProductionBatchNumber(production_date || new Date());
    }

    // Create production run
    const productionRun = await ProductionRun.create({
      recipe_id,
      production_date: production_date || new Date(),
      batch_number: finalBatchNumber,
      produced_by,
      expected_quantity,
      notes,
      status,
    });

    // Fetch created production run with relations
    const createdRun = await ProductionRun.findByPk(productionRun.id, {
      include: [
        {
          model: Recipe,
          as: 'recipe',
          attributes: ['id', 'name', 'version', 'expected_yield', 'yield_unit'],
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
    const { production_date, expected_quantity, notes, status } = req.body;

    const productionRun = await ProductionRun.findByPk(id);

    if (!productionRun) {
      return errorResponse(res, 'Production run not found', 404);
    }

    // Don't allow updates if completed
    if (productionRun.status === 'completed') {
      return errorResponse(res, 'Cannot update completed production run', 400);
    }

    // Don't allow updates if in_progress (materials already deducted)
    if (productionRun.status === 'in_progress') {
      return errorResponse(res, 'Cannot update production run that is in progress', 400);
    }

    // Validate expected_quantity if provided
    if (expected_quantity !== undefined && expected_quantity <= 0) {
      return errorResponse(res, 'Expected quantity must be greater than 0', 400);
    }

    await productionRun.update({
      production_date,
      expected_quantity,
      notes,
      status,
    });

    // Fetch updated production run
    const updatedRun = await ProductionRun.findByPk(id, {
      include: [
        {
          model: Recipe,
          as: 'recipe',
          attributes: ['id', 'name', 'version', 'expected_yield', 'yield_unit'],
          include: [
            {
              model: ProductSku,
              as: 'productSku',
              attributes: ['id', 'size', 'unit'],
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
        {
          model: db.User,
          as: 'producedBy',
          attributes: ['id', 'username'],
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
 * Start production run - checks materials, deducts using FIFO, updates status to in_progress
 * POST /api/production-runs/:id/start
 */
exports.startProductionRun = async (req, res) => {
  const transaction = await db.sequelize.transaction();

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

    if (productionRun.status !== 'planned') {
      await transaction.rollback();
      return errorResponse(res, 'Production run must be in planned status to start', 400);
    }

    if (!productionRun.expected_quantity || productionRun.expected_quantity <= 0) {
      await transaction.rollback();
      return errorResponse(res, 'Expected quantity is required to start production', 400);
    }

    // Calculate scaling factor based on expected quantity
    const expectedYield = parseFloat(productionRun.recipe.expected_yield);
    const expectedQuantity = parseFloat(productionRun.expected_quantity);
    const scaleFactor = expectedQuantity / expectedYield;

    // Track total material cost
    let totalMaterialCost = 0;

    // Process each recipe item with FIFO logic and cost tracking
    for (const item of productionRun.recipe.items) {
      const requiredQuantity = parseFloat(item.quantity) * scaleFactor;

      // Get available batches (FIFO: oldest first, exclude expired and disposed returns)
      const batches = await RawMaterialBatch.findAll({
        where: {
          material_id: item.material_id,
          quantity: { [Op.gt]: 0 },
          batch_type: 'receipt', // Only use receipt batches
          expiry_date: { [Op.or]: [null, { [Op.gt]: new Date() }] },
        },
        order: [['created_at', 'ASC']], // FIFO: oldest first
        transaction,
      });

      let remainingQuantity = requiredQuantity;
      const materialsUsed = [];

      // Deduct from batches using FIFO with cost tracking
      for (const batch of batches) {
        if (remainingQuantity <= 0) break;

        const availableInBatch = parseFloat(batch.quantity);
        const quantityToDeduct = Math.min(remainingQuantity, availableInBatch);

        // Calculate cost for this deduction
        const costFromBatch = parseFloat(batch.unit_cost || 0) * quantityToDeduct;
        totalMaterialCost += costFromBatch;

        // Update batch quantity
        await batch.update(
          {
            quantity: parseFloat(batch.quantity) - quantityToDeduct,
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
          `Insufficient stock for ${item.material.name}. Required: ${requiredQuantity.toFixed(
            2
          )}, Available: ${(requiredQuantity - remainingQuantity).toFixed(2)}`,
          400
        );
      }

      // Bulk create production materials
      if (materialsUsed.length > 0) {
        await ProductionMaterial.bulkCreate(materialsUsed, { transaction });
      }
    }

    // Update production run status to in_progress
    await productionRun.update(
      {
        status: 'in_progress',
      },
      { transaction }
    );

    await transaction.commit();

    // Fetch updated production run
    const startedRun = await ProductionRun.findByPk(id, {
      include: [
        {
          model: Recipe,
          as: 'recipe',
          attributes: ['id', 'name', 'version', 'expected_yield'],
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
              attributes: ['id', 'batch_number', 'expiry_date', 'unit_cost'],
            },
          ],
        },
      ],
    });

    return successResponse(res, startedRun);
  } catch (error) {
    await transaction.rollback();
    console.error('Error starting production run:', error);
    return errorResponse(res, 'Failed to start production run', 500);
  }
};

/**
 * Complete production run with FIFO batch consumption, cost tracking, and waste allocation
 * POST /api/production-runs/:id/complete
 */
/**
 * Complete production run - creates finished goods output (materials already deducted at start)
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
              model: ProductSku,
              as: 'productSku',
              attributes: [
                'id',
                'size',
                'unit',
                'price',
                'current_stock',
                'average_cost',
                'product_id',
              ],
            },
          ],
        },
        {
          model: ProductionMaterial,
          as: 'materials',
          include: [
            {
              model: RawMaterialBatch,
              as: 'batch',
              attributes: ['id', 'batch_number', 'unit_cost'],
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

    if (productionRun.status !== 'in_progress') {
      await transaction.rollback();
      return errorResponse(res, 'Production run must be in progress to complete', 400);
    }

    // Calculate total material cost from already deducted materials
    let totalMaterialCost = 0;
    if (productionRun.materials && productionRun.materials.length > 0) {
      for (const material of productionRun.materials) {
        const quantityUsed = parseFloat(material.quantity_used || 0);
        const unitCost = parseFloat(material.batch?.unit_cost || 0);
        totalMaterialCost += quantityUsed * unitCost;
      }
    }

    // Calculate waste cost separately (Approach 2: Separate Waste Allocation)
    const wasteQty = parseFloat(waste_quantity || 0);
    const totalExpectedQuantity = parseFloat(quantity_produced) + wasteQty;

    // Base unit cost (materials divided by expected total output including waste)
    const baseUnitCost = totalExpectedQuantity > 0 ? totalMaterialCost / totalExpectedQuantity : 0;

    // Allocate costs
    const finishedGoodsCost = baseUnitCost * parseFloat(quantity_produced);
    const wasteCost = baseUnitCost * wasteQty;

    // Get target SKU (from recipe or from outputs)
    const targetSkuId = outputs[0]?.sku_id || productionRun.recipe.product_sku_id;

    if (!targetSkuId) {
      await transaction.rollback();
      return errorResponse(res, 'Product SKU is required for production output', 400);
    }

    const targetSku = await ProductSku.findByPk(targetSkuId, { transaction });

    if (!targetSku) {
      await transaction.rollback();
      return errorResponse(res, 'Product SKU not found', 404);
    }

    // Generate finished goods batch number
    const finishedGoodsBatchNumber = await generateFinishedGoodsBatchNumber(
      targetSkuId,
      productionRun.production_date
    );

    // Update SKU average cost (weighted average)
    const currentStock = parseFloat(targetSku.current_stock || 0);
    const currentAvgCost = parseFloat(targetSku.average_cost || 0);
    const newQuantity = parseFloat(quantity_produced);
    const newUnitCost = baseUnitCost; // Use base cost (not inflated by waste)

    const totalValue = currentStock * currentAvgCost + newQuantity * newUnitCost;
    const totalQuantity = currentStock + newQuantity;
    const newAvgCost = totalQuantity > 0 ? totalValue / totalQuantity : newUnitCost;

    // Update product SKU stock and average cost
    await targetSku.update(
      {
        current_stock: totalQuantity,
        average_cost: newAvgCost.toFixed(2),
        material_cost: newAvgCost.toFixed(2), // For now, same as average (overhead added in P8)
        cost_last_updated: new Date(),
      },
      { transaction }
    );

    // Create production output with batch number and cost
    await ProductionOutput.create(
      {
        production_run_id: id,
        sku_id: targetSkuId,
        quantity_produced,
        batch_number: finishedGoodsBatchNumber,
        production_date: productionRun.production_date,
        unit_cost: baseUnitCost.toFixed(2), // Base cost per unit
        total_cost: finishedGoodsCost.toFixed(2), // Cost for finished goods only
        waste_cost: wasteCost.toFixed(2), // Waste cost tracked separately
      },
      { transaction }
    );

    // Calculate yield efficiency
    const actualQuantity = parseFloat(quantity_produced);
    const expectedQuantity = parseFloat(productionRun.expected_quantity || 0);
    const yieldEfficiency = expectedQuantity > 0 ? (actualQuantity / expectedQuantity) * 100 : 0;

    // Update production run status with yield tracking
    await productionRun.update(
      {
        status: 'completed',
        actual_quantity: actualQuantity.toFixed(2),
        waste_quantity: wasteQty.toFixed(2),
        waste_reason: waste_reason || null,
        yield_efficiency: yieldEfficiency.toFixed(2),
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
          attributes: ['id', 'name', 'version', 'expected_yield'],
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
              attributes: ['id', 'batch_number', 'expiry_date', 'unit_cost'],
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
              attributes: ['id', 'size', 'unit', 'price', 'average_cost'],
            },
          ],
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

/**
 * Get waste cost report
 * GET /api/production-runs/waste-cost-report
 */
exports.getWasteCostReport = async (req, res) => {
  try {
    const { date_from, date_to } = req.query;

    const where = {};

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

    const outputs = await ProductionOutput.findAll({
      where,
      include: [
        {
          model: ProductionRun,
          as: 'productionRun',
          attributes: ['id', 'batch_number', 'production_date', 'waste_quantity', 'waste_reason'],
        },
        {
          model: ProductSku,
          as: 'sku',
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['code', 'name'],
            },
          ],
        },
      ],
      order: [['production_date', 'DESC']],
    });

    const wasteDetails = outputs
      .filter(output => parseFloat(output.waste_cost || 0) > 0)
      .map(output => ({
        date: output.production_date,
        batch_number: output.productionRun.batch_number,
        product: output.sku.product.name,
        waste_quantity: parseFloat(output.productionRun.waste_quantity || 0),
        waste_cost: parseFloat(output.waste_cost || 0),
        waste_reason: output.productionRun.waste_reason || 'Not specified',
      }));

    const totalWasteCost = wasteDetails.reduce((sum, item) => sum + item.waste_cost, 0);

    return successResponse(res, {
      summary: {
        total_waste_cost: totalWasteCost.toFixed(2),
        total_incidents: wasteDetails.length,
        period: {
          from: date_from || 'All time',
          to: date_to || 'Now',
        },
      },
      details: wasteDetails,
    });
  } catch (error) {
    console.error('Error generating waste cost report:', error);
    return errorResponse(res, 'Failed to generate waste cost report', 500);
  }
};

/**
 * Get production efficiency report
 * GET /api/production-runs/efficiency-report
 */
exports.getEfficiencyReport = async (req, res) => {
  try {
    const { date_from, date_to, recipe_id } = req.query;

    const where = { status: 'completed' };

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
    if (recipe_id) {
      where.recipe_id = recipe_id;
    }

    const runs = await ProductionRun.findAll({
      where,
      include: [
        {
          model: Recipe,
          as: 'recipe',
          attributes: ['id', 'code', 'name'],
        },
      ],
      order: [['production_date', 'DESC']],
    });

    const report = runs.map(run => ({
      production_run_id: run.id,
      batch_number: run.batch_number,
      production_date: run.production_date,
      recipe_name: run.recipe.name,
      expected_quantity: parseFloat(run.expected_quantity || 0).toFixed(2),
      actual_quantity: parseFloat(run.actual_quantity || 0).toFixed(2),
      waste_quantity: parseFloat(run.waste_quantity || 0).toFixed(2),
      waste_reason: run.waste_reason || 'N/A',
      yield_efficiency: parseFloat(run.yield_efficiency || 0).toFixed(2),
      variance: (
        parseFloat(run.actual_quantity || 0) - parseFloat(run.expected_quantity || 0)
      ).toFixed(2),
    }));

    // Calculate summary
    const summary = {
      total_runs: report.length,
      average_efficiency:
        report.length > 0
          ? (
              report.reduce((sum, r) => sum + parseFloat(r.yield_efficiency), 0) / report.length
            ).toFixed(2)
          : '0.00',
      total_expected: report
        .reduce((sum, r) => sum + parseFloat(r.expected_quantity), 0)
        .toFixed(2),
      total_actual: report.reduce((sum, r) => sum + parseFloat(r.actual_quantity), 0).toFixed(2),
      total_waste: report.reduce((sum, r) => sum + parseFloat(r.waste_quantity), 0).toFixed(2),
    };

    return successResponse(res, {
      summary,
      details: report,
    });
  } catch (error) {
    console.error('Error generating efficiency report:', error);
    return errorResponse(res, 'Failed to generate efficiency report', 500);
  }
};
