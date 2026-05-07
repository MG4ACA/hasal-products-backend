const {
  Recipe,
  RecipeItem,
  RawMaterial,
  Product,
  ProductSku,
  ProductionRun,
} = require('../models');
const { successResponse, errorResponse } = require('../utils/response');
const { Op } = require('sequelize');
const db = require('../models');

/**
 * Standard include for RecipeItem with both raw material and product SKU
 */
const recipeItemInclude = [
  {
    model: RawMaterial,
    as: 'material',
    attributes: ['id', 'code', 'name', 'unit'],
    required: false,
  },
  {
    model: ProductSku,
    as: 'productSku',
    required: false,
    attributes: ['id', 'size', 'unit', 'price', 'average_cost', 'current_stock'],
    include: [
      {
        model: Product,
        as: 'product',
        attributes: ['id', 'code', 'name'],
      },
    ],
  },
];

/**
 * Create recipe items (handles both raw_material and finished_product types)
 */
const createRecipeItems = async (recipeId, items, transaction) => {
  for (const item of items) {
    const type = item.material_type || 'raw_material';

    if (type === 'finished_product') {
      if (!item.product_sku_id || !item.quantity) {
        throw new Error('Each finished_product item must have product_sku_id and quantity');
      }
      const sku = await ProductSku.findByPk(item.product_sku_id, { transaction });
      if (!sku) {
        throw new Error(`Product SKU with ID ${item.product_sku_id} not found`);
      }
      await RecipeItem.create(
        {
          recipe_id: recipeId,
          material_type: 'finished_product',
          material_id: null,
          product_sku_id: item.product_sku_id,
          quantity: item.quantity,
          unit: item.unit || sku.unit,
          unit_cost: item.unit_cost != null ? item.unit_cost : parseFloat(sku.price || 0),
        },
        { transaction }
      );
    } else {
      if (!item.material_id || !item.quantity) {
        throw new Error('Each raw_material item must have material_id and quantity');
      }
      const material = await RawMaterial.findByPk(item.material_id, { transaction });
      if (!material) {
        throw new Error(`Raw material with ID ${item.material_id} not found`);
      }
      await RecipeItem.create(
        {
          recipe_id: recipeId,
          material_type: 'raw_material',
          material_id: item.material_id,
          product_sku_id: null,
          quantity: item.quantity,
          unit: item.unit || material.unit,
          unit_cost: null,
        },
        { transaction }
      );
    }
  }
};

/**
 * Calculate weighted average cost for a material from receipt batches only
 * @param {number} materialId - Raw material ID
 * @returns {Promise<number>} Average cost or 0 if no receipt batches
 */
const calculateAverageCost = async materialId => {
  try {
    const costResult = await db.sequelize.query(
      `SELECT SUM(quantity * unit_cost) / SUM(quantity) as avg_cost
       FROM raw_material_batches
       WHERE material_id = ? AND batch_type = 'receipt'`,
      {
        replacements: [materialId],
        type: db.sequelize.QueryTypes.SELECT,
      }
    );
    return parseFloat(costResult[0]?.avg_cost || 0);
  } catch (error) {
    console.error('Error calculating average cost:', error);
    return 0;
  }
};

/**
 * Get all recipes with pagination and search
 * GET /api/recipes
 */
exports.getAllRecipes = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', is_active = '', product_id = '' } = req.query;
    const offset = (page - 1) * limit;

    const where = {};

    // Search filter
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { code: { [Op.like]: `%${search}%` } },
        { notes: { [Op.like]: `%${search}%` } },
      ];
    }

    // Active status filter - convert 'active'/'inactive' strings to boolean
    if (is_active !== '') {
      if (is_active === 'active') {
        where.is_active = true;
      } else if (is_active === 'inactive') {
        where.is_active = false;
      } else {
        // Also support 'true'/'false' and '1'/'0' for backwards compatibility
        where.is_active = is_active === 'true' || is_active === '1';
      }
    }

    // Product filter
    if (product_id !== '') {
      where.product_id = parseInt(product_id);
    }

    const { count, rows } = await Recipe.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        {
          model: RecipeItem,
          as: 'items',
          include: recipeItemInclude,
        },
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'code', 'name'],
        },
        {
          model: ProductSku,
          as: 'productSku',
          attributes: ['id', 'size', 'unit', 'price'],
        },
      ],
      order: [
        ['code', 'ASC'],
        ['version', 'DESC'],
      ],
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
    console.error('Error fetching recipes:', error);
    return errorResponse(res, 'Failed to fetch recipes', 500);
  }
};

