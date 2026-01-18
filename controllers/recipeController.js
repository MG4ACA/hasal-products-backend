const { Recipe, RecipeItem, RawMaterial } = require('../models');
const { successResponse, errorResponse } = require('../utils/response');
const { Op } = require('sequelize');
const db = require('../models');

/**
 * Get all recipes with pagination and search
 * GET /api/recipes
 */
exports.getAllRecipes = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', is_active = '' } = req.query;
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

    // Active status filter
    if (is_active !== '') {
      where.is_active = is_active === 'true' || is_active === '1';
    }

    const { count, rows } = await Recipe.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        {
          model: RecipeItem,
          as: 'items',
          include: [
            {
              model: RawMaterial,
              as: 'material',
              attributes: ['id', 'code', 'name', 'unit'],
            },
          ],
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
          include: [
            {
              model: RawMaterial,
              as: 'material',
              attributes: ['id', 'code', 'name', 'unit'],
            },
          ],
        },
      ],
    });

    if (!recipe) {
      return errorResponse(res, 'Recipe not found', 404);
    }

    // Calculate total cost
    const totalCost = recipe.items.reduce((sum, item) => {
      const cost = parseFloat(item.material.cost || 0) * parseFloat(item.quantity || 0);
      return sum + cost;
    }, 0);

    const recipeData = {
      ...recipe.toJSON(),
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
    const { code, name, expected_yield, yield_unit, notes = '', items = [] } = req.body;

    // Validation
    if (!code) {
      await transaction.rollback();
      return errorResponse(res, 'Recipe code is required', 400);
    }

    if (!name) {
      await transaction.rollback();
      return errorResponse(res, 'Recipe name is required', 400);
    }

    if (!expected_yield || expected_yield <= 0) {
      await transaction.rollback();
      return errorResponse(res, 'Valid expected yield is required', 400);
    }

    if (!yield_unit) {
      await transaction.rollback();
      return errorResponse(res, 'Yield unit is required', 400);
    }

    // Check if recipe code already exists
    const existingRecipe = await Recipe.findOne({
      where: { code },
    });

    if (existingRecipe) {
      await transaction.rollback();
      return errorResponse(res, 'Recipe code already exists', 400);
    }

    // Create recipe with version 1
    const recipe = await Recipe.create(
      {
        code,
        name,
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
      for (const item of items) {
        if (!item.material_id || !item.quantity) {
          await transaction.rollback();
          return errorResponse(res, 'Each item must have material_id and quantity', 400);
        }

        // Check if material exists
        const material = await RawMaterial.findByPk(item.material_id);
        if (!material) {
          await transaction.rollback();
          return errorResponse(res, `Raw material with ID ${item.material_id} not found`, 404);
        }

        await RecipeItem.create(
          {
            recipe_id: recipe.id,
            material_id: item.material_id,
            quantity: item.quantity,
            unit: item.unit || material.unit,
          },
          { transaction }
        );
      }
    }

    await transaction.commit();

    // Fetch created recipe with items
    const createdRecipe = await Recipe.findByPk(recipe.id, {
      include: [
        {
          model: RecipeItem,
          as: 'items',
          include: [
            {
              model: RawMaterial,
              as: 'material',
              attributes: ['id', 'code', 'name', 'unit'],
            },
          ],
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

    // Create new version
    const newVersion = currentRecipe.version + 1;

    const newRecipe = await Recipe.create(
      {
        code: currentRecipe.code,
        name: name || currentRecipe.name,
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
      for (const item of items) {
        if (!item.material_id || !item.quantity) {
          await transaction.rollback();
          return errorResponse(res, 'Each item must have material_id and quantity', 400);
        }

        // Check if material exists
        const material = await RawMaterial.findByPk(item.material_id);
        if (!material) {
          await transaction.rollback();
          return errorResponse(res, `Raw material with ID ${item.material_id} not found`, 404);
        }

        await RecipeItem.create(
          {
            recipe_id: newRecipe.id,
            material_id: item.material_id,
            quantity: item.quantity,
            unit: item.unit || material.unit,
          },
          { transaction }
        );
      }
    }

    await transaction.commit();

    // Fetch created recipe with items
    const updatedRecipe = await Recipe.findByPk(newRecipe.id, {
      include: [
        {
          model: RecipeItem,
          as: 'items',
          include: [
            {
              model: RawMaterial,
              as: 'material',
              attributes: ['id', 'code', 'name', 'unit'],
            },
          ],
        },
      ],
    });

    return successResponse(res, updatedRecipe);
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
          include: [
            {
              model: RawMaterial,
              as: 'material',
              attributes: ['id', 'code', 'name'],
            },
          ],
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
