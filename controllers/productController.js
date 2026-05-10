const { Product, ProductSku } = require('../models');
const { successResponse, errorResponse } = require('../utils/response');
const { Op } = require('sequelize');

/**
 * Get all products with pagination, search, and filters
 * GET /api/products
 */
exports.getAllProducts = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', status = '' } = req.query;
    const offset = (page - 1) * limit;

    const where = {};

    // Search filter
    if (search) {
      where[Op.or] = [
        { code: { [Op.like]: `%${search}%` } },
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
      ];
    }

    // Status filter
    if (status) {
      where.status = status;
    }

    const { count, rows } = await Product.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        {
          model: ProductSku,
          as: 'skus',
          attributes: [
            'id',
            'size',
            'unit',
            'barcode',
            'price',
            'current_stock',
            'status',
            'is_loose',
          ],
        },
      ],
      order: [['created_at', 'DESC']],
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
    console.error('Error fetching products:', error);
    return errorResponse(res, 'Failed to fetch products', 500);
  }
};

/**
 * Get product by ID with SKUs
 * GET /api/products/:id
 */
exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findByPk(id, {
      include: [
        {
          model: ProductSku,
          as: 'skus',
          attributes: [
            'id',
            'size',
            'unit',
            'barcode',
            'price',
            'current_stock',
            'status',
            'is_loose',
          ],
        },
      ],
    });

    if (!product) {
      return errorResponse(res, 'Product not found', 404);
    }

    return successResponse(res, product);
  } catch (error) {
    console.error('Error fetching product:', error);
    return errorResponse(res, 'Failed to fetch product', 500);
  }
};

/**
 * Create new product with auto-generated product code
 * POST /api/products
 */
exports.createProduct = async (req, res) => {
  try {
    const { name, description, category, status = 'active' } = req.body;

    // Validation
    if (!name) {
      return errorResponse(res, 'Product name is required', 400);
    }

    // Generate product code - find the highest number in existing codes
    const allProducts = await Product.findAll({
      attributes: ['code'],
      order: [['id', 'DESC']],
      limit: 100, // Check last 100 products
    });

    let maxNumber = 0;
    allProducts.forEach(product => {
      if (product.code) {
        const codeMatch = product.code.match(/(\d+)$/);
        if (codeMatch) {
          const num = parseInt(codeMatch[1], 10);
          if (!isNaN(num) && num > maxNumber) {
            maxNumber = num;
          }
        }
      }
    });

    const nextNumber = maxNumber + 1;
    const productCode = `PROD${String(nextNumber).padStart(3, '0')}`;

    // Create product
    const product = await Product.create({
      code: productCode,
      name,
      description,
      category,
      status,
    });

    // Fetch with SKUs
    const createdProduct = await Product.findByPk(product.id, {
      include: [
        {
          model: ProductSku,
          as: 'skus',
        },
      ],
    });

    return successResponse(res, createdProduct, 201);
  } catch (error) {
    console.error('Error creating product:', error);
    return errorResponse(res, 'Failed to create product', 500);
  }
};

/**
 * Update product
 * PUT /api/products/:id
 */
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, category, status } = req.body;

    const product = await Product.findByPk(id);

    if (!product) {
      return errorResponse(res, 'Product not found', 404);
    }

    // Update product
    await product.update({
      name,
      description,
      category,
      status,
    });

    // Fetch updated product with SKUs
    const updatedProduct = await Product.findByPk(id, {
      include: [
        {
          model: ProductSku,
          as: 'skus',
        },
      ],
    });

    return successResponse(res, updatedProduct);
  } catch (error) {
    console.error('Error updating product:', error);
    return errorResponse(res, 'Failed to update product', 500);
  }
};

/**
 * Delete product
 * DELETE /api/products/:id
 */
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findByPk(id);

    if (!product) {
      return errorResponse(res, 'Product not found', 404);
    }

    // Check if product has SKUs
    const skuCount = await ProductSku.count({ where: { product_id: id } });
    if (skuCount > 0) {
      return errorResponse(
        res,
        'Cannot delete product with existing SKUs. Delete SKUs first.',
        400
      );
    }

    await product.destroy();

    return successResponse(res, { message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    return errorResponse(res, 'Failed to delete product', 500);
  }
};

/**
 * Create a Loose/Bulk SKU for a product (no fixed size)
 * POST /api/products/:id/loose-sku
 */
exports.createLooseSku = async (req, res) => {
  try {
    const { id } = req.params;
    const { unit } = req.body;

    if (!unit) {
      return errorResponse(res, 'Unit is required for loose SKU', 400);
    }

    const product = await Product.findByPk(id);
    if (!product) {
      return errorResponse(res, 'Product not found', 404);
    }

    // Enforce only one loose SKU per product
    const existingLoose = await ProductSku.findOne({
      where: { product_id: id, is_loose: true },
    });
    if (existingLoose) {
      return errorResponse(res, 'A loose SKU already exists for this product', 400);
    }

    const sku = await ProductSku.create({
      product_id: id,
      size: null,
      unit,
      price: 0,
      current_stock: 0,
      status: 'active',
      is_loose: true,
    });

    return successResponse(res, sku, 201);
  } catch (error) {
    console.error('Error creating loose SKU:', error.message);
    console.error('Error stack:', error.stack);
    if (error.errors) {
      console.error('Validation errors:', error.errors);
    }
    return errorResponse(res, `Failed to create loose SKU: ${error.message}`, 500);
  }
};