/**
 * Get recipe by ID with all items (BOM)
 * GET /api/recipes/:id
 */
exports.getRecipeById = async (req, res) => {
  try {
    const { id } = req.params;

    const recipe = await Recipe.findByPk(id, {
      include: [
        {
          model: RecipeItem,
          as: 'items',
          include: recipeItemInclude,
        },
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'code', 'name'],
        },
        {
          model: ProductSku,
          as: 'productSku',
          attributes: ['id', 'size', 'unit', 'price'],
        },
      ],
    });

    if (!recipe) {
      return errorResponse(res, 'Recipe not found', 404);
    }

    // Add average_cost for each material in the BOM and calculate costs
    let totalCost = 0;
    const itemsWithCosts = [];

    if (recipe.items && recipe.items.length > 0) {
      for (const item of recipe.items) {
        if (item.material_type === 'finished_product') {
          const unitCost = parseFloat(item.unit_cost || item.productSku?.price || 0);
          const itemCost = unitCost * parseFloat(item.quantity || 0);
          totalCost += itemCost;
          itemsWithCosts.push({
            ...item.toJSON(),
            cost: itemCost,
          });
        } else {
          const averageCost = item.material ? await calculateAverageCost(item.material.id) : 0;
          const itemCost = parseFloat(averageCost || 0) * parseFloat(item.quantity || 0);
          totalCost += itemCost;
          itemsWithCosts.push({
            ...item.toJSON(),
            material: item.material
              ? { ...item.material.toJSON(), average_cost: averageCost }
              : null,
          });
        }
      }
    }

    const recipeData = {
      ...recipe.toJSON(),
      items: itemsWithCosts,
      total_cost: totalCost.toFixed(2),
      cost_per_unit:
        recipe.expected_yield > 0 ? (totalCost / recipe.expected_yield).toFixed(2) : '0.00',
    };

    return successResponse(res, recipeData);
  } catch (error) {
    console.error('Error fetching recipe:', error);
    return errorResponse(res, 'Failed to fetch recipe', 500);
  }
};

/**
 * Create new recipe (version 1)
 * POST /api/recipes
 */
exports.createRecipe = async (req, res) => {
  const transaction = await db.sequelize.transaction();

  try {
    const {
      name,
      expected_yield,
      yield_unit,
      notes = '',
      items = [],
      product_id,
      product_sku_id,
    } = req.body;

    // Validation
    if (!name) {
      await transaction.rollback();
      return errorResponse(res, 'Recipe name is required', 400);
    }

    if (!product_id) {
      await transaction.rollback();
      return errorResponse(res, 'Product is required', 400);
    }

    // Verify product exists
    const product = await Product.findByPk(product_id);
    if (!product) {
      await transaction.rollback();
      return errorResponse(res, 'Product not found', 404);
    }

    // Verify SKU exists and belongs to product (only if provided)
    if (product_sku_id) {
      const sku = await ProductSku.findOne({
        where: { id: product_sku_id, product_id: product_id },
      });
      if (!sku) {
        await transaction.rollback();
        return errorResponse(
          res,
          'Product SKU not found or does not belong to selected product',
          404
        );
      }
    }

    if (!expected_yield || expected_yield <= 0) {
      await transaction.rollback();
      return errorResponse(res, 'Valid expected yield is required', 400);
    }

    if (!yield_unit) {
      await transaction.rollback();
      return errorResponse(res, 'Yield unit is required', 400);
    }

    // Generate recipe code - find the highest number in ALL existing codes
    const allRecipes = await Recipe.findAll({
      attributes: ['code'],
      order: [['id', 'DESC']],
      transaction,
    });

    let maxNumber = 0;
    allRecipes.forEach(recipe => {
      if (recipe.code) {
        const codeMatch = recipe.code.match(/(\d+)$/);
        if (codeMatch) {
          const num = parseInt(codeMatch[1], 10);
          if (!isNaN(num) && num > maxNumber) {
            maxNumber = num;
          }
        }
      }
    });

    const nextNumber = maxNumber + 1;
    const generatedCode = `RECIPE${String(nextNumber).padStart(3, '0')}`;

    // Create recipe with version 1
    const recipe = await Recipe.create(
      {
        code: generatedCode,
        name,
        product_id,
        product_sku_id,
        version: 1,
        expected_yield,
        yield_unit,
        is_active: true,
        notes,
      },
      { transaction }
    );

    // Create recipe items if provided
    if (items && items.length > 0) {
      try {
        await createRecipeItems(recipe.id, items, transaction);
      } catch (err) {
        await transaction.rollback();
        return errorResponse(res, err.message, 400);
      }
    }

    await transaction.commit();

    // Fetch created recipe with items
    const createdRecipe = await Recipe.findByPk(recipe.id, {
      include: [
        {
          model: RecipeItem,
          as: 'items',
          include: recipeItemInclude,
        },
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'code', 'name'],
        },
        {
          model: ProductSku,
          as: 'productSku',
          attributes: ['id', 'size', 'unit', 'price'],
        },
      ],
    });

    return successResponse(res, createdRecipe, 201);
  } catch (error) {
    await transaction.rollback();
    console.error('Error creating recipe:', error);
    return errorResponse(res, 'Failed to create recipe', 500);
  }
};

