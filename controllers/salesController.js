const {
  SalesInvoice,
  InvoiceItem,
  Outlet,
  Employee,
  Route,
  ProductSku,
  Product,
  User,
  sequelize,
} = require('../models');
const { successResponse, errorResponse } = require('../utils/response');
const { generateInvoiceNumber } = require('../utils/invoiceNumberGenerator');
const { Op } = require('sequelize');

// Get all sales invoices with pagination, search, and filters
exports.getAllInvoices = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      outlet_id = '',
      sales_ref_id = '',
      route_id = '',
      payment_status = '',
      payment_method = '',
      start_date = '',
      end_date = '',
    } = req.query;

    const offset = (page - 1) * limit;
    const where = {};

    // Search by invoice number
    if (search) {
      where.invoice_number = { [Op.like]: `%${search}%` };
    }

    // Filter by outlet
    if (outlet_id) {
      where.outlet_id = outlet_id;
    }

    // Filter by sales ref
    if (sales_ref_id) {
      where.sales_ref_id = sales_ref_id;
    }

    // Filter by route
    if (route_id) {
      where.route_id = route_id;
    }

    // Filter by payment status
    if (payment_status) {
      where.payment_status = payment_status;
    }

    // Filter by payment method
    if (payment_method) {
      where.payment_method = payment_method;
    }

    // Filter by date range
    if (start_date && end_date) {
      where.invoice_date = {
        [Op.between]: [start_date, end_date],
      };
    } else if (start_date) {
      where.invoice_date = { [Op.gte]: start_date };
    } else if (end_date) {
      where.invoice_date = { [Op.lte]: end_date };
    }

    const { count, rows } = await SalesInvoice.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        {
          model: Outlet,
          as: 'outlet',
          attributes: ['id', 'code', 'name', 'owner_name', 'balance'],
        },
        {
          model: Employee,
          as: 'sales_ref',
          attributes: ['id', 'code', 'name', 'type'],
        },
        {
          model: Route,
          as: 'route',
          attributes: ['id', 'code', 'name'],
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'role'],
        },
      ],
      order: [
        ['invoice_date', 'DESC'],
        ['created_at', 'DESC'],
      ],
    });

    return successResponse(res, {
      invoices: rows,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / limit),
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return errorResponse(res, 'Failed to fetch invoices', 500);
  }
};

// Get single invoice by ID with items
exports.getInvoiceById = async (req, res) => {
  try {
    const { id } = req.params;

    const invoice = await SalesInvoice.findByPk(id, {
      include: [
        {
          model: Outlet,
          as: 'outlet',
          attributes: [
            'id',
            'code',
            'name',
            'owner_name',
            'phone',
            'address',
            'balance',
            'credit_limit',
          ],
        },
        {
          model: Employee,
          as: 'sales_ref',
          attributes: ['id', 'code', 'name', 'type'],
        },
        {
          model: Route,
          as: 'route',
          attributes: ['id', 'code', 'name'],
        },
        {
          model: InvoiceItem,
          as: 'items',
          include: [
            {
              model: ProductSku,
              as: 'sku',
              attributes: ['id', 'size', 'unit', 'barcode', 'price'],
              include: [
                {
                  model: Product,
                  as: 'product',
                  attributes: ['id', 'code', 'name', 'category'],
                },
              ],
            },
          ],
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'role'],
        },
      ],
    });

    if (!invoice) {
      return errorResponse(res, 'Invoice not found', 404);
    }

    return successResponse(res, invoice);
  } catch (error) {
    console.error('Error fetching invoice:', error);
    return errorResponse(res, 'Failed to fetch invoice', 500);
  }
};