/**
 * Add SKU to product
 * POST /api/products/:id/skus
 */
exports.addSku = async (req, res) => {
  try {
    const { id } = req.params;
    const { size, unit, barcode, price, status = 'active' } = req.body;

    // Validation
    if (!size) {
      return errorResponse(res, 'SKU size is required', 400);
    }

    if (!unit) {
      return errorResponse(res, 'SKU unit is required', 400);
    }

    if (!price || price <= 0) {
      return errorResponse(res, 'Valid price is required', 400);
    }

    const product = await Product.findByPk(id);

    if (!product) {
      return errorResponse(res, 'Product not found', 404);
    }

    // Check if barcode is unique (if provided)
    if (barcode) {
      const existingBarcode = await ProductSku.findOne({ where: { barcode } });
      if (existingBarcode) {
        return errorResponse(res, 'Barcode already exists', 400);
      }
    }

    // Check if SKU with this size already exists for this product
    const existingSku = await ProductSku.findOne({
      where: { product_id: id, size },
    });

    if (existingSku) {
      return errorResponse(res, 'SKU with this size already exists for this product', 400);
    }

    // Create SKU
    const sku = await ProductSku.create({
      product_id: id,
      size,
      unit,
      barcode,
      price,
      current_stock: 0, // Initialize to 0
      status,
    });

    return successResponse(res, sku, 201);
  } catch (error) {
    console.error('Error adding SKU:', error);
    return errorResponse(res, 'Failed to add SKU', 500);
  }
};

/**
 * Update SKU
 * PUT /api/products/:productId/skus/:skuId
 */
exports.updateSku = async (req, res) => {
  try {
    const { productId, skuId } = req.params;
    const { size, unit, barcode, price, status, current_stock } = req.body;

    const sku = await ProductSku.findOne({
      where: { id: skuId, product_id: productId },
    });

    if (!sku) {
      return errorResponse(res, 'SKU not found', 404);
    }

    // Check barcode uniqueness if being updated
    if (barcode && barcode !== sku.barcode) {
      const existingBarcode = await ProductSku.findOne({
        where: { barcode, id: { [Op.ne]: skuId } },
      });
      if (existingBarcode) {
        return errorResponse(res, 'Barcode already exists', 400);
      }
    }

    // Update SKU (including current_stock if provided)
    const updateData = {
      size: size || sku.size,
      unit: unit || sku.unit,
      barcode: barcode || sku.barcode,
      price: price || sku.price,
      status: status || sku.status,
    };

    // Allow updating current_stock if provided (useful for testing/manual adjustments)
    if (typeof current_stock !== 'undefined') {
      updateData.current_stock = current_stock;
    }

    await sku.update(updateData);

    return successResponse(res, sku);
  } catch (error) {
    console.error('Error updating SKU:', error);
    return errorResponse(res, 'Failed to update SKU', 500);
  }
};

/**
 * Delete SKU
 * DELETE /api/products/:productId/skus/:skuId
 */
exports.deleteSku = async (req, res) => {
  try {
    const { productId, skuId } = req.params;

    const sku = await ProductSku.findOne({
      where: { id: skuId, product_id: productId },
    });

    if (!sku) {
      return errorResponse(res, 'SKU not found', 404);
    }

    // Check if SKU has stock
    if (sku.current_stock > 0) {
      return errorResponse(res, 'Cannot delete SKU with existing stock', 400);
    }

    await sku.destroy();

    return successResponse(res, { message: 'SKU deleted successfully' });
  } catch (error) {
    console.error('Error deleting SKU:', error);
    return errorResponse(res, 'Failed to delete SKU', 500);
  }
};

/**
 * Get stock for all SKUs of a product
 * GET /api/products/:id/stock
 */
exports.getProductStock = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findByPk(id, {
      include: [
        {
          model: ProductSku,
          as: 'skus',
          attributes: ['id', 'size', 'unit', 'current_stock', 'status'],
        },
      ],
    });

    if (!product) {
      return errorResponse(res, 'Product not found', 404);
    }

    const stockData = {
      product_id: product.id,
      product_code: product.product_code,
      product_name: product.name,
      skus: product.skus.map(sku => ({
        id: sku.id,
        size: sku.size,
        unit: sku.unit,
        current_stock: sku.current_stock,
        status: sku.status,
      })),
      total_stock: product.skus.reduce((sum, sku) => sum + parseFloat(sku.current_stock || 0), 0),
    };

    return successResponse(res, stockData);
  } catch (error) {
    console.error('Error fetching product stock:', error);
    return errorResponse(res, 'Failed to fetch product stock', 500);
  }
};

/**
 * Get profit analysis for specific SKU
 * GET /api/products/:productId/skus/:skuId/profit
 */