/**
 * Update recipe (creates new version)
 * PUT /api/recipes/:id
 */
exports.updateRecipe = async (req, res) => {
  const transaction = await db.sequelize.transaction();

  try {
    const { id } = req.params;
    const { name, expected_yield, yield_unit, notes, items = [] } = req.body;

    const currentRecipe = await Recipe.findByPk(id);

    if (!currentRecipe) {
      await transaction.rollback();
      return errorResponse(res, 'Recipe not found', 404);
    }

    // Mark current recipe as inactive
    await currentRecipe.update({ is_active: false }, { transaction });

    // Find the actual max version for this recipe code to avoid duplicate entry on retry
    const maxVersionRecipe = await Recipe.findOne({
      where: { code: currentRecipe.code },
      order: [['version', 'DESC']],
      transaction,
    });
    const newVersion = (maxVersionRecipe ? maxVersionRecipe.version : currentRecipe.version) + 1;

    const newRecipe = await Recipe.create(
      {
        code: currentRecipe.code,
        name: name || currentRecipe.name,
        product_id: currentRecipe.product_id,
        product_sku_id: currentRecipe.product_sku_id,
        version: newVersion,
        expected_yield: expected_yield || currentRecipe.expected_yield,
        yield_unit: yield_unit || currentRecipe.yield_unit,
        is_active: true,
        notes: notes !== undefined ? notes : currentRecipe.notes,
      },
      { transaction }
    );

    // Create new recipe items
    if (items && items.length > 0) {
      try {
        await createRecipeItems(newRecipe.id, items, transaction);
      } catch (err) {
        await transaction.rollback();
        return errorResponse(res, err.message, 400);
      }
    }

    await transaction.commit();

    // Fetch created recipe with items and calculate costs
    const updatedRecipe = await Recipe.findByPk(newRecipe.id, {
      include: [
        {
          model: RecipeItem,
          as: 'items',
          include: recipeItemInclude,
        },
      ],
    });

    const recipeData = {
      ...updatedRecipe.toJSON(),
    };

    return successResponse(res, recipeData);
  } catch (error) {
    await transaction.rollback();
    console.error('Error updating recipe:', error);
    return errorResponse(res, 'Failed to update recipe', 500);
  }
};

/**
 * Delete recipe
 * DELETE /api/recipes/:id
 */
