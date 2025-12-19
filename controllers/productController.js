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
        { product_code: { [Op.like]: `%${search}%` } },
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
          attributes: ['id', 'size', 'unit', 'barcode', 'price', 'current_stock', 'status'],
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
          attributes: ['id', 'size', 'unit', 'barcode', 'price', 'current_stock', 'status'],
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

    // Generate product code
    const lastProduct = await Product.findOne({
      order: [['id', 'DESC']],
    });

    let productCode = 'PROD001';
    if (lastProduct && lastProduct.product_code) {
      const lastNumber = parseInt(lastProduct.product_code.replace('PROD', ''));
      const nextNumber = lastNumber + 1;
      productCode = `PROD${String(nextNumber).padStart(3, '0')}`;
    }

    // Create product
    const product = await Product.create({
      product_code: productCode,
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
    const { size, unit, barcode, price, status } = req.body;

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

    // Update SKU
    await sku.update({
      size: size || sku.size,
      unit: unit || sku.unit,
      barcode: barcode || sku.barcode,
      price: price || sku.price,
      status: status || sku.status,
    });

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