exports.getSkuProfit = async (req, res) => {
  try {
    const { productId, skuId } = req.params;

    const sku = await ProductSku.findOne({
      where: { id: skuId, product_id: productId },
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'code', 'name'],
        },
      ],
    });

    if (!sku) {
      return errorResponse(res, 'SKU not found', 404);
    }

    const sellingPrice = parseFloat(sku.price || 0);
    const avgCost = parseFloat(sku.average_cost || 0);
    const profit = sellingPrice - avgCost;
    const profitMargin = sellingPrice > 0 ? (profit / sellingPrice) * 100 : 0;

    const profitData = {
      product: {
        id: sku.product.id,
        code: sku.product.code,
        name: sku.product.name,
      },
      sku: {
        id: sku.id,
        size: sku.size,
        unit: sku.unit,
      },
      pricing: {
        selling_price: sellingPrice.toFixed(2),
        average_cost: avgCost.toFixed(2),
        profit_per_unit: profit.toFixed(2),
        profit_margin_percentage: profitMargin.toFixed(2),
      },
      inventory: {
        current_stock: parseFloat(sku.current_stock || 0),
        total_inventory_value: (parseFloat(sku.current_stock || 0) * avgCost).toFixed(2),
        total_potential_revenue: (parseFloat(sku.current_stock || 0) * sellingPrice).toFixed(2),
        total_potential_profit: (parseFloat(sku.current_stock || 0) * profit).toFixed(2),
      },
    };

    return successResponse(res, profitData);
  } catch (error) {
    console.error('Error calculating profit:', error);
    return errorResponse(res, 'Failed to calculate profit', 500);
  }
};

/**
 * Get profit summary for all products
 * GET /api/products/profit-summary
 */
exports.getProfitSummary = async (req, res) => {
  try {
    const products = await Product.findAll({
      where: { status: 'active' },
      include: [
        {
          model: ProductSku,
          as: 'skus',
          where: { status: 'active' },
          required: false,
        },
      ],
    });

    const profitSummary = products.map(product => {
      const skuAnalysis = product.skus.map(sku => {
        const sellingPrice = parseFloat(sku.price || 0);
        const avgCost = parseFloat(sku.average_cost || 0);
        const profit = sellingPrice - avgCost;
        const profitMargin = sellingPrice > 0 ? (profit / sellingPrice) * 100 : 0;
        const stock = parseFloat(sku.current_stock || 0);

        return {
          sku_id: sku.id,
          size: sku.size,
          selling_price: sellingPrice.toFixed(2),
          cost: avgCost.toFixed(2),
          profit: profit.toFixed(2),
          margin: profitMargin.toFixed(2),
          stock: stock,
          total_value: (stock * avgCost).toFixed(2),
          total_profit: (stock * profit).toFixed(2),
        };
      });

      const totalProfit = skuAnalysis.reduce((sum, sku) => sum + parseFloat(sku.total_profit), 0);
      const totalValue = skuAnalysis.reduce((sum, sku) => sum + parseFloat(sku.total_value), 0);

      return {
        product_id: product.id,
        product_code: product.code,
        product_name: product.name,
        skus: skuAnalysis,
        total_inventory_value: totalValue.toFixed(2),
        total_potential_profit: totalProfit.toFixed(2),
      };
    });

    return successResponse(res, profitSummary);
  } catch (error) {
    console.error('Error calculating profit summary:', error);
    return errorResponse(res, 'Failed to calculate profit summary', 500);
  }
};

/**
 * Get SKU profit analysis
 * GET /api/products/:productId/skus/:skuId/profit
 */
exports.getSkuProfit = async (req, res) => {
  try {
    const { productId, skuId } = req.params;

    const sku = await ProductSku.findOne({
      where: { id: skuId, product_id: productId },
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'code', 'name'],
        },
      ],
    });

    if (!sku) {
      return errorResponse(res, 'SKU not found', 404);
    }

    const sellingPrice = parseFloat(sku.price || 0);
    const avgCost = parseFloat(sku.average_cost || 0);
    const profit = sellingPrice - avgCost;
    const profitMargin = sellingPrice > 0 ? (profit / sellingPrice) * 100 : 0;
    const stock = parseFloat(sku.current_stock || 0);

    const profitAnalysis = {
      product_id: sku.product.id,
      product_code: sku.product.code,
      product_name: sku.product.name,
      sku_id: sku.id,
      size: sku.size,
      unit: sku.unit,
      barcode: sku.barcode,
      selling_price: sellingPrice.toFixed(2),
      average_cost: avgCost.toFixed(2),
      profit_per_unit: profit.toFixed(2),
      profit_margin_percent: profitMargin.toFixed(2),
      current_stock: stock,
      inventory_value: (stock * avgCost).toFixed(2),
      potential_profit: (stock * profit).toFixed(2),
    };

    return successResponse(res, profitAnalysis);
  } catch (error) {
    console.error('Error calculating SKU profit:', error);
    return errorResponse(res, 'Failed to calculate SKU profit', 500);
  }
};