exports.deleteRecipe = async (req, res) => {
  try {
    const { id } = req.params;

    const recipe = await Recipe.findByPk(id);

    if (!recipe) {
      return errorResponse(res, 'Recipe not found', 404);
    }

    // Block if recipe has been used in any production run
    const productionRunCount = await ProductionRun.count({
      where: { recipe_id: id },
    });
    if (productionRunCount > 0) {
      return errorResponse(
        res,
        'Cannot delete: this recipe has been used in production records.',
        400
      );
    }

    // Delete all recipe items first
    await RecipeItem.destroy({ where: { recipe_id: id } });

    // Delete recipe
    await recipe.destroy();

    return successResponse(res, { message: 'Recipe deleted successfully' });
  } catch (error) {
    console.error('Error deleting recipe:', error);
    return errorResponse(res, 'Failed to delete recipe', 500);
  }
};

/**
 * Get version history for a product/SKU
 * GET /api/recipes/:id/versions
 */
exports.getRecipeVersions = async (req, res) => {
  try {
    const { id } = req.params;

    const recipe = await Recipe.findByPk(id);

    if (!recipe) {
      return errorResponse(res, 'Recipe not found', 404);
    }

    // Get all versions for this recipe code
    const versions = await Recipe.findAll({
      where: {
        code: recipe.code,
      },
      include: [
        {
          model: RecipeItem,
          as: 'items',
          include: recipeItemInclude,
        },
      ],
      order: [['version', 'DESC']],
    });

    return successResponse(res, versions);
  } catch (error) {
    console.error('Error fetching recipe versions:', error);
    return errorResponse(res, 'Failed to fetch recipe versions', 500);
  }
};

/**
 * Add item to recipe
 * POST /api/recipes/:id/items
 */
exports.addRecipeItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { material_id, quantity, unit } = req.body;

    // Validation
    if (!material_id || !quantity) {
      return errorResponse(res, 'Raw material ID and quantity are required', 400);
    }

    const recipe = await Recipe.findByPk(id);

    if (!recipe) {
      return errorResponse(res, 'Recipe not found', 404);
    }

    // Check if raw material exists
    const rawMaterial = await RawMaterial.findByPk(material_id);
    if (!rawMaterial) {
      return errorResponse(res, 'Raw material not found', 404);
    }

    // Create recipe item
    const item = await RecipeItem.create({
      recipe_id: id,
      material_id,
      quantity,
      unit: unit || rawMaterial.unit,
    });

    // Fetch with raw material details
    const createdItem = await RecipeItem.findByPk(item.id, {
      include: [
        {
          model: RawMaterial,
          as: 'material',
          attributes: ['id', 'code', 'name', 'unit'],
        },
      ],
    });

    return successResponse(res, createdItem, 201);
  } catch (error) {
    console.error('Error adding recipe item:', error);
    return errorResponse(res, 'Failed to add recipe item', 500);
  }
};

/**
 * Update recipe item
 * PUT /api/recipes/:recipeId/items/:itemId
 */
exports.updateRecipeItem = async (req, res) => {
  try {
    const { recipeId, itemId } = req.params;
    const { quantity, unit } = req.body;

    const item = await RecipeItem.findOne({
      where: { id: itemId, recipe_id: recipeId },
    });

    if (!item) {
      return errorResponse(res, 'Recipe item not found', 404);
    }

    // Update item
    await item.update({
      quantity,
      unit,
    });

    // Fetch updated item with raw material details
    const updatedItem = await RecipeItem.findByPk(itemId, {
      include: [
        {
          model: RawMaterial,
          as: 'material',
          attributes: ['id', 'code', 'name', 'unit'],
        },
      ],
    });

    return successResponse(res, updatedItem);
  } catch (error) {
    console.error('Error updating recipe item:', error);
    return errorResponse(res, 'Failed to update recipe item', 500);
  }
};

/**
 * Delete recipe item
 * DELETE /api/recipes/:recipeId/items/:itemId
 */
exports.deleteRecipeItem = async (req, res) => {
  try {
    const { recipeId, itemId } = req.params;

    const item = await RecipeItem.findOne({
      where: { id: itemId, recipe_id: recipeId },
    });

    if (!item) {
      return errorResponse(res, 'Recipe item not found', 404);
    }

    await item.destroy();

    return successResponse(res, { message: 'Recipe item deleted successfully' });
  } catch (error) {
    console.error('Error deleting recipe item:', error);
    return errorResponse(res, 'Failed to delete recipe item', 500);
  }
};