// Create new sales invoice
exports.createInvoice = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      outlet_id,
      sales_ref_id,
      route_id,
      invoice_date,
      items, // Array of { sku_id, quantity, unit_price, discount_percent, is_return, return_reason, return_to_stock }
      payment_method,
      check_number,
      check_date,
      notes,
    } = req.body;

    // Validate outlet exists
    const outlet = await Outlet.findByPk(outlet_id);
    if (!outlet) {
      await transaction.rollback();
      return errorResponse(res, 'Outlet not found', 404);
    }

    // Validate sales ref if provided
    if (sales_ref_id) {
      const salesRef = await Employee.findByPk(sales_ref_id);
      if (!salesRef) {
        await transaction.rollback();
        return errorResponse(res, 'Sales ref not found', 404);
      }
    }

    // Validate items array
    if (!items || items.length === 0) {
      await transaction.rollback();
      return errorResponse(res, 'Invoice must have at least one item', 400);
    }

    // Generate invoice number
    const invoice_number = await generateInvoiceNumber(new Date(invoice_date));

    // Calculate totals
    let subtotal = 0;
    let total_discount_amount = 0;

    const processedItems = [];

    for (const item of items) {
      // Validate SKU exists and has enough stock
      const sku = await ProductSku.findByPk(item.sku_id);
      if (!sku) {
        await transaction.rollback();
        return errorResponse(res, `Product SKU ${item.sku_id} not found`, 404);
      }

      // For sales items (not returns), check stock availability
      if (!item.is_return && sku.current_stock < item.quantity) {
        await transaction.rollback();
        return errorResponse(
          res,
          `Insufficient stock for SKU ${sku.id}. Available: ${sku.current_stock}, Required: ${item.quantity}`,
          400
        );
      }

      // Calculate line item amounts
      const line_subtotal = item.quantity * item.unit_price;
      const discount_percent = item.discount_percent || 0;
      const discount_amount = (line_subtotal * discount_percent) / 100;
      const line_total = line_subtotal - discount_amount;

      // For returns, amounts should be negative
      const finalQuantity = item.is_return ? -Math.abs(item.quantity) : item.quantity;
      const finalTotal = item.is_return ? -Math.abs(line_total) : line_total;

      subtotal += line_subtotal;
      total_discount_amount += discount_amount;

      processedItems.push({
        sku_id: item.sku_id,
        quantity: finalQuantity,
        unit_price: item.unit_price,
        discount_percent,
        discount_amount,
        total_amount: finalTotal,
        is_return: item.is_return || false,
        return_reason: item.return_reason || null,
        return_to_stock: item.return_to_stock || false,
      });
    }

    const total_amount = subtotal - total_discount_amount;

    // Determine payment status
    let payment_status = 'unpaid';
    if (payment_method === 'cash') {
      payment_status = 'paid';
    } else if (payment_method === 'check') {
      payment_status = check_number ? 'unpaid' : 'unpaid'; // Check needs clearance
    }

    // Create invoice
    const invoice = await SalesInvoice.create(
      {
        invoice_number,
        outlet_id,
        sales_ref_id: sales_ref_id || null,
        route_id: route_id || null,
        invoice_date,
        subtotal,
        discount_percent: 0, // Line-level discounts only for now
        discount_amount: total_discount_amount,
        total_amount,
        payment_method,
        payment_status,
        check_number: check_number || null,
        check_date: check_date || null,
        notes: notes || null,
        created_by: req.user.id,
      },
      { transaction }
    );

    // Create invoice items and update stock
    for (const item of processedItems) {
      await InvoiceItem.create(
        {
          invoice_id: invoice.id,
          ...item,
        },
        { transaction }
      );

      // Update product SKU stock
      const sku = await ProductSku.findByPk(item.sku_id);

      if (item.is_return) {
        // For returns: if return_to_stock is true, add back to stock; otherwise, don't change stock
        if (item.return_to_stock) {
          sku.current_stock += Math.abs(item.quantity); // Add back (quantity is negative, so use abs)
        }
      } else {
        // For sales: reduce stock
        sku.current_stock -= item.quantity;
      }

      await sku.save({ transaction });
    }

    // Update outlet balance (for credit sales only)
    if (payment_method === 'credit') {
      outlet.balance += total_amount;
      await outlet.save({ transaction });
    }

    await transaction.commit();

    // Fetch the created invoice with associations
    const createdInvoice = await SalesInvoice.findByPk(invoice.id, {
      include: [
        { model: Outlet, as: 'outlet' },
        { model: Employee, as: 'sales_ref' },
        { model: Route, as: 'route' },
        { model: InvoiceItem, as: 'items', include: [{ model: ProductSku, as: 'sku' }] },
      ],
    });

    return successResponse(res, createdInvoice, 201);
  } catch (error) {
    await transaction.rollback();
    console.error('Error creating invoice:', error);
    return errorResponse(res, error.message || 'Failed to create invoice', 500);
  }
};

// Update sales invoice
exports.updateInvoice = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { notes, payment_status } = req.body;

    const invoice = await SalesInvoice.findByPk(id);
    if (!invoice) {
      await transaction.rollback();
      return errorResponse(res, 'Invoice not found', 404);
    }

    // Only allow updating notes and payment status (not items or amounts)
    if (notes !== undefined) invoice.notes = notes;
    if (payment_status !== undefined) invoice.payment_status = payment_status;

    await invoice.save({ transaction });
    await transaction.commit();

    const updatedInvoice = await SalesInvoice.findByPk(id, {
      include: [
        { model: Outlet, as: 'outlet' },
        { model: Employee, as: 'sales_ref' },
        { model: Route, as: 'route' },
        { model: InvoiceItem, as: 'items' },
      ],
    });

    return successResponse(res, updatedInvoice);
  } catch (error) {
    await transaction.rollback();
    console.error('Error updating invoice:', error);
    return errorResponse(res, 'Failed to update invoice', 500);
  }
};

// Delete sales invoice (soft delete - reverse stock movements)
exports.deleteInvoice = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    const invoice = await SalesInvoice.findByPk(id, {
      include: [{ model: InvoiceItem, as: 'items' }],
    });

    if (!invoice) {
      await transaction.rollback();
      return errorResponse(res, 'Invoice not found', 404);
    }

    // Reverse stock movements
    for (const item of invoice.items) {
      const sku = await ProductSku.findByPk(item.sku_id);

      if (item.is_return) {
        // Reverse return: if was returned to stock, remove it again
        if (item.return_to_stock) {
          sku.current_stock -= Math.abs(item.quantity);
        }
      } else {
        // Reverse sale: add stock back
        sku.current_stock += Math.abs(item.quantity);
      }

      await sku.save({ transaction });
    }

    // Reverse outlet balance (for credit sales)
    if (invoice.payment_method === 'credit') {
      const outlet = await Outlet.findByPk(invoice.outlet_id);
      outlet.balance -= invoice.total_amount;
      await outlet.save({ transaction });
    }

    // Delete invoice (cascade will delete items)
    await invoice.destroy({ transaction });

    await transaction.commit();

    return successResponse(res, { message: 'Invoice deleted successfully' });
  } catch (error) {
    await transaction.rollback();
    console.error('Error deleting invoice:', error);
    return errorResponse(res, 'Failed to delete invoice', 500);
  }
};

// Get invoice PDF (placeholder for future implementation)
exports.getInvoicePDF = async (req, res) => {
  try {
    return errorResponse(res, 'PDF generation not yet implemented', 501);
  } catch (error) {
    console.error('Error generating PDF:', error);
    return errorResponse(res, 'Failed to generate PDF', 500);
  }
};
